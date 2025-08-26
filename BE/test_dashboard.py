#!/usr/bin/env python3
"""
Simple test script to add dashboard endpoints directly to Flask app
"""

from flask import Flask, request, jsonify, make_response
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity, verify_jwt_in_request
from flask_cors import CORS
from datetime import datetime, timedelta
import os

# Create Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['JWT_SECRET_KEY'] = 'jwt-secret-string'

# Initialize extensions
jwt = JWTManager(app)
CORS(app, origins=["http://localhost:8080"], supports_credentials=True)

# Simple dashboard endpoints
@app.route('/api/dashboard/stats', methods=['GET', 'OPTIONS'])
def get_dashboard_stats():
    """Get dashboard statistics"""
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "http://localhost:8080")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
        response.headers.add("Access-Control-Allow-Methods", "GET,OPTIONS")
        return response
    
    # Return mock data for testing
    response = make_response(jsonify({
        'total_sessions': 5,
        'total_duration': 1200,
        'drowsiness_count': 3
    }))
    response.headers.add("Access-Control-Allow-Origin", "http://localhost:8080")
    response.headers.add("Access-Control-Allow-Credentials", "true")
    return response, 200

@app.route('/api/dashboard/recent-sessions', methods=['GET', 'OPTIONS'])
def get_recent_sessions():
    """Get recent detection sessions"""
    # Handle CORS preflight request
    if request.method == 'OPTIONS':
        response = make_response()
        response.headers.add("Access-Control-Allow-Origin", "http://localhost:8080")
        response.headers.add("Access-Control-Allow-Headers", "Content-Type,Authorization")
        response.headers.add("Access-Control-Allow-Methods", "GET,OPTIONS")
        return response
    
    # Return mock data for testing
    sessions_data = [
        {
            'id': 1,
            'created_at': datetime.now().isoformat(),
            'duration': 300,
            'total_detections': 10,
            'drowsiness_count': 2,
            'status': 'completed'
        }
    ]
    
    response = make_response(jsonify({'sessions': sessions_data}))
    response.headers.add("Access-Control-Allow-Origin", "http://localhost:8080")
    response.headers.add("Access-Control-Allow-Credentials", "true")
    return response, 200

if __name__ == '__main__':
    print("Starting test dashboard server...")
    print("\n=== REGISTERED ROUTES ===")
    for rule in app.url_map.iter_rules():
        print(f"{rule.methods} {rule.rule} -> {rule.endpoint}")
    print("========================\n")
    
    app.run(host='0.0.0.0', port=5000, debug=True)
