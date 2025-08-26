// History JavaScript - Handles detection history page functionality
// This section manages the history page displaying detailed detection analytics

/**
 * Load history page content
 * Connects to: history page section
 * Database tables: detection_sessions, detection_results
 */
async function loadHistory() {
    const historyContainer = document.getElementById('history-page');
    
    showLoading();
    
    try {
        // Fetch detection history from backend
        // Connects to: BE/api_database.py - /history/sessions endpoint
        const sessionsResponse = await apiRequest('/history/sessions');
        console.log('Sessions response:', sessionsResponse);
        const sessions = Array.isArray(sessionsResponse) ? sessionsResponse : 
                        (sessionsResponse.sessions && Array.isArray(sessionsResponse.sessions)) ? sessionsResponse.sessions : [];
        console.log('Processed sessions:', sessions);
        
        // Fetch summary statistics
        // Connects to: BE/api_database.py - /history/summary endpoint
        const summary = await apiRequest('/history/summary');
        
        historyContainer.innerHTML = `
            <div class="fade-in">
                <!-- History Header Section -->
                <div class="mb-8">
                    <h1 class="text-4xl font-bold text-gray-800 mb-2">
                        <i class="fas fa-history text-indigo-600 mr-3"></i>
                        Detection History
                    </h1>
                    <p class="text-gray-600">View and analyze your past detection sessions</p>
                </div>

                <!-- Summary Statistics Section -->
                <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div class="stats-card total">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600">Total Sessions</p>
                                <p class="text-3xl font-bold text-indigo-600">${summary.totalSessions || 0}</p>
                            </div>
                            <div class="text-indigo-600">
                                <i class="fas fa-calendar text-2xl"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stats-card drowsiness">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600">Total Alerts</p>
                                <p class="text-3xl font-bold text-red-500">${summary.totalAlerts || 0}</p>
                            </div>
                            <div class="text-red-500">
                                <i class="fas fa-exclamation-triangle text-2xl"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stats-card">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600">Total Duration</p>
                                <p class="text-3xl font-bold text-blue-600">${formatDuration(summary.totalDuration || 0)}</p>
                            </div>
                            <div class="text-blue-600">
                                <i class="fas fa-clock text-2xl"></i>
                            </div>
                        </div>
                    </div>
                    
                    <div class="stats-card">
                        <div class="flex items-center justify-between">
                            <div>
                                <p class="text-sm font-medium text-gray-600">Avg Session</p>
                                <p class="text-3xl font-bold text-green-600">${formatDuration(summary.avgDuration || 0)}</p>
                            </div>
                            <div class="text-green-600">
                                <i class="fas fa-chart-line text-2xl"></i>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Filter and Search Section -->
                <div class="card mb-8">
                    <div class="p-6">
                        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label class="form-label">Date Range</label>
                                <select id="date-filter" onchange="filterHistory()" class="form-input">
                                    <option value="all">All Time</option>
                                    <option value="today">Today</option>
                                    <option value="week">This Week</option>
                                    <option value="month">This Month</option>
                                </select>
                            </div>
                            <div>
                                <label class="form-label">Status</label>
                                <select id="status-filter" onchange="filterHistory()" class="form-input">
                                    <option value="all">All Status</option>
                                    <option value="completed">Completed</option>
                                    <option value="interrupted">Interrupted</option>
                                </select>
                            </div>
                            <div>
                                <label class="form-label">Sort By</label>
                                <select id="sort-filter" onchange="filterHistory()" class="form-input">
                                    <option value="date_desc">Newest First</option>
                                    <option value="date_asc">Oldest First</option>
                                    <option value="duration_desc">Longest Duration</option>
                                    <option value="alerts_desc">Most Alerts</option>
                                </select>
                            </div>
                            <div class="flex items-end">
                                <button onclick="exportHistory()" class="btn btn-primary w-full">
                                    <i class="fas fa-download mr-2"></i>Export
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Sessions List Section - displays detection session history -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="text-xl font-semibold">
                            <i class="fas fa-list mr-2"></i>Session History
                        </h3>
                    </div>
                    <div class="p-6">
                        <div id="sessions-list">
                            ${renderSessionsList(sessions)}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Error loading history:', error);
        historyContainer.innerHTML = `
            <div class="text-center py-12">
                <i class="fas fa-exclamation-triangle text-red-500 text-4xl mb-4"></i>
                <h3 class="text-xl font-semibold text-gray-800 mb-2">Error Loading History</h3>
                <p class="text-gray-600 mb-4">Unable to load detection history. Please try again.</p>
                <button onclick="loadHistory()" class="btn btn-primary">
                    <i class="fas fa-refresh mr-2"></i>Retry
                </button>
            </div>
        `;
        showToast('Failed to load history data', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Render sessions list
 * Displays list of detection sessions with details
 * @param {Array} sessions - Array of detection sessions
 * @returns {string} HTML string for sessions list
 */
function renderSessionsList(sessions) {
    if (!sessions || sessions.length === 0) {
        return `
            <div class="text-center py-12">
                <i class="fas fa-history text-gray-400 text-4xl mb-4"></i>
                <h3 class="text-xl font-semibold text-gray-800 mb-2">No History Found</h3>
                <p class="text-gray-600 mb-4">You haven't completed any detection sessions yet.</p>
                <button onclick="showPage('detection')" class="btn btn-primary">
                    <i class="fas fa-play mr-2"></i>Start First Session
                </button>
            </div>
        `;
    }
    
    return `
        <div class="space-y-4">
            ${sessions.map(session => `
                <div class="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer" 
                     onclick="viewSessionDetails('${session.id}')">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-4">
                            <div class="w-12 h-12 rounded-full ${getSessionStatusColor(session.status)} flex items-center justify-center">
                                <i class="fas ${getSessionStatusIcon(session.status)} text-white"></i>
                            </div>
                            <div>
                                <h4 class="text-lg font-semibold text-gray-800">
                                    ${formatDate(session.start_time)}
                                </h4>
                                <p class="text-sm text-gray-600">
                                    Duration: ${formatDuration(session.duration || 0)} • 
                                    Status: <span class="capitalize">${session.status}</span>
                                </p>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="flex space-x-4 text-sm">
                                <div class="text-center">
                                    <div class="text-lg font-bold text-green-500">${session.awake_count || 0}</div>
                                    <div class="text-gray-600">Awake</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-lg font-bold text-red-500">${session.drowsiness_count || 0}</div>
                                    <div class="text-gray-600">Drowsy</div>
                                </div>
                                <div class="text-center">
                                    <div class="text-lg font-bold text-yellow-500">${session.yawn_count || 0}</div>
                                    <div class="text-gray-600">Yawn</div>
                                </div>
                            </div>
                            <div class="mt-2">
                                <i class="fas fa-chevron-right text-gray-400"></i>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

/**
 * View detailed session information
 * Opens modal with session details and charts
 * @param {string} sessionId - Session ID to view
 */
async function viewSessionDetails(sessionId) {
    try {
        showLoading();
        
        // Fetch detailed session data
        // Connects to: BE/api_database.py - /history/session/{id} endpoint
        const sessionDetails = await apiRequest(`/history/session/${sessionId}`);
        
        // Create and show modal with session details
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-screen overflow-y-auto">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold text-gray-800">
                            <i class="fas fa-chart-line mr-2"></i>Session Details
                        </h2>
                        <button onclick="this.closest('.fixed').remove()" class="text-gray-400 hover:text-gray-600">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    
                    <!-- Session Overview -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div class="text-center">
                            <div class="text-3xl font-bold text-indigo-600">${formatDuration(sessionDetails.duration || 0)}</div>
                            <div class="text-gray-600">Total Duration</div>
                        </div>
                        <div class="text-center">
                            <div class="text-3xl font-bold text-green-600">${sessionDetails.total_detections || 0}</div>
                            <div class="text-gray-600">Total Detections</div>
                        </div>
                        <div class="text-center">
                            <div class="text-3xl font-bold text-red-600">${sessionDetails.drowsiness_count || 0}</div>
                            <div class="text-gray-600">Drowsiness Alerts</div>
                        </div>
                    </div>
                    
                    <!-- Detection Timeline -->
                    <div class="mb-8">
                        <h3 class="text-lg font-semibold mb-4">Detection Timeline</h3>
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <canvas id="timeline-chart" width="800" height="200"></canvas>
                        </div>
                    </div>
                    
                    <!-- Detailed Results -->
                    <div>
                        <h3 class="text-lg font-semibold mb-4">Detection Results</h3>
                        <div class="max-h-64 overflow-y-auto">
                            <table class="w-full text-sm">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-4 py-2 text-left">Time</th>
                                        <th class="px-4 py-2 text-left">Detection</th>
                                        <th class="px-4 py-2 text-left">Confidence</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${sessionDetails.detections?.map(detection => `
                                        <tr class="border-b">
                                            <td class="px-4 py-2">${formatDate(detection.timestamp)}</td>
                                            <td class="px-4 py-2">
                                                <span class="px-2 py-1 rounded text-xs ${getDetectionBadgeColor(detection.class)}">
                                                    ${detection.class}
                                                </span>
                                            </td>
                                            <td class="px-4 py-2">${(detection.confidence * 100).toFixed(1)}%</td>
                                        </tr>
                                    `).join('') || '<tr><td colspan="3" class="px-4 py-2 text-center text-gray-500">No detailed results available</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Initialize timeline chart
        initializeTimelineChart(sessionDetails);
        
    } catch (error) {
        console.error('Error loading session details:', error);
        showToast('Failed to load session details', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Get badge color for detection class
 * @param {string} detectionClass - Detection class
 * @returns {string} CSS classes for badge
 */
function getDetectionBadgeColor(detectionClass) {
    switch(detectionClass) {
        case 'Drowsiness': return 'bg-red-100 text-red-800';
        case 'awake': return 'bg-green-100 text-green-800';
        case 'yawn': return 'bg-yellow-100 text-yellow-800';
        default: return 'bg-gray-100 text-gray-800';
    }
}

/**
 * Initialize timeline chart for session details
 * @param {object} sessionDetails - Session details data
 */
function initializeTimelineChart(sessionDetails) {
    const canvas = document.getElementById('timeline-chart');
    if (!canvas || !sessionDetails.detections) return;
    
    const ctx = canvas.getContext('2d');
    const detections = sessionDetails.detections;
    
    if (detections.length === 0) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No detection data available', canvas.width / 2, canvas.height / 2);
        return;
    }
    
    // Simple timeline visualization
    const width = canvas.width - 40;
    const height = canvas.height - 40;
    const startX = 20;
    const startY = 20;
    
    // Draw timeline background
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(startX, startY, width, height);
    
    // Draw detection points
    detections.forEach((detection, index) => {
        const x = startX + (index / detections.length) * width;
        const y = startY + height / 2;
        
        const color = detection.class === 'Drowsiness' ? '#ef4444' : 
                      detection.class === 'awake' ? '#10b981' : '#f59e0b';
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, 2 * Math.PI);
        ctx.fill();
    });
    
    // Draw labels
    ctx.fillStyle = '#374151';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Start', startX, startY + height + 15);
    ctx.textAlign = 'right';
    ctx.fillText('End', startX + width, startY + height + 15);
}

/**
 * Filter history based on selected criteria
 * Updates the sessions list based on filter selections
 */
async function filterHistory() {
    const dateFilter = document.getElementById('date-filter').value;
    const statusFilter = document.getElementById('status-filter').value;
    const sortFilter = document.getElementById('sort-filter').value;
    
    try {
        showLoading();
        
        // Fetch filtered sessions
        // Connects to: BE/api_database.py - /history/sessions endpoint with filters
        const response = await apiRequest(`/history/sessions?date=${dateFilter}&status=${statusFilter}&sort=${sortFilter}`);
        
        console.log('Filter API response:', response); // Debug log
        
        // Extract sessions from response (API returns {pagination: {...}, sessions: [...]})
        const sessions = response && response.sessions ? response.sessions : [];
        
        console.log('Sessions array:', sessions); // Debug log
        
        // Update sessions list
        document.getElementById('sessions-list').innerHTML = renderSessionsList(sessions);
        
    } catch (error) {
        console.error('Error filtering history:', error);
        showToast('Failed to filter history', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Export history data
 * Downloads history data as CSV file
 */
async function exportHistory() {
    try {
        showLoading();
        
        // Request export data from backend
        // Connects to: BE/api_database.py - /history/export endpoint
        const response = await fetch(`${API_BASE_URL}/history/export`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Export failed');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `detection_history_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        showToast('History exported successfully', 'success');
        
    } catch (error) {
        console.error('Error exporting history:', error);
        showToast('Failed to export history', 'error');
    } finally {
        hideLoading();
    }
}

// Main page load function for history page
function loadHistoryPage() {
    console.log('Initializing history page...');
    
    // Load history data
    loadHistory();
    
    // Set up event listeners for filter form
    const filterForm = document.getElementById('history-filter-form');
    if (filterForm) {
        filterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            filterHistory();
        });
    }
    
    // Set up export button
    const exportBtn = document.getElementById('export-history');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportHistory);
    }
}

// Export functions for use in other modules
window.loadHistory = loadHistory;
window.loadHistoryPage = loadHistoryPage;
window.viewSessionDetails = viewSessionDetails;
window.filterHistory = filterHistory;
window.exportHistory = exportHistory;
