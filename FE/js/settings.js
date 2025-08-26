// Settings JavaScript - Handles user settings and profile management
// This section manages the settings page for user profile and preferences

/**
 * Original load settings function
 */
async function _loadSettings() {
    console.log('Loading settings...');
    
    const settingsContainer = document.getElementById('settings-page');
    if (!settingsContainer) {
        console.error('Settings container not found!');
        hideLoading();
        return;
    }
    
    showLoading();
    
    // Clear existing content to prevent duplicates
    settingsContainer.innerHTML = '';
    
    // Fetch user profile data with better error handling
    let profile = {};
    try {
        console.log('Fetching profile data from API...');
        const response = await apiRequest('/settings/profile').catch(error => {
            console.warn('API request failed, trying fallback methods:', error);
            return null;
        });
        
        if (response) {
            profile = response.profile || response;
            console.log('Profile data loaded from API:', profile);
            // Cache the successful response in localStorage
            try {
                localStorage.setItem('userData', JSON.stringify(profile));
            } catch (storageError) {
                console.warn('Failed to cache profile in localStorage:', storageError);
            }
        } else {
            // Try to get from localStorage if API fails
            console.log('Trying to load profile from localStorage...');
            const userData = localStorage.getItem('userData');
            if (userData) {
                try {
                    profile = JSON.parse(userData);
                    console.log('Profile loaded from localStorage:', profile);
                } catch (parseError) {
                    console.error('Failed to parse userData from localStorage:', parseError);
                }
            }
        }
    } catch (error) {
        console.error('Unexpected error while loading profile:', error);
        // Ensure we have at least an empty object
        profile = {};
    }
    
    // Also try to get current user from AppState
    if ((!profile || !profile.name) && AppState.currentUser) {
        profile = { ...profile, ...AppState.currentUser };
    }
    
    // Handle profile picture URL
    let profilePictureUrl = `http://localhost:5000/default-avatar.png`;
    console.log('Profile data:', profile); // Debug profile data
    if (profile.profile_photo || profile.profilePhoto) {
        const photoFilename = profile.profile_photo || profile.profilePhoto;
        console.log('Photo filename:', photoFilename); // Debug filename
        if (photoFilename && photoFilename !== 'default-avatar.png') {
            profilePictureUrl = `http://localhost:5000/uploads/profile_pictures/${photoFilename}`;
        }
    }
    console.log('Final profile picture URL:', profilePictureUrl); // Debug final URL
    
    // Ensure profile has required fields and handle null values
    profile = {
        name: profile.name || profile.fullName || profile.full_name || '',
        email: profile.email || '',
        phone: (profile.phone && profile.phone !== 'null' && profile.phone !== null) ? profile.phone : '',
        date_of_birth: (profile.date_of_birth && profile.date_of_birth !== 'null' && profile.date_of_birth !== null) ? profile.date_of_birth : '',
        profile_picture: profilePictureUrl,
        ...profile
    };
    
    // Additional cleanup for phone field specifically
    if (profile.phone === 'null' || profile.phone === null || profile.phone === undefined) {
        profile.phone = '';
    }
    
    // Render settings page with original design
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

            <!-- Profile Settings Section -->
            <div class="settings-section">
                <div class="flex justify-between items-center mb-4">
                    <h3><i class="fas fa-user mr-2"></i>Profile Information</h3>
                    <button type="button" id="edit-profile-btn" onclick="toggleProfileEdit()" class="btn bg-blue-500 text-white hover:bg-blue-600">
                        <i class="fas fa-edit mr-2"></i>Edit Profile
                    </button>
                </div>
                <form id="profile-form" class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Profile Picture Section -->
                        <div class="md:col-span-2 text-center">
                            <div class="mb-4">
                                <img id="profile-picture" src="${profilePictureUrl}" 
                                     alt="" class="profile-picture mx-auto" 
                                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                                <div class="profile-picture mx-auto" style="display: none; align-items: center; justify-content: center; background: #f3f4f6; font-size: 12px; color: #6b7280;">
                                    <i class="fas fa-user text-2xl"></i>
                                </div>
                            </div>
                            <div>
                                <input type="file" id="profile-picture-input" accept="image/*" 
                                       onchange="uploadProfilePicture(this.files[0])" class="hidden">
                                <button type="button" onclick="document.getElementById('profile-picture-input').click()" 
                                        class="btn btn-primary">
                                    <i class="fas fa-camera mr-2"></i>Change Photo
                                </button>
                            </div>
                        </div>
                        
                        <!-- Name Field -->
                        <div>
                            <label class="form-label">Full Name</label>
                            <input type="text" id="profile-name" value="${profile.name}" 
                                   class="form-input profile-field" disabled required>
                        </div>
                        
                        <!-- Email Field -->
                        <div>
                            <label class="form-label">Email Address</label>
                            <input type="email" id="profile-email" value="${profile.email}" 
                                   class="form-input profile-field" disabled required>
                        </div>
                        
                        <!-- Phone Field -->
                        <div>
                            <label class="form-label">Phone Number</label>
                            <input type="tel" id="profile-phone" value="${profile.phone || ''}" 
                                   class="form-input profile-field" disabled placeholder="Not set">
                        </div>
                        
                        <!-- Date of Birth Field -->
                        <div>
                            <label class="form-label">Date of Birth</label>
                            <div class="relative">
                                <input type="date" id="profile-dob" value="${(profile.date_of_birth && profile.date_of_birth !== 'null') ? profile.date_of_birth.split('T')[0] : ''}" 
                                       class="form-input profile-field pr-10" disabled 
                                       max="${new Date().toISOString().split('T')[0]}"
                                       placeholder="You can type manually or click calendar">
                                <div class="absolute inset-y-0 right-0 flex items-center pr-3">
                                    <i class="fas fa-calendar-alt text-gray-400 hover:text-indigo-600 cursor-pointer transition-colors duration-200" id="calendar-icon" onclick="openDatePicker()"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div id="profile-actions" class="flex justify-end space-x-4" style="display: none;">
                        <button type="button" onclick="cancelProfileEdit()" class="btn bg-gray-500 text-white hover:bg-gray-600">
                            <i class="fas fa-times mr-2"></i>Cancel
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-save mr-2"></i>Save Profile
                        </button>
                    </div>
                </form>
            </div>

            <!-- Password Change Section -->
            <div class="settings-section">
                <h3><i class="fas fa-lock mr-2"></i>Change Password</h3>
                <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-left mb-4">
                    <div class="flex items-start space-x-2">
                        <i class="fas fa-info-circle text-yellow-600 mt-0.5"></i>
                        <div class="text-sm text-yellow-800">
                            <p class="font-medium mb-1">Password Requirements:</p>
                            <ul class="list-disc list-inside space-y-1 text-xs">
                                <li>Minimum 8 characters</li>
                                <li>At least one uppercase letter (A-Z)</li>
                                <li>At least one number (0-9)</li>
                            </ul>
                        </div>
                    </div>
                </div>
                
                <form id="password-form" class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label class="form-label">Current Password</label>
                            <input type="password" id="current-password" class="form-input" required>
                        </div>
                        <div>
                            <label class="form-label">New Password</label>
                            <input type="password" id="new-password" class="form-input" required>
                        </div>
                        <div>
                            <label class="form-label">Confirm New Password</label>
                            <input type="password" id="confirm-password" class="form-input" required>
                        </div>
                    </div>
                    
                    <div class="flex justify-end">
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-key mr-2"></i>Change Password
                        </button>
                    </div>
                </form>
            </div>

            <!-- Detection Settings Section -->
            <div class="settings-section">
                <h3><i class="fas fa-bell mr-2"></i>Detection & Alarm Settings</h3>
                <div class="space-y-6">
                    <!-- Alarm Trigger Time -->
                    <div>
                        <label class="form-label">Drowsiness Alert Trigger Time</label>
                        <div class="flex items-center space-x-4">
                            <input type="range" id="settings-trigger-time" min="1" max="10" 
                                   value="5" 
                                   class="flex-1" onchange="updateSettingsTriggerTime(this.value)">
                            <span id="settings-trigger-display" class="text-lg font-medium w-16">
                                5s
                            </span>
                            <button type="button" onclick="pinInfoPopup('trigger-info')" 
                                    onmouseenter="showHoverPopup('trigger-info', this)" 
                                    onmouseleave="hideHoverPopup('trigger-info')"
                                    class="w-4 h-4 bg-gray-400 text-white rounded-full flex items-center justify-center text-xs hover:bg-gray-500 transition-colors ml-1">
                                <i class="fas fa-exclamation"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Alarm Volume -->
                    <div>
                        <label class="form-label">Alarm Volume</label>
                        <div class="flex items-center space-x-4">
                            <input type="range" id="settings-volume" min="0" max="1" step="0.1" 
                                   value="0.8" 
                                   class="flex-1" onchange="updateSettingsVolume(this.value)">
                            <span id="settings-volume-display" class="text-lg font-medium w-16">
                                80%
                            </span>
                            <button type="button" onclick="pinInfoPopup('volume-info')" 
                                    onmouseenter="showHoverPopup('volume-info', this)" 
                                    onmouseleave="hideHoverPopup('volume-info')"
                                    class="w-4 h-4 bg-gray-400 text-white rounded-full flex items-center justify-center text-xs hover:bg-gray-500 transition-colors ml-1">
                                <i class="fas fa-exclamation"></i>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Detection Sensitivity -->
                    <div>
                        <label class="form-label">Detection Sensitivity</label>
                        <div class="flex items-center space-x-4">
                            <input type="range" id="detection-sensitivity" min="0.3" max="0.9" step="0.1" 
                                   value="0.6" 
                                   class="flex-1" onchange="updateDetectionSensitivity(this.value)">
                            <span id="sensitivity-display" class="text-lg font-medium w-16">
                                60%
                            </span>
                            <button type="button" onclick="pinInfoPopup('sensitivity-info')" 
                                    onmouseenter="showHoverPopup('sensitivity-info', this)" 
                                    onmouseleave="hideHoverPopup('sensitivity-info')"
                                    class="w-4 h-4 bg-gray-400 text-white rounded-full flex items-center justify-center text-xs hover:bg-gray-500 transition-colors ml-1">
                                <i class="fas fa-exclamation"></i>
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="flex justify-end mt-6">
                    <button onclick="saveDetectionSettings()" class="btn btn-primary">
                        <i class="fas fa-save mr-2"></i>Save Detection Settings
                    </button>
                </div>
            </div>

            <!-- Data Management Section -->
            <div class="settings-section">
                <h3><i class="fas fa-database mr-2"></i>Data Management</h3>
                <p class="text-sm text-gray-600 mb-4">Manage your detection history and account data.</p>
                <div class="flex flex-wrap gap-4">
                    <button onclick="clearDetectionHistory()" class="btn bg-yellow-500 text-white hover:bg-yellow-600">
                        <i class="fas fa-trash mr-2"></i>Clear History
                    </button>
                    <button onclick="deleteAccount()" class="btn btn-danger">
                        <i class="fas fa-user-times mr-2"></i>Delete Account
                    </button>
                </div>
            </div>

            <!-- About Section -->
            <div class="settings-section">
                <h3><i class="fas fa-info-circle mr-2"></i>About DrowsyGuard</h3>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 class="font-medium text-gray-800 mb-2">Application Info</h4>
                        <div class="space-y-2 text-sm text-gray-600">
                            <div>Version: 1.0.0</div>
                            <div>Build: 2025.08.15</div>
                            <div>Model Version: YOLOv12</div>
                        </div>
                    </div>
                    <div>
                        <h4 class="font-medium text-gray-800 mb-2">Support & Info</h4>
                        <div class="space-y-2">
                            <button type="button" onclick="showContactSupport()" class="block text-indigo-600 hover:text-indigo-700 text-sm text-left">
                                <i class="fas fa-envelope mr-2"></i>Contact Support
                            </button>
                            <button type="button" onclick="showDeveloperProfile()" class="block text-indigo-600 hover:text-indigo-700 text-sm text-left">
                                <i class="fas fa-user-circle mr-2"></i>Meet the Developer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
`;
    
    hideLoading();
}

// Show toast notification
function showToast(message, type = 'info', duration = 3000) {
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            max-width: 300px;
        `;
        document.body.appendChild(container);
    }

    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        background: ${type === 'error' ? '#F44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
        color: white;
        padding: 12px 20px;
        margin-bottom: 10px;
        border-radius: 4px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        animation: slideIn 0.3s ease-out;
    `;
    
    toast.textContent = message;
    container.appendChild(toast);
    
    // Auto remove after duration
    if (duration > 0) {
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    return toast;
}

// Add toast animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes fadeOut {
        to { opacity: 0; transform: translateX(100%); }
    }
`;
document.head.appendChild(style);

// Contact support function
function showContactSupport() {
    // Check if contact support is already initialized
    if (typeof window.showContactSupportModal === 'function') {
        console.log('[Settings] Using existing contact support modal');
        window.showContactSupportModal();
        return false;
    }
    
    // Try to initialize contact support
    if (typeof initContactSupport === 'function') {
        console.log('[Settings] Initializing contact support');
        const contactSupport = initContactSupport();
        if (contactSupport && typeof contactSupport.showModal === 'function') {
            contactSupport.showModal();
            return false;
        }
    }
    
    // Fallback to a simple alert
    console.warn('[Settings] Could not initialize contact support modal');
    alert('Silakan hubungi kami di: support@example.com');
    return false;
}

function showDeveloperProfile() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content developer-modal">
            <div class="modal-header">
                <h2><i class="fas fa-user-circle mr-2"></i>Meet the Developer</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="developer-profile">
                    <div class="developer-avatar">
                        <img src="Profile_owner/Masahiro.jpg" alt="Developer" class="developer-image" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
                        <div class="developer-placeholder" style="display: none;">
                            <i class="fas fa-user"></i>
                        </div>
                    </div>
                    <div class="developer-info">
                        <h3>Masahiro Gerarudo Yamazaki</h3>
                        <div class="developer-bio">
                            <h4>About Me</h4>
                            <p>Gunadarma University Informatics student with a strong interest in Machine Learning and Full Stack Development. Passionate about leveraging technology to solve complex problems and create innovative solutions. Skilled in front-end and back-end development, with a solid foundation in machine learning algorithms and data analysis. Committed to bridging the gap between technical capabilities and business objectives to deliver impactful and user-centric solutions. Enjoys collaborating in crossfunctional teams, driving agile project execution, and staying ahead of industry trends. Eager to contribute to cutting-edge projects, lead initiatives, and continuously learn and grow in the field of technology.</p>
                        </div>
                        <div class="social-links" style="margin-top: 1.5rem; display: flex; gap: 1rem; justify-content: center;">
                            <a href="https://www.instagram.com/masayama_24/" target="_blank" class="social-link instagram" style="display: flex; align-items: center; justify-content: center; width: 50px; height: 50px; border-radius: 12px; background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%); color: white; text-decoration: none; transition: transform 0.3s ease;">
                                <i class="fab fa-instagram" style="font-size: 1.5rem;"></i>
                            </a>
                            <a href="https://www.linkedin.com/in/masayama240303/" target="_blank" class="social-link linkedin" style="display: flex; align-items: center; justify-content: center; width: 50px; height: 50px; border-radius: 12px; background: #0077b5; color: white; text-decoration: none; transition: transform 0.3s ease;">
                                <i class="fab fa-linkedin" style="font-size: 1.5rem;"></i>
                            </a>
                        </div>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function sendSupportMessage() {
    const subject = document.getElementById('support-subject').value;
    const message = document.getElementById('support-message').value;
    const priority = document.getElementById('support-priority').value;
    
    if (!subject || !message) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    // Simulate sending message
    showToast('Support message sent successfully! We will get back to you soon.', 'success');
    document.querySelector('.modal-overlay').remove();
}

// Profile management functions
function toggleProfileEdit() {
    const profileFields = document.querySelectorAll('.profile-field');
    const editBtn = document.getElementById('edit-profile-btn');
    const profileActions = document.getElementById('profile-actions');
    
    const isEditing = !profileFields[0].disabled;
    
    if (isEditing) {
        // Cancel editing - reload to reset values
        profileFields.forEach(field => field.disabled = true);
        editBtn.innerHTML = '<i class="fas fa-edit mr-2"></i>Edit Profile';
        profileActions.style.display = 'none';
        loadSettings(); // Reload to reset values
    } else {
        // Start editing
        profileFields.forEach(field => field.disabled = false);
        editBtn.innerHTML = '<i class="fas fa-times mr-2"></i>Cancel';
        profileActions.style.display = 'flex';
    }
}

function cancelProfileEdit() {
    toggleProfileEdit();
}

async function uploadProfilePicture(file) {
    if (!file) return;
    
    showLoading();
    try {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch(`${API_BASE_URL}/settings/profile-picture`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: formData
        });
        
        if (!response.ok) throw new Error('Upload failed');
        
        const result = await response.json();
        console.log('Upload response:', result); // Debug log
        showToast('Profile picture updated successfully', 'success');
        
        // Update localStorage with new profile photo
        const userData = localStorage.getItem('userData');
        if (userData) {
            const userProfile = JSON.parse(userData);
            userProfile.profile_photo = result.profilePhoto;
            localStorage.setItem('userData', JSON.stringify(userProfile));
            console.log('Updated localStorage with new profile photo:', result.profilePhoto);
        }
        
        // Also update AppState if it exists
        if (AppState && AppState.currentUser) {
            AppState.currentUser.profile_photo = result.profilePhoto;
            console.log('Updated AppState with new profile photo');
        }
        
        // Update the image
        const profileImg = document.getElementById('profile-picture');
        console.log('Profile image element:', profileImg); // Debug log
        console.log('Upload result:', result); // Debug the full response
        if (profileImg) {
            const newImageUrl = `http://localhost:5000/uploads/profile_pictures/${result.profilePhoto}?t=${Date.now()}`;
            console.log('Setting image src to:', newImageUrl); // Debug log
            profileImg.src = newImageUrl;
            
            // Also update the fallback div to hide it
            const fallbackDiv = profileImg.nextElementSibling;
            if (fallbackDiv) {
                fallbackDiv.style.display = 'none';
                profileImg.style.display = 'block';
            }
            
            // Force image reload
            profileImg.onload = function() {
                console.log('Image loaded successfully');
            };
            profileImg.onerror = function() {
                console.error('Failed to load image:', newImageUrl);
            };
        } else {
            console.error('Profile image element not found!');
        }
        
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        showToast('Failed to upload profile picture', 'error');
    } finally {
        hideLoading();
    }
}

// Settings functions
function updateSettingsTriggerTime(value) {
    const display = document.getElementById('settings-trigger-display');
    if (display) {
        display.textContent = value + 's';
    }
    const input = document.getElementById('settings-trigger-time');
    if (input) {
        input.value = value;
    }
}

function updateSettingsVolume(value) {
    const display = document.getElementById('settings-volume-display');
    if (display) {
        display.textContent = Math.round(value * 100) + '%';
    }
    const input = document.getElementById('settings-volume');
    if (input) {
        input.value = value;
    }
}

function updateDetectionSensitivity(value) {
    const display = document.getElementById('sensitivity-display');
    if (display) {
        display.textContent = Math.round(value * 100) + '%';
    }
    const input = document.getElementById('detection-sensitivity');
    if (input) {
        input.value = value;
    }
}

async function saveDetectionSettings() {
    const settings = {
        triggerTime: parseInt(document.getElementById('settings-trigger-time').value),
        volume: parseFloat(document.getElementById('settings-volume').value),
        sensitivity: parseFloat(document.getElementById('detection-sensitivity').value)
    };
    
    // Save to localStorage immediately for better UX
    localStorage.setItem('detectionSettings', JSON.stringify(settings));
    
    try {
        showLoading();
        await apiRequest('/settings/alarm', {
            method: 'PUT',
            body: JSON.stringify(settings)
        });
        showToast('Detection settings saved successfully', 'success');
    } catch (error) {
        console.error('Error saving detection settings:', error);
        showToast('Failed to save detection settings', 'error');
    } finally {
        hideLoading();
    }
}

// Data management functions
async function exportUserData() {
    try {
        showLoading();
        const response = await fetch(`${API_BASE_URL}/settings/export-data`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (!response.ok) throw new Error('Export failed');
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `drowsyguard-data-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showToast('Data exported successfully', 'success');
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast('Failed to export data', 'error');
    } finally {
        hideLoading();
    }
}

async function clearDetectionHistory() {
    showClearHistoryConfirmation();
}

function showClearHistoryConfirmation() {
    const popup = document.createElement('div');
    popup.className = 'confirmation-popup-overlay';
    popup.innerHTML = `
        <div class="confirmation-popup" style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.15);
            padding: 32px;
            max-width: 450px;
            width: 90vw;
            z-index: 1001;
            animation: slideInScale 0.3s ease;
        ">
            <div class="flex items-start justify-center mb-6">
                <div class="bg-red-100 rounded-full p-3 mr-4">
                    <i class="fas fa-exclamation-triangle text-red-600 text-2xl"></i>
                </div>
                <div class="flex-1">
                    <h3 class="text-xl font-bold text-gray-800 mb-2">Clear Detection History</h3>
                    <p class="text-gray-600 leading-relaxed">
                        Are you sure you want to clear all your detection history? This action will permanently delete:
                    </p>
                    <ul class="mt-3 text-sm text-gray-600 space-y-1">
                        <li class="flex items-center"><i class="fas fa-check text-red-500 mr-2"></i>All detection sessions</li>
                        <li class="flex items-center"><i class="fas fa-check text-red-500 mr-2"></i>Detection results and statistics</li>
                        <li class="flex items-center"><i class="fas fa-check text-red-500 mr-2"></i>Historical performance data</li>
                    </ul>
                    <div class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p class="text-sm text-yellow-800 font-medium">
                            <i class="fas fa-info-circle mr-1"></i>
                            This action cannot be undone!
                        </p>
                    </div>
                </div>
            </div>
            <div class="flex justify-end space-x-3">
                <button onclick="closeClearHistoryConfirmation()" 
                        class="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium">
                    Cancel
                </button>
                <button onclick="confirmClearHistory()" 
                        class="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">
                    <i class="fas fa-trash mr-2"></i>Yes, Clear History
                </button>
            </div>
        </div>
    `;
    
    // Add gray overlay background
    popup.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        animation: fadeIn 0.3s ease;
    `;
    
    // Close on overlay click
    popup.addEventListener('click', function(e) {
        if (e.target === popup) {
            closeClearHistoryConfirmation();
        }
    });
    
    document.body.appendChild(popup);
}

function closeClearHistoryConfirmation() {
    const popup = document.querySelector('.confirmation-popup-overlay');
    if (popup) {
        popup.remove();
    }
}

async function confirmClearHistory() {
    closeClearHistoryConfirmation();
    
    try {
        showLoading();
        await apiRequest('/settings/clear-history', {
            method: 'DELETE'
        });
        showToast('Detection history cleared successfully', 'success');
    } catch (error) {
        console.error('Error clearing history:', error);
        showToast('Failed to clear detection history', 'error');
    } finally {
        hideLoading();
    }
}

async function deleteAccount() {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.')) {
        return;
    }
    
    const finalConfirm = prompt('Type "DELETE" to confirm account deletion:');
    if (finalConfirm !== 'DELETE') {
        showToast('Account deletion cancelled', 'info');
        return;
    }
    
    try {
        showLoading();
        await apiRequest('/settings/delete-account', {
            method: 'DELETE'
        });
        
        // Clear local storage and redirect to login
        localStorage.clear();
        showToast('Account deleted successfully', 'info');
        setTimeout(() => {
            window.location.reload();
        }, 2000);
        
    } catch (error) {
        console.error('Error deleting account:', error);
        showToast('Failed to delete account', 'error');
    } finally {
        hideLoading();
    }
}


function showDeveloperProfile() {
    const developerBar = document.createElement('div');
    developerBar.className = 'developer-bar-overlay';
    developerBar.innerHTML = `
        <div class="developer-bar" style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 20px;
            box-shadow: 0 25px 50px rgba(0,0,0,0.2);
            padding: 40px 60px;
            max-width: 480px;
            width: 90vw;
            text-align: center;
            z-index: 1001;
            animation: slideInScale 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        ">
            <button onclick="this.closest('.developer-bar-overlay').remove()" 
                    style="position: absolute; top: 15px; right: 15px; background: none; border: none; color: #9ca3af; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; font-size: 18px;"
                    onmouseover="this.style.background='#f3f4f6'; this.style.color='#374151';"
                    onmouseout="this.style.background='none'; this.style.color='#9ca3af';">
                <i class="fas fa-times"></i>
            </button>
            
            <!-- Developer Photo -->
            <div style="margin-bottom: 24px; display: flex; justify-content: center; align-items: center;">
                <img src="http://localhost:5000/profile_owner/Masahiro.jpg" alt="Masahiro Gerarudo Yamazaki" 
                     style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 4px solid #667eea; box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3); transition: all 0.3s ease; display: block;" 
                     onmouseover="this.style.transform='scale(1.05)';"
                     onmouseout="this.style.transform='scale(1)';"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <div style="display: none; width: 100px; height: 100px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); align-items: center; justify-content: center; color: white; font-size: 40px; border: 4px solid #667eea; box-shadow: 0 8px 24px rgba(102, 126, 234, 0.3);">
                    <i class="fas fa-user"></i>
                </div>
            </div>
            
            <!-- Developer Name & Title -->
            <h3 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; color: #1a202c; line-height: 1.2;">Masahiro Gerarudo Yamazaki</h3>
            <p style="margin: 0 0 20px 0; font-size: 14px; color: #667eea; font-weight: 600;">Informatics Student & Full Stack Developer</p>
            
            <!-- About Section -->
            <div style="margin-bottom: 24px; text-align: center;">
                <h4 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #2d3748; display: flex; align-items: center; justify-content: center;">
                    <i class="fas fa-user-graduate mr-2" style="color: #667eea;"></i>About Me
                </h4>
                <p style="margin: 0; line-height: 1.6; color: #4a5568; font-size: 13px; text-align: justify;">Gunadarma University Informatics student with a strong interest in Machine Learning and Full Stack Development. Passionate about leveraging technology to solve complex problems and create innovative solutions.</p>
            </div>
            
            <!-- Social Links -->
            <div style="text-align: center;">
                <h4 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #2d3748;">
                    <i class="fas fa-share-alt mr-2" style="color: #667eea;"></i>Connect with Me
                </h4>
                <div style="display: flex; gap: 16px; justify-content: center;">
                    <a href="https://www.instagram.com/masayama_24/" target="_blank" 
                       style="display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(45deg, #f09433 0%,#e6683c 25%,#dc2743 50%,#cc2366 75%,#bc1888 100%); color: white; text-decoration: none; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(225, 48, 108, 0.3);"
                       onmouseover="this.style.transform='translateY(-3px) scale(1.05)'; this.style.boxShadow='0 8px 25px rgba(225, 48, 108, 0.4)';"
                       onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 4px 15px rgba(225, 48, 108, 0.3)';">
                        <i class="fab fa-instagram" style="font-size: 22px;"></i>
                    </a>
                    <a href="https://www.linkedin.com/in/masayama240303/" target="_blank" 
                       style="display: flex; align-items: center; justify-content: center; width: 48px; height: 48px; border-radius: 12px; background: #0077b5; color: white; text-decoration: none; transition: all 0.3s ease; box-shadow: 0 4px 15px rgba(0, 119, 181, 0.3);"
                       onmouseover="this.style.transform='translateY(-3px) scale(1.05)'; this.style.boxShadow='0 8px 25px rgba(0, 119, 181, 0.4)';"
                       onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='0 4px 15px rgba(0, 119, 181, 0.3)';">
                        <i class="fab fa-linkedin-in" style="font-size: 22px;"></i>
                    </a>
                </div>
            </div>
        </div>
    `;
    
    // Add overlay background
    developerBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        animation: fadeIn 0.3s ease;
    `;
    
    // Close on overlay click
    developerBar.addEventListener('click', function(e) {
        if (e.target === developerBar) {
            developerBar.remove();
        }
    });
    
    document.body.appendChild(developerBar);
}

function showContactDeveloper() {
    // Close developer profile modal
    const existingModal = document.querySelector('.modal-overlay');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content contact-modal">
            <div class="modal-header">
                <h2><i class="fas fa-envelope mr-2"></i>Message Developer</h2>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="contact-developer-form" class="contact-form">
                    <div class="form-group">
                        <label class="form-label">Subject</label>
                        <input type="text" id="dev-subject" class="form-input" placeholder="What would you like to discuss?" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Message</label>
                        <textarea id="dev-message" rows="5" class="form-input" placeholder="Your message to the developer..." required></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Your Email (optional)</label>
                        <input type="email" id="dev-email" class="form-input" placeholder="For response if needed">
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button onclick="this.closest('.modal-overlay').remove()" class="btn bg-gray-500 text-white hover:bg-gray-600">
                    <i class="fas fa-times mr-2"></i>Cancel
                </button>
                <button onclick="sendDeveloperMessage()" class="btn btn-primary">
                    <i class="fas fa-paper-plane mr-2"></i>Send Message
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function sendSupportMessage() {
    const category = document.getElementById('support-category').value;
    const subject = document.getElementById('support-subject').value.trim();
    const message = document.getElementById('support-message').value.trim();
    const priority = document.querySelector('.priority-option.selected')?.classList.contains('low') ? 'low' :
                    document.querySelector('.priority-option.selected')?.classList.contains('high') ? 'high' : 'medium';
    
    if (!category || !subject || !message) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    try {
        showLoading();
        // Get user profile data to include in the email
        let userProfile = {};
        try {
            const response = await apiRequest('/settings/profile');
            userProfile = response.profile || response || {};
        } catch (e) {
            console.warn('Could not fetch user profile:', e);
        }
        
        // Format user info for the email
        const userInfo = [
            `Name: ${userProfile.full_name || userProfile.name || 'Not provided'}`,
            `Email: ${userProfile.email || 'Not provided'}`,
            `User ID: ${userProfile.id || 'N/A'}`,
            `Account Created: ${userProfile.created_at ? new Date(userProfile.created_at).toLocaleDateString() : 'N/A'}`,
            '\n--- USER MESSAGE ---\n'
        ].join('\n');
        
        const fullMessage = userInfo + message;
        
        await apiRequest('/api/contact/support', {
            method: 'POST',
            body: JSON.stringify({
                category,
                subject,
                message: fullMessage,
                priority,
                user_email: userProfile.email || ''
            })
        });
        
        document.querySelector('.modal-overlay').remove();
        showToast('Your support request has been sent successfully!', 'success');
    } catch (error) {
        console.error('Error sending support message:', error);
        showToast('Failed to send message. Please try again later.', 'error');
    } finally {
        hideLoading();
    }
}

async function sendDeveloperMessage() {
    const subject = document.getElementById('dev-subject').value;
    const message = document.getElementById('dev-message').value;
    const email = document.getElementById('dev-email').value;
    
    if (!subject || !message) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    try {
        showLoading();
        await apiRequest('/settings/contact-developer', {
            method: 'POST',
            body: JSON.stringify({ subject, message, email })
        });
        
        document.querySelector('.modal-overlay').remove();
        showToast('Message sent to developer successfully', 'success');
    } catch (error) {
        console.error('Error sending developer message:', error);
        showToast('Failed to send message', 'error');
    } finally {
        hideLoading();
    }
}

function openDatePicker() {
    const dobInput = document.getElementById('profile-dob');
    if (dobInput && !dobInput.disabled) {
        dobInput.focus();
        dobInput.showPicker();
    }
}

// Handle profile form submission
document.addEventListener('DOMContentLoaded', function() {
    document.addEventListener('submit', async function(e) {
        if (e.target.id === 'profile-form') {
            e.preventDefault();
            
            const profileData = {
                name: document.getElementById('profile-name').value,
                email: document.getElementById('profile-email').value,
                phone: document.getElementById('profile-phone').value,
                date_of_birth: document.getElementById('profile-dob').value
            };
            
            try {
                showLoading();
                const response = await apiRequest('/settings/profile', {
                    method: 'PUT',
                    body: JSON.stringify(profileData)
                });
                
                showToast('Profile updated successfully', 'success');
                
                // Update UI fields with the response data
                const profileFields = document.querySelectorAll('.profile-field');
                profileFields.forEach(field => field.disabled = true);
                document.getElementById('edit-profile-btn').innerHTML = '<i class="fas fa-edit mr-2"></i>Edit Profile';
                document.getElementById('profile-actions').style.display = 'none';
                
                // Update the form fields with the response data
                if (response && response.user) {
                    const user = response.user;
                    document.getElementById('profile-name').value = user.full_name || user.name || '';
                    document.getElementById('profile-email').value = user.email || '';
                    document.getElementById('profile-phone').value = user.phone || '';
                    if (user.date_of_birth) {
                        const dob = new Date(user.date_of_birth);
                        document.getElementById('profile-dob').value = dob.toISOString().split('T')[0];
                    }
                    
                    // Update the display values safely
                    const phoneDisplay = document.querySelector('.phone-display');
                    const dobDisplay = document.querySelector('.dob-display');
                    
                    if (phoneDisplay) {
                        phoneDisplay.textContent = user.phone || 'Not set';
                    }
                    
                    if (dobDisplay) {
                        if (user.date_of_birth) {
                            try {
                                const formattedDob = new Date(user.date_of_birth).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                });
                                dobDisplay.textContent = formattedDob;
                            } catch (e) {
                                console.error('Error formatting date:', e);
                                dobDisplay.textContent = 'Not set';
                            }
                        } else {
                            dobDisplay.textContent = 'Not set';
                        }
                    }
                    
                    // Update localStorage with the new data
                    const userData = JSON.parse(localStorage.getItem('userData') || '{}');
                    userData.phone = user.phone;
                    userData.date_of_birth = user.date_of_birth;
                    localStorage.setItem('userData', JSON.stringify(userData));
                }
            } catch (error) {
                console.error('Error updating profile:', error);
                showToast('Failed to update profile', 'error');
            } finally {
                hideLoading();
            }
        }
        
        if (e.target.id === 'password-form') {
            e.preventDefault();
            
            const currentPassword = document.getElementById('current-password').value;
            const newPassword = document.getElementById('new-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            
            if (newPassword !== confirmPassword) {
                showToast('New passwords do not match', 'error');
                return;
            }
            
            // Validate password strength
            const passwordValidation = validatePassword(newPassword);
            if (!passwordValidation.isValid) {
                showToast(passwordValidation.message, 'error');
                return;
            }
            
            try {
                showLoading();
                await apiRequest('/settings/password', {
                    method: 'PUT',
                    body: JSON.stringify({
                        current_password: currentPassword,
                        new_password: newPassword
                    })
                });
                
                showToast('Password changed successfully', 'success');
                e.target.reset();
            } catch (error) {
                console.error('Error changing password:', error);
                // Show specific error message from backend
                const errorMessage = error.message || 'Failed to change password';
                showToast(errorMessage, 'error');
            } finally {
                hideLoading();
            }
        }
    });
});

// Priority selector function
function selectPriority(priority, element) {
    // Remove selected class from all options
    document.querySelectorAll('.priority-option').forEach(opt => opt.classList.remove('selected'));
    // Add selected class to clicked option
    element.classList.add('selected');
}

// Load detection settings when the page loads
async function loadDetectionSettings() {
    // Function to apply settings to the UI
    function applySettings(settings) {
        if (!settings) return;
        
        console.log('Applying settings:', settings);
        
        // Ensure we have valid values with proper type conversion
        // Handle both old and new API response formats
        const settingsWithDefaults = {
            triggerTime: settings.triggerTime ? parseInt(settings.triggerTime) : 5,
            // Check both 'volume' and 'alarmVolume' keys
            volume: settings.volume !== undefined ? parseFloat(settings.volume) : 
                   (settings.alarmVolume !== undefined ? parseFloat(settings.alarmVolume) : 0.8),
            // Check both 'sensitivity' and 'detectionSensitivity' keys
            sensitivity: settings.sensitivity !== undefined ? parseFloat(settings.sensitivity) : 
                       (settings.detectionSensitivity !== undefined ? parseFloat(settings.detectionSensitivity) : 0.6)
        };
        
        console.log('Final settings with defaults:', settingsWithDefaults);
        
        // Update input values
        const triggerInput = document.getElementById('settings-trigger-time');
        const volumeInput = document.getElementById('settings-volume');
        const sensitivityInput = document.getElementById('detection-sensitivity');
        
        if (triggerInput) {
            triggerInput.value = settingsWithDefaults.triggerTime;
            updateSettingsTriggerTime(settingsWithDefaults.triggerTime);
        }
        
        if (volumeInput) {
            volumeInput.value = settingsWithDefaults.volume;
            updateSettingsVolume(settingsWithDefaults.volume);
        }
        
        if (sensitivityInput) {
            sensitivityInput.value = settingsWithDefaults.sensitivity;
            updateDetectionSensitivity(settingsWithDefaults.sensitivity);
        }
        
        console.log('Settings applied to DOM');
    }
    
    try {
        console.log('Loading detection settings...');
        
        // First try to get settings from localStorage
        try {
            const savedSettings = localStorage.getItem('detectionSettings');
            if (savedSettings) {
                console.log('Found saved settings in localStorage');
                const settings = JSON.parse(savedSettings);
                applySettings(settings);
            } else {
                // Set default values if no saved settings found
                console.log('No saved settings found, using defaults');
                applySettings({
                    triggerTime: 5,
                    volume: 0.8,
                    sensitivity: 0.6
                });
            }
        } catch (localStorageError) {
            console.error('Error reading from localStorage:', localStorageError);
            // Set default values on error
            applySettings({
                triggerTime: 5,
                volume: 0.8,
                sensitivity: 0.6
            });
        }
        
        // Try to fetch from API in the background
        (async () => {
            try {
                const response = await apiRequest('/settings/alarm').catch(() => null);
                if (response) {
                    console.log('Successfully fetched settings from API:', response);
                    localStorage.setItem('detectionSettings', JSON.stringify(response));
                    applySettings(response);
                }
            } catch (apiError) {
                console.warn('Failed to fetch settings from API, using localStorage values:', apiError);
            }
        })();
        
    } catch (error) {
        console.error('Unexpected error in loadDetectionSettings:', error);
        // Set default values on unexpected error
        updateSettingsTriggerTime(5);
        updateSettingsVolume(0.8);
        updateDetectionSensitivity(0.6);
    }
}

// Main load settings function that loads both profile and detection settings
async function loadSettings() {
    try {
        // First try to load the settings page content
        try {
            await _loadSettings();
        } catch (error) {
            console.warn('Error loading profile, continuing with default UI...', error);
            // Continue even if profile loading fails
        }
        
        // Load detection settings after a small delay
        setTimeout(async () => {
            try {
                await loadDetectionSettings();
            } catch (error) {
                console.error('Error loading detection settings:', error);
                // Set default values if detection settings fail to load
                updateSettingsTriggerTime(5);
                updateSettingsVolume(0.8);
                updateDetectionSensitivity(0.6);
            }
        }, 100);
    } catch (error) {
        console.error('Unexpected error in loadSettings:', error);
    }
}

// Export functions to window for HTML onclick handlers
window.loadSettings = loadSettings;
window.toggleProfileEdit = toggleProfileEdit;
window.cancelProfileEdit = cancelProfileEdit;
window.uploadProfilePicture = uploadProfilePicture;
window.updateSettingsTriggerTime = updateSettingsTriggerTime;
window.updateSettingsVolume = updateSettingsVolume;
window.updateDetectionSensitivity = updateDetectionSensitivity;
window.saveDetectionSettings = saveDetectionSettings;
window.exportUserData = exportUserData;
window.clearDetectionHistory = clearDetectionHistory;
window.deleteAccount = deleteAccount;
window.showHoverPopup = showHoverPopup;
window.hideHoverPopup = hideHoverPopup;
window.pinInfoPopup = pinInfoPopup;
window.closePinnedPopup = closePinnedPopup;
window.showContactSupport = showContactSupport;
window.showDeveloperProfile = showDeveloperProfile;
window.showContactDeveloper = showContactDeveloper;
window.sendSupportMessage = sendSupportMessage;
window.sendDeveloperMessage = sendDeveloperMessage;
window.selectPriority = selectPriority;
window.openDatePicker = openDatePicker;

// Info popup functionality for Detection & Alarm Settings
let activePopups = new Set();
let hoverTimeouts = new Map();

function getPopupContent(infoType) {
    switch(infoType) {
        case 'trigger-info':
            return {
                title: 'Trigger Time Information',
                content: 'Sets how long the system waits after detecting drowsiness before triggering the alarm. Lower values = faster alerts, higher values = less false alarms.'
            };
        case 'volume-info':
            return {
                title: 'Volume Information', 
                content: 'Controls how loud the drowsiness alarm will be. Set to 0% to turn off sound, or higher values for louder alerts. Recommended: 60-80% for effective wake-up alerts.'
            };
        case 'sensitivity-info':
            return {
                title: 'Sensitivity Information',
                content: 'Controls how easily the system detects drowsiness signs. Higher sensitivity = more alerts but may include false alarms. Lower sensitivity = less false alarms but might miss mild drowsiness signs. Recommended: 50-70%.'
            };
    }
}

function showHoverPopup(infoType, buttonElement) {
    // Clear any existing timeout for this popup
    if (hoverTimeouts.has(infoType)) {
        clearTimeout(hoverTimeouts.get(infoType));
        hoverTimeouts.delete(infoType);
    }
    
    // Don't show hover popup if it's already pinned
    if (activePopups.has(infoType)) return;
    
    const { title, content } = getPopupContent(infoType);
    const rect = buttonElement.getBoundingClientRect();
    
    const popup = document.createElement('div');
    popup.id = `hover-popup-${infoType}`;
    popup.className = 'hover-info-popup';
    popup.innerHTML = `
        <div class="bg-gray-800 text-white text-sm rounded-lg p-3 shadow-lg max-w-xs" style="
            position: fixed;
            top: ${rect.top - 10}px;
            left: ${rect.left - 320}px;
            z-index: 1000;
            animation: fadeIn 0.2s ease;
        ">
            <div class="flex items-start space-x-2 mb-2">
                <i class="fas fa-info-circle text-gray-400 mt-0.5"></i>
                <h4 class="font-medium text-gray-200">${title}</h4>
            </div>
            <p class="text-gray-300 text-xs leading-relaxed" style="text-align: justify;">${content}</p>
        </div>
    `;
    
    document.body.appendChild(popup);
}

function hideHoverPopup(infoType) {
    // Don't hide if it's pinned
    if (activePopups.has(infoType)) return;
    
    // Set timeout to hide after a short delay
    const timeout = setTimeout(() => {
        const popup = document.getElementById(`hover-popup-${infoType}`);
        if (popup) {
            popup.remove();
        }
    }, 100);
    
    hoverTimeouts.set(infoType, timeout);
}

function pinInfoPopup(infoType) {
    // Remove hover popup if exists
    const hoverPopup = document.getElementById(`hover-popup-${infoType}`);
    if (hoverPopup) {
        hoverPopup.remove();
    }
    
    // Clear hover timeout
    if (hoverTimeouts.has(infoType)) {
        clearTimeout(hoverTimeouts.get(infoType));
        hoverTimeouts.delete(infoType);
    }
    
    const { title, content } = getPopupContent(infoType);
    
    const popup = document.createElement('div');
    popup.className = 'info-popup-overlay';
    popup.innerHTML = `
        <div class="info-popup" style="
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.15);
            padding: 24px;
            max-width: 400px;
            width: 90vw;
            z-index: 1001;
            animation: slideInScale 0.3s ease;
        ">
            <div class="flex items-start justify-between mb-4">
                <h3 class="text-lg font-semibold text-gray-800 flex items-center">
                    <i class="fas fa-info-circle text-gray-500 mr-2"></i>
                    ${title}
                </h3>
                <button onclick="closePinnedPopup('${infoType}')" 
                        class="text-gray-400 hover:text-gray-600 transition-colors">
                    <i class="fas fa-times text-lg"></i>
                </button>
            </div>
            <p class="text-gray-600 leading-relaxed" style="text-align: justify;">${content}</p>
            <div class="mt-4 flex justify-end">
                <button onclick="closePinnedPopup('${infoType}')" 
                        class="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors">
                    Got it
                </button>
            </div>
        </div>
    `;
    
    // Add gray overlay background
    popup.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1000;
        animation: fadeIn 0.3s ease;
    `;
    
    // Close on overlay click
    popup.addEventListener('click', function(e) {
        if (e.target === popup) {
            closePinnedPopup(infoType);
        }
    });
    
    activePopups.add(infoType);
    document.body.appendChild(popup);
}

function closePinnedPopup(infoType) {
    const popup = document.querySelector('.info-popup-overlay');
    if (popup) {
        popup.remove();
    }
    activePopups.delete(infoType);
}
