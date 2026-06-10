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
from app.api import events_bp, calendars_bp, reminders_bp, todos_bp, voice_bp, weather_bp

app = Flask(__name__, static_folder=os.path.join(base_path, 'frontend', 'dist'))
CORS(app)

# 使用绝对路径确保数据库始终在同一位置
db_dir = os.path.join(os.path.dirname(os.path.abspath(sys.argv[0])) if getattr(sys, 'frozen', False) else base_path, 'instance')
os.makedirs(db_dir, exist_ok=True)
db_path = os.path.join(db_dir, 'calendar.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

app.register_blueprint(events_bp)
app.register_blueprint(calendars_bp)
app.register_blueprint(reminders_bp)
app.register_blueprint(todos_bp)
app.register_blueprint(voice_bp)
app.register_blueprint(weather_bp)

with app.app_context():
    try:
        db.create_all()
        print(f"DB path: {db_path}")
        print(f"DB exists: {os.path.exists(db_path)}")
        # 确保 events 表有 progress 列
        from sqlalchemy import text
        result = db.session.execute(text("PRAGMA table_info(events)"))
        columns = [row[1] for row in result]
        print(f"Events columns: {columns}")
        if 'progress' not in columns:
            db.session.execute(text("ALTER TABLE events ADD COLUMN progress INTEGER DEFAULT 0"))
            db.session.commit()
            print("Migration: added progress column")
        else:
            print("Migration: progress column exists")
        # 测试查询
        from app.models import Event
        count = Event.query.count()
        print(f"Events count: {count}")
    except Exception as e:
        print(f"DB init error: {e}")
        import traceback
        traceback.print_exc()
        db.session.rollback()

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
