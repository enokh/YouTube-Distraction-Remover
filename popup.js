'use strict';

const STATUS_CLEAR_MS = 1500;

function setSelected(mode) {
  document.querySelectorAll('label').forEach(l => l.classList.remove('selected'));
  const radio = document.querySelector(`input[name="mode"][value="${mode}"]`);
  if (radio) {
    radio.checked = true;
    radio.closest('label').classList.add('selected');
  }
}

async function init() {
  const { ydlMode = 'basic' } = await chrome.storage.sync.get('ydlMode');
  setSelected(ydlMode);
}

document.querySelectorAll('input[name="mode"]').forEach(radio => {
  radio.addEventListener('change', async () => {
    const mode = radio.value;
    setSelected(mode);
    await chrome.storage.sync.set({ ydlMode: mode });

    const statusEl = document.getElementById('status');
    const tabs = await chrome.tabs.query({ url: '*://*.youtube.com/*' });

    if (tabs.length === 0) {
      statusEl.textContent = 'No YouTube tab open.';
    } else {
      for (const tab of tabs) {
        chrome.tabs.sendMessage(tab.id, { type: 'YDL_SET_MODE', mode }).catch(() => {});
      }
      statusEl.textContent = 'Saved.';
    }

    setTimeout(() => { statusEl.textContent = ''; }, STATUS_CLEAR_MS);
  });
});

init();
