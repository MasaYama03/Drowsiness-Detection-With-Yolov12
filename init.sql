-- DrowsyGuard Database Initialization Script
-- Run this script in PostgreSQL to create all required tables

-- Create database (run this first if database doesn't exist)
-- CREATE DATABASE drowsys_db;

-- Connect to drowsys_db database before running the rest

-- ========================================
-- USERS TABLE - User accounts and profiles
-- ========================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(80) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    profile_photo VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- ========================================
-- USER_SETTINGS TABLE - Detection and alarm preferences
-- ========================================
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    detection_sensitivity FLOAT DEFAULT 0.5,
    trigger_time INTEGER DEFAULT 5,
    alarm_enabled BOOLEAN DEFAULT TRUE,
    alarm_volume FLOAT DEFAULT 0.8,
    alarm_sound VARCHAR(255) DEFAULT 'default',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- ========================================
-- DETECTION_SESSIONS TABLE - Detection session records
-- ========================================
CREATE TABLE IF NOT EXISTS detection_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_type VARCHAR(20) NOT NULL CHECK (session_type IN ('live', 'upload')),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    duration INTEGER, -- in seconds
    total_detections INTEGER DEFAULT 0,
    drowsiness_count INTEGER DEFAULT 0,
    yawn_count INTEGER DEFAULT 0,
    awake_count INTEGER DEFAULT 0,
    alarm_triggered BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'stopped')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- DETECTION_RESULTS TABLE - Individual detection results
-- ========================================
CREATE TABLE IF NOT EXISTS detection_results (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES detection_sessions(id) ON DELETE CASCADE,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    detection_class VARCHAR(20) NOT NULL CHECK (detection_class IN ('Drowsiness', 'awake', 'yawn')),
    confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    bbox_x1 FLOAT,
    bbox_y1 FLOAT,
    bbox_x2 FLOAT,
    bbox_y2 FLOAT,
    frame_number INTEGER,
    processing_time FLOAT -- in milliseconds
);

-- ========================================
-- UPLOADED_FILES TABLE - File upload records
-- ========================================
CREATE TABLE IF NOT EXISTS uploaded_files (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    session_id INTEGER REFERENCES detection_sessions(id) ON DELETE CASCADE,
    original_filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    processed_path VARCHAR(500),
    file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('image', 'video')),
    file_size INTEGER, -- in bytes
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    upload_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_time TIMESTAMP,
    error_message TEXT
);

-- ========================================
-- INDEXES for better performance
-- ========================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_detection_sessions_user_id ON detection_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_detection_sessions_start_time ON detection_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_detection_results_session_id ON detection_results(session_id);
CREATE INDEX IF NOT EXISTS idx_detection_results_timestamp ON detection_results(timestamp);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_user_id ON uploaded_files(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_session_id ON uploaded_files(session_id);

-- ========================================
-- INSERT DEFAULT DATA
-- ========================================

-- Insert default admin user (password: admin123)
INSERT INTO users (username, email, password_hash, full_name, is_active) 
VALUES (
    'admin', 
    'admin@drowsyguard.com', 
    'scrypt:32768:8:1$YourHashedPasswordHere$hashedpasswordstring', -- You need to hash this properly
    'System Administrator', 
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- Insert default user settings for admin
INSERT INTO user_settings (user_id, detection_sensitivity, trigger_time, alarm_enabled, alarm_volume) 
SELECT id, 0.5, 5, TRUE, 0.8 
FROM users 
WHERE email = 'admin@drowsyguard.com'
ON CONFLICT (user_id) DO NOTHING;

-- ========================================
-- TRIGGERS for updated_at timestamps
-- ========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Triggers for user_settings table
DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at 
    BEFORE UPDATE ON user_settings 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- VIEWS for common queries
-- ========================================

-- View for user statistics
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.id as user_id,
    u.username,
    u.full_name,
    COUNT(ds.id) as total_sessions,
    SUM(ds.duration) as total_duration,
    SUM(ds.drowsiness_count) as total_drowsiness,
    SUM(ds.yawn_count) as total_yawns,
    SUM(ds.awake_count) as total_awake,
    COUNT(CASE WHEN ds.alarm_triggered = TRUE THEN 1 END) as alarm_sessions,
    MAX(ds.start_time) as last_session
FROM users u
LEFT JOIN detection_sessions ds ON u.id = ds.user_id
GROUP BY u.id, u.username, u.full_name;

-- View for recent sessions
CREATE OR REPLACE VIEW recent_sessions AS
SELECT 
    ds.id,
    ds.user_id,
    u.username,
    ds.session_type,
    ds.start_time,
    ds.end_time,
    ds.duration,
    ds.total_detections,
    ds.drowsiness_count,
    ds.yawn_count,
    ds.awake_count,
    ds.alarm_triggered,
    ds.status
FROM detection_sessions ds
JOIN users u ON ds.user_id = u.id
ORDER BY ds.start_time DESC;

-- ========================================
-- GRANT PERMISSIONS (adjust as needed)
-- ========================================
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_app_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_app_user;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================
-- Run these to verify the setup:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- SELECT * FROM users;
-- SELECT * FROM user_settings;

COMMIT;
