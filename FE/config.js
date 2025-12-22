// Central configuration file - edit here to change API port
const CONFIG = {
    API_PORT: 5050,
    API_HOST: 'localhost',
    get API_BASE_URL() {
        return `http://${this.API_HOST}:${this.API_PORT}/api`;
    },
    get ASSET_URL() {
        return `http://${this.API_HOST}:${this.API_PORT}`;
    },
    get AUDIO_BASE_URL() {
        return `http://${this.API_HOST}:5050`;
    }
};

// Make it global so all scripts can access
window.CONFIG = CONFIG;
