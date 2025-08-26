# Alarm Sounds Folder

This folder contains alarm sound files for the drowsiness detection system.

## Default Sound Files
Place the following sound files in this directory:
- `beep.mp3` - Simple beep sound
- `alarm.mp3` - Standard alarm sound  
- `bell.mp3` - Bell notification sound
- `siren.mp3` - Emergency siren sound

## Usage
- Users can select alarm sounds from the settings page
- Sound files are served as static files by the Flask backend
- Default sound is 'default' which maps to the first available sound file

## File Format
- Supported formats: MP3, WAV, OGG
- Recommended: MP3 for better browser compatibility
- Keep file sizes reasonable (< 1MB per sound)
