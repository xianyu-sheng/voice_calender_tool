from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from app import db
from app.api import events_bp, calendars_bp, reminders_bp, todos_bp, voice_bp, weather_bp, sync_bp, backup_bp, desktop_bp, assistant_bp

# 加载 .env 文件中的环境变量
load_dotenv()

app = Flask(__name__)
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///calendar.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)

app.register_blueprint(events_bp)
app.register_blueprint(calendars_bp)
app.register_blueprint(reminders_bp)
app.register_blueprint(todos_bp)
app.register_blueprint(voice_bp)
app.register_blueprint(weather_bp)
app.register_blueprint(sync_bp)
app.register_blueprint(backup_bp)
app.register_blueprint(desktop_bp)
app.register_blueprint(assistant_bp)

with app.app_context():
    db.create_all()
    # 确保 events 表有 progress 列
    try:
        from sqlalchemy import text
        result = db.session.execute(text("PRAGMA table_info(events)"))
        columns = [row[1] for row in result]
        if 'progress' not in columns:
            db.session.execute(text("ALTER TABLE events ADD COLUMN progress INTEGER DEFAULT 0"))
            db.session.commit()
            print("Migration: added progress column to events table")
        else:
            print("Migration: progress column already exists")
    except Exception as e:
        print(f"Migration check: {e}")
        db.session.rollback()

@app.route('/')
def root():
    return jsonify({
        "message": "Voice Calendar Tool API",
        "version": "0.1.0"
    })

@app.route('/api/health')
def health_check():
    return jsonify({"status": "healthy"})

@app.route('/api/test')
def test_endpoint():
    return jsonify({
        "success": True,
        "data": {
            "events": [],
            "message": "API连接正常"
        }
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)
