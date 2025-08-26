# Configuration file for DrowsyGuard application
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Base configuration class"""
    
    # Database Configuration
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:123@localhost:5432/drowsys_db')
    
    # JWT Configuration
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'your-super-secret-jwt-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = 3600  # 1 hour
    
    # Flask Configuration
    SECRET_KEY = os.getenv('SECRET_KEY', 'your-secret-key-change-in-production')
    DEBUG = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    
    # File Upload Configuration
    MAX_CONTENT_LENGTH = 100 * 1024 * 1024  # 100MB max file size
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # BE folder
    PROJECT_ROOT = os.path.dirname(BASE_DIR)  # Project root folder
    UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, 'uploads', 'detection')
    PROCESSED_FOLDER = os.path.join(BASE_DIR, 'processed')
    
    # Alarm Sound Configuration
    ALARM_SOUNDS_FOLDER = os.getenv('ALARM_SOUNDS_FOLDER', 'uploads/sounds')
    DEFAULT_ALARM_SOUNDS = ['beep.mp3', 'alarm.mp3', 'bell.mp3', 'siren.mp3']
    
    # Model Configuration  
    MODEL_PATH = os.path.join(PROJECT_ROOT, 'model', 'best.pt')
    
    # CORS Configuration
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080').split(',')
    
    # Detection Configuration
    DETECTION_CLASSES = {0: 'Drowsiness', 1: 'awake', 2: 'yawn'}
    DEFAULT_CONFIDENCE_THRESHOLD = 0.7  # Increased for stability
    DEFAULT_TRIGGER_TIME = 5  # seconds
    DEFAULT_ALARM_VOLUME = 0.8
    
    # Smoothing Configuration
    DETECTION_SMOOTHING_FRAMES = 5  # Number of frames to average for stability
    MIN_DETECTION_STABILITY = 0.4  # Lower threshold for initial detection
    CONFIDENCE_SMOOTHING_ALPHA = 0.3  # Smoothing factor (lower = more stable)
    MIN_VOTES_REQUIRED = 3  # Minimum votes needed to show detection

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    TESTING = False
    
    # Override with more secure defaults for production
    JWT_ACCESS_TOKEN_EXPIRES = 1800  # 30 minutes

class TestingConfig(Config):
    """Testing configuration"""
    DEBUG = True
    TESTING = True
    DATABASE_URL = 'sqlite:///test.db'  # Use SQLite for testing

# Configuration mapping
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}
