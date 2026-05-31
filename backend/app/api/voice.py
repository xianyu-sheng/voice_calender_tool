import os
from flask import Blueprint, request, jsonify
from ..services.llm_service import parse_with_llm, is_complex_command

voice_bp = Blueprint('voice', __name__)

API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")


@voice_bp.route('/api/voice/config', methods=['POST'])
def config_api_key():
    global API_KEY
    data = request.get_json()
    if data and 'api_key' in data:
        API_KEY = data['api_key']
        return jsonify({'success': True, 'message': 'API key configured'})
    return jsonify({'success': False, 'error': 'Missing api_key'}), 400


@voice_bp.route('/api/voice/config', methods=['GET'])
def get_config():
    return jsonify({
        'success': True,
        'data': {
            'has_api_key': bool(API_KEY),
            'api_url': 'https://api.deepseek.com'
        }
    })


@voice_bp.route('/api/voice/parse', methods=['POST'])
def parse_voice():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'success': False, 'error': 'Missing text'}), 400

    text = data['text']
    use_llm = data.get('use_llm', True)

    effective_key = API_KEY or os.environ.get("DEEPSEEK_API_KEY", "")

    if use_llm and effective_key and is_complex_command(text):
        result = parse_with_llm(text, effective_key)
        if result:
            result['source'] = 'llm'
            return jsonify({'success': True, 'data': result})

    return jsonify({
        'success': True,
        'data': {
            'source': 'regex',
            'use_frontend_parser': True
        }
    })
