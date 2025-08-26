// Authentication JavaScript - Handles login and signup functionality
// This section manages user authentication for the login and signup pages

/**
 * Initialize authentication event listeners
 */
document.addEventListener('DOMContentLoaded', function() {
    setupAuthEventListeners();
});

/**
 * Setup event listeners for authentication forms
 * This section handles form submissions for login and signup pages
 */
function setupAuthEventListeners() {
    // Login form submission - connects to login page
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Signup form submission - connects to signup page  
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignup);
    }
}

/**
 * Handle login form submission
 * Connects to: login page form
 * Database table: users
 * @param {Event} event - Form submit event
 */
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    
    // Validate input
    if (!email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    if (!isValidEmail(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    showLoading();
    
    try {
        // API call to backend authentication endpoint
        // Connects to: BE/api_database.py - /auth/login endpoint
        const response = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({
                email: email,
                password: password
            })
        });
        
        // Store authentication data - use access_token field from backend
        const token = response.access_token || response.token;
        console.log('Storing token:', token); // Debug log
        localStorage.setItem('authToken', token);
        localStorage.setItem('userData', JSON.stringify(response.user));
        
        // Update application state
        AppState.currentUser = response.user;
        AppState.isAuthenticated = true;
        
        console.log('Login successful, showing main app...'); // Debug log
        
        // Show main application
        showMainApp();
        loadDashboard();
        
        showToast(`Welcome back, ${response.user.name || response.user.fullName}!`, 'success');
        
    } catch (error) {
        console.error('Login error:', error);
        showToast(error.message || 'Login failed. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Handle signup form submission
 * Connects to: signup page form
 * Database table: users
 * @param {Event} event - Form submit event
 */
async function handleSignup(event) {
    event.preventDefault();
    
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    
    // Validate input
    if (!name || !email || !password || !confirmPassword) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    if (!isValidEmail(email)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
        showToast(passwordValidation.message, 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    showLoading();
    
    try {
        // API call to backend authentication endpoint
        // Connects to: BE/api_database.py - /auth/register endpoint
        const response = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                username: email.split('@')[0], // Use email prefix as username
                fullName: name,
                email: email,
                password: password
            })
        });
        
        showToast('Account created successfully! Please log in.', 'success');
        
        // Switch to login page
        showLogin();
        
        // Pre-fill email in login form
        document.getElementById('login-email').value = email;
        
    } catch (error) {
        console.error('Signup error:', error);
        showToast(error.message || 'Signup failed. Please try again.', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Check if user is authenticated
 * Used by other pages to verify authentication status
 * @returns {boolean} True if user is authenticated
 */
function isAuthenticated() {
    const token = localStorage.getItem('authToken');
    const userData = localStorage.getItem('userData');
    return !!(token && userData);
}

/**
 * Get current user data
 * Used by other pages to access user information
 * @returns {object|null} User data or null if not authenticated
 */
function getCurrentUser() {
    const userData = localStorage.getItem('userData');
    return userData ? JSON.parse(userData) : null;
}

/**
 * Refresh authentication token
 * Called periodically to maintain session
 */
async function refreshToken() {
    try {
        const response = await apiRequest('/auth/refresh', {
            method: 'POST'
        });
        
        localStorage.setItem('authToken', response.token);
        
    } catch (error) {
        console.error('Token refresh failed:', error);
        // If refresh fails, logout user
        logout();
    }
}

// Set up token refresh interval (every 30 minutes)
setInterval(refreshToken, 30 * 60 * 1000);

// Export functions for use in other modules
window.isAuthenticated = isAuthenticated;
window.getCurrentUser = getCurrentUser;
window.refreshToken = refreshToken;
