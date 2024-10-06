function injectScriptAsModule(file) {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = chrome.runtime.getURL(file);
    
    script.onload = function() {
        console.log(`${file} has been injected successfully.`);
        this.remove(); // Clean up after script runs
    };
    
    script.onerror = function() {
        console.error(`Failed to inject script: ${file}`);
    };
    
    (document.head || document.documentElement).appendChild(script);
}




// Inject the custom script as a module
injectScriptAsModule('scripts/injectedScript.js');

const script = document.createElement('script');
script.src = 'https://unpkg.com/@pkmn/dex';  // Load Dex from unpkg
script.onload = () => {
    console.log('Dex loaded successfully');
    console.log(pkmn.Dex.species.get('Pikachu'));  // Example: Log Pikachu's data
};
script.onerror = () => console.error('Failed to load Dex');
(document.head || document.documentElement).appendChild(script);

