"""
语音识别服务 — 使用百度语音识别 API
纯 HTTP REST 接口，无需任何本地 C++ 库
免费额度: 50,000次/天，中文识别精度极高
"""
import os
import sys
import json
import base64
import requests
import tempfile
import wave
from typing import Optional

# 百度 API 配置
BAIDU_TOKEN_URL = "https://aip.baidubce.com/oauth/2.0/token"
BAIDU_STT_URL = "https://vop.baidu.com/server_api"

# API 凭据（可通过 settings 设置）
BAIDU_API_KEY = ""
BAIDU_SECRET_KEY = ""

_access_token = None
_token_expires = 0


def get_access_token() -> Optional[str]:
    """获取百度 API access token（自动缓存和刷新）"""
    global _access_token, _token_expires
    import time

    if _access_token and time.time() < _token_expires - 60:
        return _access_token

    key = BAIDU_API_KEY or os.environ.get("BAIDU_STT_API_KEY", "")
    secret = BAIDU_SECRET_KEY or os.environ.get("BAIDU_STT_SECRET_KEY", "")

    if not key or not secret:
        print("[STT] Baidu API key not configured")
        return None

    try:
        resp = requests.post(
            BAIDU_TOKEN_URL,
            params={
                "grant_type": "client_credentials",
                "client_id": key,
                "client_secret": secret
            },
            timeout=10
        )
        data = resp.json()
        _access_token = data.get("access_token")
        expires_in = data.get("expires_in", 86400)
        _token_expires = time.time() + expires_in
        print(f"[STT] Baidu token obtained, expires in {expires_in}s")
        return _access_token
    except Exception as e:
        print(f"[STT] Failed to get Baidu token: {e}")
        return None


def transcribe_audio(audio_data: bytes, mime_type: str = 'audio/wav') -> Optional[str]:
    """使用百度语音识别 API 将音频转录为文本"""
    token = get_access_token()
    if not token:
        print("[STT] No Baidu token available — STT unavailable")
        return None

    # 验证和准备音频
    wav_path = None
    try:
        # 写入临时 WAV 文件，检查音频有效性
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            tmp.write(audio_data)
            wav_path = tmp.name

        if os.path.getsize(wav_path) < 100:
            print("[STT] Audio file too small")
            return None

        # 检查 WAV 格式
        try:
            wf = wave.open(wav_path, 'rb')
            framerate = wf.getframerate()
            nframes = wf.getnframes()
            channels = wf.getnchannels()
            duration = nframes / max(framerate, 1)
            wf.close()
            print(f"[STT] Audio: {framerate}Hz, {channels}ch, {duration:.1f}s [{nframes} frames]")

            if duration < 0.3:
                print("[STT] Audio too short")
                return None
            if duration > 60:
                print("[STT] Audio too long (>60s), truncating not supported")
                # 百度免费版限制 60 秒
        except wave.Error as e:
            print(f"[STT] Invalid WAV: {e}")
            return None

        # 读取音频并 Base64 编码
        with open(wav_path, 'rb') as f:
            audio_b64 = base64.b64encode(f.read()).decode('utf-8')

        # 调用百度语音识别 API
        payload = {
            "format": "pcm",
            "rate": framerate,
            "channel": channels,
            "cuid": "voice_calendar_tool",
            "token": token,
            "speech": audio_b64,
            "len": os.path.getsize(wav_path),
            "dev_pid": 1537,  # 普通话(纯中文识别)
        }

        print(f"[STT] Calling Baidu STT API (audio: {os.path.getsize(wav_path)} bytes)...")
        resp = requests.post(BAIDU_STT_URL, json=payload, timeout=30)
        result = resp.json()

        if result.get("err_no") == 0:
            text = ' '.join(result.get("result", []))
            print(f"[STT] Recognized: {text}")
            return text
        else:
            err_msg = result.get("err_msg", "Unknown error")
            err_no = result.get("err_no", -1)
            print(f"[STT] Baidu API error: [{err_no}] {err_msg}")
            return None

    except Exception as e:
        print(f"[STT] Error: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        if wav_path and os.path.exists(wav_path):
            try:
                os.unlink(wav_path)
            except Exception:
                pass
