from flask import Flask, request, jsonify, send_from_directory, send_file, Response
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import os
import sys
from datetime import datetime, timedelta
import uuid
import cv2
import numpy as np
from ultralytics import YOLO
from PIL import Image
import json
import base64
from collections import defaultdict, deque
import threading
import time
import traceback

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import database models
from database import *
from sqlalchemy import func

# Initialize Flask app
app = Flask(__name__)

# Configuration
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:123@localhost:5432/drowsys_db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = 'jwt-secret-string'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)
app.config['JWT_TOKEN_LOCATION'] = ['headers', 'cookies', 'json', 'query_string']
app.config['JWT_HEADER_NAME'] = 'Authorization'
app.config['JWT_HEADER_TYPE'] = 'Bearer'

# Initialize JWT
jwt = JWTManager(app)

# Configure CORS with specific settings
CORS(app, 
     resources={
         r"/api/*": {
             "origins": ["http://localhost:8080", "http://127.0.0.1:8080"],
             "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
             "allow_headers": ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"],
             "supports_credentials": True,
             "expose_headers": ["Content-Disposition", "X-Total-Count"],
             "max_age": 600  # Cache preflight request for 10 minutes
         }
     },
     supports_credentials=True
)

# Detection Configuration
app.config['DETECTION_CLASSES'] = {0: 'Normal', 1: 'Drowsiness', 2: 'yawn'}
app.config['DEFAULT_CONFIDENCE_THRESHOLD'] = 0.5
app.config['MIN_DETECTION_STABILITY'] = 0.5
app.config['DETECTION_SMOOTHING_FRAMES'] = 3
app.config['MIN_VOTES_REQUIRED'] = 2
app.config['DEFAULT_TRIGGER_TIME'] = 3
app.config['UPLOAD_FOLDER'] = 'uploads/detection'

# Derived/auxiliary config values
app.config['DATABASE_URL'] = app.config.get('SQLALCHEMY_DATABASE_URI')
app.config['MODEL_PATH'] = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'model', 'best.pt')
app.config['ALARM_SOUNDS_FOLDER'] = os.path.join(os.path.dirname(__file__), 'uploads', 'alarm_sounds')

# Initialize extensions
jwt = JWTManager(app)
CORS(app, origins=['http://localhost:8080', 'http://localhost:3000'], supports_credentials=True)

# Global variables
model = None
active_sessions = {}
camera = None

# Model path
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'model', 'best.pt')

# Load YOLO model
try:
    # Try loading with explicit task specification to avoid compatibility issues
    model = YOLO(MODEL_PATH, task='detect')
    print("Model loaded successfully")
    print(f"Model classes: {model.names}")
except Exception as e:
    print(f"Error loading model: {e}")
    print("Attempting fallback model loading...")
    try:
        # Fallback: try loading with older ultralytics version compatibility
        from ultralytics import YOLO
        import torch
        
        # Check if it's a custom trained model that needs specific handling
        if MODEL_PATH.endswith('.pt'):
            # Try direct torch loading first
            try:
                model = torch.load(MODEL_PATH, map_location='cpu')
                print("Model loaded with torch.load")
            except:
                # Try YOLO with force_reload
                model = YOLO(MODEL_PATH)
                print("Model loaded with YOLO fallback")
                print(f"Model classes: {model.names}")
        else:
            model = YOLO(MODEL_PATH)
            print("Model loaded with fallback method")
            print(f"Model classes: {model.names}")
    except Exception as e2:
        print(f"Fallback model loading also failed: {e2}")
        print("Server will continue without model - detection features disabled")
        model = None

# Initialize database
init_db()

# Create upload directories
os.makedirs('uploads', exist_ok=True)
os.makedirs('uploads/detection', exist_ok=True)
os.makedirs('uploads/sounds', exist_ok=True)
os.makedirs('processed', exist_ok=True)

# Import and register database API blueprint
from api_database import db_api
app.register_blueprint(db_api)

# Add a direct dashboard endpoint to test routing
@app.route('/api/dashboard/stats', methods=['GET', 'OPTIONS'])
def dashboard_stats_direct():
    """Direct dashboard endpoint for testing"""
    print("[DIRECT] Dashboard stats endpoint hit!")
    if request.method == 'OPTIONS':
        from flask import make_response
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "http://localhost:8080")
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization")
        response.headers.add('Access-Control-Allow-Methods', "GET,OPTIONS")
        return response
    
    return jsonify({
        'total_sessions': 0,
        'total_duration': 0,
        'drowsiness_count': 0,
        'message': 'Direct endpoint working'
    }), 200

# Add JWT error handlers
@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    print("[JWT] Token expired")
    return jsonify({'message': 'Token has expired'}), 401

@jwt.invalid_token_loader
def invalid_token_callback(error):
    print(f"[JWT] Invalid token: {error}")
    return jsonify({'message': 'Invalid token'}), 401

@jwt.unauthorized_loader
def missing_token_callback(error):
    print(f"[JWT] Missing token: {error}")
    return jsonify({'message': 'Authorization token is required'}), 401

# ========================================
# MODEL OPERATIONS API (Port 8000 functionality)
# ========================================

# Recent sessions endpoint moved to api_database.py to avoid conflicts

@app.route('/api/contact/support', methods=['POST', 'OPTIONS'])
@jwt_required(optional=True)
def send_support_message():
    """Send support message to admin email - SETTINGS PAGE"""
    # Handle preflight request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'preflight'})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:8080')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        response.headers.add('Vary', 'Origin')
        return response, 200
        
    try:
        data = request.get_json()
        if not data:
            response = jsonify({'error': 'No data provided'})
            response.headers.add('Access-Control-Allow-Origin', 'http://localhost:8080')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response, 400
            
        user_id = get_jwt_identity()
        
        # If no user is logged in, use a default user ID
        if not user_id:
            user_id = 1  # or get a default user ID
        else:
            user_id = int(user_id)
            
        # Validate required fields
        if not data.get('message'):
            response = jsonify({'error': 'Message is required'})
            response.headers.add('Access-Control-Allow-Origin', 'http://localhost:8080')
            response.headers.add('Access-Control-Allow-Credentials', 'true')
            return response, 400
        
        db = SessionLocal()
        
        try:
            # Get user info
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                response = jsonify({'error': 'User not found'})
                response.headers.add('Access-Control-Allow-Origin', 'http://localhost:8080')
                response.headers.add('Access-Control-Allow-Credentials', 'true')
                return response, 404
            
            # Prepare email content
            subject = f"[DrowsyGuard Support] Message from {user.full_name or user.username}"
            
            email_body = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
        .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; }}
        .content {{ padding: 20px; background: #f9f9f9; }}
        .user-info {{ background: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }}
        .message {{ background: white; padding: 15px; border-radius: 8px; border-left: 4px solid #667eea; }}
        .footer {{ text-align: center; padding: 10px; color: #666; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>🛡️ DrowsyGuard Support</h1>
        <p>New support message received</p>
    </div>
    
    <div class="content">
        <div class="user-info">
            <h3>👤 User Information</h3>
            <p><strong>Name:</strong> {user.full_name or 'Not provided'}</p>
            <p><strong>Username:</strong> {user.username}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Phone:</strong> {user.phone or 'Not provided'}</p>
            <p><strong>Date of Birth:</strong> {user.date_of_birth or 'Not provided'}</p>
            <p><strong>User ID:</strong> {user.id}</p>
            <p><strong>Account Created:</strong> {user.created_at.strftime('%Y-%m-%d %H:%M:%S') if user.created_at else 'Unknown'}</p>
        </div>
        
        <div class="message">
            <h3>💬 Support Message</h3>
            <p>{data['message']}</p>
        </div>
    </div>
    
    <div class="footer">
        <p>This message was sent automatically from DrowsyGuard application</p>
        <p>Sent at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
    </div>
</body>
</html>
            """
            
            # Send email using SMTP
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            
            # Email configuration - Using environment variables for security
            smtp_server = "smtp.gmail.com"
            smtp_port = 587
            sender_email = os.getenv('SMTP_EMAIL', 'your-app-email@gmail.com')
            sender_password = os.getenv('SMTP_PASSWORD', 'your-app-password')
            recipient_email = "masahiroymzk23@gmail.com"
            
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = sender_email
            msg['To'] = recipient_email
            msg['Reply-To'] = user.email
            
            # Attach HTML content
            html_part = MIMEText(email_body, 'html')
            msg.attach(html_part)
            
            # Send email
            try:
                server = smtplib.SMTP(smtp_server, smtp_port)
                server.starttls()
                server.login(sender_email, sender_password)
                server.send_message(msg)
                server.quit()
                
                print(f"Support message from user {user_id}:")
                print(f"Subject: {data.get('subject', 'No subject')}")
                print(f"Message: {data.get('message')}")
                
                return jsonify({
                    'success': True,
                    'message': 'Support request received successfully',
                    'user_id': user_id,
                    'email_sent': False  # Change to True when email is implemented
                }), 200
                
            except Exception as email_error:
                print(f"Email sending error: {str(email_error)}")
                # For now, just log the message instead of actually sending
                print(f"Support message from {user.username}: {data['message']}")
                
                response = jsonify({
                    'message': 'Support message received. We will get back to you soon!'
                })
                response.headers.add('Access-Control-Allow-Origin', 'http://localhost:8080')
                response.headers.add('Access-Control-Allow-Credentials', 'true')
                return response, 200
            
        except Exception as e:
            db.rollback()
            return jsonify({'error': str(e)}), 500
        finally:
            db.close()
        
    except Exception as e:
        print(f"Support message error: {str(e)}")
        return jsonify({'error': str(e)}), 500


# PUT /api/settings/alarm is defined in api_database.py (database API). Removed here to avoid duplicate route.

# Change password endpoint moved to api_database.py to avoid conflicts

@app.route('/api/settings/profile-picture', methods=['POST'])
@jwt_required()
def upload_profile_picture():
    """Upload profile picture - SETTINGS PAGE"""
    try:
        user_id = int(get_jwt_identity())
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Check file type
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
        if not ('.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
            return jsonify({'error': 'Invalid file type. Please use PNG, JPG, JPEG, GIF, or WebP'}), 400
        
        # Create uploads directory if it doesn't exist
        upload_dir = os.path.join(os.path.dirname(__file__), 'uploads', 'profile_pictures')
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate unique filename
        import uuid
        file_extension = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{user_id}_{uuid.uuid4().hex[:8]}.{file_extension}"
        file_path = os.path.join(upload_dir, filename)
        
        # Save file
        file.save(file_path)
        
        # Update user profile photo in database
        db = SessionLocal()
        try:
            user = db.query(User).filter(User.id == user_id).first()
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Delete old profile picture if exists
            if user.profile_photo and user.profile_photo != 'default-avatar.png':
                old_file_path = os.path.join(upload_dir, user.profile_photo)
                if os.path.exists(old_file_path):
                    os.remove(old_file_path)
            
            user.profile_photo = filename
            db.commit()
            
            return jsonify({
                'message': 'Profile picture uploaded successfully',
                'profilePhoto': filename,
                'profilePhotoUrl': f'/uploads/profile_pictures/{filename}'
            }), 200
            
        except Exception as e:
            db.rollback()
            # Remove uploaded file if database update fails
            if os.path.exists(file_path):
                os.remove(file_path)
            return jsonify({'error': str(e)}), 500
        finally:
            db.close()
        
    except Exception as e:
        print(f"Profile picture upload error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/uploads/profile_pictures/<filename>')
def serve_profile_picture(filename):
    """Serve profile picture files"""
    try:
        upload_dir = os.path.join(os.path.dirname(__file__), 'uploads', 'profile_pictures')
        file_path = os.path.join(upload_dir, filename)
        
        print(f"=== PROFILE PICTURE REQUEST ===")
        print(f"Requested filename: {filename}")
        print(f"Upload directory: {upload_dir}")
        print(f"Full file path: {file_path}")
        print(f"Directory exists: {os.path.exists(upload_dir)}")
        print(f"File exists: {os.path.exists(file_path)}")
        
        if os.path.exists(upload_dir):
            files = os.listdir(upload_dir)
            print(f"Files in directory: {files}")
        
        if not os.path.exists(file_path):
            print(f"File not found: {file_path}")
            return jsonify({'error': 'File not found'}), 404
            
        return send_from_directory(upload_dir, filename)
    except Exception as e:
        print(f"Error serving profile picture: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'File not found'}), 404

@app.route('/api/settings/alarm-sounds', methods=['POST'])
@jwt_required()
def upload_alarm_sound():
    """Upload custom alarm sound - SETTINGS PAGE"""
    try:
        user_id = int(get_jwt_identity())
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Check file type
        allowed_extensions = {'mp3', 'wav', 'ogg'}
        if not ('.' in file.filename and file.filename.rsplit('.', 1)[1].lower() in allowed_extensions):
            return jsonify({'error': 'Invalid file type. Please use MP3, WAV, or OGG'}), 400
        
        # Create uploads directory if it doesn't exist
        upload_dir = os.path.join(os.path.dirname(__file__), 'uploads', 'alarm_sounds')
        os.makedirs(upload_dir, exist_ok=True)
        
        # Generate unique filename
        import uuid
        file_extension = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{user_id}_{uuid.uuid4().hex[:8]}_{secure_filename(file.filename)}"
        file_path = os.path.join(upload_dir, filename)
        
        # Save file
        file.save(file_path)
        
        return jsonify({
            'message': 'Alarm sound uploaded successfully',
            'filename': filename,
            'original_name': file.filename,
            'url': f'/uploads/alarm_sounds/{filename}'
        }), 200
        
    except Exception as e:
        print(f"Alarm sound upload error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/settings/alarm-sounds', methods=['GET'])
@jwt_required()
def get_alarm_sounds():
    """Get list of uploaded alarm sounds - SETTINGS PAGE"""
    try:
        user_id = int(get_jwt_identity())
        upload_dir = os.path.join(os.path.dirname(__file__), 'uploads', 'alarm_sounds')
        
        print(f"[DEBUG] User ID: {user_id}")
        print(f"[DEBUG] Looking for files in: {upload_dir}")
        
        sounds = [{
            'name': 'Default Alarm',
            'filename': 'default',
            'original_name': 'Default Alarm',
            'url': '/sound-default/Danger Alarm Sound Effect.mp3',
            'deletable': False
        }]
        
        if not os.path.exists(upload_dir):
            print(f"[DEBUG] Directory does not exist: {upload_dir}")
            os.makedirs(upload_dir, exist_ok=True)
            print(f"[DEBUG] Created directory: {upload_dir}")
        
        # List all files in the directory
        try:
            files = os.listdir(upload_dir)
            print(f"[DEBUG] Found {len(files)} files in directory")
            print(f"[DEBUG] Files: {files}")
            
            for filename in files:
                file_path = os.path.join(upload_dir, filename)
                print(f"[DEBUG] Checking file: {filename}")
                print(f"[DEBUG] Full path: {file_path}")
                
                # Skip directories
                if not os.path.isfile(file_path):
                    print(f"[DEBUG] Skipping directory: {filename}")
                    continue
                    
                # Check file extension
                if not filename.lower().endswith(('.mp3', '.wav', '.ogg')):
                    print(f"[DEBUG] Skipping non-audio file: {filename}")
                    continue
                
                # Check if file belongs to current user
                if not filename.startswith(f"{user_id}_"):
                    print(f"[DEBUG] File {filename} does not belong to user {user_id}")
                    continue
                
                print(f"[DEBUG] Processing user's file: {filename}")
                
                # Extract original name from filename
                parts = filename.split('_', 2)
                original_name = parts[2] if len(parts) > 2 else filename
                
                # Create display name
                if '.' in original_name:
                    name_parts = original_name.split('_')
                    if len(name_parts) > 2:  # If there's a UUID in the name
                        display_name = '_'.join(name_parts[2:])  # Skip user_id and UUID
                    else:
                        display_name = original_name
                    display_name = display_name.rsplit('.', 1)[0]  # Remove file extension
                else:
                    display_name = original_name
                
                sound_data = {
                    'name': display_name,
                    'original_name': original_name,
                    'filename': filename,
                    'url': f'/uploads/alarm_sounds/{filename}',
                    'deletable': True
                }
                print(f"[DEBUG] Adding sound: {sound_data}")
                sounds.append(sound_data)
                
        except Exception as e:
            print(f"[ERROR] Error reading directory {upload_dir}: {str(e)}")
            return jsonify({'error': 'Error reading alarm sounds directory'}), 500
        
        print(f"[DEBUG] Returning {len(sounds)} sounds for user {user_id}")
        return jsonify({'sounds': sounds}), 200
        
    except Exception as e:
        print(f"Get alarm sounds error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/settings/alarm-sounds/<filename>', methods=['DELETE'])
@jwt_required()
def delete_alarm_sound(filename):
    """Delete custom alarm sound - SETTINGS PAGE"""
    try:
        user_id = int(get_jwt_identity())
        
        # Prevent deletion of default sound
        if filename == 'default':
            return jsonify({'error': 'Cannot delete default alarm sound'}), 400
        
        # Check if file belongs to user
        if not filename.startswith(f"{user_id}_"):
            return jsonify({'error': 'Unauthorized'}), 403
        
        upload_dir = os.path.join(os.path.dirname(__file__), 'uploads', 'alarm_sounds')
        file_path = os.path.join(upload_dir, filename)
        
        if os.path.exists(file_path):
            os.remove(file_path)
            return jsonify({'message': 'Alarm sound deleted successfully'}), 200
        else:
            return jsonify({'error': 'File not found'}), 404
        
    except Exception as e:
        print(f"Delete alarm sound error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/uploads/alarm_sounds/<filename>')
def serve_alarm_sound(filename):
    """Serve alarm sound files"""
    try:
        upload_dir = os.path.join(os.path.dirname(__file__), 'uploads', 'alarm_sounds')
        return send_from_directory(upload_dir, filename)
    except Exception as e:
        print(f"Error serving alarm sound: {str(e)}")
        return jsonify({'error': 'File not found'}), 404

@app.route('/uploads/sounds/<filename>')
def serve_uploaded_sound(filename):
    """Serve user uploaded alarm sound files - DETECTION PAGE"""
    try:
        sounds_dir = os.path.join(os.path.dirname(__file__), 'uploads', 'sounds')
        return send_from_directory(sounds_dir, filename)
    except Exception as e:
        print(f"Error serving alarm sound: {str(e)}")
        return jsonify({'error': 'File not found'}), 404

@app.route('/profile_owner/<filename>')
def serve_owner_image(filename):
    """Serve owner profile images directly"""
    try:
        print(f"=== PROFILE OWNER REQUEST: {filename} ===")
        profile_owner_dir = os.path.join(os.path.dirname(__file__), 'Profile_owner')
        print(f"Looking in directory: {profile_owner_dir}")
        print(f"Directory exists: {os.path.exists(profile_owner_dir)}")
        
        if os.path.exists(profile_owner_dir):
            files = os.listdir(profile_owner_dir)
            print(f"Files in directory: {files}")
        
        file_path = os.path.join(profile_owner_dir, filename)
        print(f"Full file path: {file_path}")
        print(f"File exists: {os.path.exists(file_path)}")
        
        return send_from_directory(profile_owner_dir, filename)
    except Exception as e:
        print(f"Error serving owner image: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'File not found'}), 404

@app.route('/api/profile-picture/default')
def serve_default_avatar():
    """Serve default avatar - SETTINGS PAGE"""
    try:
        # Try to serve a default avatar file if it exists
        default_path = os.path.join(app.config['UPLOAD_FOLDER'], 'default-avatar.png')
        if os.path.exists(default_path):
            return send_file(default_path)
        else:
            # Return a simple SVG placeholder
            svg_content = '''<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
                <rect width="100" height="100" fill="#e5e7eb"/>
                <circle cx="50" cy="35" r="15" fill="#9ca3af"/>
                <path d="M20 80 Q20 65 35 65 L65 65 Q80 65 80 80 Z" fill="#9ca3af"/>
            </svg>'''
            return Response(svg_content, mimetype='image/svg+xml')
    except Exception as e:
        print(f"Error serving default avatar: {str(e)}")
        return jsonify({'error': 'Default avatar not found'}), 404

@app.route('/api/profile-picture/owner')
def serve_owner_profile():
    """Serve owner profile picture - DEVELOPER PROFILE"""
    try:
        print("=== OWNER PROFILE ENDPOINT CALLED ===")
        # Look for owner profile picture in Profile_owner folder
        profile_owner_folder = os.path.join(os.path.dirname(__file__), 'Profile_owner')
        print(f"Looking in folder: {profile_owner_folder}")
        print(f"Folder exists: {os.path.exists(profile_owner_folder)}")
        
        # Common image extensions to check
        image_extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp']
        
        # Look for Masahiro.jpg first, then any other image
        owner_files = ['Masahiro.jpg', 'masahiro.jpg', 'MASAHIRO.JPG']
        
        for filename in owner_files:
            file_path = os.path.join(profile_owner_folder, filename)
            print(f"Checking file: {file_path}")
            print(f"File exists: {os.path.exists(file_path)}")
            if os.path.exists(file_path):
                print(f"Serving file: {file_path}")
                return send_file(file_path)
        
        # If Masahiro.jpg not found, look for any image file in the folder
        if os.path.exists(profile_owner_folder):
            files_in_folder = os.listdir(profile_owner_folder)
            print(f"Files in folder: {files_in_folder}")
            for file in files_in_folder:
                if any(file.lower().endswith(ext) for ext in image_extensions):
                    file_path = os.path.join(profile_owner_folder, file)
                    print(f"Serving fallback file: {file_path}")
                    return send_file(file_path)
        
        # If no image found, return default SVG
        print("No image found, returning default SVG")
        svg_content = '''<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
            <rect width="100" height="100" fill="#e5e7eb"/>
            <circle cx="50" cy="35" r="15" fill="#9ca3af"/>
            <path d="M20 80 Q20 65 35 65 L65 65 Q80 65 80 80 Z" fill="#9ca3af"/>
        </svg>'''
        return Response(svg_content, mimetype='image/svg+xml')
        
    except Exception as e:
        print(f"Error serving owner profile picture: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Owner profile picture not found'}), 404


 

# ========================================
# MODEL OPERATIONS API (Port 5001 functionality)
# ========================================

@app.route('/api/model/health', methods=['GET'])
def model_health():
    """Check model health - DETECTION PAGE"""
    return jsonify({
        'status': 'healthy' if model else 'error',
        'model_loaded': model is not None,
        'model_path': app.config['MODEL_PATH'],
        'classes': app.config['DETECTION_CLASSES']
    }), 200

@app.route('/api/detection/start-session', methods=['POST'])
@jwt_required()
def start_detection_session():
    """Always starts a new detection session - DETECTION PAGE"""
    db = None
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json()
        session_type = data.get('type', 'live')
        
        db = SessionLocal()
        
        # Mark any orphaned 'active' sessions for this user as 'interrupted'
        orphaned_sessions = db.query(DetectionSession).filter(
            DetectionSession.user_id == user_id,
            DetectionSession.status == 'active'
        ).all()
        
        for orphaned in orphaned_sessions:
            print(f"Marking orphaned session {orphaned.id} as interrupted.")
            orphaned.status = 'interrupted'
            orphaned.end_time = datetime.now()
            if orphaned.start_time:
                orphaned.duration = (orphaned.end_time - orphaned.start_time).total_seconds()

        # Create a new session
        session = DetectionSession(
            user_id=user_id,
            session_type=session_type,
            start_time=datetime.now(),
            status='active' # Status is briefly active, will be finalized by stop/end
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        
        session_id = session.id

        # Initialize camera
        global camera
        if camera is None:
            camera = cv2.VideoCapture(0)
            if not camera.isOpened():
                print("--- ERROR: Could not open camera. ---")
                return jsonify({'error': 'Could not open camera.'}), 500
        print("Camera initialized successfully.")
        
        # Initialize in-memory session tracking with all required stats
        active_sessions[session_id] = {
            'user_id': user_id,
            'start_time': session.start_time,
            'total_detections': 0,
            'drowsiness_count': 0,
            'awake_count': 0,
            'yawn_count': 0,
            'drowsiness_count': 0,
            'awake_count': 0,
            'yawn_count': 0,
            'drowsiness_streak': 0,
            'last_alarm': None,
            'alarm_triggered': False
        }
        
        print(f"Created new session {session_id} for user {user_id}")
        
        return jsonify({
            'session_id': session_id,
            'message': 'New session started successfully',
            'resumed': False
        }), 200
        
    except Exception as e:
        if db:
            db.rollback()
        error_traceback = traceback.format_exc()
        print(f"--- ERROR IN /api/detection/start-session ---\n{error_traceback}")
        return jsonify({'error': 'An internal error occurred. See server logs for details.'}), 500
    finally:
        if db:
            db.close()

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

@app.route('/api/detection/analyze-frame', methods=['POST'])
@jwt_required()
def analyze_frame():
    """Analyze camera frame for drowsiness - DETECTION PAGE (Live Camera)"""
    db = None
    try:
        if not model:
            return jsonify({'error': 'Model not loaded'}), 500
        
        user_id = int(get_jwt_identity())
        data = request.get_json()
        
        session_id = data.get('session_id')
        frame_data = data.get('image_data')
        
        if not session_id or session_id not in active_sessions:
            return jsonify({'error': 'Invalid session'}), 400
            
        if not frame_data:
            return jsonify({'error': 'No image data received'}), 400
        
        # Decode base64 image
        import base64
        image_data = base64.b64decode(frame_data.split(',')[1])
        nparr = np.frombuffer(image_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Failed to decode image'}), 400
        
        # If session was stopped after decode, abort immediately to avoid needless processing
        if session_id not in active_sessions:
            return jsonify({'stopped': True, 'message': 'Session stopped'}), 200
        
        # Run YOLO detection (same as testing model)
        # Timing will be captured around the actual inference call below
        processing_time = 0.0
        
        print(f"=== ANALYZE-FRAME DEBUG ===")
        print(f"Session ID: {session_id}")
        print(f"Frame shape: {frame.shape}")
        print(f"Processing time: {processing_time:.1f}ms")
        
        detections = []
        drowsiness_detected = False
        
        # Initialize session smoothing data
        if session_id not in active_sessions:
            return jsonify({'error': 'Session not found. Please start a new session.'}), 400
            
        session_data = active_sessions[session_id]
        if 'detection_history' not in session_data:
            session_data['detection_history'] = deque(maxlen=app.config['DETECTION_SMOOTHING_FRAMES'])
        if 'smoothed_confidence' not in session_data:
            session_data['smoothed_confidence'] = {}
        if 'current_detection' not in session_data:
            session_data['current_detection'] = None

        # Process current frame
        current_detection = None
        best_confidence = 0.0
        
        if model:
            try:
                start_time = time.time()
                # Increased confidence threshold to 0.5 for better accuracy
                results = model(frame, conf=0.5)
                processing_time = (time.time() - start_time) * 1000
                
                if results and len(results) > 0:
                    result = results[0]
                    valid_detections = []
                    
                    if result.boxes is not None and len(result.boxes) > 0:
                        # Process all detections first
                        for i, box in enumerate(result.boxes):
                            class_id = int(box.cls[0])
                            confidence = float(box.conf[0])
                            
                            # Get class name from model
                            if hasattr(model, 'names') and class_id in model.names:
                                class_name = model.names[class_id]
                            else:
                                class_name = app.config['DETECTION_CLASSES'].get(class_id, f'Unknown_{class_id}')
                            
                            # Get bounding box
                            bbox = box.xyxy[0].tolist()
                            x1, y1, x2, y2 = map(int, bbox)
                            
                            # Filter by size
                            min_size = 40  # pixels
                            max_size = min(frame.shape[0], frame.shape[1]) * 0.8
                            width = x2 - x1
                            height = y2 - y1
                            
                            if (min_size <= width <= max_size and 
                                min_size <= height <= max_size):
                                valid_detections.append({
                                    'class': class_name,
                                    'confidence': confidence,
                                    'bbox': bbox
                                })
                        
                        # Sort by confidence and take top detection
                        valid_detections.sort(key=lambda x: x['confidence'], reverse=True)
                        
                        if valid_detections:
                            current_detection = valid_detections[0]
                            best_confidence = current_detection['confidence']
                            
                            print(f"Best detection: {current_detection['class']} ({best_confidence:.3f})")
                            
                            # Add smoothing using detection history
                            session_data['detection_history'].append(current_detection)
                            
                            # Apply temporal smoothing if we have enough history
                            if len(session_data['detection_history']) >= 3:
                                # Get last 3 detections of same class
                                same_class = [
                                    d for d in session_data['detection_history'] 
                                    if d['class'] == current_detection['class']
                                ][-3:]
                                
                                if same_class:
                                    # Average bbox coordinates
                                    avg_bbox = [
                                        sum(d['bbox'][i] for d in same_class) / len(same_class)
                                        for i in range(4)
                                    ]
                                    
                                    # Apply smoothing (70% current, 30% history)
                                    current_bbox = current_detection['bbox']
                                    current_detection['bbox'] = [
                                        0.7 * current_bbox[i] + 0.3 * avg_bbox[i]
                                        for i in range(4)
                                    ]
                                    
                                    # Ensure box is within frame
                                    h, w = frame.shape[:2]
                                    x1, y1, x2, y2 = map(int, current_detection['bbox'])
                                    x1 = max(0, min(x1, w-1))
                                    y1 = max(0, min(y1, h-1))
                                    x2 = max(0, min(x2, w-1))
                                    y2 = max(0, min(y2, h-1))
                                    current_detection['bbox'] = [x1, y1, x2, y2]
                        
            except Exception as e:
                print(f"Detection error: {e}")
                traceback.print_exc()
        else:
            print("No YOLO results for frame")
        
        # Add to detection history
        session_data['detection_history'].append(current_detection)
        
        # Always show a consistent detection box - never empty
        if current_detection:
            detection = current_detection.copy()
            # Add color information for frontend
            detection['color'] = get_color_for_class(detection['class'])
            detections.append(detection)
            
            # Update session current detection
            session_data['current_detection'] = current_detection
            
            if detection['class'] == 'Drowsiness':
                drowsiness_detected = True
        else:
            # Always show a detection box with valid bbox coordinates
            # Use center of frame for consistent display
            frame_center_x = frame.shape[1] // 2
            frame_center_y = frame.shape[0] // 2
            box_size = 100
            
            default_detection = {
                'class': 'awake',
                'confidence': 0.8,
                'bbox': [frame_center_x - box_size, frame_center_y - box_size, 
                        frame_center_x + box_size, frame_center_y + box_size],
                'color': get_color_for_class('awake')
            }
            detections.append(default_detection)
            session_data['current_detection'] = default_detection
        
        # Update session tracking - check if session still exists
        if session_id not in active_sessions:
            return jsonify({'error': 'Session not found or already stopped'}), 400
        
        session_data = active_sessions[session_id]
        
        # Save to database - but only save drowsiness when alarm will be triggered
        if session_data.get('current_detection'):
            detection = session_data['current_detection']
            should_save = True
            if detection['class'] == 'Drowsiness':
                # Check if this drowsiness detection will trigger alarm
                current_streak = session_data.get('drowsiness_streak', 0) + 1
                should_save = current_streak >= app.config['DEFAULT_TRIGGER_TIME']
            
            if should_save:
                db = SessionLocal()
                try:
                    detection_result = DetectionResult(
                        session_id=session_id,
                        detection_class=detection['class'],
                        confidence=detection['confidence'],
                        bbox_x1=detection['bbox'][0],
                        bbox_y1=detection['bbox'][1],
                        bbox_x2=detection['bbox'][2],
                        bbox_y2=detection['bbox'][3],
                        processing_time=processing_time
                    )
                    db.add(detection_result)
                    db.commit()
                finally:
                    db.close()
                    db = None
        
        # Update detection counts
        if session_data.get('current_detection'):
            detection = session_data['current_detection']
            if detection['class'] == 'Drowsiness':
                session_data['drowsiness_streak'] += 1
            elif detection['class'] == 'awake':
                session_data['awake_count'] = session_data.get('awake_count', 0) + 1
                session_data['total_detections'] = session_data.get('total_detections', 0) + 1
                session_data['drowsiness_streak'] = 0
            elif detection['class'] == 'yawn':
                session_data['yawn_count'] = session_data.get('yawn_count', 0) + 1
                session_data['total_detections'] = session_data.get('total_detections', 0) + 1
                session_data['drowsiness_streak'] = 0
            
            print(f"Updated session stats: total={session_data.get('total_detections', 0)}, drowsy={session_data.get('drowsiness_count', 0)}, awake={session_data.get('awake_count', 0)}, yawn={session_data.get('yawn_count', 0)}")
        else:
            session_data['drowsiness_streak'] = 0
        
        # Check if alarm should be triggered
        alarm_triggered = False
        if session_data['drowsiness_streak'] >= app.config['DEFAULT_TRIGGER_TIME']:
            current_time = datetime.now()
            if (session_data['last_alarm'] is None or 
                (current_time - session_data['last_alarm']).seconds > 10):
                alarm_triggered = True
                session_data['last_alarm'] = current_time
                session_data['alarm_triggered'] = True
                # Only count drowsiness when alarm is triggered (after 5+ consecutive detections)

        # Send back response
        return jsonify({
            'detections': detections,
            'drowsiness_detected': drowsiness_detected,
            'alarm_triggered': alarm_triggered,
            'processing_time': f"{processing_time:.1f}ms",
            'session_id': session_id
        }), 200

    except Exception as e:
        error_traceback = traceback.format_exc()
        print(f"--- ERROR IN /api/detection/analyze-frame ---\n{error_traceback}")
        # If session was removed due to an error, notify client
        if 'session_id' in locals() and session_id not in active_sessions:
            return jsonify({'stopped': True, 'message': 'Session ended due to an error.'}), 200
        return jsonify({'error': 'An internal error occurred while analyzing frame.'}), 500
    finally:
        if db:
            db.close()

@app.route('/api/detection/analyze-file', methods=['POST'])
@jwt_required()
def analyze_file():
    db = None  # Initialize db to None
    try:
        if not model:
            return jsonify({'error': 'Model not loaded'}), 500
        
        user_id = int(get_jwt_identity())  # Convert back to int from string
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400
        
        file = request.files['file']
        session_id = request.form.get('session_id')
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Get current user ID for unique filename
        current_user = get_jwt_identity()
        
        # Create detection upload folder if it doesn't exist
        os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
        
        # Save uploaded file with user-specific name (replaces previous uploads)
        original_filename = secure_filename(file.filename)
        print(f"DEBUG: Raw filename from request: {file.filename}")  # Debug log
        print(f"DEBUG: Secured original_filename: {original_filename}")  # Debug log
        file_ext = original_filename.rsplit('.', 1)[1].lower()
        saved_filename = f"detection_{current_user}.{file_ext}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], saved_filename)
        
        # Remove old file if exists (to replace, not accumulate)
        if os.path.exists(file_path):
            os.remove(file_path)
        
        file.save(file_path)
        
        # Determine file type
        image_extensions = {'jpg', 'jpeg', 'png', 'gif', 'bmp'}
        video_extensions = {'mp4', 'avi', 'mov', 'mkv'}
        
        is_video = file_ext in video_extensions
        if is_video:
            file_type = 'video'
        elif file_ext in image_extensions:
            file_type = 'image'
        else:
            return jsonify({'error': 'Unsupported file type'}), 400
        
        # Initialize counters for all file types
        total_detections = 0
        drowsiness_count = 0
        yawn_count = 0
        awake_count = 0
        processed_image_base64 = None

        # Process file
        detections = []
        processed_media_path = None
        db_error = None
        video_error = None

        if is_video:
            try:
                cap = cv2.VideoCapture(file_path)
                
                if not cap.isOpened():
                    return jsonify({'error': 'Could not open video file'}), 400
                
                frame_count = 0
                fps = cap.get(cv2.CAP_PROP_FPS)
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                
                # Validate video properties
                if fps <= 0 or width <= 0 or height <= 0:
                    cap.release()
                    return jsonify({'error': 'Invalid video file or corrupted video'}), 400
                
                # Create temporary processed video file for download
                # Create processed video file in BE/processed folder (replaces old ones)
                processed_folder = os.path.join(os.path.dirname(__file__), 'processed')
                os.makedirs(processed_folder, exist_ok=True)
                
                # Use consistent filename that will replace previous processed videos for this user
                processed_filename = f"processed_{current_user}.{file_ext}"
                temp_processed_path = os.path.join(processed_folder, processed_filename)
                
                # Remove old processed video if exists (to save storage)
                if os.path.exists(temp_processed_path):
                    os.remove(temp_processed_path)
                    print(f"Removed old processed video: {temp_processed_path}")
                fourcc = cv2.VideoWriter_fourcc(*'mp4v')
                out = cv2.VideoWriter(temp_processed_path, fourcc, fps, (width, height))
                
                try:
                    while True:
                        ret, frame = cap.read()
                        if not ret:
                            break
                        
                        frame_count += 1
                        processed_frame = frame.copy()
                        
                        # Run detection on frame (use same confidence threshold as other parts)
                        results = model(frame, conf=app.config['DEFAULT_CONFIDENCE_THRESHOLD'])
                        
                        # Process detections - Add debug for every frame
                        print(f"Frame {frame_count}: Processing...")
                        if results and len(results) > 0:
                            detections = results[0].boxes
                            print(f"Frame {frame_count}: Found {len(detections) if detections is not None else 0} detections")
                            if detections is not None and len(detections) > 0:
                                # Process all valid detections
                                for i in range(len(detections)):
                                    confidence = float(detections.conf[i].cpu().numpy())

                                    if confidence > app.config['DEFAULT_CONFIDENCE_THRESHOLD']:
                                        class_id = int(detections.cls[i].cpu().numpy())
                                        class_name = model.names[class_id]
                                        bbox = detections.xyxy[i].cpu().numpy()

                                        # Increment counts for each valid detection
                                        total_detections += 1
                                        if class_name == 'Drowsiness':
                                            drowsiness_count += 1
                                        elif class_name == 'yawn':
                                            yawn_count += 1
                                        elif class_name == 'awake':
                                            awake_count += 1

                                        # Draw detection box on frame
                                        x1, y1, x2, y2 = map(int, bbox)
                                        color = get_color_for_class(class_name)
                                        cv2.rectangle(processed_frame, (x1, y1), (x2, y2), color, 3)
                                        
                                        # Add background for text
                                        label = f"{class_name}: {confidence:.2f}"
                                        label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.8, 2)[0]
                                        
                                        # Ensure label is within frame
                                        label_y = max(20, y1 - 5)  # Keep label at least 5px from top
                                        label_y = min(processed_frame.shape[0] - 10, label_y)  # Keep label within bottom
                                        
                                        # Draw background for label
                                        cv2.rectangle(processed_frame, 
                                                    (x1, label_y - label_size[1] - 10), 
                                                    (x1 + label_size[0], label_y + 5), 
                                                    color, -1)
                                        
                                        # Draw text
                                        cv2.putText(processed_frame, label, (x1, label_y), 
                                                  cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
                                else:
                                    print(f"Frame {frame_count}: No detections above confidence threshold")
                            else:
                                print(f"Frame {frame_count}: No detections found")
                        
                        # Write processed frame to output video
                        out.write(processed_frame)
                        
                except Exception as video_error:
                    print(f"Video processing error: {str(video_error)}")
                    # We will let the main exception handler deal with this
                    raise video_error
                finally:
                    # Release video resources
                    if 'cap' in locals() and cap.isOpened():
                        cap.release()
                    if 'out' in locals() and out.isOpened():
                        out.release()
            except Exception as e:
                print(f"Error processing video: {str(e)}")
                raise e
        else:
            # Process image file
            img = cv2.imread(file_path)
            if img is not None:
                processed_img = img.copy()
                
                # Run detection on image (use same confidence threshold as other parts)
                results = model(img, conf=app.config['DEFAULT_CONFIDENCE_THRESHOLD'])
                
                # Process detections
                if results and len(results) > 0:
                    detections = results[0].boxes
                    print(f"Found {len(detections) if detections is not None else 0} detections")
                    if detections is not None and len(detections) > 0:
                        for i in range(len(detections)):
                            confidence = float(detections.conf[i].cpu().numpy())
                            if confidence > app.config['DEFAULT_CONFIDENCE_THRESHOLD']:
                                class_id = int(detections.cls[i].cpu().numpy())
                                class_name = model.names[class_id]
                                bbox = detections.xyxy[i].cpu().numpy()

                                # Increment counts for each valid detection
                                total_detections += 1
                                if class_name == 'Drowsiness':
                                    drowsiness_count += 1
                                elif class_name == 'yawn':
                                    yawn_count += 1
                                elif class_name == 'awake':
                                    awake_count += 1

                                # Draw detection box on the image
                                x1, y1, x2, y2 = map(int, bbox)
                                color = get_color_for_class(class_name)
                                cv2.rectangle(processed_img, (x1, y1), (x2, y2), color, 3)
                                label = f"{class_name}: {confidence:.2f}"
                                label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.8, 2)[0]
                                cv2.rectangle(processed_img, (x1, y1 - label_size[1] - 10), (x1 + label_size[0], y1), color, -1)
                                cv2.putText(processed_img, label, (x1, y1 - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

                        # After processing all detections, encode the image if detections were found
                        if total_detections > 0:
                            _, buffer = cv2.imencode('.jpg', processed_img)
                            processed_image_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Save file record to database
        db = SessionLocal()
        try:
            # Store relative path for database (from BE folder)
            temp_processed_path_for_db = os.path.join('processed', processed_filename) if file_type == 'video' else None
            
            uploaded_file = UploadedFile(
                user_id=current_user,
                session_id=session_id,
                original_filename=original_filename,
                file_path=file_path,
                processed_path=temp_processed_path_for_db,  # Store temp path for video downloads
                file_type=file_type,
                file_size=os.path.getsize(file_path),
                processing_status='completed'
            )
            db.add(uploaded_file)
            db.flush()  # Get the ID before commit
            
            # Update session statistics
            if session_id:
                session = db.query(DetectionSession).filter(DetectionSession.id == session_id).first()
                if session:
                    session.total_detections += total_detections
                    session.drowsiness_count += drowsiness_count
                    session.status = 'completed'
                    session.end_time = datetime.now()
            
            db.commit()
            
            print(f"Final counts - Total: {total_detections}, Drowsiness: {drowsiness_count}")  # Debug log
            print(f"Original filename being returned: {original_filename}")  # Debug log
            
            response_data = {
                'total_detections': total_detections,
                'drowsiness_count': drowsiness_count,
                'yawn_count': yawn_count,
                'awake_count': awake_count,
                'file_type': file_type,
                'original_filename': original_filename,
                'file_id': uploaded_file.id  # Add file ID for download reference
            }
            
            # Add processed image data for images
            if file_type == 'image' and processed_image_base64:
                response_data['processed_image'] = f"data:image/jpeg;base64,{processed_image_base64}"
            
            return jsonify(response_data), 200
            
        except Exception as db_error:
            db.rollback()
            print(f"Database error: {str(db_error)}")
            raise db_error
        finally:
            db.close()
        
    except Exception as e:
        print(f"Error in analyze_file: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/detection/stop-session/<int:session_id>', methods=['POST', 'OPTIONS'])
@jwt_required()
def stop_detection_session(session_id):
    """Stop detection session and save to database - DETECTION PAGE"""
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'success'})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:8080')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    db = None
    try:
        user_id = int(get_jwt_identity())
        
        # Get session data from active_sessions before removing it
        session_stats = active_sessions.get(session_id, {})
        
        # If session not in active_sessions, it might have been stopped already
        if not session_stats:
            print(f"Session {session_id} not found in active sessions")
            return jsonify({'error': 'Session not found or already stopped'}), 400
            
        # Get a copy of the session stats for later use
        session_stats = session_stats.copy()
        
        # Remove this session from active_sessions
        if session_id in active_sessions:
            del active_sessions[session_id]
            print(f"Removed session {session_id} from active memory.")
            
        # Also remove any other active sessions for this user
        for sid in list(active_sessions.keys()):
            if active_sessions.get(sid, {}).get('user_id') == user_id:
                del active_sessions[sid]
                print(f"Removed user's other active session {sid}")

        db = SessionLocal()
        session = db.query(DetectionSession).filter(DetectionSession.id == session_id, DetectionSession.user_id == user_id).first()
        
        if not session:
            return jsonify({'error': 'Session not found or already stopped'}), 404

        # Finalize session details
        session.end_time = datetime.now()
        session.duration = (session.end_time - session.start_time).total_seconds()
        session.status = 'completed'  # Mark as completed

        # Update final session stats from memory
        session.total_detections = session_stats.get('total_detections', 0)
        session.drowsiness_count = session_stats.get('drowsiness_count', 0)
        session.awake_count = session_stats.get('awake_count', 0)
        session.yawn_count = session_stats.get('yawn_count', 0)
        session.alarm_triggered = session_stats.get('alarm_triggered', False)
        
        db.commit()
        print(f"Session {session_id} stopped and marked as completed.")

        # Release camera if no other sessions are active
        if not active_sessions:
            global camera
            if camera is not None:
                camera.release()
                camera = None
                print("Camera released.")
        
        return jsonify({'message': 'Session stopped and saved successfully'}), 200
        
    except Exception as e:
        if db:
            db.rollback()
        error_traceback = traceback.format_exc()
        print(f"--- ERROR IN /api/detection/stop-session ---\n{error_traceback}")
        return jsonify({'error': 'An internal error occurred.'}), 500
    finally:
        if db:
            db.close()

@app.route('/api/detection/update-session/<int:session_id>', methods=['POST', 'OPTIONS'])
@jwt_required()
def update_detection_session(session_id):
    """Update session stats in real-time"""
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'success'})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:8080')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response
    
    print(f"\n=== UPDATE SESSION REQUEST ===")
    print(f"Session ID: {session_id}")
    print(f"Active sessions: {list(active_sessions.keys())}")
    
    try:
        user_id = int(get_jwt_identity())
        data = request.get_json()
        print(f"Received update data: {data}")
        
        # Update the active session with new stats
        if session_id in active_sessions:
            session_data = active_sessions[session_id]
            session_data['total_detections'] = data.get('total_detections', session_data.get('total_detections', 0))
            session_data['drowsiness_count'] = data.get('drowsiness_count', session_data.get('drowsiness_count', 0))
            session_data['awake_count'] = data.get('awake_count', session_data.get('awake_count', 0))
            session_data['yawn_count'] = data.get('yawn_count', session_data.get('yawn_count', 0))
            
            # Also update the database for persistence
            db = SessionLocal()
            try:
                print(f"Querying database for session {session_id}...")
                session = db.query(DetectionSession).filter(
                    DetectionSession.id == session_id,
                    DetectionSession.user_id == user_id
                ).first()
                
                if session:
                    print(f"Current database values - drowsiness: {session.drowsiness_count}, awake: {session.awake_count}, yawn: {session.yawn_count}")
                    print(f"Updating to - drowsiness: {session_data['drowsiness_count']}, awake: {session_data['awake_count']}, yawn: {session_data['yawn_count']}")
                    
                    session.total_detections = session_data['total_detections']
                    session.drowsiness_count = session_data['drowsiness_count']
                    session.awake_count = session_data['awake_count']
                    session.yawn_count = session_data['yawn_count']
                    
                    db.commit()
                    db.refresh(session)
                    print(f"After commit - drowsiness: {session.drowsiness_count}, awake: {session.awake_count}, yawn: {session.yawn_count}")
                    print(f"Successfully updated session {session_id} in database")
            except Exception as e:
                db.rollback()
                print(f"Error updating session in database: {str(e)}")
            finally:
                db.close()
                
        return jsonify({'message': 'Session stats updated successfully'}), 200
        
    except Exception as e:
        print(f"Error updating session stats: {str(e)}")
        return jsonify({'error': 'Failed to update session stats'}), 500

@app.route('/api/detection/end-session', methods=['POST'])
def end_detection_session():
    """Permanently end detection session - called when user navigates away or refreshes"""
    try:
        data = request.get_json()
        session_id = data.get('session_id')
        
        # Get JWT token from request body (for sendBeacon) or Authorization header
        auth_header = request.headers.get('Authorization')
        token = None
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(" ")[1]
        elif 'jwt' in data:
            token = data['jwt']
            
        if not token:
            return jsonify({'error': 'Missing authentication token'}), 401
            
        # Manually verify the token
        try:
            decoded = decode_token(token)
            user_id = int(decoded['sub']['identity'])
        except Exception as e:
            print(f"Invalid token: {e}")
            return jsonify({'error': 'Invalid or expired token'}), 401
        
        # Get final session stats and delete from active_sessions
        session_stats = {}
        if session_id in active_sessions:
            session_data = active_sessions[session_id]
            session_stats = {
                'total_detections': session_data.get('total_detections', 0),
                'drowsiness_count': session_data.get('drowsiness_count', 0),
                'awake_count': session_data.get('awake_count', 0),
                'yawn_count': session_data.get('yawn_count', 0),
                'alarm_triggered': session_data.get('alarm_triggered', False)
            }
            print(f"Ending session {session_id} - final stats: {session_stats}")
            del active_sessions[session_id]  # Now delete from active sessions
            print(f"Removed session {session_id} from active_sessions. Remaining: {list(active_sessions.keys())}")
        
        # Update database and mark as interrupted
        db = SessionLocal()
        try:
            session = db.query(DetectionSession).filter(DetectionSession.id == session_id).first()
            if session:
                # Finalize session details
                session.end_time = datetime.now()
                session.duration = (session.end_time - session.start_time).total_seconds()
                session.status = 'interrupted'  # Mark as interrupted when user navigates away

                # Update final session stats if available
                if session_stats:
                    session.total_detections = session_stats.get('total_detections', session.total_detections)
                    session.drowsiness_count = session_stats.get('drowsiness_count', session.drowsiness_count)
                    session.awake_count = session_stats.get('awake_count', session.awake_count)
                    session.yawn_count = session_stats.get('yawn_count', session.yawn_count)
                    session.alarm_triggered = session_stats.get('alarm_triggered', session.alarm_triggered)

                print(f"Session {session_id} interrupted - final duration: {session.duration}s")

                db.commit()

                # Release camera if no other sessions are active
                if not active_sessions:
                    global camera
                    if camera is not None:
                        camera.release()
                        camera = None
                        print("Camera released after interruption.")

                return jsonify({'message': 'Session interrupted and saved successfully'}), 200
            else:
                # This case might happen if the session was created but the page was closed before it could be saved
                print(f"Session {session_id} not found in database, cannot mark as interrupted.")
                return jsonify({'error': 'Session not found in database'}), 404
        except Exception as e:
            db.rollback()
            print(f"Error interrupting session {session_id}: {e}")
            return jsonify({'error': str(e)}), 500
        finally:
            db.close()
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/files/processed/<int:file_id>', methods=['GET'])
@jwt_required()
def get_processed_file(file_id):
    """Download processed file - DETECTION PAGE"""
    try:
        user_id = int(get_jwt_identity())  # Convert back to int from string
        db = SessionLocal()
        
        uploaded_file = db.query(UploadedFile).filter(
            UploadedFile.id == file_id,
            UploadedFile.user_id == user_id
        ).first()
        
        if not uploaded_file:
            db.close()
            return jsonify({'error': 'File not found'}), 404
        
        db.close()
        
        # Get original filename and extension
        original_name = uploaded_file.original_filename
        name_without_ext = os.path.splitext(original_name)[0]
        file_ext = os.path.splitext(original_name)[1]
        
        # Create download filename with "processed_" prefix but keep original extension
        download_name = f"processed_{name_without_ext}{file_ext}"
        
        # Debug logging
        print(f"Original filename: {original_name}")
        print(f"Download name: {download_name}")
        print(f"File extension: {file_ext}")
        print(f"Processed path: {uploaded_file.processed_path}")
        
        # Check if file exists
        if not os.path.exists(uploaded_file.processed_path):
            return jsonify({'error': 'Processed file not found'}), 404
            
        # Set proper MIME type based on file extension
        mimetype = None
        if file_ext.lower() in ['.jpg', '.jpeg']:
            mimetype = 'image/jpeg'
        elif file_ext.lower() == '.png':
            mimetype = 'image/png'
        elif file_ext.lower() == '.mp4':
            mimetype = 'video/mp4'
        
        from flask import Response
        import mimetypes
        
        # Read the file content
        with open(uploaded_file.processed_path, 'rb') as f:
            file_data = f.read()
        
        # Create response with proper headers
        response = Response(
            file_data,
            mimetype=mimetype or mimetypes.guess_type(uploaded_file.processed_path)[0],
            headers={
                'Content-Disposition': f'attachment; filename="{download_name}"',
                'Content-Length': len(file_data)
            }
        )
        
        return response
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ========================================
# ERROR HANDLERS
# ========================================

@app.errorhandler(401)
def unauthorized(error):
    print(f"401 Unauthorized error: {error}")  # Debug log
    return jsonify({'error': 'Unauthorized'}), 401

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'error': 'Internal server error'}), 500

@jwt.unauthorized_loader
def unauthorized_callback(callback):
    print(f"JWT unauthorized callback: {callback}")  # Debug log
    return jsonify({'error': 'Missing Authorization Header'}), 401

@jwt.invalid_token_loader
def invalid_token_callback(callback):
    print(f"JWT invalid token callback: {callback}")  # Debug log
    return jsonify({'error': 'Invalid token'}), 401

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    print(f"JWT expired token - header: {jwt_header}, payload: {jwt_payload}")  # Debug log
    return jsonify({'error': 'Token has expired'}), 401

# ========================================
# AUTHENTICATION ENDPOINTS - LOGIN PAGE
# ========================================
# These endpoints handle user authentication for the login page
# Database tables used: users, user_settings

# Duplicate login endpoint removed - using the one at line 173

# Static file serving for alarm sounds
@app.route('/uploads/sounds/<filename>')
def serve_user_alarm_sound(filename):
    """Serve user uploaded alarm sound files - DETECTION PAGE"""
    try:
        sounds_dir = os.path.join(os.path.dirname(__file__), 'uploads', 'sounds')
        print(f"Looking for user sound file: {filename}")
        print(f"In directory: {sounds_dir}")
        return send_from_directory(sounds_dir, filename)
    except Exception as e:
        print(f"Error serving user sound file: {e}")
        return jsonify({'error': 'Sound file not found'}), 404

# Static file serving for default alarm sounds
@app.route('/sound-default/<filename>')
def serve_default_alarm_sound(filename):
    """Serve default alarm sound files - DETECTION PAGE"""
    try:
        sounds_dir = os.path.join(os.path.dirname(__file__), 'sound-default')
        print(f"Looking for default sound file: {filename}")
        print(f"In directory: {sounds_dir}")
        print(f"Directory exists: {os.path.exists(sounds_dir)}")
        if os.path.exists(sounds_dir):
            files = os.listdir(sounds_dir)
            print(f"Available default files: {files}")
        return send_from_directory(sounds_dir, filename)
    except Exception as e:
        print(f"Error serving default sound file: {e}")
        return jsonify({'error': 'Default sound file not found'}), 404

@app.route('/api/settings/alarm-sounds', methods=['GET'])
@jwt_required()
def get_available_alarm_sounds():
    """Get list of available alarm sounds - SETTINGS PAGE"""
    try:
        sounds_dir = os.path.join(os.getcwd(), 'uploads', 'sounds')
        if not os.path.exists(sounds_dir):
            return jsonify({'sounds': Config.DEFAULT_ALARM_SOUNDS}), 200
            
        sound_files = []
        for file in os.listdir(sounds_dir):
            if file.lower().endswith(('.mp3', '.wav', '.ogg')):
                sound_files.append(file)
        
        # If no sound files found, return default list
        if not sound_files:
            sound_files = Config.DEFAULT_ALARM_SOUNDS
            
        return jsonify({'sounds': sound_files}), 200
        
    except Exception as e:
        print(f"Get alarm sounds error: {str(e)}")
        return jsonify({'sounds': Config.DEFAULT_ALARM_SOUNDS}), 200

@app.route('/api/detection/download-processed-video', methods=['GET', 'OPTIONS'])
def download_processed_video():
    """Download processed video with detection boxes"""
    print(f"Download endpoint called with method: {request.method}")  # Debug log
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', 'http://localhost:8080')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,OPTIONS')
        response.headers.add('Access-Control-Allow-Credentials', 'true')
        return response, 200
    
    try:
        print("Processing GET request for video download")  # Debug log
        
        original_filename = request.args.get('filename')
        token_param = request.args.get('token')
        
        print(f"Filename: {original_filename}, Token provided: {bool(token_param)}")  # Debug log
        
        # Get current user from token parameter
        if not token_param:
            return jsonify({'error': 'Token required'}), 401
            
        # Verify JWT token from URL parameter
        from flask_jwt_extended import decode_token
        try:
            decoded_token = decode_token(token_param)
            current_user = decoded_token['sub']
            print(f"Token decoded successfully, user: {current_user}")  # Debug log
        except Exception as jwt_error:
            print(f"JWT decode error from URL param: {str(jwt_error)}")
            return jsonify({'error': 'Invalid token'}), 401
        
        if not original_filename:
            return jsonify({'error': 'Original filename required'}), 400
        
        # Find the uploaded file record
        db = SessionLocal()
        try:
            uploaded_file = db.query(UploadedFile).filter(
                UploadedFile.user_id == current_user,
                UploadedFile.original_filename == original_filename,
                UploadedFile.file_type == 'video'
            ).order_by(UploadedFile.id.desc()).first()
            
            if not uploaded_file or not uploaded_file.processed_path:
                return jsonify({'error': 'Processed video not found'}), 404
            
            processed_path = uploaded_file.processed_path
            
            if not os.path.exists(processed_path):
                return jsonify({'error': 'Processed video file not found'}), 404
            
            # Generate download filename
            file_ext = original_filename.split('.').pop()
            base_name = original_filename.replace(f'.{file_ext}', '')
            download_filename = f"{base_name}_processed.{file_ext}"
            
            return send_file(
                processed_path,
                as_attachment=True,
                download_name=download_filename,
                mimetype='video/mp4'
            )
            
        finally:
            db.close()
            
    except Exception as e:
        print(f"Download processed video error: {str(e)}")
        return jsonify({'error': 'Failed to download processed video'}), 500

if __name__ == '__main__':
    # Create database tables
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully")
    except Exception as e:
        print(f"❌ Database error: {str(e)}")
    
    print("Starting DrowsyGuard Backend Server...")
    print(f"Database URL: {app.config.get('DATABASE_URL')}")
    print(f"Model Path: {app.config.get('MODEL_PATH')}")
    print(f"Alarm Sounds: {app.config.get('ALARM_SOUNDS_FOLDER')}")
    print("Server running on http://localhost:5000")
    
    # Debug: Print all registered routes
    print("\n=== REGISTERED ROUTES ===")
    for rule in app.url_map.iter_rules():
        print(f"{rule.methods} {rule.rule} -> {rule.endpoint}")
    print("========================\n")

# Add request logging middleware
@app.before_request
def log_request():
    print(f"[REQUEST] {request.method} {request.path} from {request.remote_addr}")
    if request.headers.get('Authorization'):
        auth_header = request.headers.get('Authorization')
        print(f"[REQUEST] Auth header: {auth_header[:50]}...")
    # Check if this is a dashboard stats request
    if request.path == '/api/dashboard/stats' and request.method == 'GET':
        print("[REQUEST] Dashboard stats GET request detected - checking routing...")

@app.after_request
def log_response(response):
    print(f"[RESPONSE] {response.status_code} for {request.method} {request.path}")
    return response

if __name__ == '__main__':
    # Run without debug mode to prevent reloader issues with YOLO model
    app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False)
