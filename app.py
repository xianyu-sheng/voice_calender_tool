import os
import sys
import webbrowser
import threading
from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

def get_base_path():
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

base_path = get_base_path()

sys.path.insert(0, os.path.join(base_path, 'backend'))

from app import db
from app.api import events_bp, calendars_bp, reminders_bp, todos_bp, voice_bp

app = Flask(__name__, static_folder=os.path.join(base_path, 'frontend', 'dist'))
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///calendar.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

app.register_blueprint(events_bp)
app.register_blueprint(calendars_bp)
app.register_blueprint(reminders_bp)
app.register_blueprint(todos_bp)
app.register_blueprint(voice_bp)

with app.app_context():
    db.create_all()
    # 确保 events 表有 progress 列
    try:
        import sqlite3
        db_path = app.config['SQLALCHEMY_DATABASE_URI'].replace('sqlite:///', '')
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(events)")
        columns = [col[1] for col in cursor.fetchall()]
        if 'progress' not in columns:
            cursor.execute("ALTER TABLE events ADD COLUMN progress INTEGER DEFAULT 0")
            conn.commit()
        conn.close()
    except Exception as e:
        print(f"Migration check: {e}")

@app.route('/')
def serve_frontend():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/api/health')
def health_check():
    return jsonify({"status": "healthy"})

def open_browser():
    webbrowser.open('http://localhost:8000')

if __name__ == '__main__':
    if getattr(sys, 'frozen', False):
        threading.Timer(1.5, open_browser).start()
    app.run(debug=False, host='0.0.0.0', port=8000)
