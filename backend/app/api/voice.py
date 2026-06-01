import os
from flask import Blueprint, request, jsonify
from ..services.llm_service import parse_with_llm, is_complex_command
from ..services.stt_service import transcribe_audio

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
            'api_url': 'https://api.deepseek.com',
            'stt_engine': 'vosk (offline)',
        }
    })


@voice_bp.route('/api/voice/transcribe', methods=['POST'])
def transcribe():
    """接收音频文件，返回语音识别文本（使用 Vosk 离线引擎）"""
    if 'audio' not in request.files:
        return jsonify({
            'success': False,
            'error': '缺少音频文件（字段名: audio）'
        }), 400

    audio_file = request.files['audio']
    audio_data = audio_file.read()

    if len(audio_data) == 0:
        return jsonify({
            'success': False,
            'error': '音频文件为空'
        }), 400

    mime_type = audio_file.content_type or 'audio/webm'
    print(f"[Voice API] 收到音频: {len(audio_data)} bytes, MIME: {mime_type}")

    try:
        text = transcribe_audio(audio_data, mime_type)
    except FileNotFoundError as e:
        print(f"[Voice API] 模型文件错误: {e}")
        return jsonify({
            'success': False,
            'error': f'语音模型未找到: {str(e)}'
        }), 500
    except Exception as e:
        print(f"[Voice API] 转录异常: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': f'语音识别异常: {str(e)}'
        }), 500

    if text:
        return jsonify({
            'success': True,
            'data': {
                'text': text,
                'engine': 'vosk'
            }
        })
    else:
        return jsonify({
            'success': False,
            'error': '语音识别失败，请重试（确认麦克风工作正常且说出清晰的中文）'
        }), 500


@voice_bp.route('/api/voice/parse', methods=['POST'])
def parse_voice():
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'success': False, 'error': 'Missing text'}), 400

    text = data['text']
    use_llm = data.get('use_llm', True)

    effective_key = API_KEY or os.environ.get("DEEPSEEK_API_KEY", "")

    if use_llm and effective_key:  # 只要有 API key 就用 LLM，不做复杂度判断
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
