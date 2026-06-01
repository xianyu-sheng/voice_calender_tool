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

// 检测浏览器实际是否支持语音识别
function checkSpeechSupport(): boolean {
  return typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
}

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const recognitionRef = useRef<any>(null);
  const startTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSupported = checkSpeechSupport();

  // 清理定时器
  useEffect(() => {
    return () => {
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current);
      }
    };
  }, []);

  const startListening = useCallback(() => {
    console.log('=== startListening called ===');

    if (!isSupported) {
      const msg = '您的浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器';
      setError(msg);
      setStatus('error');
      return;
    }

    // 清理之前的识别实例
    if (recognitionRef.current) {
      console.log('Aborting previous recognition...');
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }

    // 清理之前的超时
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = null;
    }

    // 立即设置状态，给用户视觉反馈
    setIsListening(true);
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    setStatus('connecting');  // 连接中状态

    console.log('Creating new SpeechRecognition instance...');
    const SpeechRecognition = (window as any).SpeechRecognition ||
                              (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let hasStarted = false;
    let hasTimedOut = false;  // 追踪是否已超时，避免 onend 覆盖 error 状态

    // ⏱ 超时检测：如果 6 秒内 onstart 没有触发，说明语音服务不可达
    startTimeoutRef.current = setTimeout(() => {
      if (!hasStarted) {
        console.error('✗ Speech recognition start TIMEOUT — service unreachable');
        hasTimedOut = true;
        setStatus('error');
        setIsListening(false);
        setError(
          '语音服务连接超时。\n' +
          '可能原因：① 网络无法访问 Google 语音服务（国内用户需使用 VPN 或 Edge 浏览器）；' +
          '② 麦克风被其他应用占用。\n' +
          '💡 建议：使用 Microsoft Edge 浏览器（使用 Azure 语音服务，国内可访问）'
        );
        try {
          recognition.abort();
        } catch (e) {
          // ignore
        }
        recognitionRef.current = null;
      }
    }, 6000);

    recognition.onstart = () => {
      console.log('✓ onstart fired — speech service connected');
      hasStarted = true;
      setStatus('listening');  // 切换为正在聆听状态

      // 清除超时
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }
    };

    recognition.onaudiostart = () => {
      console.log('✓ onaudiostart — capturing audio');
    };

    recognition.onspeechstart = () => {
      console.log('✓ onspeechstart — speech detected');
    };

    recognition.onresult = (event: any) => {
      console.log('✓ onresult fired, results:', event.results.length);
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        console.log('✓ Final transcript:', final);
        setTranscript(prev => prev + final);
        setInterimTranscript('');
        setStatus('idle');  // 拿到最终结果，回到空闲
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('✗ onerror:', event.error, event.message);

      // 清除超时
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }

      setIsListening(false);
      setStatus('error');
      recognitionRef.current = null;

      // 不把 abort 和 no-speech 当错误
      if (event.error === 'aborted') {
        console.log('Recognition aborted (normal)');
        return;
      }
      if (event.error === 'no-speech') {
        setError('未检测到语音，请再试一次');
        return;
      }

      // 网络错误 — 最常见的国内用户问题
      if (event.error === 'network') {
        setError(
          '语音识别网络错误。Google 语音服务在国内可能无法访问。\n' +
          '💡 请尝试：① 使用 Microsoft Edge 浏览器；② 检查网络连接；③ 使用 VPN'
        );
      } else if (event.error === 'not-allowed') {
        setError('麦克风权限未授予，请在浏览器设置中允许麦克风访问');
      } else if (event.error === 'audio-capture') {
        setError('无法访问麦克风，请检查麦克风是否被其他应用占用');
      } else {
        setError(`语音识别错误: ${event.error}${event.message ? ' — ' + event.message : ''}`);
      }
    };

    recognition.onend = () => {
      console.log('✓ onend fired');

      // 清除超时
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }

      setIsListening(false);
      recognitionRef.current = null;
      setInterimTranscript('');

      // 超时时不覆盖 error 状态
      if (hasTimedOut) {
        return;
      }

      // 正常结束：回到 idle
      setStatus('idle');
    };

    recognitionRef.current = recognition;

    try {
      console.log('Calling recognition.start()...');
      recognition.start();
      console.log('recognition.start() called successfully');
    } catch (err: any) {
      console.error('start() exception:', err);
      setIsListening(false);
      recognitionRef.current = null;
      setStatus('error');

      // 清除超时
      if (startTimeoutRef.current) {
        clearTimeout(startTimeoutRef.current);
        startTimeoutRef.current = null;
      }

      if (err.name === 'NotAllowedError' || err.message?.includes('not allowed')) {
        setError('麦克风权限被拒绝。请在浏览器地址栏左侧点击锁图标，允许麦克风访问。');
      } else {
        setError(`启动语音识别失败: ${err.message}`);
      }
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    console.log('=== stopListening called ===');

    // 清除启动超时
    if (startTimeoutRef.current) {
      clearTimeout(startTimeoutRef.current);
      startTimeoutRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        console.log('recognition.stop() called');
      } catch (e) {
        console.error('stop() error:', e);
      }
    } else {
      // 没有活跃的识别实例，直接重置状态
      setIsListening(false);
      setStatus('idle');
      setInterimTranscript('');
    }
    // 注意：不在这里设置 setIsListening(false)
    // 让 onend 回调来处理状态更新
  }, []);

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
