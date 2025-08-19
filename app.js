
let pyodideReadyPromise;

async function setupPyodide() {
  self.languagePluginUrl = 'https://cdn.jsdelivr.net/pyodide/v0.25.1/full/';
  const pyodide = await loadPyodide({indexURL: self.languagePluginUrl});
  // Provide a shim Python module: tries to import user's module, else defines simple rules
  const shim = `
import sys, importlib

# Try to import user's game logic
try:
    import kkunmal_wordchain as wc
    _HAS_USER = True
except Exception:
    wc = None
    _HAS_USER = False

# Fallback simple rules
def _basic_is_valid_move(prev, curr):
    prev = (prev or '').strip()
    curr = (curr or '').strip()
    if not prev: return True
    if not curr: return False
    # last char of prev == first char of curr
    return prev[-1] == curr[0]

def _basic_sanitize(word):
    return word.strip()

def is_valid_move(prev, curr):
    if _HAS_USER and hasattr(wc, 'is_valid_move'):
        try:
            return bool(wc.is_valid_move(prev, curr))
        except Exception:
            pass
    return _basic_is_valid_move(prev, curr)

def sanitize(word):
    if _HAS_USER and hasattr(wc, 'sanitize'):
        try:
            return wc.sanitize(word)
        except Exception:
            pass
    return _basic_sanitize(word)
`;
  await pyodide.runPythonAsync(shim);

  // Try to load user's python file if present in the same directory
  try {
    const resp = await fetch('kkunmal_wordchain.py', {cache:'no-store'});
    if (resp.ok) {
      const code = await resp.text();
      pyodide.FS.writeFile('kkunmal_wordchain.py', code);
      await pyodide.runPythonAsync('import importlib,kkunmal_wordchain; importlib.reload(kkunmal_wordchain)');
    }
  } catch(e) {
    console.warn('User module not loaded:', e);
  }

  return pyodide;
}

async function ensurePyodide() {
  if (!pyodideReadyPromise) pyodideReadyPromise = setupPyodide();
  return pyodideReadyPromise;
}

// UI Logic
const lastWordEl = document.getElementById('lastWord');
const inputEl = document.getElementById('wordInput');
const msgEl = document.getElementById('message');
const logEl = document.getElementById('log');
const resetBtn = document.getElementById('resetBtn');
const submitBtn = document.getElementById('submitBtn');
const clearLogBtn = document.getElementById('clearLogBtn');

let lastWord = '시작';

function addLog(text){
  const li = document.createElement('li');
  li.textContent = text;
  logEl.prepend(li);
}

function setMessage(text){ msgEl.textContent = text; }

resetBtn.addEventListener('click', () => {
  lastWord = '시작';
  lastWordEl.textContent = lastWord;
  setMessage('초기화되었습니다. 다시 시작하세요.');
  inputEl.value='';
});

clearLogBtn.addEventListener('click', () => {
  logEl.innerHTML='';
});

submitBtn.addEventListener('click', async () => {
  await onSubmit();
});
inputEl.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') { await onSubmit(); }
});

async function onSubmit(){
  const py = await ensurePyodide();
  let text = inputEl.value.trim();
  if(!text){ setMessage('단어를 입력하세요.'); return; }
  // sanitize
  try {
    text = await py.runPythonAsync(`import builtins\nfrom __main__ import sanitize\nsanitize(${JSON.stringify(text)})`);
  } catch(e) { /* ignore */ }

  const ok = await py.runPythonAsync(`from __main__ import is_valid_move\nis_valid_move(${JSON.stringify(lastWord)}, ${JSON.stringify(text)})`);

  if(ok){
    addLog(`✅ ${lastWord} → ${text}`);
    lastWord = text;
    lastWordEl.textContent = lastWord;
    setMessage('좋아요! 다음 단어를 입력하세요.');
    inputEl.value='';
    inputEl.focus();
  } else {
    addLog(`⛔ 규칙 위반: ${lastWord} → ${text}`);
    setMessage('규칙 위반! 다시 시도해보세요.');
  }
}

// Warm-up
ensurePyodide().then(()=>setMessage('준비 완료! 단어를 입력해 보세요.'));
