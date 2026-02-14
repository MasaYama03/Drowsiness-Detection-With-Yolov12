// Central configuration file - edit here to change API URL
// Production: Change RAILWAY_BE_URL below to your Railway backend URL
// Development: Uses localhost:5050 as fallback
const RAILWAY_BE_URL = ''; // e.g. 'https://your-app-name.up.railway.app'

const CONFIG = {
    get API_BASE_URL() {
        const baseUrl = RAILWAY_BE_URL || 'http://localhost:5050';
        return `${baseUrl}/api`;
    },
    get ASSET_URL() {
        return RAILWAY_BE_URL || 'http://localhost:5050';
    },
    get AUDIO_BASE_URL() {
        return RAILWAY_BE_URL || 'http://localhost:5050';
    }
};

// Make it global so all scripts can access
window.CONFIG = CONFIG;
