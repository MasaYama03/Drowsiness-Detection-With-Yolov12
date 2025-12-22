# API Database endpoints
from flask import Blueprint, request, jsonify, current_app, send_file
from flask_jwt_extended import jwt_required, create_access_token, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import os
import sys
from datetime import datetime, timedelta
import io
import csv
import json
import uuid
from database import *
from sqlalchemy import func, desc

# Define Blueprint to be registered in main app
db_api = Blueprint('db_api', __name__)

# Will be imported after app initialization to avoid circular imports

# Initialize database
init_db()

# Create upload directories
os.makedirs('uploads', exist_ok=True)
os.makedirs('uploads/detection', exist_ok=True)
os.makedirs('uploads/sounds', exist_ok=True)
os.makedirs('processed', exist_ok=True)
upload_folder = 'uploads'
os.makedirs(upload_folder, exist_ok=True)
os.makedirs(os.path.join(upload_folder, 'profile_pictures'), exist_ok=True)

# Database session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Authentication Endpoints
# These endpoints connect to: login page, signup page

@db_api.route('/api/auth/register', methods=['POST'])
def register_user():
    """
    User registration endpoint
    Connects to: signup page form
    Database table: users
    """
    try:
        data = request.get_json()
        
        # Accept both FE schemas: {name,email,password} or {fullName,email,password}
        provided_name = data.get('name') or data.get('fullName') or data.get('username')
        if not data.get('email') or not data.get('password') or not provided_name:
            return jsonify({'message': 'Missing required fields'}), 400
        
        db = SessionLocal()
        
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == data['email']).first()
        if existing_user:
            return jsonify({'message': 'Email already registered'}), 409
        
        # Create new user (map to model fields: username, full_name)
        username = data.get('username') or (data['email'].split('@')[0])
        user = User(
            username=username,
            email=data['email'],
            full_name=provided_name
        )
        user.set_password(data['password'])
        
        db.add(user)
        db.flush()  # Get user ID
        
        # Create default user settings
        user_settings = UserSettings(user_id=user.id)
        db.add(user_settings)
        
        db.commit()
        
        return jsonify({
            'message': 'User registered successfully',
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        db.rollback()
        return jsonify({'message': f'Registration failed: {str(e)}'}), 500
    finally:
        db.close()

@db_api.route('/api/auth/login', methods=['POST'])
def login_user():
    """
    User login endpoint
    Connects to: login page form
    Database table: users
    """
    try:
        data = request.get_json()
        
        if not all(k in data for k in ('email', 'password')):
            return jsonify({'message': 'Missing email or password'}), 400
        
        db = SessionLocal()
        
        # Find user by email
        user = db.query(User).filter(User.email == data['email']).first()
        print(f"[LOGIN] Attempt for email={data['email']}. Found user by email: {bool(user)}")
        
        # Fallback: some legacy users may attempt using username in the email field
        if not user:
            user = db.query(User).filter(User.username == data['email']).first()
            print(f"[LOGIN] Fallback lookup by username. Found: {bool(user)}")
        
        if not user:
            return jsonify({'message': 'Invalid email or password'}), 401
        
        # If legacy user without password_hash (null/empty), set it now
        if not getattr(user, 'password_hash', None):
            print("[LOGIN] password_hash missing/null. Upgrading to hashed now.")
            user.set_password(data['password'])
            user.updated_at = datetime.utcnow()
            db.commit()
        
        # Check hashed password
        raw_hash = getattr(user, 'password_hash', '') or ''
        check_ok = user.check_password(data['password'])
        print(f"[LOGIN] check_password result: {check_ok}")
        print(f"[LOGIN] User details: username={getattr(user, 'username', 'N/A')}, email={user.email}")
        print(f"[LOGIN] Password hash preview: {raw_hash[:20]}...")
        if not check_ok:
            # Legacy fallback: some old records may have stored plaintext in password_hash
            # Detect non-PBKDF2 format and compare directly
            raw_hash = getattr(user, 'password_hash', '') or ''
            is_probably_plain = not raw_hash.startswith('pbkdf2:')
            print(f"[LOGIN] Fallback check. is_probably_plain={is_probably_plain}, raw_len={len(raw_hash)}")
            if is_probably_plain and raw_hash == data['password']:
                user.set_password(data['password'])
                user.updated_at = datetime.utcnow()
                db.commit()
            else:
                print("[LOGIN] Invalid credentials after fallback")
                return jsonify({'message': 'Invalid email or password'}), 401
        
        # Create access token - convert user.id to string for JWT compatibility
        access_token = create_access_token(identity=str(user.id))
        
        return jsonify({
            'token': access_token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'message': 'Login failed', 'error': str(e)}), 500
    finally:
        db.close()

@db_api.route('/api/auth/reset-password', methods=['POST', 'OPTIONS'])
def reset_password():
    """
    Reset password for legacy users - TEMPORARY ENDPOINT
    Connected to: login page (for legacy account recovery)
    Database table: users
    """
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "http://localhost:8080")
        response.headers.add('Access-Control-Allow-Headers', "Content-Type,Authorization")
        response.headers.add('Access-Control-Allow-Methods', "POST,OPTIONS")
        return response
    
    try:
        data = request.get_json()
        
        if not all(k in data for k in ('email', 'new_password')):
            return jsonify({'message': 'Missing email or new_password'}), 400
        
        db = SessionLocal()
        
        # Find user by email
        user = db.query(User).filter(User.email == data['email']).first()
        if not user:
            return jsonify({'message': 'User not found'}), 404
        
        # Force reset password
        user.set_password(data['new_password'])
        user.updated_at = datetime.utcnow()
        db.commit()
        
        print(f"[RESET] Password reset for user: {user.email}")
        
        return jsonify({'message': 'Password reset successful'}), 200
        
    except Exception as e:
        return jsonify({'message': 'Password reset failed', 'error': str(e)}), 500
    finally:
        db.close()

@db_api.route('/api/auth/refresh', methods=['POST'])
@jwt_required()
def refresh_token():
    """
    Refresh authentication token
    Connects to: main.js token refresh
    """
    try:
        current_user_id = get_jwt_identity()
        new_token = create_access_token(identity=current_user_id)
        
        return jsonify({'token': new_token}), 200
        
    except Exception as e:
        return jsonify({'message': f'Token refresh failed: {str(e)}'}), 500

# Dashboard Endpoints
# These endpoints connect to: dashboard page

@db_api.route('/api/dashboard/stats', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    """
    Get dashboard statistics
    Connects to: dashboard page statistics section
    Database tables: detection_sessions, detection_results
    """
    try:
        current_user_id = get_jwt_identity()
        db = SessionLocal()
        
        # Get all sessions for the user
        sessions = db.query(DetectionSession).filter(
            DetectionSession.user_id == current_user_id,
            DetectionSession.status == 'completed'  # Only count completed sessions
        ).all()
        
        # Calculate statistics
        total_sessions = len(sessions)
        total_duration = sum(session.duration or 0 for session in sessions)
        total_detections = sum(session.total_detections or 0 for session in sessions)
        drowsiness_count = sum(session.drowsiness_count or 0 for session in sessions)
        awake_count = sum(session.awake_count or 0 for session in sessions)
        yawn_count = sum(session.yawn_count or 0 for session in sessions)
        
        response_data = {
            'totalSessions': total_sessions,
            'totalDuration': total_duration,
            'totalDetections': total_detections,
            'drowsinessCount': drowsiness_count,
            'awakeCount': awake_count,
            'yawnCount': yawn_count
        }
        
        return jsonify(response_data), 200
        
    except Exception as e:
        print(f"[DASHBOARD] Error: {str(e)}")
        return jsonify({'message': 'Internal server error'}), 500
    finally:
        if 'db' in locals():
            db.close()

@db_api.route('/api/dashboard/recent-sessions', methods=['GET'])
@jwt_required()
def get_recent_sessions():
    """
    Get recent detection sessions
    Connects to: dashboard page recent activity section
    Database table: detection_sessions
    """
    try:
        current_user_id = int(get_jwt_identity())
        db = SessionLocal()
        
        # Get last 5 sessions
        sessions = db.query(DetectionSession).filter(
            DetectionSession.user_id == current_user_id
        ).order_by(desc(DetectionSession.start_time)).limit(5).all()
        
        # Convert sessions to list of dicts and wrap in 'sessions' object to match frontend expectation
        sessions_data = [{
            'id': str(session.id),
            'startTime': session.start_time.isoformat() if session.start_time else None,
            'endTime': session.end_time.isoformat() if session.end_time else None,
            'duration': session.duration,
            'drowsiness_count': session.drowsiness_count or 0,  # Changed from drowsinessCount
            'awake_count': session.awake_count or 0,           # Changed from awakeCount
            'yawn_count': session.yawn_count or 0,             # Changed from yawnCount
            'total_detections': (session.drowsiness_count or 0) + (session.awake_count or 0) + (session.yawn_count or 0),  # Added total_detections
            'status': session.status,
            'created_at': session.start_time.isoformat() if session.start_time else None  # Use start_time instead of created_at for correct display
        } for session in sessions]
        
        return jsonify({'sessions': sessions_data}), 200
        
    except Exception as e:
        print(f"[DASHBOARD] Error in recent-sessions: {str(e)}")
        return jsonify({'message': 'Internal server error'}), 500
    finally:
        if 'db' in locals():
            db.close()

# Profile endpoint
@db_api.route('/api/settings/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """
    Get user profile
    Connects to: settings page profile section
    Database table: users
    """
    try:
        current_user_id = get_jwt_identity()
        db = SessionLocal()
        
        user = db.query(User).filter(User.id == current_user_id).first()
        if not user:
            return jsonify({'message': 'User not found'}), 404
            
        profile_data = {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'full_name': user.full_name,
            'profile_picture': user.profile_picture,
            'phone': user.phone,
            'date_of_birth': user.date_of_birth.isoformat() if user.date_of_birth else None
        }
        
        return jsonify(profile_data), 200
        
    except Exception as e:
        return jsonify({'message': f'Failed to get profile: {str(e)}'}), 500
    finally:
        if 'db' in locals():
            db.close()

@db_api.route('/api/settings/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """
    Update user profile information
    Connects to: settings page profile form
    Database table: users
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        db = SessionLocal()
        
        user = db.query(User).filter(User.id == current_user_id).first()
        if not user:
            return jsonify({'message': 'User not found'}), 404
        
        # Update allowed fields
        allowed_fields = ['name', 'email', 'phone', 'date_of_birth']
        for field in allowed_fields:
            if field in data:
                if field == 'name':
                    # Map 'name' to 'full_name' in database
                    setattr(user, 'full_name', data[field])
                elif field == 'date_of_birth' and data[field]:
                    setattr(user, field, datetime.fromisoformat(data[field]))
                else:
                    setattr(user, field, data[field])
        
        user.updated_at = datetime.utcnow()
        db.commit()
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.rollback()
        return jsonify({'message': f'Failed to update profile: {str(e)}'}), 500
    finally:
        db.close()

# Removed: profile picture upload endpoint is handled in app.py to avoid duplication

@db_api.route('/api/settings/password', methods=['PUT'])
@jwt_required()
def change_password():
    """
    Change user password
    Connects to: settings page password form
    Database table: users
    """
    db = None
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not all(k in data for k in ('current_password', 'new_password')):
            return jsonify({'message': 'Missing required fields'}), 400
        
        db = SessionLocal()
        user = db.query(User).filter(User.id == current_user_id).first()
        
        if not user or not user.check_password(data['current_password']):
            if db:
                db.close()
            return jsonify({'message': 'Current password is incorrect'}), 401
        
        user.set_password(data['new_password'])
        user.updated_at = datetime.utcnow()
        db.commit()
        
        return jsonify({'message': 'Password changed successfully'}), 200
        
    except Exception as e:
        if db:
            db.rollback()
        return jsonify({'message': 'Failed to change password. Please try again.'}), 500
    finally:
        if db:
            db.close()

@db_api.route('/api/settings/alarm', methods=['GET'])
@jwt_required()
def get_alarm_settings():
    """
    Get user alarm settings
    Connects to: settings page alarm section, detection page
    Database table: user_settings
    """
    try:
        current_user_id = get_jwt_identity()
        db = SessionLocal()
        
        settings = db.query(UserSettings).filter(
            UserSettings.user_id == current_user_id
        ).first()
        
        if not settings:
            # Create default settings
            settings = UserSettings(user_id=current_user_id)
            db.add(settings)
            db.commit()
        
        return jsonify(settings.to_dict()), 200
        
    except Exception as e:
        return jsonify({'message': f'Failed to get alarm settings: {str(e)}'}), 500
    finally:
        db.close()

@db_api.route('/api/settings/alarm', methods=['PUT'])
@jwt_required()
def update_alarm_settings():
    """
    Update user alarm settings
    Connects to: settings page alarm form, detection page settings
    Database table: user_settings
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        db = SessionLocal()
        
        settings = db.query(UserSettings).filter(
            UserSettings.user_id == current_user_id
        ).first()
        
        if not settings:
            settings = UserSettings(user_id=current_user_id)
            db.add(settings)
        
        # Update settings
        if 'triggerTime' in data:
            settings.trigger_time = data['triggerTime']
        if 'volume' in data:
            settings.alarm_volume = data['volume']
        if 'soundFile' in data:
            settings.custom_alarm_sound = data['soundFile']
        if 'sensitivity' in data:
            settings.detection_sensitivity = data['sensitivity']
        if 'confidenceThreshold' in data:
            settings.confidence_threshold = data['confidenceThreshold']
        
        settings.updated_at = datetime.utcnow()
        db.commit()
        
        return jsonify({
            'message': 'Alarm settings updated successfully',
            'settings': settings.to_dict()
        }), 200
        
    except Exception as e:
        db.rollback()
        return jsonify({'message': f'Failed to update alarm settings: {str(e)}'}), 500
    finally:
        db.close()

@db_api.route('/api/settings/notifications', methods=['PUT'])
@jwt_required()
def update_notification_settings():
    """
    Update user notification preferences
    Connects to: settings page notification section
    Database table: users
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        db = SessionLocal()
        
        user = db.query(User).filter(User.id == current_user_id).first()
        if not user:
            return jsonify({'message': 'User not found'}), 404
        
        # Update notification settings
        if 'email_notifications' in data:
            user.email_notifications = data['email_notifications']
        if 'session_summaries' in data:
            user.session_summaries = data['session_summaries']
        if 'safety_tips' in data:
            user.safety_tips = data['safety_tips']
        
        user.updated_at = datetime.utcnow()
        db.commit()
        
        return jsonify({'message': 'Notification settings updated successfully'}), 200
        
    except Exception as e:
        db.rollback()
        return jsonify({'message': f'Failed to update notification settings: {str(e)}'}), 500
    finally:
        db.close()

# History Endpoints
# These endpoints connect to: history page

@db_api.route('/api/history/sessions', methods=['GET'])
@jwt_required()
def get_history_sessions():
    """
    Get user detection session history with filtering
    Connects to: history page sessions list
    Database table: detection_sessions
    """
    try:
        current_user_id = get_jwt_identity()
        db = SessionLocal()
        
        # Get query parameters for filtering
        date_filter = request.args.get('date', 'all')
        status_filter = request.args.get('status', 'all')
        sort_filter = request.args.get('sort', 'date_desc')
        
        # Base query
        query = db.query(DetectionSession).filter(
            DetectionSession.user_id == current_user_id
        )
        
        # Apply date filter
        if date_filter == 'today':
            today = datetime.utcnow().date()
            query = query.filter(func.date(DetectionSession.created_at) == today)
        elif date_filter == 'week':
            week_ago = datetime.utcnow() - timedelta(days=7)
            query = query.filter(DetectionSession.created_at >= week_ago)
        elif date_filter == 'month':
            month_ago = datetime.utcnow() - timedelta(days=30)
            query = query.filter(DetectionSession.created_at >= month_ago)
        
        # Apply status filter
        if status_filter != 'all':
            query = query.filter(DetectionSession.status == status_filter)
        
        # Apply sorting
        if sort_filter == 'date_asc':
            query = query.order_by(asc(DetectionSession.created_at))
        elif sort_filter == 'duration_desc':
            query = query.order_by(desc(DetectionSession.duration))
        elif sort_filter == 'alerts_desc':
            query = query.order_by(desc(DetectionSession.drowsiness_count))
        else:  # date_desc (default)
            query = query.order_by(desc(DetectionSession.created_at))
        
        sessions = query.all()
        
        # Return paginated response format to match frontend expectation
        return jsonify({
            'sessions': [session.to_dict() for session in sessions],
            'pagination': {
                'total': len(sessions),
                'page': 1,
                'per_page': len(sessions)
            }
        }), 200
        
    except Exception as e:
        return jsonify({'message': f'Failed to get session history: {str(e)}'}), 500
    finally:
        db.close()

@db_api.route('/api/history/summary', methods=['GET'])
@jwt_required()
def get_history_summary_db():
    """
    Get history summary statistics
    Connects to: history page summary section
    Database table: detection_sessions
    """
    try:
        current_user_id = get_jwt_identity()
        db = SessionLocal()
        
        # Get summary statistics
        summary = db.query(
            func.count(DetectionSession.id).label('total_sessions'),
            func.sum(DetectionSession.drowsiness_count).label('total_alerts'),
            func.sum(DetectionSession.duration).label('total_duration'),
            func.avg(DetectionSession.duration).label('avg_duration')
        ).filter(
            DetectionSession.user_id == current_user_id,
            DetectionSession.status == 'completed'  # Only count completed sessions
        ).first()
        
        return jsonify({
            'totalSessions': summary.total_sessions or 0,
            'totalAlerts': summary.total_alerts or 0,
            'totalDuration': summary.total_duration or 0,
            'avgDuration': summary.avg_duration or 0
        }), 200
        
    except Exception as e:
        return jsonify({'message': f'Failed to get history summary: {str(e)}'}), 500
    finally:
        db.close()

@db_api.route('/api/history/session/<session_id>', methods=['GET'])
@jwt_required()
def get_session_details(session_id):
    """
    Get detailed information for a specific session
    Connects to: history page session detail modal
    Database tables: detection_sessions, detection_results
    """
    try:
        current_user_id = get_jwt_identity()
        db = SessionLocal()
        
        # Get session with results
        session = db.query(DetectionSession).filter(
            DetectionSession.id == session_id,
            DetectionSession.user_id == current_user_id
        ).first()
        
        if not session:
            return jsonify({'message': 'Session not found'}), 404
        
        # Get detection results
        results = db.query(DetectionResult).filter(
            DetectionResult.session_id == session_id
        ).order_by(DetectionResult.timestamp).all()
        
        session_dict = session.to_dict()
        session_dict['detections'] = [result.to_dict() for result in results]
        
        return jsonify(session_dict), 200
        
    except Exception as e:
        return jsonify({'message': f'Failed to get session details: {str(e)}'}), 500
    finally:
        db.close()

@db_api.route('/api/history/export', methods=['GET'])
@jwt_required()
def export_history():
    """
    Export user history as CSV file
    Connects to: history page export button
    Database table: detection_sessions
    """
    try:
        current_user_id = get_jwt_identity()
        db = SessionLocal()
        
        # Get all sessions for user
        sessions = db.query(DetectionSession).filter(
            DetectionSession.user_id == current_user_id
        ).order_by(desc(DetectionSession.created_at)).all()
        
        # Create CSV data
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'Date', 'Duration (seconds)', 'Status', 'Total Detections',
            'Drowsiness Count', 'Awake Count', 'Yawn Count'
        ])
        
        # Write data
        for session in sessions:
            writer.writerow([
                session.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                session.duration,
                session.status,
                session.total_detections,
                session.drowsiness_count,
                session.awake_count,
                session.yawn_count
            ])
        
        # Create response
        output.seek(0)
        return send_file(
            io.BytesIO(output.getvalue().encode()),
            mimetype='text/csv',
            as_attachment=True,
            download_name=f'detection_history_{datetime.utcnow().strftime("%Y%m%d")}.csv'
        )
        
    except Exception as e:
        return jsonify({'message': f'Failed to export history: {str(e)}'}), 500
    finally:
        db.close()

# Data Management Endpoints
# These endpoints connect to: settings page data management section

@db_api.route('/api/settings/export-data', methods=['GET'])
@jwt_required()
def export_user_data():
    """
    Export all user data as JSON
    Connects to: settings page export data button
    Database tables: users, detection_sessions, detection_results
    """
    try:
        current_user_id = get_jwt_identity()
        db = SessionLocal()
        
        # Get user data
        user = db.query(User).filter(User.id == current_user_id).first()
        sessions = db.query(DetectionSession).filter(
            DetectionSession.user_id == current_user_id
        ).all()
        
        # Compile data
        export_data = {
            'user': user.to_dict() if user else None,
            'sessions': [session.to_dict() for session in sessions],
            'export_date': datetime.utcnow().isoformat()
        }
        
        # Create JSON response
        json_data = json.dumps(export_data, indent=2)
        
        return send_file(
            io.BytesIO(json_data.encode()),
            mimetype='application/json',
            as_attachment=True,
            download_name=f'user_data_{datetime.utcnow().strftime("%Y%m%d")}.json'
        )
        
    except Exception as e:
        return jsonify({'message': f'Failed to export user data: {str(e)}'}), 500
    finally:
        db.close()

@db_api.route('/api/settings/clear-history', methods=['DELETE', 'OPTIONS'])
def clear_detection_history():
    """
    Clear all detection history for user
    Connects to: settings page clear history button
    Database tables: detection_sessions, detection_results
    """
    # Handle OPTIONS preflight request
    if request.method == 'OPTIONS':
        response = jsonify({'message': 'OK'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'DELETE,OPTIONS')
        return response
    
    # Handle DELETE request
    try:
        # Apply JWT requirement only for DELETE method
        from flask_jwt_extended import jwt_required, get_jwt_identity
        jwt_required()(lambda: None)()
        current_user_id = get_jwt_identity()
        
        db = SessionLocal()
        
        # Delete all sessions (cascade will delete results)
        db.query(DetectionSession).filter(
            DetectionSession.user_id == current_user_id
        ).delete()
        
        db.commit()
        
        return jsonify({'message': 'Detection history cleared successfully'}), 200
        
    except Exception as e:
        if 'db' in locals():
            db.rollback()
        return jsonify({'message': f'Failed to clear history: {str(e)}'}), 500
    finally:
        if 'db' in locals():
            db.close()

@db_api.route('/api/settings/delete-account', methods=['DELETE'])
@jwt_required()
def delete_user_account():
    """
    Delete user account and all associated data
    Connects to: settings page delete account button
    Database table: users (cascade deletes all related data)
    """
    try:
        current_user_id = get_jwt_identity()
        db = SessionLocal()
        
        # Delete user (cascade will delete all related data)
        user = db.query(User).filter(User.id == current_user_id).first()
        if user:
            db.delete(user)
            db.commit()
        
        return jsonify({'message': 'Account deleted successfully'}), 200
        
    except Exception as e:
        db.rollback()
        return jsonify({'message': f'Failed to delete account: {str(e)}'}), 500
    finally:
        db.close()

# Note: error handlers are defined in the main app if needed
# This module defines a Blueprint and should be registered by the main Flask app.
