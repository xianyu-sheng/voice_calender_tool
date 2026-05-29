from flask import Flask, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///calendar.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

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
