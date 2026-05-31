from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from app import db
from app.api import events_bp, calendars_bp, reminders_bp, todos_bp, voice_bp

# 加载 .env 文件中的环境变量
load_dotenv()

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])

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
