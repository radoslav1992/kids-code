// A kid-sized Python subset for Code Quest: tokenizer, parser, and tree-walking interpreter.
// Programs are parsed into a small tree and interpreted directly. Nothing is ever passed to
// eval, the Function constructor, or generated JavaScript.

export class QuestError extends Error {
  /** kind: 'syntax' (cannot be read), 'runtime' (stopped while running), 'crash' (game rule), 'limit' (runaway). */
  constructor(message, line = 0, kind = 'runtime') {
    super(message);
    this.line = line;
    this.kind = kind;
  }
}

const KEYWORDS = new Set(['for', 'in', 'while', 'if', 'elif', 'else', 'def', 'return', 'break', 'continue', 'pass', 'and', 'or', 'not', 'True', 'False', 'None']);
const TWO_CHAR = ['==', '!=', '<=', '>=', '//', '**', '+=', '-=', '*=', '/='];
const ONE_CHAR = '+-*/%<>=()[],:.';
const QUOTES = {'"': '"', "'": "'", '“': '"', '”': '"', '‘': "'", '’': "'"};
const MAX_SOURCE = 20000;

export function tokenize(source) {
  if (typeof source !== 'string') throw new QuestError('The program must be text.', 0, 'syntax');
  if (source.length > MAX_SOURCE) throw new QuestError('This program is too long for Bit to read. Try loops and functions to make it shorter.', 0, 'syntax');
  const tokens = [];
  const indents = [0];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  for (let n = 0; n < lines.length; n++) {
    const text = lines[n];
    const line = n + 1;
    let i = 0;
    let width = 0;
    while (i < text.length && (text[i] === ' ' || text[i] === '\t' || text[i] === ' ')) {
      width += text[i] === '\t' ? 4 : 1;
      i++;
    }
    if (i >= text.length || text[i] === '#') continue; // blank line or comment
    const top = indents[indents.length - 1];
    if (width > top) {
      indents.push(width);
      tokens.push({type: 'INDENT', line});
    } else if (width < top) {
      while (width < indents[indents.length - 1]) {
        indents.pop();
        tokens.push({type: 'DEDENT', line});
      }
      if (width !== indents[indents.length - 1]) {
        throw new QuestError('The spaces at the start of this line don’t line up with the lines above. Use 4 spaces for each step inward.', line, 'syntax');
      }
    }
    let depth = 0;
    while (i < text.length) {
      const ch = text[i];
      if (ch === ' ' || ch === '\t' || ch === ' ') { i++; continue; }
      if (ch === '#') break;
      if (/[0-9]/.test(ch)) {
        let j = i;
        while (j < text.length && /[0-9]/.test(text[j])) j++;
        if (text[j] === '.' && /[0-9]/.test(text[j + 1] || '')) {
          j++;
          while (j < text.length && /[0-9]/.test(text[j])) j++;
        }
        if (/[A-Za-z_]/.test(text[j] || '')) throw new QuestError(`"${text.slice(i, j + 1)}…" starts with a number. Names must start with a letter.`, line, 'syntax');
        tokens.push({type: 'NUMBER', value: Number(text.slice(i, j)), line});
        i = j;
        continue;
      }
      if (/[A-Za-z_]/.test(ch)) {
        let j = i;
        while (j < text.length && /[A-Za-z0-9_]/.test(text[j])) j++;
        const word = text.slice(i, j);
        tokens.push({type: KEYWORDS.has(word) ? 'KW' : 'NAME', value: word, line});
        i = j;
        continue;
      }
      if (QUOTES[ch]) {
        const close = QUOTES[ch];
        let j = i + 1;
        let value = '';
        let closed = false;
        while (j < text.length) {
          const c = text[j];
          if (c === '\\' && j + 1 < text.length) {
            const e = text[j + 1];
            value += e === 'n' ? '\n' : e === 't' ? '\t' : e;
            j += 2;
            continue;
          }
          // A straight quote is closed only by the same straight quote; a curly quote (typed by a tablet) by any quote of its family.
          if (ch === '"' || ch === "'" ? c === ch : QUOTES[c] === close) { closed = true; j++; break; }
          value += c;
          j++;
        }
        if (!closed) throw new QuestError('This text is missing its closing quote. Text needs a quote mark at both ends, like "hello".', line, 'syntax');
        tokens.push({type: 'STRING', value, line});
        i = j;
        continue;
      }
      const two = text.slice(i, i + 2);
      if (TWO_CHAR.includes(two)) { tokens.push({type: 'OP', value: two, line}); i += 2; continue; }
      if (ONE_CHAR.includes(ch)) {
        if (ch === '(' || ch === '[') depth++;
        if (ch === ')' || ch === ']') depth--;
        tokens.push({type: 'OP', value: ch, line});
        i++;
        continue;
      }
      if (ch === ';') throw new QuestError('Python doesn’t need a ; at the end of a line. Delete it and try again.', line, 'syntax');
      if (ch === '{' || ch === '}') throw new QuestError('Python uses a colon : and indented lines instead of { } braces.', line, 'syntax');
      throw new QuestError(`Bit doesn’t understand the symbol ${ch} here.`, line, 'syntax');
    }
    if (depth > 0) throw new QuestError('A bracket on this line was opened but never closed. Every ( needs a ) and every [ needs a ].', line, 'syntax');
    if (depth < 0) throw new QuestError('This line has a closing bracket with no opening bracket to match it.', line, 'syntax');
    tokens.push({type: 'NEWLINE', line});
  }
  const last = lines.length;
  while (indents.length > 1) { indents.pop(); tokens.push({type: 'DEDENT', line: last}); }
  tokens.push({type: 'EOF', line: last});
  return tokens;
}

const describeToken = tok => tok.type === 'NEWLINE' || tok.type === 'EOF' ? 'the end of the line' : tok.type === 'STRING' ? `"${tok.value}"` : tok.type === 'INDENT' || tok.type === 'DEDENT' ? 'the indentation' : `"${tok.value}"`;

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.i = 0;
    this.features = new Set();
    this.forDepth = 0;
    this.loopDepth = 0;
    this.defDepth = 0;
    this.depth = 0;
    this.blockDepth = 0;
  }
  peek() { return this.tokens[this.i]; }
  next() { return this.tokens[this.i++]; }
  is(type, value) { const t = this.peek(); return t.type === type && (value === undefined || t.value === value); }
  take(type, value) { if (this.is(type, value)) return this.next(); return null; }
  fail(message, line = this.peek().line) { throw new QuestError(message, line, 'syntax'); }

  program() {
    const body = [];
    while (!this.is('EOF')) body.push(this.statement());
    return body;
  }

  statement() {
    const tok = this.peek();
    if (tok.type === 'INDENT') this.fail('This line is indented, but the line above it doesn’t end with a colon. Remove the spaces at the start of this line.');
    if (tok.type === 'KW') {
      switch (tok.value) {
        case 'for': return this.forStatement();
        case 'while': return this.whileStatement();
        case 'if': return this.ifStatement();
        case 'def': return this.defStatement();
        case 'else':
        case 'elif': this.fail(`"${tok.value}" needs a matching "if" just above it, starting at the same indentation.`);
      }
    }
    return this.simpleStatement();
  }

  /** Statements that fit on one line and may follow a colon on the same line. */
  simpleStatement() {
    const tok = this.peek();
    const line = tok.line;
    if (tok.type === 'KW') {
      if (tok.value === 'pass') { this.next(); this.endLine(); return {type: 'Pass', line}; }
      if (tok.value === 'break' || tok.value === 'continue') {
        this.next();
        if (!this.loopDepth) this.fail(`"${tok.value}" only works inside a loop.`, line);
        this.endLine();
        return {type: tok.value === 'break' ? 'Break' : 'Continue', line};
      }
      if (tok.value === 'return') {
        this.next();
        if (!this.defDepth) this.fail('"return" only works inside a function (a def).', line);
        const value = this.is('NEWLINE') || this.is('EOF') ? null : this.expression();
        this.features.add('return');
        this.endLine();
        return {type: 'Return', value, line};
      }
      if (['for', 'while', 'if', 'def'].includes(tok.value)) this.fail(`Start "${tok.value}" on its own line.`);
    }
    const expr = this.expression();
    const op = this.peek();
    if (op.type === 'OP' && ['=', '+=', '-=', '*=', '/='].includes(op.value)) {
      if (expr.type !== 'Name' && expr.type !== 'Index') this.fail('The left side of = must be a variable name, like steps = 3.', line);
      this.next();
      const value = this.expression();
      this.features.add('assign');
      this.endLine();
      return {type: 'Assign', target: expr, op: op.value, value, line};
    }
    if (expr.type === 'Name') {
      if (op.type === 'NEWLINE' || op.type === 'EOF') this.fail(`To run a command, add parentheses: ${expr.name}()`, line);
      if (op.type === 'NUMBER' || op.type === 'STRING' || op.type === 'NAME') this.fail(`Put that inside parentheses, like ${expr.name}(${op.type === 'STRING' ? `"${op.value}"` : op.value})`, line);
    }
    this.endLine();
    return {type: 'Expr', expr, line};
  }

  endLine() {
    const tok = this.peek();
    if (tok.type === 'NEWLINE') { this.next(); return; }
    if (tok.type === 'EOF' || tok.type === 'DEDENT') return;
    if (tok.type === 'OP' && tok.value === ':') this.fail('This colon : doesn’t belong here. Colons go at the end of for, while, if, else, and def lines.');
    if (tok.type === 'OP' && tok.value === ')') this.fail('There is an extra ) on this line.');
    this.fail(`Bit got confused at ${describeToken(tok)}. Check this line for a missing bracket, comma, or symbol.`);
  }

  block(header, line) {
    const tok = this.peek();
    if (!(tok.type === 'OP' && tok.value === ':')) {
      if (tok.type === 'OP' && tok.value === '=') this.fail('To check if two things are equal, use two equals signs: ==', line);
      if (tok.type === 'NEWLINE' || tok.type === 'EOF') this.fail(`This "${header}" line needs a colon : at the end.`, line);
      this.fail(`Bit got confused at ${describeToken(tok)}. A "${header}" line ends with a colon :`, line);
    }
    this.next();
    if (this.take('NEWLINE')) {
      if (!this.is('INDENT')) {
        const nextTok = this.peek();
        if (nextTok.type === 'EOF' || nextTok.type === 'DEDENT') this.fail(`This "${header}" needs at least one indented line under it.`, line);
        this.fail(`This line belongs inside the "${header}" above it, so it needs to be indented. Add 4 spaces at the start.`, nextTok.line);
      }
      this.next();
      if (++this.blockDepth > 30) this.fail('This code is indented too deeply for Bit to follow.', line);
      const body = [];
      while (!this.is('DEDENT') && !this.is('EOF')) body.push(this.statement());
      this.take('DEDENT');
      this.blockDepth--;
      return body;
    }
    if (this.is('EOF') || this.is('DEDENT')) this.fail(`This "${header}" needs at least one indented line under it.`, line);
    return [this.simpleStatement()];
  }

  forStatement() {
    const line = this.next().line;
    const name = this.take('NAME');
    if (!name) this.fail('After "for" comes a variable name, like: for i in range(3):', line);
    if (!this.take('KW', 'in')) this.fail('A for loop needs the word "in", like: for i in range(3):', line);
    const iterable = this.expression();
    this.features.add('for');
    if (this.forDepth > 0) this.features.add('nested-for');
    this.forDepth++; this.loopDepth++;
    const body = this.block('for', line);
    this.forDepth--; this.loopDepth--;
    return {type: 'For', name: name.value, iterable, body, line};
  }

  whileStatement() {
    const line = this.next().line;
    const test = this.expression();
    this.features.add('while');
    this.loopDepth++;
    const body = this.block('while', line);
    this.loopDepth--;
    return {type: 'While', test, body, line};
  }

  ifStatement() {
    const line = this.next().line;
    const branches = [{test: this.expression(), body: null, line}];
    this.features.add('if');
    branches[0].body = this.block('if', line);
    let otherwise = null;
    for (;;) {
      const tok = this.peek();
      if (tok.type === 'KW' && tok.value === 'elif') {
        this.next();
        const branch = {test: this.expression(), body: null, line: tok.line};
        this.features.add('elif');
        branch.body = this.block('elif', tok.line);
        branches.push(branch);
        continue;
      }
      if (tok.type === 'KW' && tok.value === 'else') {
        this.next();
        if (this.is('KW', 'if')) this.fail('In Python, "else if" is written as one word: elif', tok.line);
        this.features.add('else');
        otherwise = this.block('else', tok.line);
      }
      break;
    }
    return {type: 'If', branches, otherwise, line};
  }

  defStatement() {
    const line = this.next().line;
    const name = this.take('NAME');
    if (!name) this.fail('After "def" comes the name of your new command, like: def hop():', line);
    if (!this.take('OP', '(')) this.fail(`A function name is followed by parentheses, like: def ${name.value}():`, line);
    const params = [];
    while (!this.is('OP', ')')) {
      const param = this.take('NAME');
      if (!param) this.fail('Inside the parentheses of def, list parameter names separated by commas, like: def hop(n):', line);
      if (params.includes(param.value)) this.fail(`The parameter "${param.value}" is listed twice.`, line);
      params.push(param.value);
      if (!this.take('OP', ',')) break;
    }
    if (!this.take('OP', ')')) this.fail('The parentheses after the function name were never closed.', line);
    this.features.add('def');
    if (params.length) this.features.add('param');
    // A function body starts fresh: break/continue can't reach a loop outside it.
    const saved = [this.loopDepth, this.forDepth];
    this.loopDepth = 0; this.forDepth = 0; this.defDepth++;
    const body = this.block('def', line);
    this.defDepth--; [this.loopDepth, this.forDepth] = saved;
    return {type: 'Def', name: name.value, params, body, line};
  }

  expression() {
    if (++this.depth > 40) this.fail('This line has too many brackets inside brackets for Bit to follow.');
    const node = this.orExpr();
    this.depth--;
    return node;
  }

  orExpr() {
    let left = this.andExpr();
    while (this.is('KW', 'or')) { const line = this.next().line; left = {type: 'Logic', op: 'or', left, right: this.andExpr(), line}; }
    return left;
  }
  andExpr() {
    let left = this.notExpr();
    while (this.is('KW', 'and')) { const line = this.next().line; left = {type: 'Logic', op: 'and', left, right: this.notExpr(), line}; }
    return left;
  }
  notExpr() {
    if (this.is('KW', 'not')) { const line = this.next().line; return {type: 'Not', value: this.notExpr(), line}; }
    return this.comparison();
  }
  comparison() {
    let left = this.sum();
    for (;;) {
      const tok = this.peek();
      let op = null;
      if (tok.type === 'OP' && ['==', '!=', '<', '>', '<=', '>='].includes(tok.value)) { op = tok.value; this.next(); }
      else if (tok.type === 'KW' && tok.value === 'in') { op = 'in'; this.next(); }
      else if (tok.type === 'KW' && tok.value === 'not' && this.tokens[this.i + 1]?.type === 'KW' && this.tokens[this.i + 1].value === 'in') { op = 'not in'; this.i += 2; }
      if (!op) return left;
      left = {type: 'Compare', op, left, right: this.sum(), line: tok.line};
    }
  }
  sum() {
    let left = this.product();
    while (this.is('OP', '+') || this.is('OP', '-')) { const tok = this.next(); left = {type: 'Binary', op: tok.value, left, right: this.product(), line: tok.line}; }
    return left;
  }
  product() {
    let left = this.unary();
    while (this.is('OP', '*') || this.is('OP', '/') || this.is('OP', '//') || this.is('OP', '%')) { const tok = this.next(); left = {type: 'Binary', op: tok.value, left, right: this.unary(), line: tok.line}; }
    return left;
  }
  unary() {
    if (this.is('OP', '-') || this.is('OP', '+')) { const tok = this.next(); return {type: 'Unary', op: tok.value, value: this.unary(), line: tok.line}; }
    return this.power();
  }
  power() {
    const base = this.postfix();
    if (this.is('OP', '**')) { const tok = this.next(); return {type: 'Binary', op: '**', left: base, right: this.unary(), line: tok.line}; }
    return base;
  }
  postfix() {
    let node = this.atom();
    for (;;) {
      const tok = this.peek();
      if (tok.type !== 'OP') return node;
      if (tok.value === '(') {
        this.next();
        const args = [];
        while (!this.is('OP', ')')) {
          args.push(this.expression());
          if (!this.take('OP', ',')) break;
        }
        if (!this.take('OP', ')')) this.fail('This command is missing its closing ).', tok.line);
        if (node.type === 'Name') {
          this.features.add('call:' + node.name);
          if (args.length) this.features.add('arg:' + node.name);
        }
        node = {type: 'Call', callee: node, args, line: tok.line};
      } else if (tok.value === '[') {
        this.next();
        const index = this.expression();
        if (!this.take('OP', ']')) this.fail('This index is missing its closing ].', tok.line);
        this.features.add('index');
        node = {type: 'Index', target: node, index, line: tok.line};
      } else if (tok.value === '.') {
        this.next();
        const name = this.take('NAME');
        if (!name) this.fail('After a dot comes a name, like my_list.append(3).', tok.line);
        node = {type: 'Attr', target: node, name: name.value, line: tok.line};
      } else return node;
    }
  }
  atom() {
    const tok = this.next();
    switch (tok.type) {
      case 'NUMBER': return {type: 'Const', value: tok.value, line: tok.line};
      case 'STRING': return {type: 'Const', value: tok.value, line: tok.line};
      case 'NAME': return {type: 'Name', name: tok.value, line: tok.line};
      case 'KW':
        if (tok.value === 'True') return {type: 'Const', value: true, line: tok.line};
        if (tok.value === 'False') return {type: 'Const', value: false, line: tok.line};
        if (tok.value === 'None') return {type: 'Const', value: null, line: tok.line};
        this.fail(`"${tok.value}" is a special Python word, so it can’t be used here.`, tok.line);
        break;
      case 'OP':
        if (tok.value === '(') {
          const inner = this.expression();
          if (!this.take('OP', ')')) this.fail('This ( is missing its closing ).', tok.line);
          return inner;
        }
        if (tok.value === '[') {
          const items = [];
          while (!this.is('OP', ']')) {
            items.push(this.expression());
            if (!this.take('OP', ',')) break;
          }
          if (!this.take('OP', ']')) this.fail('This list is missing its closing ]. Separate the items with commas.', tok.line);
          this.features.add('list');
          return {type: 'List', items, line: tok.line};
        }
        break;
    }
    this.i--;
    this.fail(tok.type === 'NEWLINE' || tok.type === 'EOF' || tok.type === 'DEDENT' ? 'This line stops too soon. Something is missing at the end.' : `Bit got confused at ${describeToken(tok)}.`, tok.line);
  }
}

/** Lines of real code: blank lines and comment-only lines are free. */
export function countLines(source) {
  return String(source).split('\n').filter(text => { const t = text.trim(); return t && !t.startsWith('#'); }).length;
}

export function parse(source) {
  const parser = new Parser(tokenize(source));
  const body = parser.program();
  return {body, features: parser.features, lines: countLines(source)};
}

// ---------- Values ----------

const isList = value => Array.isArray(value);
const isFunction = value => value !== null && typeof value === 'object' && !isList(value) && (value.kind === 'function' || value.kind === 'builtin');
export const typeName = value => value === null ? 'None' : typeof value === 'number' ? 'a number' : typeof value === 'string' ? 'text' : typeof value === 'boolean' ? 'True/False' : isList(value) ? 'a list' : 'a command';

function formatNumber(n) {
  if (Number.isInteger(n)) return String(n);
  if (!Number.isFinite(n)) return n > 0 ? 'inf' : n < 0 ? '-inf' : 'nan';
  return String(Number(n.toPrecision(12)));
}
export function show(value, nested = false, depth = 0) {
  if (value === null) return 'None';
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'string') return nested ? `'${value}'` : value;
  if (isList(value)) return depth > 4 ? '[...]' : '[' + value.map(item => show(item, true, depth + 1)).join(', ') + ']';
  return `<command ${value.name}>`;
}
const truthy = value => !(value === null || value === false || value === 0 || value === '' || (isList(value) && value.length === 0));
function equal(a, b, depth = 0) {
  if (isList(a) && isList(b)) return depth < 20 && a.length === b.length && a.every((item, i) => equal(item, b[i], depth + 1));
  if (typeof a === 'boolean' && typeof b === 'number') return Number(a) === b;
  if (typeof b === 'boolean' && typeof a === 'number') return a === Number(b);
  return a === b;
}

function editDistance(a, b) {
  const row = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return row[b.length];
}
const ALIASES = {forward: 'move', step: 'move', go: 'move', walk: 'move', left: 'turn_left', right: 'turn_right', turn: 'turn_left', repeat: 'for', loop: 'for', uturn: 'turn_around', back: 'turn_around'};
export function suggest(name, known) {
  const flat = text => text.toLowerCase().replace(/_/g, '');
  const target = flat(name);
  const exact = known.find(k => flat(k) === target);
  if (exact) return exact;
  if (ALIASES[target] && known.includes(ALIASES[target])) return ALIASES[target];
  let best = null;
  let bestScore = 3;
  for (const k of known) {
    const score = editDistance(target, flat(k));
    if (k.length >= 3 && target.length >= 3 && score < bestScore && score <= Math.floor(k.length / 2)) { best = k; bestScore = score; }
  }
  return best;
}

// ---------- Interpreter ----------

class Signal { constructor(type, value = null) { this.type = type; this.value = value; } }
const MAX_LIST = 2000;
const MAX_TEXT = 2000;
const MAX_DEPTH = 40;

/**
 * Run a parsed program.
 * host.commands: {name: (args, line) => value} game commands.
 * host.print(text, line): receives print() output.
 * host.maxSteps: statement budget before the run is stopped as a runaway.
 */
export function execute(program, host = {}) {
  const commands = host.commands || {};
  const maxSteps = host.maxSteps || 20000;
  const globals = new Map();
  const frames = [];
  let steps = 0;
  let line = 0;

  const fail = (message, at = line, kind = 'runtime') => { throw new QuestError(message, at, kind); };
  const tick = at => {
    line = at;
    if (++steps > maxSteps) fail('This program keeps going and going! Look for a loop that never ends.', at, 'limit');
  };
  const wholeNumber = (value, what, at) => {
    if (typeof value === 'boolean') return Number(value);
    if (typeof value !== 'number') fail(`${what} needs a number, but got ${typeName(value)}.`, at);
    if (!Number.isInteger(value)) fail(`${what} needs a whole number, but got ${formatNumber(value)}.`, at);
    return value;
  };
  const number = (value, what, at) => {
    if (typeof value === 'boolean') return Number(value);
    if (typeof value !== 'number') fail(`${what} needs a number, but got ${typeName(value)}.`, at);
    return value;
  };
  const checkSize = (value, at) => {
    if (isList(value) && value.length > MAX_LIST) fail('That list is too big for Bit to carry.', at, 'limit');
    if (typeof value === 'string' && value.length > MAX_TEXT) fail('That text is too long for Bit to carry.', at, 'limit');
    return value;
  };

  const builtins = {
    range(args, at) {
      if (args.length < 1 || args.length > 3) fail('range() needs 1 to 3 numbers, like range(4).', at);
      const nums = args.map(a => wholeNumber(a, 'range()', at));
      let [start, stop, step] = nums.length === 1 ? [0, nums[0], 1] : nums.length === 2 ? [nums[0], nums[1], 1] : nums;
      if (step === 0) fail('The third number in range() can’t be 0.', at);
      const out = [];
      for (let v = start; step > 0 ? v < stop : v > stop; v += step) {
        if (out.length >= MAX_LIST) fail('That range is too big. Try a smaller number.', at, 'limit');
        out.push(v);
      }
      return out;
    },
    len(args, at) {
      if (args.length !== 1 || !(isList(args[0]) || typeof args[0] === 'string')) fail('len() counts the items in one list or the letters in one text.', at);
      return args[0].length;
    },
    str(args, at) {
      if (args.length !== 1) fail('str() needs exactly one value.', at);
      return show(args[0]);
    },
    int(args, at) {
      if (args.length !== 1) fail('int() needs exactly one value.', at);
      const v = args[0];
      if (typeof v === 'number') return Math.trunc(v);
      if (typeof v === 'boolean') return Number(v);
      if (typeof v === 'string' && /^\s*[+-]?\d+\s*$/.test(v)) return Number(v);
      fail(`int() can’t turn ${typeof v === 'string' ? `"${v}"` : typeName(v)} into a whole number.`, at);
    },
    abs(args, at) {
      if (args.length !== 1) fail('abs() needs exactly one number.', at);
      return Math.abs(number(args[0], 'abs()', at));
    },
    min(args, at) { return extreme(args, at, 'min', (a, b) => a < b); },
    max(args, at) { return extreme(args, at, 'max', (a, b) => a > b); },
    print(args, at) {
      host.print?.(args.map(a => show(a)).join(' '), at);
      return null;
    },
  };
  function extreme(args, at, name, better) {
    const items = args.length === 1 && isList(args[0]) ? args[0] : args;
    if (!items.length) fail(`${name}() needs at least one number.`, at);
    let best = number(items[0], `${name}()`, at);
    for (const item of items.slice(1)) { const v = number(item, `${name}()`, at); if (better(v, best)) best = v; }
    return best;
  }

  const knownNames = () => [...new Set([...(frames.length ? frames[frames.length - 1].keys() : []), ...globals.keys(), ...Object.keys(commands), ...Object.keys(builtins)])];

  function lookup(name, at) {
    const frame = frames[frames.length - 1];
    if (frame && frame.has(name)) return frame.get(name);
    if (globals.has(name)) return globals.get(name);
    if (Object.hasOwn(commands, name)) return {kind: 'builtin', name, run: commands[name]};
    if (Object.hasOwn(builtins, name)) return {kind: 'builtin', name, run: builtins[name]};
    const hint = suggest(name, knownNames());
    if (hint && hint.toLowerCase() === name.toLowerCase()) fail(`Bit doesn’t know "${name}". Did you mean ${hint}? Capital letters matter in Python.`, at);
    if (hint) fail(`Bit doesn’t know "${name}". Did you mean ${hint}?`, at);
    fail(`Bit doesn’t know "${name}". Check the spelling, or create it before you use it.`, at);
  }
  function assign(name, value) {
    (frames.length ? frames[frames.length - 1] : globals).set(name, value);
  }

  function call(fn, args, at) {
    if (!isFunction(fn)) fail(`Only commands can be run with ( ). That is ${typeName(fn)}.`, at);
    if (fn.kind === 'builtin') return fn.run(args, at) ?? null;
    if (args.length !== fn.params.length) {
      const need = fn.params.length;
      fail(`${fn.name}() needs ${need === 0 ? 'nothing' : need === 1 ? '1 value' : need + ' values'} in its parentheses, but got ${args.length}.`, at);
    }
    if (frames.length >= MAX_DEPTH) fail(`${fn.name}() keeps calling itself and never stops.`, at, 'limit');
    const frame = new Map();
    fn.params.forEach((param, i) => frame.set(param, args[i]));
    frames.push(frame);
    try {
      const signal = block(fn.body);
      return signal && signal.type === 'return' ? signal.value : null;
    } finally {
      frames.pop();
      line = at;
    }
  }

  function method(target, name, args, at) {
    if (isList(target)) {
      if (name === 'append') {
        if (args.length !== 1) fail('append() adds exactly one item, like my_list.append(3).', at);
        if (target.length >= MAX_LIST) fail('That list is too big for Bit to carry.', at, 'limit');
        target.push(args[0]);
        return null;
      }
      if (name === 'pop') {
        if (args.length > 1) fail('pop() takes at most one index.', at);
        if (!target.length) fail('This list is empty, so there is nothing to pop.', at);
        const index = args.length ? listIndex(target, args[0], at) : target.length - 1;
        return target.splice(index, 1)[0];
      }
    }
    if (typeof target === 'string') {
      if (name === 'upper' && !args.length) return target.toUpperCase();
      if (name === 'lower' && !args.length) return target.toLowerCase();
    }
    fail(`${typeName(target)} doesn’t have a .${name}() command here.`, at);
  }

  function listIndex(target, raw, at) {
    const index = wholeNumber(raw, 'An index', at);
    const size = target.length;
    const real = index < 0 ? size + index : index;
    if (real < 0 || real >= size) {
      fail(size === 0 ? 'This list is empty, so it has no items to pick.' : `Index ${index} is outside this ${isList(target) ? 'list' : 'text'}. It has ${size} item${size === 1 ? '' : 's'}, so the indexes go from 0 to ${size - 1}.`, at);
    }
    return real;
  }

  function binary(op, a, b, at) {
    const bothNumbers = (typeof a === 'number' || typeof a === 'boolean') && (typeof b === 'number' || typeof b === 'boolean');
    if (op === '+') {
      if (bothNumbers) return Number(a) + Number(b);
      if (typeof a === 'string' && typeof b === 'string') return checkSize(a + b, at);
      if (isList(a) && isList(b)) return checkSize([...a, ...b], at);
      if ((typeof a === 'string') !== (typeof b === 'string')) fail('You can’t add text and a number with +. Use str() to turn the number into text first.', at);
      fail(`You can’t add ${typeName(a)} and ${typeName(b)}.`, at);
    }
    if (op === '*') {
      if (bothNumbers) return Number(a) * Number(b);
      const [seq, times] = typeof a === 'string' || isList(a) ? [a, b] : [b, a];
      if ((typeof seq === 'string' || isList(seq)) && typeof times === 'number' && Number.isInteger(times)) {
        const count = Math.max(0, times);
        if (seq.length * count > MAX_LIST) fail('That would be too big for Bit to carry.', at, 'limit');
        return typeof seq === 'string' ? seq.repeat(count) : Array.from({length: count}, () => seq).flat();
      }
      fail(`You can’t multiply ${typeName(a)} and ${typeName(b)}.`, at);
    }
    if (!bothNumbers) fail(`The ${op} sign needs two numbers, but got ${typeName(a)} and ${typeName(b)}.`, at);
    const x = Number(a);
    const y = Number(b);
    if (op === '-') return x - y;
    if (op === '**') {
      const result = x ** y;
      if (!Number.isFinite(result)) fail('That number is too big.', at, 'limit');
      return result;
    }
    if (y === 0) fail('You can’t divide by zero.', at);
    if (op === '/') return x / y;
    if (op === '//') return Math.floor(x / y);
    return x - y * Math.floor(x / y); // % follows Python: the result has the sign of the divisor
  }

  function compare(op, a, b, at) {
    if (op === '==') return equal(a, b);
    if (op === '!=') return !equal(a, b);
    if (op === 'in' || op === 'not in') {
      let found;
      if (isList(b)) found = b.some(item => equal(item, a));
      else if (typeof b === 'string' && typeof a === 'string') found = b.includes(a);
      else fail('"in" looks inside a list or a text.', at);
      return op === 'in' ? found : !found;
    }
    const numeric = v => typeof v === 'number' || typeof v === 'boolean';
    if (numeric(a) && numeric(b)) { a = Number(a); b = Number(b); }
    else if (!(typeof a === 'string' && typeof b === 'string')) fail(`You can’t compare ${typeName(a)} and ${typeName(b)} with ${op}.`, at);
    return op === '<' ? a < b : op === '>' ? a > b : op === '<=' ? a <= b : a >= b;
  }

  function evaluate(node) {
    switch (node.type) {
      case 'Const': return node.value;
      case 'Name': return lookup(node.name, node.line);
      case 'List': return node.items.map(evaluate);
      case 'Unary': {
        const value = number(evaluate(node.value), `The ${node.op} sign`, node.line);
        return node.op === '-' ? -value : value;
      }
      case 'Binary': return binary(node.op, evaluate(node.left), evaluate(node.right), node.line);
      case 'Compare': return compare(node.op, evaluate(node.left), evaluate(node.right), node.line);
      case 'Logic': {
        const left = evaluate(node.left);
        if (node.op === 'and') return truthy(left) ? evaluate(node.right) : left;
        return truthy(left) ? left : evaluate(node.right);
      }
      case 'Not': return !truthy(evaluate(node.value));
      case 'Index': {
        const target = evaluate(node.target);
        if (!isList(target) && typeof target !== 'string') fail(`Square brackets pick an item from a list, but this is ${typeName(target)}.`, node.line);
        return target[listIndex(target, evaluate(node.index), node.line)];
      }
      case 'Attr': fail(`Add parentheses to use .${node.name}, like .${node.name}()`, node.line); break;
      case 'Call': {
        line = node.line;
        if (node.callee.type === 'Attr') {
          const target = evaluate(node.callee.target);
          return method(target, node.callee.name, node.args.map(evaluate), node.line);
        }
        const fn = evaluate(node.callee);
        const args = node.args.map(evaluate);
        return call(fn, args, node.line);
      }
    }
    fail('Bit found something it can’t run.', node.line);
  }

  function run(node) {
    tick(node.line);
    switch (node.type) {
      case 'Pass': return null;
      case 'Expr': evaluate(node.expr); return null;
      case 'Assign': {
        let value = evaluate(node.value);
        if (node.target.type === 'Name') {
          if (node.op !== '=') value = binary(node.op[0], lookup(node.target.name, node.line), value, node.line);
          assign(node.target.name, checkSize(value, node.line));
        } else {
          const target = evaluate(node.target.target);
          if (!isList(target)) fail('Only items in a list can be changed with [ ].', node.line);
          const index = listIndex(target, evaluate(node.target.index), node.line);
          target[index] = node.op === '=' ? value : binary(node.op[0], target[index], value, node.line);
        }
        return null;
      }
      case 'If': {
        for (const branch of node.branches) {
          line = branch.line;
          if (truthy(evaluate(branch.test))) return block(branch.body);
        }
        return node.otherwise ? block(node.otherwise) : null;
      }
      case 'While': {
        while (truthy(evaluate(node.test))) {
          const signal = block(node.body);
          if (signal) {
            if (signal.type === 'break') break;
            if (signal.type === 'return') return signal;
          }
          tick(node.line);
        }
        return null;
      }
      case 'For': {
        const source = evaluate(node.iterable);
        if (typeof source === 'number') fail(`A for loop can’t count through a plain number. Try range(${formatNumber(source)}).`, node.line);
        if (!isList(source) && typeof source !== 'string') fail(`A for loop needs a list or range() to go through, but got ${typeName(source)}.`, node.line);
        const items = isList(source) ? [...source] : [...source];
        for (const item of items) {
          assign(node.name, item);
          const signal = block(node.body);
          if (signal) {
            if (signal.type === 'break') break;
            if (signal.type === 'return') return signal;
          }
          tick(node.line);
        }
        return null;
      }
      case 'Def':
        assign(node.name, {kind: 'function', name: node.name, params: node.params, body: node.body});
        return null;
      case 'Return': return new Signal('return', node.value ? evaluate(node.value) : null);
      case 'Break': return new Signal('break');
      case 'Continue': return new Signal('continue');
    }
    fail('Bit found something it can’t run.', node.line);
  }

  function block(body) {
    for (const node of body) {
      const signal = run(node);
      if (signal) return signal;
    }
    return null;
  }

  block(program.body);
  return {steps};
}
