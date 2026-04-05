(() => {
  const SCRIPT_ID = 'prepdex-injected-module';
  if (document.getElementById(SCRIPT_ID)) return;

  const script = document.createElement('script');
  script.id = SCRIPT_ID;
  script.type = 'module';
  script.src = chrome.runtime.getURL('scripts/injectedScript.js');
  script.onload = function () { this.remove(); };
  script.onerror = function () {
    console.error('PrepDex: failed to inject scripts/injectedScript.js');
  };

  (document.head || document.documentElement).appendChild(script);

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'PREPDEX_OPEN') {
      window.dispatchEvent(new CustomEvent('prepdex:open'));
      sendResponse({ ok: true });
      return;
    }
    if (message?.type === 'PREPDEX_CLEAR') {
      window.dispatchEvent(new CustomEvent('prepdex:clear'));
      sendResponse({ ok: true });
      return;
    }
    if (message?.type === 'PREPDEX_PLANNER_CLEAR') {
      window.dispatchEvent(new CustomEvent('prepdex:planner-clear'));
      sendResponse({ ok: true });
    }
  });
})();
