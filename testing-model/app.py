import streamlit as st
import cv2
import numpy as np
import time
import threading
import pygame
from PIL import Image
import tempfile
import os
from datetime import datetime
import json
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots
import pandas as pd

# YOLOv8 imports (uncomment when installing ultralytics)
# from ultralytics import YOLO

# Initialize pygame mixer for audio
pygame.mixer.init()

# Configure page
st.set_page_config(
    page_title="Drowsiness Detection System",
    page_icon="😴",
    layout="wide",
    initial_sidebar_state="expanded"
)

if 'camera_running' not in st.session_state:
    st.session_state.camera_running = False

# Custom CSS for better styling
st.markdown("""
<style>
    .main-header {
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        padding: 2rem;
        border-radius: 10px;
        margin-bottom: 2rem;
        text-align: center;
        color: white;
    }
    
    .metric-container {
        background: white;
        padding: 1rem;
        border-radius: 10px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin: 0.5rem 0;
    }
    
    .alarm-status {
        padding: 1rem;
        border-radius: 10px;
        text-align: center;
        font-weight: bold;
        margin: 1rem 0;
    }
    
    .alarm-active {
        background-color: #ff6b6b;
        color: white;
        animation: pulse 1s infinite;
    }
    
    .alarm-inactive {
        background-color: #51cf66;
        color: white;
    }
    
    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
    }
    
    .detection-result {
        background: #f8f9fa;
        padding: 1rem;
        border-radius: 10px;
        border-left: 4px solid #007bff;
        margin: 1rem 0;
    }
    
    .sidebar-section {
        background: #f1f3f4;
        padding: 1rem;
        border-radius: 10px;
        margin: 1rem 0;
    }
</style>
""", unsafe_allow_html=True)

# Initialize session state
if 'detection_results' not in st.session_state:
    st.session_state.detection_results = []
if 'alarm_active' not in st.session_state:
    st.session_state.alarm_active = False
if 'alarm_sound' not in st.session_state:
    st.session_state.alarm_sound = "default"
if 'detection_history' not in st.session_state:
    st.session_state.detection_history = []
if 'current_session' not in st.session_state:
    st.session_state.current_session = {
        'start_time': None,
        'drowsiness_count': 0,
        'awake_count': 0,
        'yawn_count': 0,
        'total_detections': 0
    }


def get_color_for_class(class_name):
            if class_name == "Drowsiness":
                return (0, 0, 255)  # Merah
            elif class_name == "awake":
                return (0, 255, 0)  # Hijau
            elif class_name == "yawn":
                return (0, 255, 255)  # Kuning
            else:
                return (255, 255, 255)  # Putih default
from ultralytics import YOLO
# YOLOv8 Model Detection Function
def detect_drowsiness(image):
    """
    YOLOv8 drowsiness detection function
    Replace MODEL_PATH with your actual model path
    """
    try:
        # ========== GANTI PATH MODEL DI SINI ==========
        MODEL_PATH = os.path.join("model", "best.pt") # <- GANTI INI DENGAN PATH MODEL ANDA
        
        # Load YOLOv8 model (uncomment when you have ultralytics installed)
        model = YOLO(MODEL_PATH)
        
        # Class names sesuai dengan data.yaml Anda
        CLASS_NAMES = ["Drowsiness", "awake", "yawn"]

        
        # ========== REAL YOLO INFERENCE (uncomment when ready) ==========
        results = model(image)
        
        if results and len(results) > 0:
            result = results[0]
            if result.boxes is not None and len(result.boxes) > 0:
                # Get the first detection
                box = result.boxes[0]
                class_id = int(box.cls)
                confidence = float(box.conf)
                bbox = box.xyxy[0].tolist()  # [x1, y1, x2, y2]
                
                return {
                    'class': CLASS_NAMES[class_id],
                    'confidence': confidence,
                    'bbox': tuple(map(int, bbox)),
                    'timestamp': datetime.now()
                }
        
        # ========== MOCK DETECTION (remove when using real model) ==========
        # Simulasi untuk testing - hapus bagian ini ketika model sudah siap
        import random
        detected_class = random.choice(CLASS_NAMES)
        confidence = random.uniform(0.6, 0.95)
        
        height, width = image.shape[:2]
        x1, y1 = random.randint(0, width//2), random.randint(0, height//2)
        x2, y2 = x1 + random.randint(100, 200), y1 + random.randint(100, 200)
        
        return {
            'class': detected_class,
            'confidence': confidence,
            'bbox': (x1, y1, x2, y2),
            'timestamp': datetime.now()
        }
        
    except Exception as e:
        st.error(f"Error in detection: {e}")
        # Return default result if error occurs
        return {
            'class': 'awake',
            'confidence': 0.0,
            'bbox': (0, 0, 100, 100),
            'timestamp': datetime.now()
        }

# Alarm functions
# def play_alarm_sound(sound_choice):
#     """Play alarm sound based on user choice"""
#     try:
#         if sound_choice == "default":
#             # Create a simple beep sound
#             frequency = 1000  # Hz
#             duration = 0.5  # seconds
#             sample_rate = 44100
            
#             t = np.linspace(0, duration, int(sample_rate * duration))
#             wave = np.sin(2 * np.pi * frequency * t)
#             wave = (wave * 32767).astype(np.int16)
            
#             # Convert to stereo
#             stereo_wave = np.array([wave, wave]).T
            
#             # Play using pygame
#             sound = pygame.sndarray.make_sound(stereo_wave)
#             sound.play(loops=-1)
#         else:
#             # For custom uploaded sounds
#             pygame.mixer.music.load(sound_choice)
#             pygame.mixer.music.play(-1)  # Loop indefinitely
#     except Exception as e:
#         st.error(f"Error playing alarm: {e}")

def play_alarm_sound(sound_choice):
    """Play alarm sound based on user choice"""
    try:
        if sound_choice == "default":
            # Sine wave beep
            frequency = 1000
            duration = 0.5
            sample_rate = 44100
            
            t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
            wave = np.sin(2 * np.pi * frequency * t)
            wave = (wave * 32767).astype(np.int16)
            stereo_wave = np.column_stack((wave, wave))
            stereo_wave = np.ascontiguousarray(stereo_wave)

            sound = pygame.sndarray.make_sound(stereo_wave)
            sound.play(loops=-1)
        else:
            pygame.mixer.music.load(sound_choice)
            pygame.mixer.music.play(-1)
    except Exception as e:
        st.error(f"Error playing alarm: {e}")


def stop_alarm():
    """Stop the alarm sound"""
    try:
        pygame.mixer.stop()
        pygame.mixer.music.stop()
    except:
        pass

# Dashboard functions
def create_dashboard():
    """Create dashboard with detection statistics"""
    st.markdown('<div class="main-header"><h1>🚨 Drowsiness Detection Dashboard</h1></div>', unsafe_allow_html=True)
    
    # Current session stats
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.markdown('<div class="metric-container">', unsafe_allow_html=True)
        st.metric("Total Detections", st.session_state.current_session['total_detections'])
        st.markdown('</div>', unsafe_allow_html=True)
    
    with col2:
        st.markdown('<div class="metric-container">', unsafe_allow_html=True)
        st.metric("Drowsiness Count", st.session_state.current_session['drowsiness_count'])
        st.markdown('</div>', unsafe_allow_html=True)
    
    with col3:
        st.markdown('<div class="metric-container">', unsafe_allow_html=True)
        st.metric("Awake Count", st.session_state.current_session['awake_count'])
        st.markdown('</div>', unsafe_allow_html=True)
    
    with col4:
        st.markdown('<div class="metric-container">', unsafe_allow_html=True)
        st.metric("Yawn Count", st.session_state.current_session['yawn_count'])
        st.markdown('</div>', unsafe_allow_html=True)
    
    # Alarm status
    alarm_class = "alarm-active" if st.session_state.alarm_active else "alarm-inactive"
    alarm_text = "🚨 ALARM ACTIVE" if st.session_state.alarm_active else "✅ ALARM INACTIVE"
    st.markdown(f'<div class="alarm-status {alarm_class}">{alarm_text}</div>', unsafe_allow_html=True)
    
    # Charts
    if st.session_state.detection_history:
        st.subheader("📊 Detection History")
        
        # Create DataFrame from history
        df = pd.DataFrame(st.session_state.detection_history)
        
        # Time series chart
        fig_time = px.line(df, x='timestamp', y='confidence', 
                          color='class', title='Detection Confidence Over Time')
        st.plotly_chart(fig_time, use_container_width=True)
        
        # Class distribution
        class_counts = df['class'].value_counts()
        fig_pie = px.pie(values=class_counts.values, names=class_counts.index, 
                        title='Detection Class Distribution')
        st.plotly_chart(fig_pie, use_container_width=True)

# Live camera detection
def live_camera_detection():
    """Live camera detection interface"""
    st.header("📹 Live Camera Detection")
    
    # Camera controls
    col1, col2 = st.columns(2)
    
    with col1:
        camera_enabled = st.checkbox("Enable Camera", value=False)
    
    with col2:
        if st.session_state.alarm_active:
            if st.button("🔇 Stop Alarm", type="primary"):
                st.session_state.alarm_active = False
                stop_alarm()
                st.success("Alarm stopped!")
                st.rerun()
    
    if camera_enabled:
        # Placeholder for camera feed
        camera_placeholder = st.empty()
        detection_placeholder = st.empty()
        
        # Start camera simulation
        if not st.session_state.camera_running:
            if st.button("Start Detection"):
                st.session_state.camera_running = True
                st.rerun()
        else:
            if st.button("Stop Detection"):
                st.session_state.camera_running = False
                st.rerun()
            
            # Simulate camera feed
            cap = cv2.VideoCapture(0)  # Use 0 for default camera
            
            if not cap.isOpened():
                st.error("Cannot open camera. Using simulation mode.")
                # Simulate with a placeholder image
                placeholder_image = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
                process_frame(placeholder_image, detection_placeholder)
            else:
                frame_count = 0
                drowsiness_start_time = None
                
                while st.session_state.camera_running:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    
                    # Process frame
                    result = detect_drowsiness(frame)
                    
                    # Update session stats
                    st.session_state.current_session['total_detections'] += 1
                    if result['class'] == 'Drowsiness':
                        st.session_state.current_session['drowsiness_count'] += 1
                        if drowsiness_start_time is None:
                            drowsiness_start_time = time.time()
                        elif time.time() - drowsiness_start_time >= 5:
                            if not st.session_state.alarm_active:
                                st.session_state.alarm_active = True
                                play_alarm_sound(st.session_state.alarm_sound)
                                st.rerun()
                    else:
                        drowsiness_start_time = None
                        if result['class'] == 'awake':
                            st.session_state.current_session['awake_count'] += 1
                        elif result['class'] == 'yawn':
                            st.session_state.current_session['yawn_count'] += 1
                    
                    # Draw bounding box
                    x1, y1, x2, y2 = result['bbox']
                    color = get_color_for_class(result['class'])
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                    cv2.putText(frame, f"{result['class']}: {result['confidence']:.2f}", 
                            (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

                    
                    # Display frame
                    camera_placeholder.image(frame, channels="BGR")
                    
                    # Display detection result
                    detection_placeholder.markdown(f"""
                    <div class="detection-result">
                        <strong>Detection:</strong> {result['class']}<br>
                        <strong>Confidence:</strong> {result['confidence']:.2f}<br>
                        <strong>Time:</strong> {result['timestamp'].strftime('%H:%M:%S')}
                    </div>
                    """, unsafe_allow_html=True)
                    
                    # Add to history
                    st.session_state.detection_history.append(result)
                    
                    time.sleep(0.1)  # Control frame rate
                
                cap.release()

def process_frame(frame, placeholder):
    """Process a single frame for detection"""
    result = detect_drowsiness(frame)
    
    # Draw bounding box
    x1, y1, x2, y2 = result['bbox']
    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
    cv2.putText(frame, f"{result['class']}: {result['confidence']:.2f}", 
               (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
    
    # Display detection result
    placeholder.markdown(f"""
    <div class="detection-result">
        <strong>Detection:</strong> {result['class']}<br>
        <strong>Confidence:</strong> {result['confidence']:.2f}<br>
        <strong>Time:</strong> {result['timestamp'].strftime('%H:%M:%S')}
    </div>
    """, unsafe_allow_html=True)
    
    return result

# Upload detection
def upload_detection():
    """Upload image or video for detection"""
    st.header("📁 Upload Detection")
    
    upload_type = st.radio("Choose upload type:", ["Image", "Video"])
    
    if upload_type == "Image":
        uploaded_file = st.file_uploader("Choose an image...", type=['jpg', 'jpeg', 'png'])
        
        if uploaded_file is not None:
            # Display uploaded image
            image = Image.open(uploaded_file)
            st.image(image, caption="Uploaded Image", use_column_width=True)
            
            # Convert to OpenCV format
            cv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            
            # Perform detection
            if st.button("Detect"):
                with st.spinner("Processing..."):
                    result = detect_drowsiness(cv_image)
                    
                    # Draw bounding box
                    x1, y1, x2, y2 = result['bbox']
                    color = get_color_for_class(result['class'])
                    cv2.rectangle(cv_image, (x1, y1), (x2, y2), color, 2)
                    cv2.putText(cv_image, f"{result['class']}: {result['confidence']:.2f}", 
                            (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                                        
                    # Display result
                    result_image = cv2.cvtColor(cv_image, cv2.COLOR_BGR2RGB)
                    st.image(result_image, caption="Detection Result", use_column_width=True)
                    
                    # Show detection info
                    st.markdown(f"""
                    <div class="detection-result">
                        <strong>Detection:</strong> {result['class']}<br>
                        <strong>Confidence:</strong> {result['confidence']:.2f}<br>
                        <strong>Time:</strong> {result['timestamp'].strftime('%H:%M:%S')}
                    </div>
                    """, unsafe_allow_html=True)
                    
                    # Add to results
                    st.session_state.detection_results.append(result)
    
    elif upload_type == "Video":
        uploaded_file = st.file_uploader("Choose a video...", type=['mp4', 'avi', 'mov'])
        
        if uploaded_file is not None:
            # Save uploaded video to temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_file:
                tmp_file.write(uploaded_file.read())
                tmp_file_path = tmp_file.name
            
            # Display video
            st.video(uploaded_file)
            
            # Process video
            if st.button("Process Video"):
                with st.spinner("Processing video..."):
                    cap = cv2.VideoCapture(tmp_file_path)
                    
                    frame_results = []
                    progress_bar = st.progress(0)
                    
                    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                    frame_count = 0
                    
                    while cap.isOpened():
                        ret, frame = cap.read()
                        if not ret:
                            break
                        
                        # Process every 30th frame (for performance)
                        if frame_count % 30 == 0:
                            result = detect_drowsiness(frame)
                            frame_results.append(result)
                        
                        frame_count += 1
                        progress_bar.progress(frame_count / total_frames)
                    
                    cap.release()
                    
                    # Display results
                    if frame_results:
                        st.subheader("Video Analysis Results")
                        
                        # Create DataFrame
                        df = pd.DataFrame([{
                            'Frame': i * 30,
                            'Class': r['class'],
                            'Confidence': r['confidence'],
                            'Timestamp': r['timestamp']
                        } for i, r in enumerate(frame_results)])
                        
                        st.dataframe(df)
                        
                        # Class distribution
                        class_counts = df['Class'].value_counts()
                        fig = px.pie(values=class_counts.values, names=class_counts.index, 
                                    title='Video Detection Distribution')
                        st.plotly_chart(fig)
                        
                        # Add to results
                        st.session_state.detection_results.extend(frame_results)
                
                # Clean up temp file
                os.unlink(tmp_file_path)

# Sidebar configuration
def sidebar_config():
    """Sidebar configuration"""
    st.sidebar.markdown('<div class="sidebar-section">', unsafe_allow_html=True)
    st.sidebar.header("⚙️ Settings")
    
    # Alarm settings
    st.sidebar.subheader("🔔 Alarm Settings")
    alarm_options = ["default", "custom"]
    selected_alarm = st.sidebar.selectbox("Choose alarm sound:", alarm_options)
    
    if selected_alarm == "custom":
        uploaded_sound = st.sidebar.file_uploader("Upload custom alarm sound", type=['wav', 'mp3'])
        if uploaded_sound:
            # Save custom sound
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
                tmp_file.write(uploaded_sound.read())
                st.session_state.alarm_sound = tmp_file.name
    else:
        st.session_state.alarm_sound = "default"
    
    # Detection settings
    st.sidebar.subheader("🎯 Detection Settings")
    drowsiness_threshold = st.sidebar.slider("Drowsiness Alert Threshold (seconds)", 1, 10, 5)
    confidence_threshold = st.sidebar.slider("Confidence Threshold", 0.1, 1.0, 0.5)
    
    # Save/Load results
    st.sidebar.subheader("💾 Data Management")
    
    if st.sidebar.button("Save Results"):
        if st.session_state.detection_results:
            # Convert to JSON
            results_json = json.dumps([{
                'class': r['class'],
                'confidence': r['confidence'],
                'timestamp': r['timestamp'].isoformat()
            } for r in st.session_state.detection_results], indent=2)
            
            st.sidebar.download_button(
                label="Download Results",
                data=results_json,
                file_name=f"detection_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                mime="application/json"
            )
        else:
            st.sidebar.warning("No results to save")
    
    if st.sidebar.button("Clear Results"):
        st.session_state.detection_results = []
        st.session_state.detection_history = []
        st.session_state.current_session = {
            'start_time': None,
            'drowsiness_count': 0,
            'awake_count': 0,
            'yawn_count': 0,
            'total_detections': 0
        }
        st.sidebar.success("Results cleared!")
    
    st.sidebar.markdown('</div>', unsafe_allow_html=True)

# Main app
def main():
    """Main application"""
    # Sidebar configuration
    sidebar_config()
    
    # Navigation
    st.sidebar.markdown('<div class="sidebar-section">', unsafe_allow_html=True)
    st.sidebar.header("🧭 Navigation")
    page = st.sidebar.selectbox("Choose page:", ["Dashboard", "Live Detection", "Upload Detection"])
    st.sidebar.markdown('</div>', unsafe_allow_html=True)
    
    # Page routing
    if page == "Dashboard":
        create_dashboard()
    elif page == "Live Detection":
        live_camera_detection()
    elif page == "Upload Detection":
        upload_detection()
    
    # Footer
    st.markdown("---")
    st.markdown("**Drowsiness Detection System** - Stay Alert, Stay Safe! 🚗💤")

if __name__ == "__main__":
    main()