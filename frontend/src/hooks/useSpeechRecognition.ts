import { useState, useCallback, useRef, useEffect } from 'react';

export type SpeechStatus = 'idle' | 'connecting' | 'listening' | 'error';

interface SpeechRecognitionHook {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  status: SpeechStatus;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

// ============================================================
// 离线语音识别方案：
// 前端: getUserMedia + AudioContext → 录制 16kHz mono PCM → 编码为 WAV
// 后端: Vosk 离线引擎直接读取 WAV → 返回文本
// 无需任何云服务，无需 ffmpeg，完全离线运行
// ============================================================

function checkMediaSupport(): boolean {
  return typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia;
}

/**
 * 将 Float32 PCM 样本编码为 16-bit PCM WAV 格式
 */
function encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // WAV 文件头
  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = samples.length * 2;

  writeString(0, 'RIFF');                          // ChunkID
  view.setUint32(4, 36 + dataSize, true);           // ChunkSize
  writeString(8, 'WAVE');                           // Format
  writeString(12, 'fmt ');                          // Subchunk1ID
  view.setUint32(16, 16, true);                     // Subchunk1Size (PCM)
  view.setUint16(20, 1, true);                      // AudioFormat (PCM = 1)
  view.setUint16(22, numChannels, true);             // NumChannels
  view.setUint32(24, sampleRate, true);              // SampleRate
  view.setUint32(28, byteRate, true);                // ByteRate
  view.setUint16(32, blockAlign, true);              // BlockAlign
  view.setUint16(34, bitsPerSample, true);           // BitsPerSample
  writeString(36, 'data');                           // Subchunk2ID
  view.setUint32(40, dataSize, true);                // Subchunk2Size

  // PCM 数据 (Float32 → Int16)
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
    view.setInt16(offset, val, true);
    offset += 2;
  }

  return buffer;
}

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SpeechStatus>('idle');

  // 音频录制 refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const samplesRef = useRef<Float32Array[]>([]);
  const totalSamplesRef = useRef(0);
  const sampleRateRef = useRef(16000);
  const isRecordingRef = useRef(false);

  const isSupported = checkMediaSupport();

  // 清理
  useEffect(() => {
    return () => {
      cleanupAudio();
    };
  }, []);

  const cleanupAudio = () => {
    isRecordingRef.current = false;
    try { scriptNodeRef.current?.disconnect(); } catch (e) { /* ignore */ }
    try { sourceNodeRef.current?.disconnect(); } catch (e) { /* ignore */ }
    try { audioContextRef.current?.close(); } catch (e) { /* ignore */ }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
    }
    scriptNodeRef.current = null;
    sourceNodeRef.current = null;
    audioContextRef.current = null;
    mediaStreamRef.current = null;
    samplesRef.current = [];
    totalSamplesRef.current = 0;
  };

  const startListening = useCallback(async () => {
    console.log('=== startListening ===');
    setTranscript('');
    setInterimTranscript('');
    setError(null);

    if (!isSupported) {
      setError('您的浏览器不支持麦克风录音');
      setStatus('error');
      return;
    }

    // 清理之前的录制
    cleanupAudio();
    samplesRef.current = [];
    totalSamplesRef.current = 0;

    setStatus('connecting');

    try {
      // 1. 获取麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      mediaStreamRef.current = stream;

      // 2. 创建 AudioContext（采样率 16000）
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
      });
      audioContextRef.current = audioCtx;
      sampleRateRef.current = audioCtx.sampleRate;
      console.log(`AudioContext: sampleRate=${audioCtx.sampleRate}Hz`);

      // 3. 创建音频源
      const source = audioCtx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      // 4. 创建 ScriptProcessorNode 用于捕获原始 PCM 数据
      // bufferSize=4096 在 16kHz 下约 256ms 延迟
      const scriptNode = audioCtx.createScriptProcessor(4096, 1, 1);
      scriptNodeRef.current = scriptNode;

      scriptNode.onaudioprocess = (event) => {
        if (!isRecordingRef.current) return;
        const inputData = event.inputBuffer.getChannelData(0);
        // 复制样本数据（Float32Array）
        const copy = new Float32Array(inputData.length);
        copy.set(inputData);
        samplesRef.current.push(copy);
        totalSamplesRef.current += copy.length;

        // 每 1 秒更新一次 UI 显示录音时长
        const duration = totalSamplesRef.current / sampleRateRef.current;
        setInterimTranscript(`🎤 录音中... ${duration.toFixed(1)}秒`);
      };

      // 5. 连接节点
      source.connect(scriptNode);
      scriptNode.connect(audioCtx.destination); // 必须连接才能触发 onaudioprocess

      isRecordingRef.current = true;
      setIsListening(true);
      setStatus('listening');
      console.log('✓ 开始录音 (离线 WAV 模式)');

    } catch (err: any) {
      console.error('Start error:', err);
      setStatus('error');
      setIsListening(false);
      cleanupAudio();

      if (err.name === 'NotAllowedError') {
        setError('麦克风权限被拒绝。请在浏览器地址栏左侧点击锁图标 → 允许麦克风。');
      } else if (err.name === 'NotFoundError') {
        setError('未检测到麦克风设备');
      } else {
        setError(`无法访问麦克风: ${err.message}`);
      }
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    console.log('=== stopListening ===');
    console.log(`共录制 ${totalSamplesRef.current} 个样本, ${(totalSamplesRef.current / sampleRateRef.current).toFixed(1)} 秒`);

    isRecordingRef.current = false;
    setIsListening(false);

    // 停止音频捕获
    try { scriptNodeRef.current?.disconnect(); } catch (e) { /* ignore */ }
    try { sourceNodeRef.current?.disconnect(); } catch (e) { /* ignore */ }
    try { audioContextRef.current?.close(); } catch (e) { /* ignore */ }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
    }
    scriptNodeRef.current = null;
    sourceNodeRef.current = null;
    audioContextRef.current = null;
    mediaStreamRef.current = null;

    // 发送音频到后端识别
    if (samplesRef.current.length > 0 && totalSamplesRef.current > 0) {
      sendAudioForTranscription();
    } else {
      setInterimTranscript('');
      setStatus('idle');
      setError('没有录到声音，请检查麦克风');
    }
  }, []);

  const sendAudioForTranscription = async () => {
    setStatus('connecting');
    setInterimTranscript('正在识别语音...');

    try {
      // 合并所有样本数据
      const allSamples = new Float32Array(totalSamplesRef.current);
      let offset = 0;
      for (const chunk of samplesRef.current) {
        allSamples.set(chunk, offset);
        offset += chunk.length;
      }
      samplesRef.current = [];
      totalSamplesRef.current = 0;

      // 编码为 WAV
      const wavBuffer = encodeWAV(allSamples, sampleRateRef.current);
      const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

      console.log(`发送 WAV: ${wavBlob.size} bytes, ${allSamples.length} samples @ ${sampleRateRef.current}Hz`);

      // 发送到后端
      const formData = new FormData();
      formData.append('audio', wavBlob, 'recording.wav');

      const response = await fetch('http://localhost:8000/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.data?.text) {
        const text = data.data.text;
        console.log('✓ 识别结果:', text);
        setInterimTranscript('');
        setTranscript(text);
        setStatus('idle');
      } else {
        const errMsg = data.error || '语音识别失败';
        console.error('✗ 识别失败:', errMsg);
        setInterimTranscript('');
        setStatus('error');
        setError(errMsg);
      }
    } catch (err: any) {
      console.error('✗ 网络错误:', err);
      setInterimTranscript('');
      setStatus('error');
      setError('连接后端服务失败，请确认后端已启动 (端口 8000)');
    }
  };

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
  }, []);

  return {
    isListening,
    transcript,
    interimTranscript,
    error,
    isSupported,
    status,
    startListening,
    stopListening,
    resetTranscript
  };
}
