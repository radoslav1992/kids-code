// Runs off the UI thread. Stop/timeout terminates this worker completely.
const BASE = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
let python;
let loading;
async function initialize() {
  if (!loading) loading = (async () => {
    const {loadPyodide} = await import(BASE + 'pyodide.mjs');
    python = await loadPyodide({indexURL: BASE});
  })();
  return loading;
}
self.onmessage = async ({data}) => {
  const {id, code, input} = data;
  let output = '', scope, outputExceeded = false, ready = false;
  try {
    await initialize();
    ready = true;
    self.postMessage({type:'ready', id});
    if (typeof code !== 'string' || code.length > 50000) throw Error('Please keep your program under 50,000 characters.');
    const lines = typeof input === 'string' && input.length ? input.replace(/\r/g,'').split('\n') : [];
    let position = 0;
    python.setStdin({stdin:() => lines[position++]});
    const decoder = new TextDecoder();
    const write = buffer => {
      const part = decoder.decode(buffer, {stream:true});
      if(output.length + part.length > 30000) {outputExceeded = true; throw Error('Output limit reached. Try printing fewer lines.');}
      output += part;
      return buffer.length;
    };
    python.setStdout({write});
    python.setStderr({write});
    scope = python.toPy({__name__:'__main__'});
    const result = await python.runPythonAsync(code, {globals:scope, filename:'my_adventure.py'});
    result?.destroy?.();
    // Flush programs which use print(..., end='').
    python.runPython('import sys; sys.stdout.flush(); sys.stderr.flush()');
    if (outputExceeded) throw Error('Output limit reached. Try printing fewer lines.');
    self.postMessage({type:'done', id, output});
  } catch (error) {
    self.postMessage({type:'error', id, output, stage:ready?'run':'load', error:outputExceeded?'Output limit reached. Try printing fewer lines.':String(error?.message || error).slice(-6000)});
  } finally {scope?.destroy();}
};
