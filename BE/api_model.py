# Model API - Handles YOLO model operations for drowsiness detection
# This file contains endpoints for live detection and file processing

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import cv2
import numpy as np
import base64
import os
import uuid
from datetime import datetime
import tempfile
from PIL import Image
import io
from ultralytics import YOLO
from sqlalchemy.orm import sessionmaker
from database import engine, DetectionSession, DetectionResult, UploadedFile

app = Flask(__name__)
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['PROCESSED_FOLDER'] = 'processed'
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB for videos

# Initialize extensions
jwt = JWTManager(app)
CORS(app)

# Create directories
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['PROCESSED_FOLDER'], exist_ok=True)

# Database session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Load YOLO model
MODEL_PATH = os.path.join("model", "best.pt")
try:
    model = YOLO(MODEL_PATH)
    print(f"YOLO model loaded successfully from {MODEL_PATH}")
except Exception as e:
    print(f"Warning: Could not load YOLO model from {MODEL_PATH}: {e}")
    model = None

# Detection class names
CLASS_NAMES = ["Drowsiness", "awake", "yawn"]

def get_color_for_class(class_name):
    """Get BGR color for detection class (consistent colors for all detection modes)"""
    if class_name == "Drowsiness":
        return (0, 0, 255)  # Red (BGR format)
    elif class_name == "yawn":
        return (0, 255, 255)  # Yellow (BGR format)
    elif class_name == "awake":
        return (0, 255, 0)  # Green (BGR format)
    else:
        return (255, 255, 255)  # White default

def detect_drowsiness(image):
    """
    Perform drowsiness detection on image
    Connects to: detection page live camera, file upload processing
    Uses: YOLO model from model/best.pt
    """
    try:
        if model is None:
            # Fallback mock detection for testing
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
                'timestamp': datetime.utcnow()
            }
        
        # Real YOLO inference
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
                    'timestamp': datetime.utcnow()
                }
        
        # No detection found
        return {
            'class': 'awake',
            'confidence': 0.0,
            'bbox': (0, 0, 100, 100),
            'timestamp': datetime.utcnow()
        }
        
    except Exception as e:
        print(f"Detection error: {e}")
        return {
            'class': 'awake',
            'confidence': 0.0,
            'bbox': (0, 0, 100, 100),
            'timestamp': datetime.utcnow()
        }

# Live Detection Endpoints
# These endpoints connect to: detection page live camera section

@app.route('/api/detection/start-session', methods=['POST'])
@jwt_required()
def start_detection_session():
    """
    Start a new detection session
    Connects to: detection page start detection button
    Database table: detection_sessions
    """
    try:
        current_user_id = get_jwt_identity()
        db = SessionLocal()
        
        # Create new session
        session = DetectionSession(
            user_id=current_user_id,
            session_type='live',
            status='active'
        )
        
        db.add(session)
        db.commit()
        
        return jsonify({
            'message': 'Detection session started',
            'session_id': session.id
        }), 200
        
    except Exception as e:
        db.rollback()
        return jsonify({'message': f'Failed to start session: {str(e)}'}), 500
    finally:
        db.close()

@app.route('/api/detection/analyze-frame', methods=['POST'])
@jwt_required()
def analyze_frame():
    """
    Analyze a single frame from live camera
    Connects to: detection page live camera processing loop
    Database tables: detection_sessions, detection_results
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if 'session_id' not in data or 'image_data' not in data:
            return jsonify({'message': 'Missing required data'}), 400
        
        # Decode base64 image
        image_data = data['image_data'].split(',')[1]  # Remove data:image/jpeg;base64,
        image_bytes = base64.b64decode(image_data)
        
        # Convert to OpenCV format
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        # Perform detection
        result = detect_drowsiness(image)
        
        # Save result to database
        db = SessionLocal()
        
        # Verify session belongs to user
        session = db.query(DetectionSession).filter(
            DetectionSession.id == data['session_id'],
            DetectionSession.user_id == current_user_id
        ).first()
        
        if session:
            # Create detection result
            detection_result = DetectionResult(
                session_id=data['session_id'],
                detection_class=result['class'],
                confidence=result['confidence'],
                bbox_x1=result['bbox'][0],
                bbox_y1=result['bbox'][1],
                bbox_x2=result['bbox'][2],
                bbox_y2=result['bbox'][3]
            )
            
            db.add(detection_result)
            
            # Update session counts
            session.total_detections += 1
            if result['class'] == 'Drowsiness':
                session.drowsiness_count += 1
            elif result['class'] == 'awake':
                session.awake_count += 1
            elif result['class'] == 'yawn':
                session.yawn_count += 1
            
            db.commit()
        
        return jsonify(result), 200
        
    except Exception as e:
        if 'db' in locals():
            db.rollback()
        return jsonify({'message': f'Frame analysis failed: {str(e)}'}), 500
    finally:
        if 'db' in locals():
            db.close()

@app.route('/api/detection/end-session/<session_id>', methods=['POST'])
@jwt_required()
def end_detection_session(session_id):
    """
    End a detection session
    Connects to: detection page stop detection button
    Database table: detection_sessions
    """
    try:
        current_user_id = get_jwt_identity()
        db = SessionLocal()
        
        # Find and update session
        session = db.query(DetectionSession).filter(
            DetectionSession.id == session_id,
            DetectionSession.user_id == current_user_id
        ).first()
        
        if not session:
            return jsonify({'message': 'Session not found'}), 404
        
        # Update session
        session.status = 'completed'
        session.end_time = datetime.utcnow()
        session.duration = int((session.end_time - session.start_time).total_seconds())
        
        db.commit()
        
        return jsonify({
            'message': 'Detection session ended',
            'session': session.to_dict()
        }), 200
        
    except Exception as e:
        db.rollback()
        return jsonify({'message': f'Failed to end session: {str(e)}'}), 500
    finally:
        db.close()

# File Upload Detection Endpoints
# These endpoints connect to: detection page upload section

@app.route('/api/detection/analyze-file', methods=['POST'])
@jwt_required()
def analyze_uploaded_file():
    """
    Analyze uploaded image or video file
    Connects to: detection page file upload processing
    Database table: uploaded_files
    """
    try:
        current_user_id = get_jwt_identity()
        
        if 'file' not in request.files:
            return jsonify({'message': 'No file uploaded'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'message': 'No file selected'}), 400
        
        # Validate file type
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'mp4', 'avi', 'mov'}
        if not ('.' in file.filename and 
                file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
            return jsonify({'message': 'Invalid file type'}), 400
        
        # Save uploaded file
        filename = f"{current_user_id}_{uuid.uuid4().hex}_{secure_filename(file.filename)}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        # Determine file type
        file_ext = file.filename.rsplit('.', 1)[1].lower()
        file_type = 'image' if file_ext in {'png', 'jpg', 'jpeg', 'gif'} else 'video'
        
        # Create database record
        db = SessionLocal()
        uploaded_file = UploadedFile(
            user_id=current_user_id,
            original_filename=file.filename,
            file_path=file_path,
            file_type=file_type,
            file_size=os.path.getsize(file_path),
            processing_status='processing'
        )
        
        db.add(uploaded_file)
        db.commit()
        
        # Process file
        if file_type == 'image':
            result = process_image_file(file_path, uploaded_file.id)
        else:
            result = process_video_file(file_path, uploaded_file.id)
        
        # Update database record
        uploaded_file.processing_status = 'completed'
        uploaded_file.processed_at = datetime.utcnow()
        uploaded_file.total_detections = result.get('total_detections', 0)
        uploaded_file.drowsiness_count = result.get('drowsiness_count', 0)
        uploaded_file.awake_count = result.get('awake_count', 0)
        uploaded_file.yawn_count = result.get('yawn_count', 0)
        uploaded_file.processed_file_path = result.get('processed_file_path')
        
        db.commit()
        
        return jsonify(result), 200
        
    except Exception as e:
        if 'db' in locals():
            uploaded_file.processing_status = 'failed'
            db.commit()
        return jsonify({'message': f'File processing failed: {str(e)}'}), 500
    finally:
        if 'db' in locals():
            db.close()

def process_image_file(file_path, file_id):
    """
    Process uploaded image file
    Returns detection results and processed image
    """
    try:
        # Load image
        image = cv2.imread(file_path)
        if image is None:
            raise ValueError("Could not load image")
        
        # Perform detection
        result = detect_drowsiness(image)
        
        # Draw bounding box and label
        if result['bbox']:
            x1, y1, x2, y2 = result['bbox']
            color = get_color_for_class(result['class'])
            
            cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)
            cv2.putText(image, f"{result['class']}: {result['confidence']:.2f}", 
                       (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
        
        # Save processed image
        processed_filename = f"processed_{file_id}.jpg"
        processed_path = os.path.join(app.config['PROCESSED_FOLDER'], processed_filename)
        cv2.imwrite(processed_path, image)
        
        return {
            'total_detections': 1,
            'drowsiness_count': 1 if result['class'] == 'Drowsiness' else 0,
            'awake_count': 1 if result['class'] == 'awake' else 0,
            'yawn_count': 1 if result['class'] == 'yawn' else 0,
            'processed_file_path': processed_path,
            'processed_file': f"/api/files/processed/{processed_filename}",
            'detection_result': result
        }
        
    except Exception as e:
        raise Exception(f"Image processing failed: {str(e)}")

def process_video_file(file_path, file_id):
    """
    Process uploaded video file
    Returns detection results and processed video
    """
    try:
        # Open video
        cap = cv2.VideoCapture(file_path)
        if not cap.isOpened():
            raise ValueError("Could not open video")
        
        # Get video properties
        fps = int(cap.get(cv2.CAP_PROP_FPS))
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        # Setup output video
        processed_filename = f"processed_{file_id}.mp4"
        processed_path = os.path.join(app.config['PROCESSED_FOLDER'], processed_filename)
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(processed_path, fourcc, fps, (width, height))
        
        # Process video frames
        frame_count = 0
        detection_results = []
        drowsiness_count = 0
        awake_count = 0
        yawn_count = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            # Process every 30th frame for performance
            if frame_count % 30 == 0:
                result = detect_drowsiness(frame)
                detection_results.append(result)
                
                # Count detections
                if result['class'] == 'Drowsiness':
                    drowsiness_count += 1
                elif result['class'] == 'awake':
                    awake_count += 1
                elif result['class'] == 'yawn':
                    yawn_count += 1
                
                # Draw bounding box
                if result['bbox']:
                    x1, y1, x2, y2 = result['bbox']
                    color = get_color_for_class(result['class'])
                    
                    cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                    cv2.putText(frame, f"{result['class']}: {result['confidence']:.2f}", 
                               (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
            
            out.write(frame)
            frame_count += 1
        
        cap.release()
        out.release()
        
        return {
            'total_detections': len(detection_results),
            'drowsiness_count': drowsiness_count,
            'awake_count': awake_count,
            'yawn_count': yawn_count,
            'processed_file_path': processed_path,
            'processed_file': f"/api/files/processed/{processed_filename}",
            'detection_results': detection_results
        }
        
    except Exception as e:
        raise Exception(f"Video processing failed: {str(e)}")

# File serving endpoints

@app.route('/api/files/processed/<filename>')
def serve_processed_file(filename):
    """
    Serve processed files
    Connects to: detection page download results
    """
    try:
        file_path = os.path.join(app.config['PROCESSED_FOLDER'], filename)
        if os.path.exists(file_path):
            return send_file(file_path)
        else:
            return jsonify({'message': 'File not found'}), 404
    except Exception as e:
        return jsonify({'message': f'Error serving file: {str(e)}'}), 500

# Health check endpoint
@app.route('/api/model/health', methods=['GET'])
def health_check():
    """
    Check model API health and model status
    """
    return jsonify({
        'status': 'healthy',
        'model_loaded': model is not None,
        'model_path': MODEL_PATH,
        'timestamp': datetime.utcnow().isoformat()
    }), 200

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'message': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'message': 'Internal server error'}), 500

if __name__ == '__main__':
    # Run the application
    app.run(debug=True, host='0.0.0.0', port=5001)
