# DrowsyGuard - Drowsiness Detection System

A modern, responsive web application for real-time drowsiness detection while driving using YOLOv11 deep learning model.

## Features

- **Real-time Detection**: Live camera feed with drowsiness detection
- **File Upload Processing**: Analyze images and videos for drowsiness
- **Smart Alarm System**: Configurable alarm triggers with custom sounds
- **User Dashboard**: Statistics and analytics of detection sessions
- **Detection History**: Detailed session history with export functionality
- **User Management**: Profile management and settings customization
- **Modern UI**: Responsive design with beautiful animations

## Project Structure

```
pi - 2/
├── FE/                     # Frontend (HTML, CSS, JS)
│   ├── index.html         # Main application file
│   ├── styles/
│   │   └── main.css       # Modern styling
│   └── js/
│       ├── main.js        # Core app functionality
│       ├── auth.js        # Authentication handling
│       ├── dashboard.js   # Dashboard page
│       ├── detection.js   # Detection functionality
│       ├── history.js     # History page
│       └── settings.js    # Settings page
├── BE/                     # Backend (Python Flask APIs)
│   ├── database.py        # PostgreSQL models
│   ├── api_database.py    # Database operations API
│   └── api_model.py       # Model operations API
├── model/                  # YOLO model files
│   ├── best.pt            # YOLOv11 model
│   └── best.onnx          # ONNX model (optional)
├── requirements.txt        # Python dependencies
├── config.py              # Configuration settings
├── .env                   # Environment variables
└── README.md              # This file
```

## Setup Instructions

### Prerequisites

- Python 3.8+
- PostgreSQL 12+
- Node.js (for serving frontend)
- Webcam (for live detection)

### 1. Database Setup

```bash
# Install PostgreSQL and create database
createdb drowsiness_db

# Update database credentials in .env file
DATABASE_URL=postgresql://your_username:your_password@localhost:5432/drowsiness_db
```

### 2. Backend Setup

```bash
# Install Python dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials and settings

# Initialize database
cd BE
python database.py

# Start database API server
python api_database.py
# Server runs on http://localhost:5000

# Start model API server (in another terminal)
python api_model.py
# Server runs on http://localhost:5001
```

### 3. Frontend Setup

```bash
# Serve frontend files (using Python's built-in server)
cd FE
python -m http.server 8080
# Or use any web server of your choice

# Access application at http://localhost:8080
```

### 4. Model Setup

Place your YOLOv11 model file (`best.pt`) in the `model/` directory. The model should be trained for drowsiness detection with classes: ["Drowsiness", "awake", "yawn"].

## Usage

### 1. Authentication
- Open the application in your browser
- Create a new account or login with existing credentials
- Default admin account: `admin@drowsyguard.com` / `admin123`

### 2. Dashboard
- View detection statistics and recent sessions
- Quick access to all features
- Safety tips and recommendations

### 3. Live Detection
- Click "Detection" in navigation
- Select "Live Camera" tab
- Allow camera permissions
- Click "Start Detection" to begin monitoring
- Configure alarm settings (trigger time, volume, custom sounds)
- Alarm will sound after detecting drowsiness for configured duration

### 4. File Upload Detection
- Select "Upload File" tab in Detection page
- Upload image or video files (JPG, PNG, MP4, AVI)
- Click "Process File" to analyze
- Download processed results with bounding boxes

### 5. History & Analytics
- View detailed session history
- Filter by date, status, and sort options
- Click on sessions for detailed analysis
- Export data as CSV

### 6. Settings
- Update profile information and photo
- Configure detection and alarm preferences
- Manage notification settings
- Export or delete personal data

## API Endpoints

### Database API (Port 5000)
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/settings/profile` - User profile
- `GET /api/history/sessions` - Detection history
- And more...

### Model API (Port 5001)
- `POST /api/detection/start-session` - Start detection session
- `POST /api/detection/analyze-frame` - Analyze camera frame
- `POST /api/detection/analyze-file` - Process uploaded file
- `GET /api/model/health` - Model health check

## Configuration

### Environment Variables (.env)
```bash
DATABASE_URL=postgresql://username:password@localhost:5432/drowsiness_db
JWT_SECRET_KEY=your-super-secret-jwt-key
FLASK_ENV=development
MODEL_PATH=model/best.pt
```

### Detection Settings
- **Trigger Time**: 1-10 seconds before alarm
- **Sensitivity**: Detection confidence threshold
- **Alarm Volume**: 0-100% volume level
- **Custom Sounds**: Upload MP3/WAV files

## Database Schema

### Tables
- `users` - User accounts and preferences
- `user_settings` - Detection and alarm settings
- `detection_sessions` - Detection session records
- `detection_results` - Individual detection results
- `uploaded_files` - Processed file records

## Development

### Adding New Features
1. Frontend: Add new JavaScript modules in `FE/js/`
2. Backend: Add endpoints to appropriate API files
3. Database: Add models to `database.py`

### Testing
```bash
# Run backend tests
pytest BE/

# Test API endpoints
curl -X GET http://localhost:5000/api/model/health
```

## Troubleshooting

### Common Issues
1. **Camera not working**: Check browser permissions
2. **Model not loading**: Verify `model/best.pt` exists
3. **Database connection**: Check PostgreSQL service and credentials
4. **CORS errors**: Verify frontend URL in CORS_ORIGINS

### Performance Tips
- Use GPU for faster model inference
- Adjust detection frequency for better performance
- Optimize video processing frame rate

## Security Notes

- Change default JWT secret key in production
- Use HTTPS in production environment
- Regularly update dependencies
- Implement rate limiting for API endpoints

## License

This project is for educational and research purposes. Please ensure compliance with local regulations for driver monitoring systems.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review API documentation
3. Check browser console for errors
4. Verify all services are running

---

**Stay Alert, Stay Safe! 🚗💤**
