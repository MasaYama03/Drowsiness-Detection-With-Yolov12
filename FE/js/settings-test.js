// Minimal test version to isolate the issue
console.log('🧪 Test settings.js loaded');

async function loadSettings() {
    console.log('🧪 Test loadSettings function called');
    const settingsContainer = document.getElementById('settings-page');
    
    if (!settingsContainer) {
        console.error('❌ Settings container not found!');
        return;
    }
    
    settingsContainer.innerHTML = `
        <div class="p-6">
            <h1 class="text-2xl font-bold text-gray-800 mb-6">Settings (Test Version)</h1>
            <p class="text-gray-600">This is a minimal test version to verify the function loads correctly.</p>
        </div>
    `;
}

// Export to window
window.loadSettings = loadSettings;
console.log('🧪 Test loadSettings attached to window');
