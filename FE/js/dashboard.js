// Dashboard JavaScript - Handles dashboard page functionality
// This section manages the main dashboard page with user statistics and navigation

/**
 * Load dashboard content
 * Connects to: dashboard page section
 * Database tables: detection_sessions, detection_results, users
 */
async function loadDashboard() {
    const dashboardContainer = document.getElementById('dashboard-page');
    
    showLoading();
    
    try {
        // Fetch user statistics from backend
        // Connects to: BE/api_database.py - /dashboard/stats endpoint
        console.log('Loading dashboard stats...');
        const stats = await apiRequest('/dashboard/stats');
        
        // Fetch recent detection sessions
        // Connects to: BE/api_database.py - /dashboard/recent-sessions endpoint  
        const recentSessions = await apiRequest('/dashboard/recent-sessions');
        
        // Render dashboard content
        dashboardContainer.innerHTML = `
            <div class="fade-in">
                <!-- Dashboard Header Section -->
                <div class="mb-8">
                    <h1 class="text-4xl font-bold text-gray-800 mb-2">
                        <i class="fas fa-tachometer-alt text-indigo-600 mr-3"></i>
                        Dashboard
                    </h1>
                    <p class="text-gray-600">Welcome back, ${AppState.currentUser.name}! Here's your drowsiness detection overview.</p>
                </div>

                <!-- Statistics Cards Section - displays user statistics -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <!-- Total Sessions Card -->
                    <div class="stats-card total">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600">Total Sessions</p>
                                <p class="text-3xl font-bold text-indigo-600">${stats.totalSessions || 0}</p>
                            </div>
                            <div class="text-indigo-600">
                                <i class="fas fa-play-circle text-3xl"></i>
                            </div>
                        </div>
                        <div class="mt-2">
                            <span class="text-sm text-gray-500">All time detection sessions</span>
                        </div>
                    </div>

                    <!-- Drowsiness Detections Card -->
                    <div class="stats-card drowsiness">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600">Drowsiness Alerts</p>
                                <p class="text-3xl font-bold text-red-500">${stats.drowsinessCount || 0}</p>
                            </div>
                            <div class="text-red-500">
                                <i class="fas fa-exclamation-triangle text-3xl"></i>
                            </div>
                        </div>
                        <div class="mt-2">
                            <span class="text-sm text-gray-500">Total drowsiness detections</span>
                        </div>
                    </div>

                    <!-- Awake Detections Card -->
                    <div class="stats-card awake">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600">Awake Status</p>
                                <p class="text-3xl font-bold text-green-500">${stats.awakeCount || 0}</p>
                            </div>
                            <div class="text-green-500">
                                <i class="fas fa-check-circle text-3xl"></i>
                            </div>
                        </div>
                        <div class="mt-2">
                            <span class="text-sm text-gray-500">Total awake detections</span>
                        </div>
                    </div>

                    <!-- Yawn Detections Card -->
                    <div class="stats-card yawn">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600">Yawn Detections</p>
                                <p class="text-3xl font-bold text-yellow-500">${stats.yawnCount || 0}</p>
                            </div>
                            <div class="text-yellow-500">
                                <i class="fas fa-tired text-3xl"></i>
                            </div>
                        </div>
                        <div class="mt-2">
                            <span class="text-sm text-gray-500">Total yawn detections</span>
                        </div>
                    </div>
                </div>

                <!-- Quick Actions Section - navigation to main features -->
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    <!-- Start Detection Card -->
                    <div class="card hover:shadow-xl transition-all duration-300">
                        <div class="p-6">
                            <div class="flex items-center mb-4">
                                <div class="bg-indigo-100 p-3 rounded-full">
                                    <i class="fas fa-camera text-indigo-600 text-xl"></i>
                                </div>
                                <h3 class="text-xl font-semibold text-gray-800 ml-4">Live Detection</h3>
                            </div>
                            <p class="text-gray-600 mb-4">Start real-time drowsiness detection using your camera</p>
                            <button onclick="showPage('detection')" class="btn btn-primary w-full">
                                <i class="fas fa-play mr-2"></i>Start Detection
                            </button>
                        </div>
                    </div>

                    <!-- View History Card -->
                    <div class="card hover:shadow-xl transition-all duration-300">
                        <div class="p-6">
                            <div class="flex items-center mb-4">
                                <div class="bg-green-100 p-3 rounded-full">
                                    <i class="fas fa-history text-green-600 text-xl"></i>
                                </div>
                                <h3 class="text-xl font-semibold text-gray-800 ml-4">Detection History</h3>
                            </div>
                            <p class="text-gray-600 mb-4">View detailed history of your detection sessions</p>
                            <button onclick="showPage('history')" class="btn btn-success w-full">
                                <i class="fas fa-chart-line mr-2"></i>View History
                            </button>
                        </div>
                    </div>

                    <!-- Settings Card -->
                    <div class="card hover:shadow-xl transition-all duration-300">
                        <div class="p-6">
                            <div class="flex items-center mb-4">
                                <div class="bg-purple-100 p-3 rounded-full">
                                    <i class="fas fa-cog text-purple-600 text-xl"></i>
                                </div>
                                <h3 class="text-xl font-semibold text-gray-800 ml-4">Settings</h3>
                            </div>
                            <p class="text-gray-600 mb-4">Configure your profile and detection preferences</p>
                            <button onclick="showPage('settings')" class="btn bg-purple-600 text-white hover:bg-purple-700 w-full">
                                <i class="fas fa-user-cog mr-2"></i>Open Settings
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Recent Activity Section - displays recent detection sessions -->
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <!-- Recent Sessions -->
                    <div class="card">
                        <div class="card-header">
                            <h3 class="text-xl font-semibold">
                                <i class="fas fa-clock mr-2"></i>Recent Sessions
                            </h3>
                        </div>
                        <div class="p-6">
                            ${renderRecentSessions(recentSessions.sessions || [])}
                        </div>
                    </div>

                    <!-- Detection Chart -->
                    <div class="card">
                        <div class="card-header">
                            <h3 class="text-xl font-semibold">
                                <i class="fas fa-chart-pie mr-2"></i>Detection Overview
                            </h3>
                        </div>
                        <div class="p-6">
                            <canvas id="detectionChart" width="400" height="200"></canvas>
                        </div>
                    </div>
                </div>

                <!-- Safety Tips Section -->
                <div class="mt-8">
                    <div class="card">
                        <div class="p-6">
                            <h3 class="text-xl font-semibold text-gray-800 mb-4">
                                <i class="fas fa-lightbulb text-yellow-500 mr-2"></i>Safety Tips
                            </h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div class="flex items-start space-x-3">
                                    <i class="fas fa-moon text-indigo-600 mt-1"></i>
                                    <div>
                                        <h4 class="font-medium text-gray-800">Get Adequate Sleep</h4>
                                        <p class="text-sm text-gray-600">Aim for 7-9 hours of quality sleep before driving</p>
                                    </div>
                                </div>
                                <div class="flex items-start space-x-3">
                                    <i class="fas fa-coffee text-indigo-600 mt-1"></i>
                                    <div>
                                        <h4 class="font-medium text-gray-800">Take Regular Breaks</h4>
                                        <p class="text-sm text-gray-600">Stop every 2 hours for a 15-minute break</p>
                                    </div>
                                </div>
                                <div class="flex items-start space-x-3">
                                    <i class="fas fa-car text-indigo-600 mt-1"></i>
                                    <div>
                                        <h4 class="font-medium text-gray-800">Avoid Driving When Tired</h4>
                                        <p class="text-sm text-gray-600">Don't drive if you feel drowsy or fatigued</p>
                                    </div>
                                </div>
                                <div class="flex items-start space-x-3">
                                    <i class="fas fa-users text-indigo-600 mt-1"></i>
                                    <div>
                                        <h4 class="font-medium text-gray-800">Share Driving Duties</h4>
                                        <p class="text-sm text-gray-600">Take turns driving on long trips</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Initialize detection chart
        initializeDetectionChart(stats);
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
        dashboardContainer.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
                <h3 class="text-xl font-semibold text-gray-800 mb-2">Error Loading Dashboard</h3>
                <p class="text-gray-600 mb-4">Unable to load dashboard data. Please try again.</p>
                <button onclick="loadDashboard()" class="btn btn-primary">
                    <i class="fas fa-refresh mr-2"></i>Retry
                </button>
            </div>
        `;
        showToast('Failed to load dashboard data', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Render recent sessions list
 * Displays recent detection sessions data
 * @param {Array} sessions - Array of recent sessions
 * @returns {string} HTML string for recent sessions
 */
function renderRecentSessions(sessions) {
    if (!sessions || sessions.length === 0) {
        return `
            <div class="text-center py-8">
                <i class="fas fa-history text-gray-400 text-3xl mb-3"></i>
                <p class="text-gray-500">No recent sessions found</p>
                <button onclick="showPage('detection')" class="btn btn-primary mt-4">
                    <i class="fas fa-play mr-2"></i>Start Your First Session
                </button>
            </div>
        `;
    }
    
    return sessions.map(session => `
        <div class="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0">
            <div class="flex items-center space-x-3">
                <div class="w-10 h-10 rounded-full ${getSessionStatusColor(session.status)} flex items-center justify-center">
                    <i class="fas ${getSessionStatusIcon(session.status)} text-white text-sm"></i>
                </div>
                <div>
                    <p class="font-medium text-gray-800">${formatDate(session.created_at)}</p>
                    <p class="text-sm text-gray-600">Duration: ${formatDuration(session.duration || 0)}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="text-sm font-medium text-gray-800">${session.total_detections || 0} detections</p>
                <p class="text-xs text-gray-500">${session.drowsiness_count || 0} drowsiness alerts</p>
            </div>
        </div>
    `).join('');
}

/**
 * Get color class for session status
 * @param {string} status - Session status
 * @returns {string} CSS color class
 */
function getSessionStatusColor(status) {
    switch(status) {
        case 'completed': return 'bg-green-500';
        case 'active': return 'bg-blue-500';
        case 'interrupted': return 'bg-yellow-500';
        default: return 'bg-gray-500';
    }
}

/**
 * Get icon for session status
 * @param {string} status - Session status
 * @returns {string} Font Awesome icon class
 */
function getSessionStatusIcon(status) {
    switch(status) {
        case 'completed': return 'fa-check';
        case 'active': return 'fa-play';
        case 'interrupted': return 'fa-pause';
        default: return 'fa-circle';
    }
}

/**
 * Initialize detection chart
 * Creates a pie chart showing detection distribution
 * @param {object} stats - Statistics data
 */
function initializeDetectionChart(stats) {
    const canvas = document.getElementById('detectionChart');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    // Simple pie chart implementation
    const data = [
        { label: 'Awake', value: stats.awakeCount || 0, color: '#10b981' },
        { label: 'Drowsiness', value: stats.drowsinessCount || 0, color: '#ef4444' },
        { label: 'Yawn', value: stats.yawnCount || 0, color: '#f59e0b' }
    ];
    
    const total = data.reduce((sum, item) => sum + item.value, 0);
    
    if (total === 0) {
        // Draw "No Data" message
        ctx.fillStyle = '#6b7280';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No detection data available', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    // Draw pie chart
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    
    let currentAngle = 0;
    
    data.forEach(item => {
        const sliceAngle = (item.value / total) * 2 * Math.PI;
        
        // Draw slice
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
        ctx.lineTo(centerX, centerY);
        ctx.fillStyle = item.color;
        ctx.fill();
        
        // Draw label
        const labelAngle = currentAngle + sliceAngle / 2;
        const labelX = centerX + Math.cos(labelAngle) * (radius + 30);
        const labelY = centerY + Math.sin(labelAngle) * (radius + 30);
        
        ctx.fillStyle = '#374151';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${item.label}: ${item.value}`, labelX, labelY);
        
        currentAngle += sliceAngle;
    });
}

// Export function for use in other modules
window.loadDashboard = loadDashboard;
