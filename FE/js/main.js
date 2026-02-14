// Main JavaScript - Core application functionality
// This file handles navigation, authentication state, and global utilities

// Global application state
const AppState = {
    currentUser: null,
    isAuthenticated: false,
    currentPage: 'dashboard',
    detectionActive: false,
    alarmActive: false,
    currentSessionId: null,
    isStopping: false
};

// API Configuration
const API_BASE_URL = window.CONFIG?.API_BASE_URL || 'http://localhost:5050/api';

// Initialize application
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
    setupEventListeners();
});

/**
 * Initialize the application
 * Check authentication status and setup initial state
 */
function initializeApp() {
    // Check if user is logged in (from localStorage)
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');

    if (token && userData) {
        AppState.currentUser = JSON.parse(userData);
        AppState.isAuthenticated = true;
        showMainApp();
        loadDashboard(); // Load dashboard by default
    } else {
        showAuthSection();
    }
}

/**
 * Setup global event listeners
 */
function setupEventListeners() {
    // Mobile menu toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuBtn && mobileMenu) {
        mobileMenuBtn.addEventListener('click', function () {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // Close mobile menu when clicking outside
    document.addEventListener('click', function (event) {
        if (mobileMenu && !mobileMenu.contains(event.target) && !mobileMenuBtn.contains(event.target)) {
            mobileMenu.classList.add('hidden');
        }
    });
}

/**
 * Show authentication section (login/signup)
 */
function showAuthSection() {
    document.getElementById('auth-section').classList.remove('hidden');
    document.getElementById('app-section').classList.add('hidden');
    document.getElementById('navbar').classList.add('hidden');
    AppState.isAuthenticated = false;
}

/**
 * Show main application after successful login
 */
function showMainApp() {
    console.log('showMainApp called'); // Debug log
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('app-section').classList.remove('hidden');
    document.getElementById('navbar').classList.remove('hidden');
    AppState.isAuthenticated = true;
    console.log('Main app should now be visible'); // Debug log
}

/**
 * Show login page
 */
function showLogin() {
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('signup-page').classList.add('hidden');
}

/**
 * Show signup page
 */
function showSignup() {
    document.getElementById('login-page').classList.add('hidden');
    document.getElementById('signup-page').classList.remove('hidden');
}

// Page loading function names mapped to their script files
const PAGE_SCRIPTS = {
    'dashboard': 'loadDashboard',
    'detection': 'loadDetection',
    'history': 'loadHistoryPage',
    'settings': 'loadSettings'
};

/**
 * Show specific page content
 * @param {string} pageId - The ID of the page to show (dashboard, detection, history, settings)
 */
async function showPage(pageId) {
    console.log('Navigating to page:', pageId);

    // End current session if leaving detection page
    if (AppState.currentPage === 'detection' && pageId !== 'detection') {
        if (typeof endSessionOnNavigate === 'function') {
            await endSessionOnNavigate();
        } else {
            console.error('endSessionOnNavigate function not found. Was detection.js loaded?');
        }
    }

    // Hide all page sections
    const pageSections = document.querySelectorAll('[id$="-page"]');
    pageSections.forEach(section => section.classList.add('hidden'));

    // Show selected page
    const targetPage = document.getElementById(`${pageId}-page`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
        AppState.currentPage = pageId;

        // Update active navigation
        updateNavigation(pageId);

        // Load page-specific content if the function exists in the global scope
        const pageFunction = window[PAGE_SCRIPTS[pageId]];
        if (typeof pageFunction === 'function') {
            try {
                await pageFunction();
            } catch (error) {
                console.error(`Error loading ${pageId} page:`, error);
                showToast(`Error loading ${pageId} page`, 'error');
            }
        } else {
            console.warn(`Page function ${PAGE_SCRIPTS[pageId]} not found`);
        }
    } else {
        console.error('Page not found:', pageId);
        showToast('Page not found', 'error');
        // Fallback to dashboard if page not found
        if (pageId !== 'dashboard') {
            showPage('dashboard');
        }
    }

    // Close mobile menu if open
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu) {
        mobileMenu.classList.add('hidden');
    }
}

/**
 * Update navigation active state
 * @param {string} activePage - Currently active page
 */
function updateNavigation(activePage) {
    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Add active class to current page link
    const activeLink = document.querySelector(`[onclick="showPage('${activePage}')"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }
}

/**
 * Logout user and return to login page
 */
function logout() {
    // Clear authentication data
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');

    // Reset application state
    AppState.currentUser = null;
    AppState.isAuthenticated = false;
    AppState.detectionActive = false;
    AppState.alarmActive = false;

    // Stop any active detection
    if (AppState.detectionActive) {
        stopDetection();
    }

    // Show authentication section
    showAuthSection();
    showLogin();

    // Show logout message
    showToast('Logged out successfully', 'success');
}

/**
 * Show loading overlay
 */
function showLoading() {
    document.getElementById('loading-overlay').classList.remove('hidden');
}

/**
 * Hide loading overlay
 */
function hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type of toast (success, error, warning, info)
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
    const toastContainer = document.getElementById('toast-container');

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Toast content
    toast.innerHTML = `
        <div class="flex items-center justify-between">
            <div class="flex items-center">
                <i class="fas ${getToastIcon(type)} mr-2"></i>
                <span>${message}</span>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" class="ml-4 text-gray-400 hover:text-gray-600">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    // Add to container
    toastContainer.appendChild(toast);

    // Auto remove after duration
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, duration);
}

/**
 * Get icon for toast type
 * @param {string} type - Toast type
 * @returns {string} Font Awesome icon class
 */
function getToastIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        case 'info':
        default: return 'fa-info-circle';
    }
}

/**
 * Make API request with authentication
 * @param {string} endpoint - API endpoint
 * @param {object} options - Fetch options
 * @returns {Promise} API response
 */
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('authToken');
    console.log('Token from localStorage:', token); // Debug log

    // Create headers with authorization if token exists
    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Don't set Content-Type for FormData - let the browser set it with the correct boundary
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    const finalOptions = {
        ...options,
        headers: {
            ...headers,
            ...options.headers
        }
    };

    try {
        console.log(`Making API request to: ${API_BASE_URL}${endpoint}`); // Debug log
        const response = await fetch(`${API_BASE_URL}${endpoint}`, finalOptions);
        console.log(`API response status: ${response.status}`); // Debug log

        // Handle unauthorized
        if (response.status === 401) {
            // For login endpoint, don't logout and show the specific error message
            if (endpoint === '/auth/login') {
                const errorData = await response.json();
                throw new Error(errorData.message || errorData.error || 'Invalid email or password');
            }
            logout();
            throw new Error('Unauthorized');
        }

        if (!response.ok) {
            const error = new Error('API request failed');
            error.status = response.status;
            try {
                // Attach the full JSON error response to the error object
                error.body = await response.json();
            } catch (e) {
                error.body = { error: 'Could not parse error response.' };
            }

            // Create a user-friendly message, but the full details are in error.body
            let userMessage;
            switch (error.status) {
                case 400:
                    userMessage = error.body.error || 'Please check your input and try again.';
                    break;
                case 401:
                    userMessage = 'Please log in to continue.';
                    break;
                case 403:
                    userMessage = 'You don\'t have permission to perform this action.';
                    break;
                case 404:
                    userMessage = 'The requested resource was not found.';
                    break;
                case 409:
                    userMessage = error.body.error || 'This action conflicts with existing data.';
                    break;
                case 500:
                    userMessage = error.body.error || 'Something went wrong on our end. Please try again later.';
                    break;
                default:
                    userMessage = error.body.error || 'Something went wrong. Please try again.';
            }
            error.message = userMessage;
            throw error; // Throw the enriched error object
        }

        const data = await response.json();

        return data;
    } catch (error) {
        console.error('API Request Error:', error);

        // Handle network errors with user-friendly messages
        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            throw new Error('Unable to connect to server. Please check your internet connection and try again.');
        }

        throw error;
    }
}

/**
 * Format date for display
 * @param {string|Date} date - Date to format
 * @returns {string} Formatted date string
 */
function formatDate(date) {
    // Debug: log the input and output
    console.log('formatDate input:', date);

    const dateObj = new Date(date);
    console.log('Date object:', dateObj);
    console.log('UTC time:', dateObj.toUTCString());
    console.log('Local time:', dateObj.toString());

    const formatted = dateObj.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Jakarta'
    });

    console.log('Formatted result:', formatted);
    return formatted;
}

/**
 * Format duration in seconds to readable format
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration
 */
function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = parseFloat((seconds % 60).toFixed(2));

    if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    } else {
        return `${secs}s`;
    }
}

/**
 * Debounce function to limit function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate password strength
 * @param {string} password - Password to validate
 * @returns {object} Validation result with isValid and message
 */
function validatePassword(password) {
    if (password.length < 8) {
        return { isValid: false, message: 'Password must be at least 8 characters long' };
    }

    if (!/(?=.*[a-z])/.test(password)) {
        return { isValid: false, message: 'Password must contain at least one lowercase letter' };
    }

    if (!/(?=.*[A-Z])/.test(password)) {
        return { isValid: false, message: 'Password must contain at least one uppercase letter' };
    }

    if (!/(?=.*\d)/.test(password)) {
        return { isValid: false, message: 'Password must contain at least one number' };
    }

    return { isValid: true, message: 'Password is strong' };
}

// Handle page navigation - end active session
function endCurrentSession() {
    if (AppState.currentSessionId) {
        console.log(`Ending session ${AppState.currentSessionId} due to page navigation`);

        // Use sendBeacon for reliable delivery during page unload
        const data = {
            session_id: AppState.currentSessionId,
            jwt: localStorage.getItem('authToken')
        };

        navigator.sendBeacon(
            `${API_BASE_URL}/api/detection/end-session`,
            new Blob([JSON.stringify(data)], { type: 'application/json' })
        );

        // Clear session ID
        AppState.currentSessionId = null;
        localStorage.removeItem('currentSessionId');
    }
}

// Page loading functions
function loadDashboard() {
    console.log('Loading dashboard...');
    // Dashboard content will be loaded here
    document.getElementById('dashboard-page').innerHTML = `
        <div class="bg-white rounded-xl shadow p-6">
            <h2 class="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <!-- Dashboard cards will be loaded here -->
                <div class="bg-indigo-50 p-6 rounded-lg">
                    <h3 class="text-lg font-semibold text-indigo-700">Total Detections</h3>
                    <p id="total-detections" class="text-3xl font-bold text-indigo-900 mt-2">0</p>
                </div>
                <div class="bg-green-50 p-6 rounded-lg">
                    <h3 class="text-lg font-semibold text-green-700">Active Sessions</h3>
                    <p id="active-sessions" class="text-3xl font-bold text-green-900 mt-2">0</p>
                </div>
            </div>
        </div>
    `;
}

function loadDetectionPage() {
    console.log('Loading detection page...');
    // Detection page content will be loaded here
    document.getElementById('detection-page').innerHTML = `
        <div class="bg-white rounded-xl shadow p-6">
            <h2 class="text-2xl font-bold text-gray-800 mb-6">Drowsiness Detection</h2>
            <div class="flex flex-col items-center">
                <div id="video-container" class="w-full max-w-2xl mb-6">
                    <video id="video" autoplay playsinline class="w-full h-auto rounded-lg border border-gray-200"></video>
                </div>
                <div class="flex space-x-4">
                    <button id="start-detection" class="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-medium">
                        <i class="fas fa-play mr-2"></i>Start Detection
                    </button>
                    <button id="stop-detection" class="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-lg font-medium hidden">
                        <i class="fas fa-stop mr-2"></i>Stop Detection
                    </button>
                </div>
            </div>
        </div>
    `;
}

function loadHistoryPage() {
    console.log('Loading history page...');
    // History page content will be loaded here
    document.getElementById('history-page').innerHTML = `
        <div class="bg-white rounded-xl shadow p-6">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">Detection History</h2>
                <div class="flex space-x-2">
                    <input type="date" id="history-date" class="border rounded-lg px-3 py-2">
                    <button id="refresh-history" class="bg-indigo-100 hover:bg-indigo-200 text-indigo-700 px-4 py-2 rounded-lg">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                </div>
            </div>
            <div id="history-list" class="space-y-4">
                <!-- History items will be loaded here -->
                <div class="text-center text-gray-500 py-8">
                    <i class="fas fa-history text-4xl mb-2"></i>
                    <p>No detection history found</p>
                </div>
            </div>
        </div>
    `;
}

function loadSettingsPage() {
    const settingsContainer = document.getElementById('settings-page');

    settingsContainer.innerHTML = `
        <div class="fade-in">
            <!-- Settings Header Section -->
            <div class="mb-8">
                <h1 class="text-4xl font-bold text-gray-800 mb-2">
                    <i class="fas fa-cog text-indigo-600 mr-3"></i>
                    Settings
                </h1>
                <p class="text-gray-600">Manage your profile and detection preferences</p>
            </div>

            <!-- Settings Content -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <!-- Profile Section -->
                <div class="lg:col-span-1">
                    <div class="bg-white rounded-xl shadow-lg p-6">
                        <h2 class="text-2xl font-bold text-gray-800 mb-4">
                            <i class="fas fa-user text-indigo-600 mr-2"></i>
                            Profile
                        </h2>
                        <div class="text-center mb-6">
                            <div class="relative inline-block">
                                <img id="profile-picture" src="/uploads/profile_pictures/default.jpg" 
                                     alt="Profile Picture" class="w-24 h-24 rounded-full object-cover border-4 border-indigo-200">
                                <button class="absolute bottom-0 right-0 bg-indigo-600 text-white rounded-full p-2 hover:bg-indigo-700 transition duration-300">
                                    <i class="fas fa-camera text-sm"></i>
                                </button>
                            </div>
                        </div>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                <input type="text" id="profile-name" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                <input type="email" id="profile-email" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent">
                            </div>
                            <button class="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition duration-300">
                                <i class="fas fa-save mr-2"></i>Update Profile
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Settings Sections -->
                <div class="lg:col-span-2 space-y-6">
                    <!-- Detection Settings -->
                    <div class="bg-white rounded-xl shadow-lg p-6">
                        <h2 class="text-2xl font-bold text-gray-800 mb-4">
                            <i class="fas fa-eye text-indigo-600 mr-2"></i>
                            Detection Settings
                        </h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Detection Sensitivity</label>
                                <input type="range" id="detection-sensitivity" min="0.1" max="1" step="0.1" value="0.7" 
                                       class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer">
                                <div class="flex justify-between text-xs text-gray-500 mt-1">
                                    <span>Low</span>
                                    <span>High</span>
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Alarm Trigger Time</label>
                                <select id="alarm-trigger-time" class="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500">
                                    <option value="3">3 seconds</option>
                                    <option value="5" selected>5 seconds</option>
                                    <option value="10">10 seconds</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Notification Settings -->
                    <div class="bg-white rounded-xl shadow-lg p-6">
                        <h2 class="text-2xl font-bold text-gray-800 mb-4">
                            <i class="fas fa-bell text-indigo-600 mr-2"></i>
                            Notifications
                        </h2>
                        <div class="space-y-4">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h3 class="font-medium text-gray-800">Sound Alerts</h3>
                                    <p class="text-sm text-gray-600">Play sound when drowsiness is detected</p>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" class="sr-only peer" checked>
                                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                            <div class="flex items-center justify-between">
                                <div>
                                    <h3 class="font-medium text-gray-800">Email Notifications</h3>
                                    <p class="text-sm text-gray-600">Receive email alerts for detection sessions</p>
                                </div>
                                <label class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" class="sr-only peer">
                                    <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Data Management -->
                    <div class="bg-white rounded-xl shadow-lg p-6">
                        <h2 class="text-2xl font-bold text-gray-800 mb-4">
                            <i class="fas fa-database text-indigo-600 mr-2"></i>
                            Data Management
                        </h2>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button class="bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition duration-300">
                                <i class="fas fa-download mr-2"></i>Export Data
                            </button>
                            <button class="bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition duration-300">
                                <i class="fas fa-trash mr-2"></i>Clear History
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Handle page unload
window.addEventListener('beforeunload', endCurrentSession);

// Handle page hide (mobile browsers)
window.addEventListener('pagehide', endCurrentSession);

// Handle navigation within SPA
window.addEventListener('popstate', function () {
    if (window.location.pathname !== '/detection' && AppState.currentSessionId) {
        endCurrentSession();
    }
});

// Export functions for use in other modules
window.AppState = AppState;
window.showPage = showPage;
window.showLogin = showLogin;
window.showSignup = showSignup;
window.logout = logout;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showToast = showToast;
window.apiRequest = apiRequest;
window.formatDate = formatDate;
window.formatDuration = formatDuration;
window.isValidEmail = isValidEmail;
window.validatePassword = validatePassword;
