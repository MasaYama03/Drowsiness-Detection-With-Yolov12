# Database Configuration and Models
# PostgreSQL database setup with SQLAlchemy models

import os
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Float, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from werkzeug.security import generate_password_hash, check_password_hash
import uuid

# Database configuration
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:123@localhost:5432/drowsys_db')

# Create engine and session
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database Models

class User(Base):
    """
    User model for authentication and profile management
    Table: users
    Connected to: login page, signup page, settings page
    """
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(80), unique=True, nullable=False)
    email = Column(String(120), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    date_of_birth = Column(DateTime, nullable=True)
    profile_photo = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    detection_sessions = relationship("DetectionSession", back_populates="user", cascade="all, delete-orphan")
    user_settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    
    def set_password(self, password):
        """Set password hash"""
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        """Check password against hash"""
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        """Convert user to dictionary for JSON response"""
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'name': self.full_name,  # Map full_name to name for frontend
            'fullName': self.full_name,  # Also provide fullName for consistency
            'full_name': self.full_name,
            'phone': self.phone,
            'date_of_birth': self.date_of_birth.isoformat() if self.date_of_birth else None,
            'profile_photo': self.profile_photo,
            'profile_picture': self.profile_photo,  # Alias for frontend
            'created_at': self.created_at.isoformat(),
            'is_active': self.is_active
        }

class UserSettings(Base):
    """
    User settings model for detection and alarm preferences
    Table: user_settings
    Connected to: settings page, detection page
    """
    __tablename__ = 'user_settings'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    
    # Detection settings
    detection_sensitivity = Column(Float, default=0.5)
    trigger_time = Column(Integer, default=5)
    alarm_enabled = Column(Boolean, default=True)
    alarm_volume = Column(Float, default=0.8)
    alarm_sound = Column(String(255), default='default')
    
    # Notification settings
    notifications_enabled = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="user_settings")
    
    def to_dict(self):
        """Convert settings to dictionary for JSON response"""
        return {
            'detectionSensitivity': self.detection_sensitivity,
            'triggerTime': self.trigger_time,
            'alarmEnabled': self.alarm_enabled,
            'alarmVolume': self.alarm_volume,
            'alarmSound': self.alarm_sound,
            'notificationsEnabled': self.notifications_enabled
        }

class DetectionSession(Base):
    """
    Detection session model for tracking user detection sessions
    Table: detection_sessions
    Connected to: dashboard page, history page, detection page
    """
    __tablename__ = 'detection_sessions'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    
    # Session details
    session_type = Column(String(20), default='live')  # 'live' or 'upload'
    status = Column(String(20), default='active')  # 'active', 'completed', 'interrupted'
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    duration = Column(Integer, default=0)  # seconds
    
    # Detection counts
    total_detections = Column(Integer, default=0)
    drowsiness_count = Column(Integer, default=0)
    awake_count = Column(Integer, default=0)
    yawn_count = Column(Integer, default=0)
    
    # Add missing fields to match database schema
    alarm_triggered = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="detection_sessions")
    detection_results = relationship("DetectionResult", back_populates="session", cascade="all, delete-orphan")
    
    def to_dict(self):
        """Convert session to dictionary for JSON response"""
        # Calculate duration if not set or if session is still active
        calculated_duration = self.duration
        if calculated_duration is None or calculated_duration == 0:
            if self.end_time:
                calculated_duration = int((self.end_time - self.start_time).total_seconds())
            elif self.status == 'active':
                # For active sessions, calculate current duration
                from datetime import datetime
                calculated_duration = int((datetime.now() - self.start_time).total_seconds())
        
        return {
            'id': self.id,
            'session_type': self.session_type,
            'status': self.status,
            'start_time': self.start_time.isoformat(),
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'duration': calculated_duration or 0,
            'total_detections': self.total_detections,
            'drowsiness_count': self.drowsiness_count,
            'awake_count': self.awake_count,
            'yawn_count': self.yawn_count,
            'created_at': self.start_time.isoformat()  # Use start_time for consistency
        }

class DetectionResult(Base):
    """
    Individual detection result model
    Table: detection_results
    Connected to: detection page, history page
    """
    __tablename__ = 'detection_results'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey('detection_sessions.id'), nullable=False)
    
    # Detection data
    detection_class = Column(String(20), nullable=False)  # 'Drowsiness', 'awake', 'yawn'
    confidence = Column(Float, nullable=False)
    bbox_x1 = Column(Integer, nullable=True)
    bbox_y1 = Column(Integer, nullable=True)
    bbox_x2 = Column(Integer, nullable=True)
    bbox_y2 = Column(Integer, nullable=True)
    
    # Metadata
    timestamp = Column(DateTime, default=datetime.utcnow)
    frame_number = Column(Integer, nullable=True)
    processing_time = Column(Float, nullable=True)
    
    # Relationships
    session = relationship("DetectionSession", back_populates="detection_results")
    
    def to_dict(self):
        """Convert detection result to dictionary for JSON response"""
        return {
            'id': self.id,
            'session_id': self.session_id,
            'class': self.detection_class,
            'confidence': self.confidence,
            'bbox': [self.bbox_x1, self.bbox_y1, self.bbox_x2, self.bbox_y2] if all([
                self.bbox_x1, self.bbox_y1, self.bbox_x2, self.bbox_y2
            ]) else None,
            'timestamp': self.timestamp.isoformat()
        }

class UploadedFile(Base):
    """
    Uploaded file model for tracking processed files
    Table: uploaded_files
    Connected to: detection page (upload section)
    """
    __tablename__ = 'uploaded_files'
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    session_id = Column(Integer, ForeignKey('detection_sessions.id'), nullable=True)
    
    # File details
    original_filename = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=False)  # 'image' or 'video'
    file_size = Column(Integer, nullable=False)  # bytes
    
    # Processing results
    processed_path = Column(String(500), nullable=True)
    processing_status = Column(String(20), default='pending')  # 'pending', 'processing', 'completed', 'failed'
    
    # Metadata
    upload_time = Column(DateTime, default=datetime.utcnow)
    processed_time = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    
    def to_dict(self):
        """Convert uploaded file to dictionary for JSON response"""
        return {
            'id': self.id,
            'original_filename': self.original_filename,
            'file_type': self.file_type,
            'file_size': self.file_size,
            'processing_status': self.processing_status,
            'upload_time': self.upload_time.isoformat(),
            'processed_time': self.processed_time.isoformat() if self.processed_time else None
        }

# Database utility functions

def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    """Create all database tables"""
    Base.metadata.create_all(bind=engine)

def init_db():
    """Initialize database with default data"""
    create_tables()
    
    # Create default admin user if not exists
    db = SessionLocal()
    try:
        admin_user = db.query(User).filter(User.email == 'admin@drowsyguard.com').first()
        if not admin_user:
            admin_user = User(
                username='admin',
                full_name='Admin User',
                email='admin@drowsyguard.com'
            )
            admin_user.set_password('admin123')
            db.add(admin_user)
            
            # Create default settings for admin user
            db.flush()
            admin_settings = UserSettings(user_id=admin_user.id)
            db.add(admin_settings)
            
            db.commit()
            print("Default admin user created: admin@drowsyguard.com / admin123")
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully!")
