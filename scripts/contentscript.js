function injectScriptAsModule(file) {
    const script = document.createElement('script');
    script.type = 'module'; // This makes the script be treated as a module
    script.src = chrome.runtime.getURL(file);
    
    script.onload = function() {
        this.remove(); // Clean up after the script runs
    };

    script.onerror = function() {
        console.error(`Failed to inject script: ${file}`);
    };
    
    (document.head || document.documentElement).appendChild(script);
}

// Inject the custom script as a module
injectScriptAsModule('./injectedScript.js');
