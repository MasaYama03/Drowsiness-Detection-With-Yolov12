// Detection JavaScript - Handles live camera detection and file upload detection
// This section manages the detection page with live camera and file upload features

// Global variables for live detection
let detectionStream = null;
let drowsinessStartTime = null;
let drowsinessCountedForStats = false; // Track if this drowsiness episode was already counted
let alarmAudio = null;
let sessionStats = {};
let sessionDurationTimer = null;
let sessionStartTime = null;
let totalSessionTime = 0; // Accumulated time in seconds
let currentAlarmSettings = {
    triggerTime: 5,
    volume: 0.8,
    soundFile: 'http://localhost:5000/sound-default/Danger Alarm Sound Effect.mp3' // Default sound file from BE/sound-default
};

/**
 * Load detection page content
 * Connects to: detection page section
 * Database tables: detection_sessions, detection_results, user_settings
 */
window.addEventListener('beforeunload', (event) => {
    // This event fires when the user closes the tab or refreshes.
    if (AppState.detectionActive && AppState.currentSessionId) {
        // Use sendBeacon for reliability on page exit. It's asynchronous and doesn't expect a response.
        const data = {
            session_id: AppState.currentSessionId,
            jwt: localStorage.getItem('authToken')
        };
        navigator.sendBeacon(
            `${API_BASE_URL}/api/detection/end-session`,
            new Blob([JSON.stringify(data)], { type: 'application/json' })
        );
    }
});

async function loadDetection() {
    const detectionContainer = document.getElementById('detection-page');
    
    showLoading();
    
    try {
        // Fetch user alarm settings
        // Connects to: BE/api_database.py - /settings/alarm endpoint
        const settings = await apiRequest('/settings/alarm');
        currentAlarmSettings = { ...currentAlarmSettings, ...settings };
        
        // Load available alarm sounds
        await loadDetectionAlarmSounds();
        
        detectionContainer.innerHTML = `
            <div class="fade-in">
                <!-- Detection Header Section -->
                <div class="mb-8">
                    <h1 class="text-4xl font-bold text-gray-800 mb-2">
                        <i class="fas fa-camera text-indigo-600 mr-3"></i>
                        Drowsiness Detection
                    </h1>
                    <p class="text-gray-600">Monitor your alertness in real-time or analyze uploaded media</p>
                </div>

                <!-- Detection Mode Tabs -->
                <div class="mb-8">
                    <div class="border-b border-gray-200">
                        <nav class="-mb-px flex space-x-8">
                            <button onclick="switchDetectionMode('live')" 
                                    id="live-tab" 
                                    class="detection-tab active py-2 px-1 border-b-2 border-indigo-500 font-medium text-sm text-indigo-600">
                                <i class="fas fa-video mr-2"></i>Live Camera
                            </button>
                            <button onclick="switchDetectionMode('upload')" 
                                    id="upload-tab" 
                                    class="detection-tab py-2 px-1 border-b-2 border-transparent font-medium text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300">
                                <i class="fas fa-upload mr-2"></i>Upload File
                            </button>
                        </nav>
                    </div>
                </div>

                <!-- Live Detection Section -->
                <div id="live-detection" class="detection-mode">
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <!-- Camera Feed Section -->
                        <div class="lg:col-span-2">
                            <div class="card">
                                <div class="card-header">
                                    <h3 class="text-xl font-semibold">
                                        <i class="fas fa-camera mr-2"></i>Live Camera Feed
                                    </h3>
                                </div>
                                <div class="p-6">
                                    <!-- Camera container for live feed display -->
                                    <div id="camera-container" class="camera-container mb-4">
                                        <div id="camera-placeholder" class="camera-overlay">
                                            <div class="text-center">
                                                <i class="fas fa-camera text-4xl mb-4"></i>
                                                <p class="text-lg">Click "Start Detection" to begin</p>
                                            </div>
                                        </div>
                                        <video id="camera-feed" class="camera-feed hidden" autoplay muted></video>
                                        <canvas id="detection-canvas" class="absolute top-0 left-0 w-full h-full hidden"></canvas>
                                        <img id="frame-snapshot" class="hidden" />
                                    </div>
                                    
                                    <!-- Camera Controls -->
                                    <div class="flex flex-wrap gap-4 justify-center">
                                        <button id="start-detection-btn" onclick="startLiveDetection()" class="btn btn-primary">
                                            <i class="fas fa-play mr-2"></i>Start Detection
                                        </button>
                                        <button id="stop-detection-btn" onclick="stopLiveDetection()" class="btn btn-danger hidden">
                                            <i class="fas fa-stop mr-2"></i>Stop Detection
                                        </button>
                                        <button id="stop-alarm-btn" onclick="stopAlarm()" class="btn btn-warning hidden">
                                            <i class="fas fa-volume-mute mr-2"></i>Stop Alarm
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Detection Status Section -->
                        <div class="lg:col-span-1">
                            <!-- Current Status Card -->
                            <div class="card mb-6">
                                <div class="card-header">
                                    <h3 class="text-lg font-semibold">
                                        <i class="fas fa-info-circle mr-2"></i>Detection Status
                                    </h3>
                                </div>
                                <div class="p-4">
                                    <div id="detection-status" class="detection-status inactive">
                                        <i class="fas fa-pause mr-2"></i>Detection Inactive
                                    </div>
                                    
                                    <!-- Current detection result display -->
                                    <div id="current-detection" class="hidden">
                                        <div class="text-center">
                                            <div id="detection-class" class="text-2xl font-bold mb-2">-</div>
                                            <div id="detection-confidence" class="text-lg text-gray-600 mb-2">-</div>
                                            <div id="detection-time" class="text-sm text-gray-500">-</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Alarm Settings Card -->
                            <div class="card mb-6">
                                <div class="card-header">
                                    <h3 class="text-lg font-semibold">
                                        <i class="fas fa-bell mr-2"></i>Alarm Settings
                                    </h3>
                                </div>
                                <div class="p-4 space-y-4">
                                    <!-- Trigger time setting -->
                                    <div>
                                        <label class="form-label">Trigger Time (seconds)</label>
                                        <input type="range" id="trigger-time" min="1" max="10" value="${currentAlarmSettings.triggerTime}" 
                                               class="w-full" onchange="updateTriggerTime(this.value)">
                                        <div class="flex justify-between text-sm text-gray-500">
                                            <span>1s</span>
                                            <span id="trigger-time-display">${currentAlarmSettings.triggerTime}s</span>
                                            <span>10s</span>
                                        </div>
                                    </div>
                                    
                                    <!-- Alarm Sound Management -->
                                    <div>
                                        <label class="form-label">Alarm Sound</label>
                                        <!-- Alarm Sound Selection -->
                                        <div class="space-y-3">
                                            <div class="flex space-x-2">
                                                <select id="detection-alarm-sound-select" class="flex-1 p-2 border border-gray-300 rounded-lg" onchange="selectDetectionAlarmSound()">
                                                    <option value="default">Default Alarm</option>
                                                </select>
                                                <button type="button" onclick="testDetectionAlarmSound()" class="btn bg-yellow-500 text-white hover:bg-yellow-600">
                                                    <i class="fas fa-play mr-2"></i>Test
                                                </button>
                                                <button type="button" onclick="deleteDetectionAlarmSound()" id="detection-delete-alarm-btn" class="btn bg-red-500 text-white hover:bg-red-600 hidden">
                                                    <i class="fas fa-trash mr-2"></i>Delete
                                                </button>
                                            </div>
                                            
                                            <!-- Upload new sound -->
                                            <div class="flex space-x-2">
                                                <input type="file" id="alarm-sound" accept=".mp3,.wav,.ogg" 
                                                       onchange="uploadAlarmSound(this.files[0])" 
                                                       class="flex-1 p-2 border border-gray-300 rounded-lg">
                                                <button type="button" onclick="document.getElementById('alarm-sound').click()" class="btn bg-blue-500 text-white hover:bg-blue-600">
                                                    <i class="fas fa-upload mr-2"></i>Upload New
                                                </button>
                                            </div>
                                            <p class="text-sm text-gray-500">Upload MP3, WAV, or OGG file for custom alarm sound</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Session Statistics Card -->
                            <div class="card">
                                <div class="card-header">
                                    <h3 class="text-lg font-semibold">
                                        <i class="fas fa-chart-bar mr-2"></i>Session Stats
                                    </h3>
                                </div>
                                <div class="p-4">
                                    <div class="space-y-3">
                                        <div class="flex justify-between">
                                            <span class="text-gray-600">Duration:</span>
                                            <span id="session-duration" class="font-medium">0:00</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-600">Total Detections:</span>
                                            <span id="total-detections" class="font-medium">0</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-600">Drowsiness:</span>
                                            <span id="drowsiness-count" class="font-medium text-red-500">0</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-600">Awake:</span>
                                            <span id="awake-count" class="font-medium text-green-500">0</span>
                                        </div>
                                        <div class="flex justify-between">
                                            <span class="text-gray-600">Yawn:</span>
                                            <span id="yawn-count" class="font-medium text-yellow-500">0</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Upload Detection Section -->
                <div id="upload-detection" class="detection-mode hidden">
                    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <!-- Upload Section -->
                        <div>
                            <div class="card">
                                <div class="card-header">
                                    <h3 class="text-xl font-semibold">
                                        <i class="fas fa-cloud-upload-alt mr-2"></i>Upload Media
                                    </h3>
                                </div>
                                <div class="p-6">
                                    <!-- File upload area for image/video processing -->
                                    <div id="upload-area" class="file-upload" onclick="document.getElementById('file-input').click()">
                                        <div class="text-center">
                                            <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-4"></i>
                                            <p class="text-lg font-medium text-gray-700 mb-2">Drop files here or click to upload</p>
                                            <p class="text-sm text-gray-500 mb-3">Supports images (JPG, PNG) and videos (MP4, AVI)</p>
                                            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-left">
                                                <div class="flex items-start space-x-2">
                                                    <i class="fas fa-info-circle text-yellow-600 mt-0.5"></i>
                                                    <div class="text-sm text-yellow-800">
                                                        <p class="font-medium mb-1">Important Notes:</p>
                                                        <ul class="list-disc list-inside space-y-1 text-xs">
                                                            <li>Video processing time depends on duration - longer videos take more time</li>
                                                            <li>Each new upload will replace the previous file to save storage</li>
                                                        </ul>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <input type="file" id="file-input" accept="image/*,video/*" onchange="handleFileUpload(this.files[0])" class="hidden">
                                    
                                    <!-- Processing controls -->
                                    <div id="upload-controls" class="mt-6 hidden">
                                        <button id="process-file-btn" onclick="processUploadedFile()" class="btn btn-primary w-full">
                                            <i class="fas fa-cogs mr-2"></i>Process File
                                        </button>
                                    </div>
                                    
                                    <!-- Progress bar -->
                                    <div id="upload-progress" class="mt-4 hidden">
                                        <div class="bg-gray-200 rounded-full h-3 mb-2">
                                            <div id="progress-fill" class="bg-indigo-600 h-3 rounded-full transition-all duration-300 ease-out relative overflow-hidden" style="width: 0%">
                                                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
                                            </div>
                                        </div>
                                        <div class="flex justify-between items-center">
                                            <p id="progress-text" class="text-sm text-gray-600">Processing...</p>
                                            <div class="flex items-center space-x-2">
                                                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600"></div>
                                                <span id="progress-percentage" class="text-sm font-medium text-indigo-600">0%</span>
                                            </div>
                                        </div>
                                        <div class="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                                            <div class="flex items-start space-x-2">
                                                <i class="fas fa-exclamation-triangle text-red-600 mt-0.5"></i>
                                                <div class="text-sm text-red-800">
                                                    <p class="font-medium">Please wait - Do not leave this page!</p>
                                                    <p class="text-xs mt-1">Processing is in progress. Leaving or refreshing the page will interrupt the analysis.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Results Section -->
                        <div>
                            <div class="card">
                                <div class="card-header">
                                    <h3 class="text-xl font-semibold">
                                        <i class="fas fa-chart-line mr-2"></i>Analysis Results
                                    </h3>
                                </div>
                                <div class="p-6">
                                    <div id="upload-results" class="text-center text-gray-500">
                                        <i class="fas fa-chart-bar text-4xl mb-4"></i>
                                        <p>Upload and process a file to see results</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        initializeSessionStats();
        
    } catch (error) {
        console.error('Error loading detection page:', error);
        showToast('Failed to load detection settings', 'error');
    } finally {
        hideLoading();
    }
}

// Session statistics tracking - initialized in initializeSessionStats()

/**
 * Switch between detection modes (live/upload)
 */
function switchDetectionMode(mode) {
    document.querySelectorAll('.detection-tab').forEach(tab => {
        tab.classList.remove('active', 'border-indigo-500', 'text-indigo-600');
        tab.classList.add('border-transparent', 'text-gray-500');
    });
    
    document.getElementById(`${mode}-tab`).classList.add('active', 'border-indigo-500', 'text-indigo-600');
    document.getElementById(`${mode}-tab`).classList.remove('border-transparent', 'text-gray-500');
    
    document.querySelectorAll('.detection-mode').forEach(section => {
        section.classList.add('hidden');
    });
    
    document.getElementById(`${mode}-detection`).classList.remove('hidden');
}

/**
 * Start live camera detection
 * Connects to: BE/api_model.py - /detection/start-session endpoint
 */
async function startLiveDetection() {
    if (AppState.isStopping) {
        showToast('Please wait, the previous session is still stopping.', 'warning');
        return;
    }
    // Always reset stats for a new session
    initializeSessionStats();

    try {
        showLoading();
        
        detectionStream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 } 
        });
        
        const videoElement = document.getElementById('camera-feed');
        videoElement.srcObject = detectionStream;
        
        document.getElementById('camera-placeholder').classList.add('hidden');
        videoElement.classList.remove('hidden');
        document.getElementById('detection-canvas').classList.remove('hidden');
        
        // Update button states and colors
        const startBtn = document.getElementById('start-detection-btn');
        const stopBtn = document.getElementById('stop-detection-btn');
        
        // Start button becomes red and disabled (transparent)
        startBtn.className = 'btn bg-red-500 text-white opacity-50 cursor-not-allowed';
        startBtn.disabled = true;
        
        // Stop button becomes blue and active
        stopBtn.className = 'btn bg-blue-600 text-white hover:bg-blue-700';
        stopBtn.classList.remove('hidden');
        
        document.getElementById('detection-status').className = 'detection-status active';
        document.getElementById('detection-status').innerHTML = '<i class="fas fa-play mr-2"></i>Detection Active';
        document.getElementById('current-detection').classList.remove('hidden');
        
        const sessionResponse = await apiRequest('/detection/start-session', {
            method: 'POST',
            body: JSON.stringify({ type: 'live' })
        });
        
        AppState.currentSessionId = sessionResponse.session_id;
        AppState.detectionActive = true;
        
        // Session resume logic removed, always a new session.
        
        // Start session duration timer
        startSessionTimer();
        
        startDetectionLoop();
        showToast('Detection started successfully', 'success');
        
    } catch (error) {
        console.error('Error starting detection:', error);
        showToast('Failed to start detection. Please check camera permissions.', 'error');
        stopLiveDetection();
    } finally {
        hideLoading();
    }
}

// ...
/**
 * Stop live camera detection
 */
async function stopLiveDetection() {
    if (AppState.isStopping) return; // Prevent multiple calls
    AppState.isStopping = true;
    // First, stop all frontend processing and hardware access.
    // This is critical to prevent race conditions and release the camera.
    if (detectionStream) {
        detectionStream.getTracks().forEach(track => track.stop());
        detectionStream = null;
    }

    // Stop the alarm and session timer
    stopAlarm();
    stopSessionTimer();

    const sessionIdToStop = AppState.currentSessionId;

    // Reset AppState immediately
    AppState.detectionActive = false;
    AppState.currentSessionId = null;
    drowsinessStartTime = null;

    // Update the UI to reflect the stopped state
    const videoElement = document.getElementById('camera-feed');
    if (videoElement) {
        videoElement.srcObject = null;
        videoElement.classList.add('hidden');
    }
    document.getElementById('detection-canvas')?.classList.add('hidden');
    document.getElementById('camera-placeholder')?.classList.remove('hidden');

    const startBtn = document.getElementById('start-detection-btn');
    const stopBtn = document.getElementById('stop-detection-btn');
    if(startBtn) {
        startBtn.className = 'btn btn-primary';
        startBtn.disabled = false;
    }
    if(stopBtn) {
        stopBtn.className = 'btn btn-danger hidden';
        stopBtn.classList.add('hidden');
    }
    
    document.getElementById('stop-alarm-btn')?.classList.add('hidden');
    const statusEl = document.getElementById('detection-status');
    if(statusEl) {
        statusEl.className = 'detection-status inactive';
        statusEl.innerHTML = '<i class="fas fa-pause mr-2"></i>Detection Inactive';
    }
    document.getElementById('current-detection')?.classList.add('hidden');

    // Finally, notify the backend that the session has ended.
    // This is done before resetting stats to ensure all processing is complete.
    if (sessionIdToStop) {
        try {
            await apiRequest(`/detection/stop-session/${sessionIdToStop}`, {
                method: 'POST'
            });
            showToast('Detection stopped and session saved.', 'info');
        } catch (error) {
            console.error('Error stopping session on backend:', error);
            showToast('Detection stopped, but failed to save session.', 'error');
        }
    } else {
        showToast('Detection stopped.', 'info');
    }

    // Reset stats display for the next session - do this last to avoid race conditions
    initializeSessionStats();

    AppState.isStopping = false;
}

/**
 * Start detection processing loop
 */
let lastDetections = []; // State to hold the last known detections

async function startDetectionLoop() {
    const videoElement = document.getElementById('camera-feed');
    const canvas = document.getElementById('detection-canvas');
    const ctx = canvas.getContext('2d');
    const snapshotImg = document.getElementById('frame-snapshot');

    lastDetections = []; // Reset on new loop start

    // Load alarm settings and sounds
    try {
        const alarmSettings = await apiRequest('/settings/alarm');
        currentAlarmSettings = {
            volume: alarmSettings.volume || 0.8,
            triggerTime: alarmSettings.triggerTime || 5,
            enabled: alarmSettings.alarmEnabled !== false,
            alarmSound: alarmSettings.alarmSound || 'default'
        };
        selectedAlarmSound = currentAlarmSettings.alarmSound;
        await loadDetectionAlarmSounds();
    } catch (error) {
        console.error('Error loading alarm settings:', error);
        // Fallback settings
        currentAlarmSettings = { volume: 0.8, triggerTime: 5, enabled: true, alarmSound: 'default' };
        selectedAlarmSound = 'default';
    }

    const processFrame = async () => {
        if (!AppState.detectionActive || !videoElement.videoWidth || !AppState.currentSessionId) return;

        // Use a temporary canvas to grab the frame from the video
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = videoElement.videoWidth;
        tempCanvas.height = videoElement.videoHeight;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(videoElement, 0, 0, tempCanvas.width, tempCanvas.height);

        snapshotImg.src = tempCanvas.toDataURL('image/jpeg', 0.8);

        snapshotImg.onload = async () => {
            try {
                // 1. Draw the new video frame
                canvas.width = videoElement.videoWidth;
                canvas.height = videoElement.videoHeight;
                ctx.drawImage(snapshotImg, 0, 0);

                // 2. Immediately redraw the last known bounding boxes to prevent flicker
                if (lastDetections.length > 0) {
                    lastDetections.forEach(detection => {
                        drawBoundingBox(ctx, detection);
                    });
                }

                const imageData = snapshotImg.src;

                const result = await apiRequest('/detection/analyze-frame', {
                    method: 'POST',
                    body: JSON.stringify({
                        session_id: AppState.currentSessionId,
                        image_data: imageData
                    })
                });

                if (result && AppState.detectionActive) {
                    // 3. Update the state with the new detections for the next frame
                    lastDetections = result.detections || [];

                    // 4. Update UI text and handle drowsiness logic
                    if (lastDetections.length > 0) {
                        const topDetection = lastDetections[0];
                        updateDetectionDisplay(topDetection);
                        handleDrowsinessDetection(topDetection);
                    } else {
                        updateDetectionDisplay({ class: 'Normal', confidence: 0.5 });
                        handleDrowsinessDetection({ class: 'Normal', confidence: 0.5 });
                    }
                }

            } catch (error) {
                console.error('Error during frame analysis:', error);
            } finally {
                // Schedule the next frame processing if still active
                if (AppState.detectionActive) {
                    requestAnimationFrame(processFrame);
                }
            }
        };
    };

    // Start the detection loop
    processFrame();
}

function updateDetectionDisplay(result) {
    document.getElementById('detection-class').textContent = result.class || '-';
    document.getElementById('detection-confidence').textContent = 
        result.confidence ? `${(result.confidence * 100).toFixed(1)}%` : '-';
    document.getElementById('detection-time').textContent = 
        result.timestamp ? formatDate(result.timestamp) : '-';
    
    const classElement = document.getElementById('detection-class');
    classElement.className = `text-2xl font-bold mb-2 ${getDetectionColor(result.class)}`;
    
    updateSessionStats(result);
}

function getDetectionColor(detectionClass) {
    switch(detectionClass) {
        case 'Drowsiness': return 'text-red-500';
        case 'awake': return 'text-green-500';
        case 'yawn': return 'text-yellow-500';
        default: return 'text-gray-500';
    }
}

function drawBoundingBox(ctx, detection) {
    // Only draw bounding box if bbox exists and has valid coordinates
    if (!detection.bbox || detection.bbox.length !== 4) {
        return;
    }
    
    const [x1, y1, x2, y2] = detection.bbox;
    
    // Skip drawing if bbox is invalid (all zeros or negative dimensions)
    if (x1 === 0 && y1 === 0 && x2 === 0 && y2 === 0) {
        return;
    }
    
    if (x2 <= x1 || y2 <= y1) {
        return;
    }
    
    // Convert BGR color from backend to RGB for canvas
    let color;
    if (detection.color) {
        const [b, g, r] = detection.color;
        color = `rgb(${r}, ${g}, ${b})`;
    } else {
        // Fallback colors matching backend exactly (BGR converted to RGB)
        color = detection.class === 'Drowsiness' ? 'rgb(255, 0, 0)' : 
                detection.class === 'awake' ? 'rgb(0, 255, 0)' : 
                detection.class === 'yawn' ? 'rgb(255, 255, 0)' : 'rgb(255, 255, 255)';
    }
    
    // Draw bounding box
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    
    // Draw label background
    const label = `${detection.class}: ${(detection.confidence * 100).toFixed(1)}%`;
    ctx.font = '16px Arial';
    const textWidth = ctx.measureText(label).width;
    
    ctx.fillStyle = color;
    ctx.fillRect(x1, y1 - 30, textWidth + 10, 25);
    
    // Draw label text
    ctx.fillStyle = 'white';
    ctx.fillText(label, x1 + 5, y1 - 10);
}

function handleDrowsinessDetection(result) {
    console.log('handleDrowsinessDetection called with:', result.class, 'confidence:', result.confidence);
    console.log('Current alarm settings:', currentAlarmSettings);
    console.log('AppState.alarmActive:', AppState.alarmActive);
    
    if (result.class === 'Drowsiness') {
        if (!drowsinessStartTime) {
            drowsinessStartTime = Date.now();
            drowsinessCountedForStats = false; // Reset counter for new drowsiness episode
            console.log('🔴 Drowsiness detection started at:', new Date().toLocaleTimeString());
        } else {
            const drowsinessTime = (Date.now() - drowsinessStartTime) / 1000;
            console.log('⏱️ Drowsiness duration:', drowsinessTime.toFixed(1), 'seconds, trigger time:', currentAlarmSettings.triggerTime);
            
            // Only count in session stats if drowsiness detected for more than 5 seconds
            if (drowsinessTime >= 5 && !drowsinessCountedForStats) {
                sessionStats.drowsinessCount++;
                sessionStats.totalDetections++;
                document.getElementById('drowsiness-count').textContent = sessionStats.drowsinessCount;
                document.getElementById('total-detections').textContent = sessionStats.totalDetections;
                drowsinessCountedForStats = true; // Mark as counted to avoid double counting
                console.log('📊 Drowsiness counted in stats! Total count:', sessionStats.drowsinessCount);
                
                // Update backend with latest stats
                updateBackendSessionStats();
            }
            
            // Trigger alarm based on trigger time setting
            if (drowsinessTime >= currentAlarmSettings.triggerTime && !AppState.alarmActive) {
                console.log('🚨 SHOULD TRIGGER ALARM NOW! Duration:', drowsinessTime.toFixed(1), 'seconds, Trigger time:', currentAlarmSettings.triggerTime);
                console.log('🚨 Alarm active status before trigger:', AppState.alarmActive);
                triggerAlarm();
            } else if (drowsinessTime >= currentAlarmSettings.triggerTime && AppState.alarmActive) {
                console.log('⚠️ Alarm already active, not triggering again');
            } else {
                console.log('⏳ Not yet time to trigger alarm. Need:', currentAlarmSettings.triggerTime, 'seconds, Current:', drowsinessTime.toFixed(1));
            }
        }
    } else {
        // Reset when no longer drowsy
        if (drowsinessStartTime) {
            console.log('✅ Drowsiness detection ended');
        }
        drowsinessStartTime = null;
        drowsinessCountedForStats = false;
    }
}

// Create beep sound using Web Audio API
function createBeepSound() {
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Create a simple audio element that plays the beep
        const audio = {
            play: () => {
                return new Promise((resolve, reject) => {
                    try {
                        const oscillator = audioContext.createOscillator();
                        const gainNode = audioContext.createGain();
                        
                        oscillator.connect(gainNode);
                        gainNode.connect(audioContext.destination);
                        
                        oscillator.frequency.value = 800; // 800 Hz beep
                        oscillator.type = 'sine';
                        
                        // Set volume
                        gainNode.gain.setValueAtTime(this.volume || 0.8, audioContext.currentTime);
                        
                        oscillator.start();
                        
                        // Stop after 1 second if not looping
                        if (!this.loop) {
                            setTimeout(() => {
                                try {
                                    oscillator.stop();
                                } catch (e) {
                                    // Oscillator already stopped
                                }
                            }, 1000);
                        }
                        
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                });
            },
            pause: () => {
                // For beep sound, we can't really pause, just resolve
                return Promise.resolve();
            },
            volume: 0.8,
            loop: false
        };
        
        return audio;
    } catch (error) {
        console.error('❌ Error creating beep sound:', error);
        // Return a dummy audio object that doesn't crash
        return {
            play: () => Promise.resolve(),
            pause: () => Promise.resolve(),
            volume: 0.8,
            loop: false
        };
    }
}

function triggerAlarm() {
    console.log('🚨🚨🚨 triggerAlarm() called 🚨🚨🚨');
    console.log('Setting AppState.alarmActive to true');
    AppState.alarmActive = true;
    
    // Make stop alarm button blue and prominent when alarm is active
    const stopAlarmBtn = document.getElementById('stop-alarm-btn');
    if (stopAlarmBtn) {
        stopAlarmBtn.className = 'btn bg-blue-600 text-white hover:bg-blue-700 animate-pulse';
        stopAlarmBtn.classList.remove('hidden');
        console.log('✅ Stop alarm button made visible and blue');
    } else {
        console.error('❌ Stop alarm button not found!');
    }
    
    console.log('📋 Current alarm settings:', currentAlarmSettings);
    console.log('🔊 Volume setting:', currentAlarmSettings.volume);
    console.log('🎵 Sound file:', currentAlarmSettings.soundFile);
    
    // Always use default sound file if soundFile is undefined
    const defaultSoundFile = 'http://localhost:5000/sound-default/Danger Alarm Sound Effect.mp3';
    const soundFileToUse = currentAlarmSettings.soundFile || defaultSoundFile;
    
    console.log('🎵 Loading audio file:', soundFileToUse);
    alarmAudio = new Audio(soundFileToUse);
    
    // Add event listeners for debugging
    alarmAudio.addEventListener('loadstart', () => console.log('🎵 Audio: Load started'));
    alarmAudio.addEventListener('canplay', () => console.log('🎵 Audio: Can play'));
    alarmAudio.addEventListener('error', (e) => {
        console.error('❌ Audio error:', e);
        console.log('🔔 Falling back to beep sound...');
        // Fallback to beep sound
        alarmAudio = createBeepSound();
        alarmAudio.volume = currentAlarmSettings.volume;
        alarmAudio.loop = true;
        alarmAudio.play().then(() => {
            console.log('✅ Fallback beep sound playing');
        }).catch(beepError => {
            console.error('❌ Fallback beep also failed:', beepError);
        });
    });
    alarmAudio.addEventListener('loadeddata', () => console.log('🎵 Audio: Data loaded'));
    alarmAudio.addEventListener('play', () => console.log('▶️ Audio: Started playing'));
    alarmAudio.addEventListener('pause', () => console.log('⏸️ Audio: Paused'));
    
    if (alarmAudio) {
        alarmAudio.volume = currentAlarmSettings.volume;
        alarmAudio.loop = true;
        console.log('🔊 Audio volume set to:', alarmAudio.volume);
        console.log('🔄 Audio loop set to:', alarmAudio.loop);
        
        console.log('▶️ Attempting to play audio...');
        alarmAudio.play().then(() => {
            console.log('✅ Audio playing successfully!');
        }).catch(error => {
            console.error('❌ Error playing alarm:', error);
            console.log('🔔 Trying fallback beep sound...');
            // Try fallback beep
            try {
                const fallbackAudio = createBeepSound();
                fallbackAudio.volume = currentAlarmSettings.volume;
                fallbackAudio.play();
                console.log('✅ Fallback beep sound playing');
            } catch (fallbackError) {
                console.error('❌ Fallback beep also failed:', fallbackError);
            }
        });
    } else {
        console.error('❌ No audio object created!');
    }
    
    // Visual feedback
    document.body.style.animation = 'pulse 1s infinite';
    console.log('💫 Body animation set to pulse');
    
    showToast('🚨 DROWSINESS DETECTED! Please take a break.', 'error', 10000);
    console.log('📢 Toast notification shown');
}

function stopAlarm() {
    AppState.alarmActive = false;
    
    if (alarmAudio) {
        alarmAudio.pause();
        alarmAudio = null;
    }
    
    // Reset stop alarm button to default state and hide it
    const stopAlarmBtn = document.getElementById('stop-alarm-btn');
    stopAlarmBtn.className = 'btn bg-red-500 text-white opacity-50 cursor-not-allowed';
    stopAlarmBtn.classList.add('hidden');
    document.body.style.animation = '';
    drowsinessStartTime = null;
}

function createBeepSound() {
    return { play: () => {}, pause: () => {}, volume: 1, loop: false };
}

function initializeSessionStats() {
    // Reset session stats object
    sessionStats = {
        totalDetections: 0,
        drowsinessCount: 0,
        awakeCount: 0,
        yawnCount: 0
    };

    // Reset duration tracking
    totalSessionTime = 0;
    sessionStartTime = null;

    // Stop any existing timer
    if (sessionDurationTimer) {
        clearInterval(sessionDurationTimer);
        sessionDurationTimer = null;
    }

    // Update UI display to reset all stats visually
    document.getElementById('session-duration').textContent = '0:00';
    document.getElementById('total-detections').textContent = '0';
    document.getElementById('drowsiness-count').textContent = '0';
    document.getElementById('awake-count').textContent = '0';
    document.getElementById('yawn-count').textContent = '0';
}

// Function to update session stats on the backend
async function updateBackendSessionStats() {
    if (!AppState.detectionActive || !AppState.currentSessionId) return;
    
    try {
        await apiRequest(`/detection/update-session/${AppState.currentSessionId}`, {
            method: 'POST',
            body: JSON.stringify({
                total_detections: sessionStats.totalDetections,
                drowsiness_count: sessionStats.drowsinessCount,
                awake_count: sessionStats.awakeCount,
                yawn_count: sessionStats.yawnCount
            })
        });
    } catch (error) {
        console.error('Failed to update session stats on backend:', error);
    }
}

function updateSessionStats(result) {
    switch(result.class) {
        case 'awake': 
            sessionStats.awakeCount++; 
            sessionStats.totalDetections++;
            updateBackendSessionStats();
            break;
        case 'yawn': 
            sessionStats.yawnCount++; 
            sessionStats.totalDetections++;
            updateBackendSessionStats();
            break;
        // Drowsiness is handled separately in handleDrowsinessDetection() - only counted after 5+ seconds
    }
    
    document.getElementById('total-detections').textContent = sessionStats.totalDetections;
    // drowsiness-count is updated in handleDrowsinessDetection()
    document.getElementById('awake-count').textContent = sessionStats.awakeCount;
    document.getElementById('yawn-count').textContent = sessionStats.yawnCount;
}

function startSessionTimer() {
    // Start tracking session time
    sessionStartTime = Date.now();
    
    // Start the timer that updates every second
    sessionDurationTimer = setInterval(updateSessionDurationDisplay, 1000);
}

async function endSessionOnNavigate() {
    if (AppState.detectionActive && AppState.currentSessionId) {
        console.log("Navigating away from detection page. Ending session as interrupted.");
        
        // Stop detection processing immediately
        AppState.detectionActive = false;
        
        // Stop camera stream
        if (detectionStream) {
            detectionStream.getTracks().forEach(track => track.stop());
            detectionStream = null;
        }
        
        // Clear detection interval
        if (detectionInterval) {
            clearInterval(detectionInterval);
            detectionInterval = null;
        }
        
        // Stop session timer
        stopSessionTimer();
        
        // Call end-session endpoint to mark as interrupted
        try {
            await apiRequest('/api/detection/end-session', {
                method: 'POST',
                body: JSON.stringify({ 
                    session_id: AppState.currentSessionId,
                    jwt: localStorage.getItem('authToken')
                })
            });
            console.log('Session marked as interrupted due to navigation.');
        } catch (error) {
            console.error('Error marking session as interrupted:', error);
        }
        
        // Reset UI state
        resetDetectionUI();
        
        // Clear session ID
        AppState.currentSessionId = null;
    }
}

function resetDetectionUI() {
    // Reset UI elements to inactive state
    document.getElementById('detection-canvas')?.classList.add('hidden');
    document.getElementById('camera-placeholder')?.classList.remove('hidden');

    const startBtn = document.getElementById('start-detection-btn');
    const stopBtn = document.getElementById('stop-detection-btn');
    if(startBtn) {
        startBtn.className = 'btn btn-primary';
        startBtn.disabled = false;
    }
    if(stopBtn) {
        stopBtn.className = 'btn btn-danger hidden';
        stopBtn.classList.add('hidden');
    }
    
    document.getElementById('stop-alarm-btn')?.classList.add('hidden');
    const statusEl = document.getElementById('detection-status');
    if(statusEl) {
        statusEl.className = 'detection-status inactive';
        statusEl.innerHTML = '<i class="fas fa-pause mr-2"></i>Detection Inactive';
    }
    document.getElementById('current-detection')?.classList.add('hidden');

    // Reset stats display
    initializeSessionStats();
}

function stopSessionTimer() {
    // Add current session time to total
    if (sessionStartTime) {
        totalSessionTime += Math.floor((Date.now() - sessionStartTime) / 1000);
        sessionStartTime = null;
    }
    
    // Stop the timer
    if (sessionDurationTimer) {
        clearInterval(sessionDurationTimer);
        sessionDurationTimer = null;
    }
}

function updateSessionDurationDisplay() {
    let currentDuration = totalSessionTime;
    
    // Add current active session time if camera is running
    if (sessionStartTime) {
        currentDuration += Math.floor((Date.now() - sessionStartTime) / 1000);
    }
    
    const minutes = Math.floor(currentDuration / 60);
    const seconds = currentDuration % 60;
    
    const el = document.getElementById('session-duration');
    if (!el) {
        // Element not rendered yet; avoid crashing
        return;
    }
    el.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function updateTriggerTime(value) {
    currentAlarmSettings.triggerTime = parseInt(value);
    document.getElementById('trigger-time-display').textContent = `${value}s`;
    saveAlarmSettings();
}

// Global variables for alarm sound management
let availableAlarmSounds = [];
let selectedAlarmSound = 'default';
let currentTestAudio = null;
let testAudioTimeout = null;

async function uploadAlarmSound(file) {
    if (!file) {
        console.error('No file selected');
        showToast('Silakan pilih file untuk diupload', 'error');
        return;
    }
    try {
        showLoading('Mengunggah suara alarm...');
        
        // Validate file type
        const allowedTypes = ['audio/mp3', 'audio/wav', 'audio/ogg', 'audio/mpeg'];
        if (!allowedTypes.some(type => file.type.toLowerCase().includes(type.split('/')[1]))) {
            throw new Error('Tipe file tidak valid. Harap unggah file MP3, WAV, atau OGG.');
        }
        
        const formData = new FormData();
        formData.append('file', file);
        
        const token = localStorage.getItem('authToken');
        if (!token) {
            throw new Error('Sesi Anda telah berakhir. Silakan login kembali.');
        }
        
        const apiUrl = 'http://localhost:5000/api/settings/alarm-sounds';
        console.log('Mengunggah suara alarm ke:', apiUrl);
        
        // Tampilkan loading indicator jika tombol ditemukan
        const uploadBtn = document.querySelector('#upload-alarm-sound-btn');
        let originalBtnText = '';
        if (uploadBtn) {
            originalBtnText = uploadBtn.innerHTML;
            uploadBtn.disabled = true;
            uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Mengunggah...';
        }
        
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData,
                credentials: 'include',
                mode: 'cors'
            });
            
            console.log('Status respon upload:', response.status, response.statusText);
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'Gagal mengunggah suara alarm');
            }
            
            showToast('Suara alarm berhasil diunggah', 'success');
            
            // Tunggu sebentar untuk memastikan file sudah disimpan
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Muat ulang daftar suara alarm
            await loadDetectionAlarmSounds();
            
            // Reset form upload
            document.getElementById('alarm-sound').value = '';
            
        } finally {
            // Kembalikan tombol ke keadaan semula jika tombol ada
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = originalBtnText;
            }
        }
        
    } catch (error) {
        console.error('Error uploading alarm sound:', error);
        showToast('Failed to upload alarm sound', 'error');
    } finally {
        hideLoading();
    }
}

// New alarm sound management functions for detection page
async function loadDetectionAlarmSounds() {
    try {
        console.log('Memuat daftar suara alarm...');
        const select = document.getElementById('detection-alarm-sound-select');
        if (!select) {
            console.warn('Elemen select suara alarm tidak ditemukan. Mencoba mencari kembali...');
            // Coba temukan select element di dalam modal jika ada
            const modal = document.querySelector('.alarm-settings-modal');
            if (modal) {
                const modalSelect = modal.querySelector('select');
                if (modalSelect) {
                    modalSelect.id = 'detection-alarm-sound-select';
                    return loadDetectionAlarmSounds();
                }
            }
            console.error('Elemen select suara alarm tidak ditemukan setelah pencarian ulang');
            return;
        }

        // Save current selection before clearing
        const currentValue = select.value || 'default';
        
        // Tampilkan status loading
        select.disabled = true;
        select.innerHTML = '<option>Memuat daftar suara...</option>';
        
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                throw new Error('Sesi Anda telah berakhir. Silakan login kembali.');
            }

            const apiUrl = `${API_BASE_URL}/api/settings/alarm-sounds`;
            console.log('Mengambil daftar suara alarm dari:', apiUrl);
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                mode: 'cors'
            });
            
            console.log('Status respon:', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`Error HTTP! status: ${response.status}, response:`, errorText);
                throw new Error(`Gagal memuat daftar suara. Kode: ${response.status}`);
            }

            const data = await response.json();
            console.log('Alarm sounds API response:', data);
            
            // Pastikan data.sounds ada dan merupakan array
            const sounds = data && data.sounds ? data.sounds : [];
            availableAlarmSounds = sounds;
            
            console.log('Available alarm sounds:', availableAlarmSounds);
            
            // Kosongkan dan isi ulang dropdown
            select.innerHTML = '';
            
            // Selalu tambahkan opsi default terlebih dahulu
            const defaultOption = document.createElement('option');
            defaultOption.value = 'default';
            defaultOption.textContent = 'Alarm Standar';
            select.appendChild(defaultOption);
            
            // Tambahkan suara kustom jika ada
            if (sounds && sounds.length > 0) {
                sounds.forEach(sound => {
                    if (sound && sound.filename) {
                        const option = document.createElement('option');
                        option.value = sound.filename;
                        // Gunakan name jika ada, jika tidak gunakan original_name, terakhir gunakan filename
                        option.textContent = sound.name || sound.original_name || sound.filename;
                        option.dataset.soundId = sound.id || '';
                        select.appendChild(option);
                        console.log('Added sound to dropdown:', sound.name || sound.filename);
                    } else {
                        console.warn('Invalid sound data:', sound);
                    }
                });
                
                console.log(`Berhasil memuat ${sounds.length} suara alarm`);
            } else {
                console.log('Tidak ada suara alarm kustom yang ditemukan');
            }
            
            // Kembalikan pilihan sebelumnya jika masih ada
            const optionExists = Array.from(select.options).some(opt => opt.value === currentValue);
            select.value = optionExists ? currentValue : 'default';
            selectedAlarmSound = select.value;
            
            // Perbarui UI
            updateDetectionDeleteButton();
            
            // Log sukses
            console.log('Daftar suara alarm berhasil dimuat');
            
        } catch (error) {
            console.error('Gagal memuat daftar suara alarm:', error);
            // Kembali ke default jika terjadi error
            select.innerHTML = '';
            const defaultOption = document.createElement('option');
            defaultOption.value = 'default';
            defaultOption.textContent = 'Alarm Standar';
            select.appendChild(defaultOption);
            select.value = 'default';
            selectedAlarmSound = 'default';
            
            showToast('Menggunakan suara alarm standar', 'info');
        } finally {
            // Pastikan select selalu aktif kembali
            select.disabled = false;
            
            // Perbarui UI
            updateDetectionDeleteButton();
            
            // Log selesai
            console.log('Proses pemuatan daftar suara selesai');
        }
        
    } catch (error) {
        console.error('Terjadi kesalahan tak terduga saat memuat daftar suara:', error);
        showToast('Gagal memuat daftar suara alarm', 'error');
        
        // Pastikan select tetap berfungsi walaupun error
        const select = document.getElementById('detection-alarm-sound-select');
        if (select) {
            select.disabled = false;
            if (select.options.length === 0) {
                const defaultOption = document.createElement('option');
                defaultOption.value = 'default';
                defaultOption.textContent = 'Alarm Standar';
                select.appendChild(defaultOption);
                select.value = 'default';
            }
        }
    }
}

function selectDetectionAlarmSound() {
    const select = document.getElementById('detection-alarm-sound-select');
    if (select) {
        selectedAlarmSound = select.value;
        updateDetectionDeleteButton();
        
        // Update current alarm settings
        currentAlarmSettings.alarmSound = selectedAlarmSound;
        saveAlarmSettings();
    }
}

function updateDetectionDeleteButton() {
    const deleteBtn = document.getElementById('detection-delete-alarm-btn');
    const selectedSound = availableAlarmSounds.find(sound => sound.filename === selectedAlarmSound);
    
    if (deleteBtn) {
        if (selectedSound && selectedSound.deletable) {
            deleteBtn.classList.remove('hidden');
        } else {
            deleteBtn.classList.add('hidden');
        }
    }
}

async function deleteDetectionAlarmSound() {
    if (selectedAlarmSound === 'default') {
        showToast('Cannot delete default alarm sound', 'error');
        return;
    }
    
    if (!confirm('Are you sure you want to delete this alarm sound?')) {
        return;
    }
    
    try {
        showLoading();
        
        await apiRequest(`/settings/alarm-sounds/${selectedAlarmSound}`, {
            method: 'DELETE'
        });
        
        showToast('Alarm sound deleted successfully', 'success');
        
        // Reload sounds and select default
        await loadDetectionAlarmSounds();
        selectedAlarmSound = 'default';
        
        const select = document.getElementById('detection-alarm-sound-select');
        if (select) {
            select.value = 'default';
        }
        updateDetectionDeleteButton();
        
        // Update current alarm settings
        currentAlarmSettings.alarmSound = 'default';
        saveAlarmSettings();
        
    } catch (error) {
        console.error('Error deleting alarm sound:', error);
        showToast('Failed to delete alarm sound', 'error');
    } finally {
        hideLoading();
    }
}

function testDetectionAlarmSound() {
    const testButton = document.querySelector('button[onclick="testDetectionAlarmSound()"]');
    
    // If audio is currently playing, stop it
    if (currentTestAudio && !currentTestAudio.paused) {
        stopDetectionTestAudio();
        return;
    }
    
    showToast('Testing alarm sound...', 'info');
    
    try {
        // Get current alarm settings
        const volume = currentAlarmSettings.volume || 0.8;
        
        // Get selected alarm sound
        const selectedSound = availableAlarmSounds.find(sound => sound.filename === selectedAlarmSound);
        const soundUrl = selectedSound ? `http://localhost:5000${selectedSound.url}` : 'http://localhost:5000/sound-default/Danger Alarm Sound Effect.mp3';
        
        const testAudio = new Audio(soundUrl);
        
        // Store reference to current test audio
        currentTestAudio = testAudio;
        
        // Configure audio
        testAudio.volume = volume;
        testAudio.loop = false; // Don't loop for test
        
        // Update button appearance when playing
        if (testButton) {
            testButton.innerHTML = '<i class="fas fa-stop mr-2"></i>Stop';
            testButton.className = 'btn bg-red-500 text-white hover:bg-red-600';
        }
        
        // Add event listeners
        testAudio.addEventListener('canplay', () => {
            console.log('Test audio can play');
            showToast('Playing test alarm...', 'success');
        });
        
        testAudio.addEventListener('error', (e) => {
            console.error('Test audio error:', e);
            showToast('Error playing test sound', 'error');
            resetDetectionTestButton();
        });
        
        testAudio.addEventListener('ended', () => {
            console.log('Test audio ended');
            showToast('Test completed', 'info');
            stopDetectionTestAudio();
        });
        
        // Play the test sound
        testAudio.play().catch(error => {
            console.error('Error playing test audio:', error);
            showToast('Could not play test sound. Please check your audio settings.', 'error');
            resetDetectionTestButton();
        });
        
        // Stop after 10 seconds to prevent long playback
        testAudioTimeout = setTimeout(() => {
            if (currentTestAudio && !currentTestAudio.ended && !currentTestAudio.paused) {
                stopDetectionTestAudio();
                showToast('Test auto-stopped after 10 seconds', 'info');
            }
        }, 10000);
        
    } catch (error) {
        console.error('Test alarm sound error:', error);
        showToast('Error testing alarm sound', 'error');
        resetDetectionTestButton();
    }
}

function stopDetectionTestAudio() {
    if (currentTestAudio) {
        currentTestAudio.pause();
        currentTestAudio.currentTime = 0;
        currentTestAudio = null;
    }
    
    if (testAudioTimeout) {
        clearTimeout(testAudioTimeout);
        testAudioTimeout = null;
    }
    
    resetDetectionTestButton();
}

function resetDetectionTestButton() {
    const testButton = document.querySelector('button[onclick="testDetectionAlarmSound()"]');
    if (testButton) {
        testButton.innerHTML = '<i class="fas fa-play mr-2"></i>Test';
        testButton.className = 'btn bg-yellow-500 text-white hover:bg-yellow-600';
    }
}

async function saveAlarmSettings() {
    try {
        await apiRequest('/settings/alarm', {
            method: 'PUT',
            body: JSON.stringify(currentAlarmSettings)
        });
    } catch (error) {
        console.error('Error saving alarm settings:', error);
    }
}

// Export functions to window for HTML onclick handlers
window.loadDetectionAlarmSounds = loadDetectionAlarmSounds;
window.selectDetectionAlarmSound = selectDetectionAlarmSound;
window.deleteDetectionAlarmSound = deleteDetectionAlarmSound;
window.testDetectionAlarmSound = testDetectionAlarmSound;
window.uploadAlarmSound = uploadAlarmSound;

function handleFileUpload(file) {
    if (!file) return;
    
    const uploadArea = document.getElementById('upload-area');
    const uploadControls = document.getElementById('upload-controls');
    
    uploadArea.innerHTML = `
        <div class="text-center">
            <i class="fas fa-file text-4xl text-indigo-600 mb-4"></i>
            <p class="text-lg font-medium text-gray-700 mb-2">${file.name}</p>
            <p class="text-sm text-gray-500">Size: ${(file.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
    `;
    
    uploadControls.classList.remove('hidden');
    window.uploadedFile = file;
}

async function processUploadedFile() {
    if (!window.uploadedFile) return;
    
    const progressContainer = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    const progressPercentage = document.getElementById('progress-percentage');
    const processBtn = document.getElementById('process-file-btn');
    const resultsContainer = document.getElementById('upload-results');
    
    // Show progress and disable button
    progressContainer.classList.remove('hidden');
    processBtn.disabled = true;
    processBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Processing...';
    
    // Simulate progress animation
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90; // Cap at 90% until actual completion
        
        progressFill.style.width = `${progress}%`;
        progressPercentage.textContent = `${Math.round(progress)}%`;
        
        // Update progress text based on progress
        if (progress < 30) {
            progressText.textContent = 'Initializing analysis...';
        } else if (progress < 60) {
            progressText.textContent = 'Processing frames...';
        } else if (progress < 90) {
            progressText.textContent = 'Applying detection model...';
        }
    }, 200);
    
    try {
        const formData = new FormData();
        formData.append('file', window.uploadedFile);
        
        const response = await fetch(`${API_BASE_URL}/detection/analyze-file`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('authToken')}`
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error('File processing failed');
        }
        
        // Complete the progress
        clearInterval(progressInterval);
        progressFill.style.width = '100%';
        progressPercentage.textContent = '100%';
        progressText.textContent = 'Analysis complete!';
        
        // Small delay to show completion
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const result = await response.json();
        console.log('Upload result:', result); // Debug log
        console.log('Original filename from backend:', result.original_filename); // Debug log
        console.log('Uploaded file name:', window.uploadedFile ? window.uploadedFile.name : 'No file'); // Debug log
        
        // Store filename globally for download - use uploaded file name as fallback
        window.currentUploadedFilename = result.original_filename || (window.uploadedFile ? window.uploadedFile.name : null);
        console.log('Stored filename:', window.currentUploadedFilename); // Debug log
        
        displayUploadResults(result);
        showToast('File processed successfully', 'success');
        
    } catch (error) {
        clearInterval(progressInterval);
        console.error('Error processing file:', error);
        
        // Show error state
        progressFill.style.width = '100%';
        progressFill.classList.remove('bg-indigo-600');
        progressFill.classList.add('bg-red-500');
        progressText.textContent = 'Processing failed';
        progressPercentage.textContent = 'Error';
        
        showToast('File processing failed', 'error');
    } finally {
        // Reset button and hide progress after delay
        setTimeout(() => {
            progressContainer.classList.add('hidden');
            processBtn.disabled = false;
            processBtn.innerHTML = '<i class="fas fa-cogs mr-2"></i>Process File';
            
            // Reset progress bar for next use
            progressFill.style.width = '0%';
            progressFill.classList.remove('bg-red-500');
            progressFill.classList.add('bg-indigo-600');
            progressPercentage.textContent = '0%';
            progressText.textContent = 'Processing...';
        }, 2000);
    }
}

function displayUploadResults(result) {
    const resultsContainer = document.getElementById('upload-results');
    
    let resultHTML = `
        <div class="space-y-4">
            <h4 class="text-lg font-semibold">Analysis Complete</h4>
            <div class="grid grid-cols-3 gap-4">
                <div class="text-center">
                    <div class="text-2xl font-bold text-green-500">${result.awake_count || 0}</div>
                    <div class="text-sm text-gray-600">Awake</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-yellow-500">${result.yawn_count || 0}</div>
                    <div class="text-sm text-gray-600">Yawn</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-red-500">${result.drowsiness_count || 0}</div>
                    <div class="text-sm text-gray-600">Drowsiness</div>
                </div>
            </div>
            <div class="text-center pt-4 border-t">
                <div class="text-lg font-medium text-gray-700">Total Detections: ${result.total_detections || 0}</div>
            </div>`;
    
    // Display processed image if available (for image uploads)
    if (result.processed_image) {
        resultHTML += `
            <div class="text-center pt-4">
                <h5 class="text-md font-medium text-gray-700 mb-2">Processed Image with Detection</h5>
                <img src="${result.processed_image}" alt="Processed Image" class="max-w-full h-auto rounded-lg border border-gray-200 mx-auto">
                <div class="mt-3">
                    <button onclick="downloadProcessedImage('${result.processed_image}', 'processed_detection.jpg')" class="btn btn-secondary">
                        <i class="fas fa-download mr-2"></i>Download Processed Image
                    </button>
                </div>
            </div>`;
    }
    
    // Show note for video files with download option
    if (result.file_type === 'video') {
        resultHTML += `
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                <div class="flex items-start space-x-2">
                    <i class="fas fa-info-circle text-blue-600 mt-0.5"></i>
                    <div class="text-sm text-blue-800">
                        <strong>Note:</strong> For video processing, you can download the processed video with detection boxes below.
                    </div>
                </div>
                <div class="mt-3 text-center">
                    <button onclick="downloadProcessedVideo(window.currentUploadedFilename || '${result.original_filename}')" class="btn btn-secondary">
                        <i class="fas fa-download mr-2"></i>Download Processed Video
                    </button>
                </div>
            </div>`;
    }
    
    resultHTML += `</div>`;
    resultsContainer.innerHTML = resultHTML;
}

// Download processed image function
function downloadProcessedImage(base64Data, filename) {
    try {
        // Convert base64 to blob
        const byteCharacters = atob(base64Data.split(',')[1]);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });
        
        // Create download link
        const imageUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = imageUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(imageUrl);
        document.body.removeChild(a);
    } catch (error) {
        console.error('Download error:', error);
        alert('Failed to download processed image');
    }
}

// Download processed video function
async function downloadProcessedVideo(originalFilename) {
    try {
        // Use stored filename if available
        const filename = window.currentUploadedFilename || originalFilename;
        console.log('Download video called with filename:', filename); // Debug log
        console.log('Stored filename:', window.currentUploadedFilename); // Debug log
        console.log('Passed filename:', originalFilename); // Debug log
        
        if (!filename || filename === 'undefined' || filename === 'unknown') {
            alert('No filename available for download. Please upload a video file first.');
            return;
        }
        
        // Create a simple link approach to avoid CORS issues
        const token = localStorage.getItem('authToken');
        const url = `${API_BASE_URL}/detection/download-processed-video?filename=${encodeURIComponent(filename)}&token=${encodeURIComponent(token)}`;
        
        console.log('Download URL:', url); // Debug log
        
        // Use window.open for direct download
        window.open(url, '_blank');
    } catch (error) {
        console.error('Download error:', error);
        alert('Failed to download processed video');
    }
}

// Main page load function for detection page
function loadDetectionPage() {
    console.log('Initializing detection page...');
    
    // Initialize session stats
    currentSession = {
        startTime: new Date(),
        endTime: null,
        totalFrames: 0,
        drowsyFrames: 0,
        yawnFrames: 0,
        isActive: false,
        sessionId: null,
        videoFile: null
    };
    
    // Load alarm sounds when the page loads
    loadDetectionAlarmSounds().catch(error => {
        console.error('Error loading alarm sounds on page load:', error);
    });

    // Set up event listeners
    document.getElementById('start-detection').addEventListener('click', startLiveDetection);
    document.getElementById('stop-detection').addEventListener('click', stopLiveDetection);
    
    // Set up file upload
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileUpload(e.target.files[0]);
            }
        });
    }
    
    // Load alarm sounds
    loadDetectionAlarmSounds().catch(error => {
        console.error('Error loading alarm sounds:', error);
    });
    
    // Load saved alarm settings if any
    const savedSettings = localStorage.getItem('alarmSettings');
    if (savedSettings) {
        currentAlarmSettings = JSON.parse(savedSettings);
        document.getElementById('alarm-trigger-time').value = currentAlarmSettings.triggerTime;
        document.getElementById('alarm-volume').value = currentAlarmSettings.volume * 100;
    }
}

// Export functions
window.loadDetection = loadDetection;
window.loadDetectionPage = loadDetectionPage;
window.switchDetectionMode = switchDetectionMode;
window.startLiveDetection = startLiveDetection;
window.stopLiveDetection = stopLiveDetection;
window.stopAlarm = stopAlarm;
window.updateTriggerTime = updateTriggerTime;
window.uploadAlarmSound = uploadAlarmSound;
window.handleFileUpload = handleFileUpload;
window.processUploadedFile = processUploadedFile;
