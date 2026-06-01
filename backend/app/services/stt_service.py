"""
离线语音识别服务 — 基于 Vosk
接收 WAV 格式音频 (16kHz, 16bit, mono)，返回识别文本
完全离线运行，无需网络连接
"""
import os
import sys
import json
import wave
import shutil
import tempfile
from typing import Optional

# 模型路径：兼容普通 Python 运行和 PyInstaller 打包两种场景
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))  # backend/app/services/

if getattr(sys, 'frozen', False):
    # PyInstaller 打包：模型在 _MEIPASS/vosk-model/ 下（路径为 ASCII）
    _MEIPASS = sys._MEIPASS
    MODEL_PATHS = [
        os.path.join(_MEIPASS, 'vosk-model', 'vosk-model-small-cn-0.22'),
        os.path.join(_MEIPASS, 'backend', 'vosk-model', 'vosk-model-small-cn-0.22'),
    ]
else:
    # 普通 Python 运行：模型在 backend/vosk-model/ 下
    MODEL_PATHS = [
        os.path.join(_BASE_DIR, '..', '..', 'vosk-model', 'vosk-model-small-cn-0.22'),
    ]

_vosk_model = None
_model_ascii_path = None  # 复制到 ASCII 路径后的目录


def _is_ascii(s: str) -> bool:
    """检查字符串是否全为 ASCII 字符"""
    try:
        s.encode('ascii')
        return True
    except UnicodeEncodeError:
        return False


def _find_model() -> str:
    """查找 Vosk 模型目录，若路径含中文则复制到临时目录"""
    global _model_ascii_path

    # 先找原始模型路径
    original = None
    for p in MODEL_PATHS:
        resolved = os.path.normpath(p)
        if os.path.exists(resolved) and os.path.isdir(resolved):
            original = resolved
            break

    if original is None:
        searched = "\n".join(f"  - {os.path.normpath(p)}" for p in MODEL_PATHS)
        raise FileNotFoundError(f"Vosk 模型未找到，已搜索:\n{searched}")

    # 如果路径全是 ASCII，直接使用
    if _is_ascii(original):
        return original

    # 路径含中文 → 复制到临时目录（Vosk C 库不支持非 ASCII 路径）
    dest = os.path.join(tempfile.gettempdir(), 'vosk_model_cache', 'vosk-model-small-cn-0.22')

    if not os.path.exists(dest):
        print(f"[STT] 路径含中文，复制模型到 ASCII 目录: {dest}")
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copytree(original, dest)
        print("[STT] 模型复制完成")

    _model_ascii_path = dest
    return dest


def get_model():
    """延迟加载 Vosk 模型（首次使用时加载，约需 2-5 秒）"""
    global _vosk_model
    if _vosk_model is None:
        import vosk
        model_path = _find_model()
        print(f"[STT] 正在加载 Vosk 中文模型...")
        _vosk_model = vosk.Model(model_path)
        print("[STT] Vosk model loaded successfully")
    return _vosk_model


def transcribe_audio(audio_data: bytes, mime_type: str = 'audio/wav') -> Optional[str]:
    """
    将 WAV 音频转录为文本
    audio_data: WAV 格式音频字节 (16kHz, 16bit, mono PCM)
    mime_type: 音频 MIME 类型
    返回: 转录文本，失败返回 None
    """
    import vosk

    wav_path = None
    try:
        model = get_model()
        # 写入临时 WAV 文件
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            tmp.write(audio_data)
            wav_path = tmp.name

        if os.path.getsize(wav_path) == 0:
            print("[STT] 音频文件为空")
            return None

        # 验证 WAV 格式
        try:
            wf = wave.open(wav_path, 'rb')
            channels = wf.getnchannels()
            sampwidth = wf.getsampwidth()
            framerate = wf.getframerate()
            nframes = wf.getnframes()
            duration = nframes / max(framerate, 1)
            print(f"[STT] 音频: {framerate}Hz, {channels}ch, {sampwidth*8}bit, {duration:.1f}s, {nframes} frames")

            if nframes == 0 or duration < 0.3:
                print("[STT] 音频太短")
                wf.close()
                return None

            recognizer = vosk.KaldiRecognizer(model, framerate)
            recognizer.SetWords(False)

            results = []
            while True:
                data = wf.readframes(4000)
                if len(data) == 0:
                    break
                if recognizer.AcceptWaveform(data):
                    result = json.loads(recognizer.Result())
                    text = result.get('text', '').strip()
                    if text:
                        results.append(text)

            # 获取最后部分
            final = json.loads(recognizer.FinalResult())
            text = final.get('text', '').strip()
            if text:
                results.append(text)

            wf.close()

            full_text = ' '.join(results).strip()
            if full_text:
                print(f"[STT] Recognized: {full_text}")
                return full_text
            else:
                print("[STT] 未识别到内容")
                return None

        except wave.Error as e:
            print(f"[STT] 无效的 WAV 文件: {e}")
            return None

    except Exception as e:
        print(f"[STT] 转录错误: {e}")
        import traceback
        traceback.print_exc()
        return None
    finally:
        if wav_path and os.path.exists(wav_path):
            try:
                os.unlink(wav_path)
            except Exception:
                pass
