'use strict';

const keyInput = document.getElementById('key');
const statusEl = document.getElementById('status');

function say(text, isError) {
  statusEl.textContent = text;
  statusEl.className = isError ? 'err' : '';
}

function send(msg) {
  return new Promise((resolve) => chrome.runtime.sendMessage(msg, (r) => resolve(r || { ok: false, error: 'Extension did not respond. Reload it and try again.' })));
}

async function save(key) {
  say('Checking…');
  const r = await send({ type: 'SET_KEY', key });
  if (!r.ok) return say(r.error, true);
  keyInput.value = '';
  keyInput.placeholder = r.custom ? 'Your own key is saved' : 'e.g. a1b2c3d4';
  say(r.custom ? 'Saved. Reload your Netflix tab.' : 'Back to the shared key. Reload your Netflix tab.');
}

document.getElementById('save').addEventListener('click', () => {
  const key = keyInput.value.trim();
  if (!key) return say('Paste a key first.', true);
  save(key);
});
document.getElementById('clear').addEventListener('click', () => save(''));

send({ type: 'GET_KEY' }).then((r) => {
  if (r.custom) keyInput.placeholder = 'Your own key is saved';
});
