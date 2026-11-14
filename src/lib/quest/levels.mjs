// Code Quest curriculum: 6 worlds, 30 levels. Every map, story, and solution here is original to KidsCode.
//
// Map characters:  > < ^ v  Bit's start (and heading)   .  path   *  crystal   #  rock
//                  o  orange tile   b  blue tile   (space)  water
// A level has either one `map`, or `variants`: several boards that swap between runs, so that the
// program has to sense, read, or calculate instead of memorising one route.

/** Build a board by walking a route from the start tile. Numbers walk, 'left'/'right' turn, '*' drops a crystal, {sign: n} plants a sign. */
function trail(ops, extra = {}) {
  const delta = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  let x = 0, y = 0, dir = 1;
  const cells = new Map([['0,0', '>']]);
  const signs = [];
  for (const op of ops) {
    if (typeof op === 'number') {
      for (let i = 0; i < op; i++) {
        x += delta[dir][0]; y += delta[dir][1];
        if (!cells.has(x + ',' + y)) cells.set(x + ',' + y, '.');
      }
    } else if (op === 'left') dir = (dir + 3) % 4;
    else if (op === 'right') dir = (dir + 1) % 4;
    else if (op === '*') cells.set(x + ',' + y, '*');
    else if (op && typeof op === 'object') signs.push({x, y, value: op.sign});
  }
  const points = [...cells.keys()].map(key => key.split(',').map(Number));
  const minX = Math.min(...points.map(p => p[0])), minY = Math.min(...points.map(p => p[1]));
  const w = Math.max(...points.map(p => p[0])) - minX + 1, h = Math.max(...points.map(p => p[1])) - minY + 1;
  const map = Array.from({length: h}, (_, row) => Array.from({length: w}, (_, col) => cells.get((col + minX) + ',' + (row + minY)) || ' ').join(''));
  return {map, signs: signs.map(s => ({x: s.x - minX, y: s.y - minY, value: s.value})), ...extra};
}
const stairs = count => Array.from({length: count}, () => [1, 'left', 1, 'right']).flat();

/** Buttons that drop a line of code into the editor. */
export const TOOLS = {
  move: {label: 'move()', insert: 'move()', tip: 'Roll forward one tile'},
  moveN: {label: 'move(3)', insert: 'move(3)', tip: 'Roll forward several tiles. Change the number!'},
  left: {label: 'turn_left()', insert: 'turn_left()', tip: 'Turn to Bit’s left, staying on the same tile'},
  right: {label: 'turn_right()', insert: 'turn_right()', tip: 'Turn to Bit’s right, staying on the same tile'},
  around: {label: 'turn_around()', insert: 'turn_around()', tip: 'Turn to face the opposite way'},
  for: {label: 'for … in range(3):', insert: 'for i in range(3):', tip: 'Repeat the indented lines 3 times'},
  def: {label: 'def trick():', insert: 'def trick():', tip: 'Invent a new command'},
  if: {label: 'if path_clear():', insert: 'if path_clear():', tip: 'Only do the indented lines when the next tile is safe'},
  else: {label: 'else:', insert: 'else:', tip: 'What to do when the if is not true'},
  while: {label: 'while path_clear():', insert: 'while path_clear():', tip: 'Keep repeating while the next tile is safe'},
  whileLeft: {label: 'while crystals_left() > 0:', insert: 'while crystals_left() > 0:', tip: 'Keep repeating until every crystal is collected'},
  color: {label: 'if tile_color() == "orange":', insert: 'if tile_color() == "orange":', tip: 'Check the color of the tile Bit is standing on'},
  elif: {label: 'elif …:', insert: 'elif tile_color() == "blue":', tip: 'Another check, tried only when the if above was not true'},
  sign: {label: 'steps = read_sign()', insert: 'steps = read_sign()', tip: 'Read the number on the sign under Bit and remember it'},
  set: {label: 'n = 1', insert: 'n = 1', tip: 'Make a variable: a name that remembers a value'},
  forList: {label: 'for n in [2, 1, 3]:', insert: 'for n in [2, 1, 3]:', tip: 'Go through a list, one item at a time'},
  map: {label: 'read_map()', insert: 'for item in read_map():', tip: 'Go through every item on Bit’s treasure map'},
  say: {label: 'say("Hi!")', insert: 'say("Hi!")', tip: 'Make Bit say something'},
};

const BASIC = ['move', 'moveN', 'left', 'right', 'around'];

export const worlds = [
  {
    id: 'meadow', name: 'Launch Meadow', topic: 'Commands in order', icon: '➜',
    blurb: 'Type your first commands. Bit does exactly what you write, one line at a time.',
    theme: {water: '#bfe3ee', tile: '#dff3b6', edge: '#9cc474', line: '#7ba657'},
    tools: ['move', 'left', 'right'],
    levels: [
      {
        slug: 'first-steps', title: 'First steps', concept: 'Write your first line of code. The move() command rolls Bit forward one tile.',
        goal: 'Roll Bit to the crystal.',
        story: 'Hi, I’m Bit! I’m excellent at following instructions and terrible at guessing. Type what I should do, then press Run.',
        teach: {title: 'A command is one instruction', text: 'move() rolls Bit forward one tile. Bit reads your code from the top line to the bottom line, one line at a time.', code: 'move()\nmove()'},
        map: ['>.*'], tools: ['move'],
        starter: 'move()\n',
        hints: ['The crystal is two tiles away. One move() is already written for you.', 'Add a second line that also says move()'],
        idea: {label: 'Use the move() command', needs: ['call:move']}, lines: 2,
        solution: 'move()\nmove()',
      },
      {
        slug: 'count-your-steps', title: 'Count your steps', concept: 'Put a number inside move() to roll several tiles with a single line of code.',
        goal: 'Reach the crystal with just one line of code.',
        story: 'That crystal is far away. Typing move() five times would work, but I know a shortcut.',
        teach: {title: 'Numbers go inside the parentheses', text: 'A number inside the parentheses tells Bit how many tiles to roll. move(3) means “move three tiles”.', code: 'move(3)'},
        map: ['>....*'], tools: ['move', 'moveN'],
        starter: 'move()\n',
        hints: ['Count the tiles between Bit and the crystal.', 'Change the line to move(5)'],
        idea: {label: 'Put a number inside move()', needs: ['arg:move']}, lines: 1,
        solution: 'move(5)',
      },
      {
        slug: 'turn-left', title: 'Around the corner', concept: 'Use turn_left() to change the direction Bit is facing before moving again.',
        goal: 'Turn the corner and collect the crystal.',
        story: 'I can only roll the way I’m facing. Look at my eyes: that’s my front!',
        teach: {title: 'Turning', text: 'turn_left() spins Bit a quarter turn to its own left. Bit stays on the same tile; only the direction changes.', code: 'move(2)\nturn_left()\nmove(2)'},
        map: ['  *', '  .', '>..'], tools: ['move', 'moveN', 'left'],
        starter: 'move(2)\n',
        hints: ['After two tiles Bit reaches the corner. Which way is the crystal from there?', 'Add turn_left() and then move(2)'],
        idea: {label: 'Use turn_left()', needs: ['call:turn_left']}, lines: 3,
        solution: 'move(2)\nturn_left()\nmove(2)',
      },
      {
        slug: 'turn-right', title: 'Two crystals', concept: 'Use turn_right() and plan a route that collects more than one crystal.',
        goal: 'Collect both crystals.',
        story: 'Two crystals this time. I pick up a crystal whenever I roll over it, so plan a path that visits both.',
        teach: {title: 'Left and right belong to Bit', text: 'turn_right() spins Bit to its own right. If Bit is facing the bottom of the board, Bit’s right is your left! Imagine sitting on Bit’s shoulders.', code: 'move(3)\nturn_right()\nmove(2)'},
        map: ['>.*.', '   .', '   *'], tools: ['move', 'moveN', 'left', 'right'],
        starter: '',
        hints: ['Roll all the way to the end of the first path. Bit collects the first crystal on the way.', 'move(3), then turn_right(), then move(2)'],
        idea: {label: 'Use turn_right()', needs: ['call:turn_right']}, lines: 3,
        solution: 'move(3)\nturn_right()\nmove(2)',
      },
      {
        slug: 'fix-the-zigzag', title: 'Fix the zigzag', concept: 'Find and fix a bug: one wrong command sends the whole program off course.',
        goal: 'This program has a bug. Find it and fix it.',
        story: 'Somebody wrote this program for me, but I keep falling in the water. Press Run and watch where it goes wrong.',
        teach: {title: 'Bugs and debugging', text: 'A bug is a mistake in a program. Debugging means finding it and fixing it. Run the code, watch which line is glowing when things go wrong, and change just that line.', code: 'turn_left()   # oops?\nturn_right()  # fixed!'},
        map: ['>..  ', '  .  ', '  *..', '    .', '    *'], tools: ['move', 'moveN', 'left', 'right'],
        starter: 'move(2)\nturn_left()\nmove(2)\nturn_left()\nmove(2)\nturn_right()\nmove(2)\n',
        hints: ['Run the program. The glowing line shows where Bit was when it fell in.', 'The first turn is wrong. Line 2 should be turn_right()'],
        idea: {label: 'Use both turn_left() and turn_right()', needs: ['call:turn_left', 'call:turn_right']}, lines: 7,
        solution: 'move(2)\nturn_right()\nmove(2)\nturn_left()\nmove(2)\nturn_right()\nmove(2)',
      },
    ],
  },
  {
    id: 'lagoon', name: 'Loop Lagoon', topic: 'Loops', icon: '↻',
    blurb: 'Why type the same thing four times? Loops repeat your code for you.',
    theme: {water: '#aadff0', tile: '#fbeec2', edge: '#dcc27c', line: '#b79c56'},
    tools: [...BASIC, 'for'],
    levels: [
      {
        slug: 'round-the-pond', title: 'Round the pond', concept: 'A for loop repeats the indented lines. Use for i in range(3) to walk around a square pond.',
        goal: 'Collect the three crystals around the pond.',
        story: 'Move, turn, move, turn, move, turn… I’m doing the same thing again and again. There must be a shorter way to say it.',
        teach: {title: 'A loop repeats lines', text: 'for i in range(3): repeats the lines underneath it 3 times. The repeated lines must be indented: they start with 4 spaces. That is how Bit knows they belong to the loop.', code: 'for i in range(3):\n    move(3)\n    turn_left()'},
        map: ['*..*', '.  .', '.  .', '>..*'],
        starter: 'for i in range(3):\n    move(3)\n',
        hints: ['Each side of the pond needs two things: roll along it, then turn the corner.', 'Add turn_left() under move(3), indented with 4 spaces so it is inside the loop.'],
        idea: {label: 'Use a for loop', needs: ['for']}, lines: 3,
        solution: 'for i in range(3):\n    move(3)\n    turn_left()',
      },
      {
        slug: 'crystal-stairs', title: 'Crystal stairs', concept: 'Spot the repeating pattern in a staircase and write it once inside a loop.',
        goal: 'Climb the stairs and collect all four crystals.',
        story: 'Stairs! Every step is the same little pattern. Work out one step, and the loop does the rest.',
        teach: {title: 'Find the pattern', text: 'Before you write a loop, look for the part that repeats. One stair is: roll, turn left, roll, turn right. Put those four lines inside the loop.', code: 'for i in range(4):\n    move()\n    turn_left()\n    move()\n    turn_right()'},
        map: ['    *', '   *.', '  *. ', ' *.  ', '>.   '],
        starter: 'for i in range(4):\n    move()\n    turn_left()\n',
        hints: ['After turning left and climbing, Bit needs to face along the stairs again.', 'Inside the loop: move(), turn_left(), move(), turn_right()'],
        idea: {label: 'Use a for loop', needs: ['for']}, lines: 5,
        solution: 'for i in range(4):\n    move()\n    turn_left()\n    move()\n    turn_right()',
      },
      {
        slug: 'the-comb', title: 'There and back', concept: 'Combine a longer repeating pattern with turn_around() to visit dead ends and come back.',
        goal: 'Dip into each side path and collect the three crystals.',
        story: 'Three little dead ends, each with a crystal. I’ll have to go in, spin around, and come back out. Three times!',
        teach: {title: 'Loops can hold many lines', text: 'A loop can repeat as many lines as you like. turn_around() spins Bit to face the opposite way, which is handy for dead ends.', code: 'turn_left()\nmove()\nturn_around()\nmove()\nturn_left()'},
        map: [' * * * ', '>......'],
        starter: 'for i in range(3):\n    move()\n    turn_left()\n    move()\n',
        hints: ['After collecting a crystal, Bit must turn around, come back down, face along the path again, and roll to the next dead end.', 'Inside the loop: move(), turn_left(), move(), turn_around(), move(), turn_left(), move()'],
        idea: {label: 'Use a for loop', needs: ['for']}, lines: 8,
        solution: 'for i in range(3):\n    move()\n    turn_left()\n    move()\n    turn_around()\n    move()\n    turn_left()\n    move()',
      },
      {
        slug: 'up-and-over', title: 'Up and over', concept: 'Use two loops, one after the other, when a path has two different repeating patterns.',
        goal: 'Climb up the hill, then down the other side.',
        story: 'Up three steps, then down three steps. Going down is a different pattern, so I’ll need a second loop.',
        teach: {title: 'One loop after another', text: 'When a loop finishes, Bit carries on with the next line that is not indented. So you can write one loop for going up, and a second loop for going down.', code: 'for i in range(3):\n    move()\nfor i in range(3):\n    turn_left()'},
        map: ['   *.  ', '  .... ', ' ..  ..', '>.    *'],
        starter: 'for i in range(3):\n    move()\n    turn_left()\n    move()\n    turn_right()\n',
        hints: ['The first loop is finished for you. Going down, the turns are the other way around.', 'Add a second loop: move(), turn_right(), move(), turn_left(), three times.'],
        idea: {label: 'Use a for loop', needs: ['for']}, lines: 10,
        solution: 'for i in range(3):\n    move()\n    turn_left()\n    move()\n    turn_right()\nfor i in range(3):\n    move()\n    turn_right()\n    move()\n    turn_left()',
      },
      {
        slug: 'diamond-loop', title: 'The diamond', concept: 'Put a loop inside a loop. Nested loops repeat a pattern that is itself made of repeats.',
        goal: 'Travel all the way around the diamond.',
        story: 'This diamond has four sides, and every side is two stairs. A loop of loops? Yes please.',
        teach: {title: 'A loop inside a loop', text: 'Loops can go inside other loops. The inner loop runs all the way through each time the outer loop repeats. Indent the inner lines twice: 8 spaces.', code: 'for i in range(4):\n    for j in range(2):\n        move()\n    turn_left()'},
        map: [' .*. ', '.. ..', '*   *', '.. ..', ' *>. '],
        starter: 'for i in range(4):\n    for j in range(2):\n        move()\n        turn_left()\n',
        hints: ['One stair is move(), turn_left(), move(), turn_right(). Each side of the diamond is two stairs.', 'After the inner loop finishes a side, add turn_left() with 4 spaces, so it runs once per side.'],
        idea: {label: 'Put a loop inside a loop', needs: ['nested-for']}, lines: 7,
        solution: 'for i in range(4):\n    for j in range(2):\n        move()\n        turn_left()\n        move()\n        turn_right()\n    turn_left()',
      },
    ],
  },
  {
    id: 'forest', name: 'Function Forest', topic: 'Functions', icon: 'ƒ',
    blurb: 'Invent your own commands, give them names, and use them again and again.',
    theme: {water: '#b9dfd0', tile: '#cfe9a8', edge: '#86b062', line: '#5f8a45'},
    tools: [...BASIC, 'for', 'def'],
    levels: [
      {
        slug: 'teach-a-trick', title: 'Teach Bit a trick', concept: 'A function is a command you invent. Define it once with def, then call it by name.',
        goal: 'Use the new grab() command to collect all three crystals.',
        story: 'I only know a few commands. But you can teach me new ones! This program teaches me a trick called grab.',
        teach: {title: 'def makes a new command', text: 'def grab(): gives a name to the indented lines below it. Nothing happens yet! The lines only run when you call the function by writing grab() later.', code: 'def grab():\n    turn_left()\n    move(2)\n\ngrab()'},
        map: [' *  * *', ' .  . .', '>......'],
        starter: 'def grab():\n    turn_left()\n    move(2)\n    turn_around()\n    move(2)\n    turn_left()\n\nmove()\ngrab()\n',
        hints: ['The side paths are not evenly spaced. Count the tiles between them.', 'After the first grab(): move(3), grab(), move(2), grab()'],
        idea: {label: 'Define a function with def', needs: ['def']}, lines: 12,
        solution: 'def grab():\n    turn_left()\n    move(2)\n    turn_around()\n    move(2)\n    turn_left()\n\nmove()\ngrab()\nmove(3)\ngrab()\nmove(2)\ngrab()',
      },
      {
        slug: 'step-by-step', title: 'Your own command', concept: 'Write a function from scratch for a pattern that repeats in uneven places.',
        goal: 'Write a function for one stair, then use it four times.',
        story: 'Stairs again, but with flat bits in between, so one loop won’t do. A function called step would be perfect.',
        teach: {title: 'Why functions help', text: 'A loop repeats code straight away. A function lets you reuse code whenever you want: here, there, and later on. Good names make programs easy to read.', code: 'def step():\n    move()\n    turn_left()\n    move()\n    turn_right()'},
        map: ['       *', '     ...', '  *.*.  ', ' ..     ', '>.      '],
        starter: 'def step():\n    move()\n\nstep()\n',
        hints: ['Finish step() first: move(), turn_left(), move(), turn_right().', 'Then: step(), step(), move(2), step(), move(), step()'],
        idea: {label: 'Define a function with def', needs: ['def']}, lines: 11,
        solution: 'def step():\n    move()\n    turn_left()\n    move()\n    turn_right()\n\nstep()\nstep()\nmove(2)\nstep()\nmove()\nstep()',
      },
      {
        slug: 'reach-up', title: 'How far up?', concept: 'Give a function a parameter so that one command can do slightly different jobs.',
        goal: 'The side paths have different lengths. Give grab() a number.',
        story: 'These side paths are 1, 3, and 2 tiles long. I don’t want three different grab commands. Can one grab take a number?',
        teach: {title: 'Parameters', text: 'A parameter is a name inside the parentheses of def. When you call grab(3), the parameter n becomes 3 inside the function. Call grab(1) and n is 1.', code: 'def grab(n):\n    turn_left()\n    move(n)\n\ngrab(3)'},
        map: ['   *  ', '   . *', ' * . .', '>.....'],
        starter: 'def grab(n):\n    turn_left()\n    move(n)\n    turn_around()\n    move(n)\n    turn_left()\n\nmove()\ngrab(1)\n',
        hints: ['Roll to the foot of each side path, then call grab with that path’s length.', 'move(2), grab(3), move(2), grab(2)'],
        idea: {label: 'Use a function with a parameter', needs: ['def', 'param']}, lines: 12,
        solution: 'def grab(n):\n    turn_left()\n    move(n)\n    turn_around()\n    move(n)\n    turn_left()\n\nmove()\ngrab(1)\nmove(2)\ngrab(3)\nmove(2)\ngrab(2)',
      },
      {
        slug: 'two-numbers', title: 'Two numbers', concept: 'Functions can take two parameters. Use them to describe stairs of any width and height.',
        goal: 'Every stair has a different size. Write one function that fits them all.',
        story: 'Wonky stairs! Each one goes along a bit and up a bit, but never the same amount. Two numbers should do it.',
        teach: {title: 'More than one parameter', text: 'Separate parameters with commas. The values you pass in are matched up in order: in corner(2, 1), along is 2 and up is 1.', code: 'def corner(along, up):\n    move(along)\n    turn_left()\n    move(up)\n    turn_right()'},
        map: ['      *', '   *...', '   .   ', '   .   ', '  *.   ', '>..    '],
        starter: 'def corner(along, up):\n    move(along)\n    turn_left()\n\ncorner(2, 1)\n',
        hints: ['Finish corner(): after turning left, move(up), then turn_right() to face along the stairs again.', 'The three stairs are corner(2, 1), corner(1, 3), and corner(3, 1)'],
        idea: {label: 'Use a function with parameters', needs: ['def', 'param']}, lines: 8,
        solution: 'def corner(along, up):\n    move(along)\n    turn_left()\n    move(up)\n    turn_right()\n\ncorner(2, 1)\ncorner(1, 3)\ncorner(3, 1)',
      },
      {
        slug: 'great-staircase', title: 'The great staircase', concept: 'Combine a loop and a parameter inside a function to build a powerful new command.',
        goal: 'Climb the great staircase to the top of the forest.',
        story: 'The biggest staircase in the forest: 2 stairs, a walk, 3 stairs, a walk, and 1 more. A function with a loop inside could climb any of them.',
        teach: {title: 'A loop inside a function', text: 'Functions can contain loops, and the parameter can decide how many times the loop repeats. stairs(3) climbs three stairs; stairs(1) climbs one.', code: 'def stairs(n):\n    for i in range(n):\n        move()\n        turn_left()\n        move()\n        turn_right()'},
        map: ['         *', '       *..', '      ..  ', '     ..   ', '  *.*.    ', ' ..       ', '>.        '],
        starter: 'def stairs(n):\n    for i in range(n):\n        move()\n\nstairs(2)\n',
        hints: ['One stair is move(), turn_left(), move(), turn_right(). Put all four inside the loop, indented 8 spaces.', 'Then call: stairs(2), move(2), stairs(3), move(), stairs(1)'],
        idea: {label: 'Put a loop inside a function with a parameter', needs: ['def', 'param', 'for']}, lines: 11,
        solution: 'def stairs(n):\n    for i in range(n):\n        move()\n        turn_left()\n        move()\n        turn_right()\n\nstairs(2)\nmove(2)\nstairs(3)\nmove()\nstairs(1)',
      },
    ],
  },
  {
    id: 'dunes', name: 'Decision Dunes', topic: 'If and while', icon: '?',
    blurb: 'The sand shifts between runs! Teach Bit to look before it rolls.',
    theme: {water: '#b7dcea', tile: '#f6ddb0', edge: '#d4ab66', line: '#ad8743'},
    tools: [...BASIC, 'for', 'def', 'if', 'else', 'while', 'whileLeft'],
    levels: [
      {
        slug: 'which-way', title: 'Which way?', concept: 'Use if and else with path_clear() so a program can choose between two routes.',
        goal: 'The crystal moves between runs. Check the path, then choose.',
        story: 'The wind keeps moving things around here. Sometimes the crystal is on my left, sometimes on my right. I’ll have to check before I roll.',
        teach: {title: 'if and else', text: 'path_clear() answers True when the tile in front of Bit is safe to roll onto. An if runs its indented lines only when the answer is True. The lines under else run when it is False.', code: 'if path_clear():\n    move(2)\nelse:\n    turn_around()'},
        variants: [{map: ['*.^# ']}, {map: [' #^.*']}],
        starter: 'turn_left()\nif path_clear():\n    move(2)\n',
        hints: ['If the left side is blocked by a rock, the crystal must be the other way.', 'Add else: and under it, indented: turn_around() then move(2)'],
        idea: {label: 'Use if and else', needs: ['if', 'else']}, lines: 6,
        solution: 'turn_left()\nif path_clear():\n    move(2)\nelse:\n    turn_around()\n    move(2)',
      },
      {
        slug: 'until-the-edge', title: 'As far as it goes', concept: 'A while loop repeats for as long as its question is True, however long that takes.',
        goal: 'The path is a different length on every run. Stop at the end!',
        story: 'I can’t count the tiles this time, because the path keeps changing length. I’ll just keep rolling while the way ahead is clear.',
        teach: {title: 'while keeps going', text: 'A for loop repeats a set number of times. A while loop asks a question before every repeat, and stops as soon as the answer is False.', code: 'while path_clear():\n    move()'},
        variants: [{map: ['>..*']}, {map: ['>.....*']}, {map: ['>...*']}],
        tools: [...BASIC, 'for', 'if', 'else', 'while'],
        starter: 'move(3)\n',
        hints: ['move(3) only works when the path happens to be 3 tiles long. Press Run a few times and watch.', 'Replace it with: while path_clear(): and, indented underneath, move()'],
        idea: {label: 'Use a while loop', needs: ['while']}, lines: 2,
        solution: 'while path_clear():\n    move()',
      },
      {
        slug: 'corner-to-corner', title: 'Corner to corner', concept: 'Put a while loop inside a for loop to follow a path with corners of unknown length.',
        goal: 'Three straight paths, three unknown lengths. Collect the crystal.',
        story: 'Roll to the end, turn left. Roll to the end, turn left. I know the pattern, just not how long each part is.',
        teach: {title: 'Loops inside loops, again', text: 'A while loop can sit inside a for loop. Here the while rolls Bit to the end of one straight path, and the for repeats that for all three paths.', code: 'for i in range(3):\n    while path_clear():\n        move()\n    turn_left()'},
        variants: [{map: [' *..', '   .', '>...']}, {map: ['*....', '    .', '    .', '>....']}, {map: [' *.', '>..']}],
        tools: [...BASIC, 'for', 'if', 'else', 'while'],
        starter: 'while path_clear():\n    move()\nturn_left()\n',
        hints: ['The starter handles one straight path and one corner. You need that three times.', 'Wrap it in for i in range(3): and indent the three lines so they sit inside the loop.'],
        idea: {label: 'Use a while loop', needs: ['while']}, lines: 4,
        solution: 'for i in range(3):\n    while path_clear():\n        move()\n    turn_left()',
      },
      {
        slug: 'color-code', title: 'Color code', concept: 'Compare values with == and use elif to choose between more than two options.',
        goal: 'Orange tiles mean turn left. Blue tiles mean turn right.',
        story: 'Somebody painted clues on the path! Orange means turn left, blue means turn right. I can check the tile I’m standing on.',
        teach: {title: 'Comparing with ==', text: 'tile_color() answers "orange", "blue", or "plain". Two equals signs ask “are these the same?”. elif means “otherwise, if…”: it is checked only when the if above it was False.', code: 'if tile_color() == "orange":\n    turn_left()\nelif tile_color() == "blue":\n    turn_right()'},
        variants: [{map: ['  b.b', '  . .', '>.o *']}, {map: ['>.b  ', '  .  ', '  o.*']}, {map: ['  *.o', '    .', '>...o']}],
        tools: [...BASIC, 'for', 'if', 'else', 'while', 'whileLeft', 'color', 'elif'],
        starter: 'while crystals_left() > 0:\n    move()\n    if tile_color() == "orange":\n        turn_left()\n',
        hints: ['The starter already turns left on orange tiles. Blue tiles need a turn too.', 'Add, lined up with the if: elif tile_color() == "blue": and under it turn_right()'],
        idea: {label: 'Use if with tile_color()', needs: ['if', 'call:tile_color']}, lines: 6,
        solution: 'while crystals_left() > 0:\n    move()\n    if tile_color() == "orange":\n        turn_left()\n    elif tile_color() == "blue":\n        turn_right()',
      },
      {
        slug: 'maze-runner', title: 'Maze runner', concept: 'Combine while, if, else, and not to write one program that solves many different mazes.',
        goal: 'Write one program that can follow any winding path.',
        story: 'No painted clues, and the path twists a different way on every run. When I can’t go forward, I’ll try left. If left is blocked too, it must be right!',
        teach: {title: 'An if inside an else', text: 'not flips an answer: not path_clear() is True when the way is blocked. You can put an if inside another if or else to make a second decision.', code: 'turn_left()\nif not path_clear():\n    turn_around()'},
        variants: [{map: ['>..   ', '  .   ', '  ...*']}, {map: [' *..', '   .', '>...']}, {map: ['>.   *', ' .   .', ' .....']}],
        starter: 'while crystals_left() > 0:\n    if path_clear():\n        move()\n    else:\n        turn_left()\n',
        hints: ['Sometimes turning left points Bit at water. Then the path must go the other way.', 'Under turn_left(), still inside the else: if not path_clear(): and under that, turn_around()'],
        idea: {label: 'Use while with if and else', needs: ['while', 'if', 'else']}, lines: 7,
        solution: 'while crystals_left() > 0:\n    if path_clear():\n        move()\n    else:\n        turn_left()\n        if not path_clear():\n            turn_around()',
      },
    ],
  },
  {
    id: 'valley', name: 'Variable Valley', topic: 'Variables', icon: 'x',
    blurb: 'Mystery signs hide a new number on every run. Read them, remember them, use them.',
    theme: {water: '#c3dcf2', tile: '#e2ddf6', edge: '#aca0d8', line: '#8577b8'},
    tools: [...BASIC, 'for', 'def', 'if', 'else', 'while', 'sign', 'set'],
    levels: [
      {
        slug: 'mystery-sign', title: 'The mystery sign', concept: 'A variable is a name that remembers a value. Store what read_sign() returns, then use it.',
        goal: 'The sign says how far to go, and it changes on every run.',
        story: 'I’m standing on a sign with a number on it. It’s a different number each time, but I can read it and remember it.',
        teach: {title: 'Variables remember things', text: 'steps = read_sign() reads the number on the sign under Bit and stores it in a variable called steps. Afterwards, writing steps is just like writing that number.', code: 'steps = read_sign()\nmove(steps)'},
        variants: [2, 4, 5].map(n => trail([{sign: n}, n, '*'])),
        starter: 'steps = read_sign()\n',
        hints: ['The variable steps now holds the number from the sign.', 'Add move(steps)'],
        idea: {label: 'Store a value in a variable', needs: ['assign']}, lines: 2,
        solution: 'steps = read_sign()\nmove(steps)',
      },
      {
        slug: 'two-signs', title: 'Two signs', concept: 'A variable can be given a new value. Read a second sign and store its number too.',
        goal: 'Read the first sign, roll, then read the sign at the corner.',
        story: 'Another sign is waiting at the corner. My variable can forget the old number and remember the new one.',
        teach: {title: 'Variables can change', text: 'Giving a variable a new value replaces the old one. That is why they are called variables: their values can vary.', code: 'steps = read_sign()\nmove(steps)\nsteps = read_sign()'},
        variants: [[2, 3], [4, 1], [3, 2]].map(([a, b]) => trail([{sign: a}, a, {sign: b}, 'left', b, '*'])),
        starter: 'steps = read_sign()\nmove(steps)\nturn_left()\n',
        hints: ['Bit is now standing on the second sign, facing the crystal.', 'Add steps = read_sign() and then move(steps)'],
        idea: {label: 'Store a value in a variable', needs: ['assign']}, lines: 5,
        solution: 'steps = read_sign()\nmove(steps)\nturn_left()\nsteps = read_sign()\nmove(steps)',
      },
      {
        slug: 'sign-math', title: 'Sign math', concept: 'Do arithmetic with variables: multiply and add to work out distances.',
        goal: 'First path: twice the sign’s number. Second path: the number plus 1.',
        story: 'A riddle! The first path is twice as long as the number on the sign. After the left turn, the second path is the number plus one.',
        teach: {title: 'Math with variables', text: 'Variables work in sums. Use + to add, - to subtract, and * to multiply. If n is 3, then n * 2 is 6 and n + 1 is 4.', code: 'n = read_sign()\nmove(n * 2)'},
        variants: [1, 2, 3].map(n => trail([{sign: n}, 2 * n, 'left', n + 1, '*'])),
        starter: 'n = read_sign()\nmove(n * 2)\n',
        hints: ['Bit is at the corner. Turn left, then roll the number plus one.', 'Add turn_left() and then move(n + 1)'],
        idea: {label: 'Store a value in a variable', needs: ['assign']}, lines: 4,
        solution: 'n = read_sign()\nmove(n * 2)\nturn_left()\nmove(n + 1)',
      },
      {
        slug: 'growing-spiral', title: 'The growing spiral', concept: 'Change a variable inside a loop so that every repeat does a little more than the last.',
        goal: 'Each side of the spiral is one tile longer than the one before.',
        story: 'A spiral! 1 tile, then 2, then 3, then 4, then 5. A variable that grows every time around the loop would be perfect.',
        teach: {title: 'Counting up', text: 'n = n + 1 means “work out n plus 1, and store the answer back in n”. Inside a loop, it makes n bigger on every repeat.', code: 'n = 1\nfor i in range(5):\n    move(n)\n    n = n + 1'},
        map: ['*..*  ', '.  .  ', '. >.  ', '.     ', '*....*'],
        starter: 'n = 1\nfor i in range(5):\n    move(n)\n    turn_left()\n',
        hints: ['Right now n stays at 1, so every side is 1 tile long.', 'Add n = n + 1 as the last line inside the loop.'],
        idea: {label: 'Change a variable inside a loop', needs: ['assign', 'for']}, lines: 5,
        solution: 'n = 1\nfor i in range(5):\n    move(n)\n    turn_left()\n    n = n + 1',
      },
      {
        slug: 'count-and-climb', title: 'Count and climb', concept: 'Use a variable to decide how many times a loop repeats.',
        goal: 'The first sign counts the stairs. The sign at the top says how far to roll.',
        story: 'The sign at the bottom tells me how many stairs there are. There’s another sign at the top. Everything changes between runs, so no guessing!',
        teach: {title: 'Variables in range()', text: 'A variable can go anywhere a number can, even inside range(). If stairs is 4, then for i in range(stairs): repeats 4 times.', code: 'stairs = read_sign()\nfor i in range(stairs):\n    move()'},
        variants: [[2, 3], [3, 2], [4, 4], [1, 5]].map(([s, f]) => trail([{sign: s}, ...stairs(s), {sign: f}, f, '*'])),
        starter: 'stairs = read_sign()\nfor i in range(stairs):\n    move()\n    turn_left()\n',
        hints: ['Finish the stair pattern first: move(), turn_left(), move(), turn_right().', 'After the loop, not indented: far = read_sign() and then move(far)'],
        idea: {label: 'Use a variable inside range()', needs: ['assign', 'for']}, lines: 8,
        solution: 'stairs = read_sign()\nfor i in range(stairs):\n    move()\n    turn_left()\n    move()\n    turn_right()\nfar = read_sign()\nmove(far)',
      },
    ],
  },
  {
    id: 'lighthouse', name: 'List Lighthouse', topic: 'Lists', icon: '[ ]',
    blurb: 'Carry many values at once, and write programs that follow treasure maps.',
    theme: {water: '#a9cfe6', tile: '#d9eef0', edge: '#8fbfc6', line: '#5f97a0'},
    tools: [...BASIC, 'for', 'def', 'if', 'else', 'elif', 'while', 'set', 'forList', 'map'],
    levels: [
      {
        slug: 'list-of-steps', title: 'A list of steps', concept: 'A list holds several values in order. A for loop can visit them one at a time.',
        goal: 'The sides are 4, 2, 3, and 1 tiles long. Put them in a list.',
        story: 'The sides of this path are all different, with no pattern at all. But I can write the numbers in a list and loop through them.',
        teach: {title: 'Lists', text: 'A list is written with square brackets and commas. for n in [4, 2, 3, 1]: runs the loop four times. The first time n is 4, then 2, then 3, then 1.', code: 'for n in [4, 2, 3, 1]:\n    move(n)\n    turn_left()'},
        map: [' *..*', ' *  .', '>...*'],
        starter: 'for n in [4, 2]:\n    move(n)\n    turn_left()\n',
        hints: ['The list only has the first two sides. Count the tiles in the other two.', 'Change the list to [4, 2, 3, 1]'],
        idea: {label: 'Loop through a list', needs: ['list', 'for']}, lines: 3,
        solution: 'for n in [4, 2, 3, 1]:\n    move(n)\n    turn_left()',
      },
      {
        slug: 'treasure-map', title: 'The treasure map', concept: 'Loop through a list that the program receives, without knowing its contents in advance.',
        goal: 'Follow the map: roll each number, turning left after every one.',
        story: 'I found a treasure map! It’s a list of numbers, and it’s different on every run. Roll that far, turn left, and repeat.',
        teach: {title: 'A list you did not write', text: 'read_map() gives back the list on Bit’s treasure map. You do not need to know what is in it, or even how long it is. The loop visits every item.', code: 'for n in read_map():\n    move(n)'},
        variants: [[3, 2, 1], [4, 3, 2, 1], [2, 2, 4, 1]].map(list => ({...trail(list.flatMap((n, i) => [n, ...(i === list.length - 1 ? ['*'] : []), 'left'])), scroll: list})),
        starter: 'for n in read_map():\n    move(n)\n',
        hints: ['The map says: after every number, turn left.', 'Add turn_left() inside the loop, under move(n).'],
        idea: {label: 'Loop through a list', needs: ['for', 'call:read_map']}, lines: 3,
        solution: 'for n in read_map():\n    move(n)\n    turn_left()',
      },
      {
        slug: 'left-or-right', title: 'Left or right?', concept: 'Lists can hold words as well as numbers. Combine a list loop with if and else.',
        goal: 'This map is a list of words. Roll 2 tiles, then turn the way it says.',
        story: 'This map has words on it: "left" and "right". Every path here is 2 tiles long, and then the map tells me which way to turn.',
        teach: {title: 'Lists of words', text: 'Lists can hold text too. Text goes inside quote marks. Compare text with == just like numbers.', code: 'for turn in ["left", "right"]:\n    if turn == "left":\n        turn_left()'},
        variants: [['left', 'right', 'left'], ['right', 'right', 'left', 'left'], ['left', 'left', 'right']].map(list => ({...trail(list.flatMap((t, i) => [2, ...(i === list.length - 1 ? ['*'] : []), t])), scroll: list})),
        starter: 'for turn in read_map():\n    move(2)\n    if turn == "left":\n        turn_left()\n',
        hints: ['When the word is not "left", it must be "right".', 'Add else: lined up with the if, and under it turn_right()'],
        idea: {label: 'Use if inside a list loop', needs: ['for', 'if', 'call:read_map']}, lines: 6,
        solution: 'for turn in read_map():\n    move(2)\n    if turn == "left":\n        turn_left()\n    else:\n        turn_right()',
      },
      {
        slug: 'pick-an-item', title: 'Pick an item', concept: 'Use an index in square brackets to pick one item from a list. Indexes start at 0.',
        goal: 'The map has three numbers: roll, turn left, roll, turn right, roll.',
        story: 'Three numbers on the map, one for each straight path. But the turns are different, so a loop won’t fit. I’ll pick the numbers out one by one.',
        teach: {title: 'Indexes start at 0', text: 'Square brackets after a list pick out one item. Programmers count from zero: steps[0] is the first item, steps[1] is the second, and steps[2] is the third.', code: 'steps = read_map()\nmove(steps[0])'},
        variants: [[2, 3, 2], [4, 1, 3], [1, 2, 4]].map(list => ({...trail([list[0], 'left', list[1], 'right', list[2], '*']), scroll: list})),
        starter: 'steps = read_map()\nmove(steps[0])\nturn_left()\n',
        hints: ['The second number is steps[1]. The third is steps[2].', 'Add move(steps[1]), turn_right(), and move(steps[2])'],
        idea: {label: 'Pick items with an index', needs: ['index']}, lines: 6,
        solution: 'steps = read_map()\nmove(steps[0])\nturn_left()\nmove(steps[1])\nturn_right()\nmove(steps[2])',
      },
      {
        slug: 'the-lighthouse', title: 'The lighthouse', concept: 'The final challenge: loops, lists, and decisions together in a program that follows any instructions.',
        goal: 'The last map mixes numbers and words. Teach Bit to follow all of it.',
        story: 'The last map! It mixes numbers and words, like [3, "left", 2]. A number means roll that far. A word means turn that way. If I can follow this, I can follow anything.',
        teach: {title: 'A program that reads programs', text: 'Check each item in turn. If it is "left" or "right", turn. Otherwise it must be a number, so move that many tiles. You are teaching Bit to follow instructions that were written by someone else: that is exactly what a computer does!', code: 'if item == "left":\n    turn_left()\nelif item == "right":\n    turn_right()\nelse:\n    move(item)'},
        variants: [[2, 'left', 3, 'right', 2], [1, 'right', 2, 'left', 3, 'left', 1], [3, 'left', 2, 'left', 1, 'right', 2]].map(list => ({...trail(list.flatMap(item => typeof item === 'number' ? [item, '*'] : [item])), scroll: list})),
        starter: 'for item in read_map():\n    if item == "left":\n        turn_left()\n',
        hints: ['Three cases: the word "left", the word "right", or a number.', 'Add elif item == "right": with turn_right() under it, then else: with move(item) under it.'],
        idea: {label: 'Use if, elif, and else inside a list loop', needs: ['for', 'if', 'elif', 'else']}, lines: 7,
        solution: 'for item in read_map():\n    if item == "left":\n        turn_left()\n    elif item == "right":\n        turn_right()\n    else:\n        move(item)',
      },
    ],
  },
];

/** All levels in play order, each knowing its world and position. */
export const levels = worlds.flatMap((world, w) => world.levels.map((level, i) => ({...level, world: w, worldId: world.id, number: i + 1, tools: level.tools || world.tools})));
levels.forEach((level, index) => { level.index = index; });
export const levelBySlug = slug => levels.find(level => level.slug === slug);
export const MAX_STARS = levels.length * 3;

/** Everything a program can call, for the command book. */
export const commandBook = [
  ['move()', 'Roll forward one tile. move(3) rolls three tiles.'],
  ['turn_left()', 'Turn a quarter turn to Bit’s left.'],
  ['turn_right()', 'Turn a quarter turn to Bit’s right.'],
  ['turn_around()', 'Turn to face the opposite way.'],
  ['path_clear()', 'True when the tile in front of Bit is safe to roll onto.'],
  ['crystals_left()', 'How many crystals are still on the board.'],
  ['tile_color()', '"orange", "blue", or "plain": the color of the tile under Bit.'],
  ['read_sign()', 'The number on the sign under Bit.'],
  ['read_map()', 'The list written on Bit’s treasure map.'],
  ['say("Hi!")', 'Bit says something. print() does the same.'],
];
export const pythonBook = [
  ['for i in range(3):', 'Repeat the indented lines 3 times.'],
  ['for item in my_list:', 'Repeat once for every item in a list.'],
  ['while question:', 'Repeat for as long as the question is True.'],
  ['if / elif / else', 'Choose which lines to run.'],
  ['def name(a, b):', 'Invent a new command. return sends a value back.'],
  ['x = 5', 'Store a value in a variable. Also += -= *='],
  ['+ - * / // %', 'Math: add, subtract, multiply, divide, whole division, remainder.'],
  ['== != < > <= >=', 'Compare two values.'],
  ['and  or  not', 'Combine True/False answers.'],
  ['[1, 2, 3]', 'A list. Pick items with my_list[0]. Add items with my_list.append(4).'],
  ['len()  range()  str()  int()  abs()  min()  max()', 'Handy built-in helpers.'],
  ['# a note', 'A comment. Bit ignores everything after the #.'],
];
