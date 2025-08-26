// Settings JavaScript - Clean version without syntax errors
console.log('📄 Settings.js script loaded successfully - CLEAN VERSION');

/**
 * Load settings page content
 */
async function loadSettings() {
    console.log('🔧 Loading settings page');
    const settingsContainer = document.getElementById('settings-page');
    
    if (!settingsContainer) {
        console.error('❌ Settings container not found!');
        return;
    }
    
    showLoading();
    
    try {
        // Get user profile data
        let profile = {};
        try {
            const userData = localStorage.getItem('userData');
            profile = userData ? JSON.parse(userData) : {};
        } catch (error) {
            console.warn('Error loading profile data:', error);
        }
        
        // Use AppState if available
        if ((!profile || !profile.name) && AppState.currentUser) {
            profile = { ...profile, ...AppState.currentUser };
        }
        
        // Set default values
        profile = {
            name: profile.name || profile.fullName || 'User',
            email: profile.email || 'user@example.com',
            phone: profile.phone || '',
            dateOfBirth: profile.dateOfBirth || '',
            photo: profile.photo || 'default-avatar.png'
        };
        
        // Construct profile picture URL
        let profilePictureUrl = `${API_BASE_URL}/default-avatar.png`;
        if (profile.photo && profile.photo !== 'default-avatar.png') {
            profilePictureUrl = `http://localhost:5000/uploads/profile_pictures/${profile.photo}`;
        }
        
        // Render settings page
        settingsContainer.innerHTML = `
            <div class="max-w-4xl mx-auto p-6">
                <h1 class="text-3xl font-bold text-gray-800 mb-8">Settings</h1>
                
                <!-- Profile Section -->
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 class="text-xl font-semibold text-gray-800 mb-4">Profile Information</h2>
                    <div class="flex items-center space-x-6 mb-6">
                        <div class="relative">
                            <img id="profile-picture" src="${profilePictureUrl}" alt="Profile" 
                                 class="w-20 h-20 rounded-full object-cover border-4 border-gray-200">
                            <button onclick="document.getElementById('profile-picture-input').click()" 
                                    class="absolute bottom-0 right-0 bg-indigo-600 text-white rounded-full p-2 hover:bg-indigo-700">
                                <i class="fas fa-camera text-xs"></i>
                            </button>
                            <input type="file" id="profile-picture-input" accept="image/*" class="hidden" 
                                   onchange="uploadProfilePicture(this.files[0])">
                        </div>
                        <div>
                            <h3 class="text-lg font-medium text-gray-800">${profile.name}</h3>
                            <p class="text-gray-600">${profile.email}</p>
                        </div>
                    </div>
                    
                    <form id="profile-form" class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                                <input type="text" id="full-name" value="${profile.name}" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                <input type="tel" id="phone" value="${profile.phone}" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                                <input type="date" id="date-of-birth" value="${profile.dateOfBirth}" 
                                       class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            </div>
                        </div>
                        <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                            Update Profile
                        </button>
                    </form>
                </div>
                
                <!-- Password Section -->
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 class="text-xl font-semibold text-gray-800 mb-4">Change Password</h2>
                    <form id="password-form" class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                            <input type="password" id="current-password" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                            <input type="password" id="new-password" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                            <input type="password" id="confirm-password" 
                                   class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>
                        <button type="submit" class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                            Change Password
                        </button>
                    </form>
                </div>
                
                <!-- Detection Settings -->
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 class="text-xl font-semibold text-gray-800 mb-4">Detection & Alarm Settings</h2>
                    <div class="space-y-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                Trigger Time: <span id="settings-trigger-display">3s</span>
                            </label>
                            <input type="range" id="settings-trigger-time" min="1" max="10" value="3" 
                                   class="w-full" onchange="updateSettingsTriggerTime(this.value)">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                Volume: <span id="settings-volume-display">80%</span>
                            </label>
                            <input type="range" id="settings-volume" min="0" max="1" step="0.1" value="0.8" 
                                   class="w-full" onchange="updateSettingsVolume(this.value)">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">
                                Detection Sensitivity: <span id="sensitivity-display">70%</span>
                            </label>
                            <input type="range" id="sensitivity" min="0" max="1" step="0.1" value="0.7" 
                                   class="w-full" onchange="updateDetectionSensitivity(this.value)">
                        </div>
                        <button onclick="saveDetectionSettings()" 
                                class="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700">
                            Save Settings
                        </button>
                    </div>
                </div>
                
                <!-- Data Management -->
                <div class="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 class="text-xl font-semibold text-gray-800 mb-4">Data Management</h2>
                    <div class="space-y-4">
                        <button onclick="exportUserData()" 
                                class="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700">
                            <i class="fas fa-download mr-2"></i>Export Data
                        </button>
                        <button onclick="clearDetectionHistory()" 
                                class="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700">
                            <i class="fas fa-trash mr-2"></i>Clear History
                        </button>
                        <button onclick="deleteAccount()" 
                                class="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">
                            <i class="fas fa-user-times mr-2"></i>Delete Account
                        </button>
                    </div>
                </div>
                
                <!-- About -->
                <div class="bg-white rounded-lg shadow-md p-6">
                    <h2 class="text-xl font-semibold text-gray-800 mb-4">About</h2>
                    <p class="text-gray-600 mb-4">Drowsiness Detection System v1.0</p>
                    <button onclick="showContactSupport()" 
                            class="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
                        Contact Support
                    </button>
                </div>
            </div>
        `;
        
        // Add event listeners
        setTimeout(() => {
            const profileForm = document.getElementById('profile-form');
            const passwordForm = document.getElementById('password-form');
            
            if (profileForm) {
                profileForm.addEventListener('submit', handleProfileUpdate);
            }
            
            if (passwordForm) {
                passwordForm.addEventListener('submit', handlePasswordChange);
            }
        }, 100);
        
        hideLoading();
        
    } catch (error) {
        console.error('Error loading settings:', error);
        hideLoading();
        showToast('Failed to load settings', 'error');
    }
}

// Utility functions
function updateSettingsTriggerTime(value) {
    document.getElementById('settings-trigger-display').textContent = `${value}s`;
}

function updateSettingsVolume(value) {
    document.getElementById('settings-volume-display').textContent = `${Math.round(value * 100)}%`;
}

function updateDetectionSensitivity(value) {
    document.getElementById('sensitivity-display').textContent = `${Math.round(value * 100)}%`;
}

// Placeholder functions for form handlers
async function handleProfileUpdate(event) {
    event.preventDefault();
    showToast('Profile update functionality coming soon', 'info');
}

async function handlePasswordChange(event) {
    event.preventDefault();
    showToast('Password change functionality coming soon', 'info');
}

async function uploadProfilePicture(file) {
    if (!file) return;
    showToast('Profile picture upload functionality coming soon', 'info');
}

async function saveDetectionSettings() {
    showToast('Detection settings saved', 'success');
}

async function exportUserData() {
    showToast('Export functionality coming soon', 'info');
}

async function clearDetectionHistory() {
    if (confirm('Are you sure you want to clear all detection history?')) {
        showToast('History cleared', 'success');
    }
}

async function deleteAccount() {
    const confirmation = prompt('Type "DELETE" to confirm account deletion:');
    if (confirmation === 'DELETE') {
        showToast('Account deletion functionality coming soon', 'info');
    }
}

function showContactSupport() {
    showToast('Contact support functionality coming soon', 'info');
}

// Export to window
window.loadSettings = loadSettings;
window.updateSettingsTriggerTime = updateSettingsTriggerTime;
window.updateSettingsVolume = updateSettingsVolume;
window.updateDetectionSensitivity = updateDetectionSensitivity;
window.handleProfileUpdate = handleProfileUpdate;
window.handlePasswordChange = handlePasswordChange;
window.uploadProfilePicture = uploadProfilePicture;
window.saveDetectionSettings = saveDetectionSettings;
window.exportUserData = exportUserData;
window.clearDetectionHistory = clearDetectionHistory;
window.deleteAccount = deleteAccount;
window.showContactSupport = showContactSupport;

console.log('✅ Clean settings.js loaded and functions exported to window');
