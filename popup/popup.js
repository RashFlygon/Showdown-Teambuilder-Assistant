async function getShowdownTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs.find((tab) => /^https?:\/\/play\.pokemonshowdown\.com\//.test(tab.url || '')) || null;
}

async function sendToShowdown(message) {
  const tab = await getShowdownTab();
  if (!tab?.id) throw new Error('Open Pokemon Showdown in the current tab first.');
  await chrome.tabs.sendMessage(tab.id, message);
}

function setStatus(text) {
  document.getElementById('popup-status').textContent = text;
}

document.getElementById('open-prepdex').addEventListener('click', async () => {
  try {
    await sendToShowdown({ type: 'PREPDEX_OPEN' });
    setStatus('PrepDex home opened in Showdown.');
  } catch (error) {
    setStatus(error.message || 'Could not open PrepDex.');
  }
});

document.getElementById('clear-prepdex').addEventListener('click', async () => {
  try {
    await sendToShowdown({ type: 'PREPDEX_CLEAR' });
    setStatus('Saved PrepDex data cleared.');
  } catch (error) {
    setStatus(error.message || 'Could not clear saved data.');
  }
});
