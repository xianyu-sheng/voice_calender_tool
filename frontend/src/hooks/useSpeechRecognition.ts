import { useState, useEffect, useCallback, useRef } from 'react';

interface SpeechRecognitionHook {
  isListening: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  resetTranscript: () => void;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const isStartingRef = useRef(false);  // 防止重复启动

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    if (!isSupported) {
      console.log('Speech recognition not supported');
      return;
    }

    console.log('Initializing speech recognition...');
    const SpeechRecognition = (window as any).SpeechRecognition ||
                              (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();

    recognition.lang = 'zh-CN';
    recognition.continuous = false;  // 单次识别
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('✓ Speech recognition started');
      setIsListening(true);
      isStartingRef.current = false;
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      console.log('Speech recognition result:', event);
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
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('✗ Speech recognition error:', event.error);
      setIsListening(false);
      isStartingRef.current = false;

      switch (event.error) {
        case 'no-speech':
          setError('未检测到语音，请重试');
          break;
        case 'audio-capture':
          setError('无法访问麦克风，请检查权限');
          break;
        case 'not-allowed':
          setError('麦克风权限被拒绝，请在浏览器设置中允许');
          break;
        case 'network':
          setError('网络错误，请检查网络连接');
          break;
        case 'aborted':
          // 用户主动取消，不显示错误
          break;
        default:
          setError(`语音识别错误: ${event.error}`);
      }
    };

    recognition.onend = () => {
      console.log('✓ Speech recognition ended');
      setIsListening(false);
      isStartingRef.current = false;
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;
    console.log('✓ Speech recognition initialized');

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [isSupported]);

  const startListening = useCallback(() => {
    console.log('startListening called, isSupported:', isSupported, 'isStarting:', isStartingRef.current);

    if (!isSupported) {
      setError('您的浏览器不支持语音识别功能，请使用 Chrome/Edge 浏览器');
      return;
    }

    // 防止重复启动
    if (isStartingRef.current) {
      console.log('Already starting, skipping...');
      return;
    }

    if (recognitionRef.current) {
      console.log('Starting speech recognition...');
      isStartingRef.current = true;
      setTranscript('');
      setInterimTranscript('');
      setError(null);

      try {
        recognitionRef.current.start();
      } catch (err: any) {
        console.error('Speech recognition start error:', err);
        isStartingRef.current = false;

        if (err.name === 'InvalidStateError') {
          // 如果已经在运行，先停止再重启
          console.log('Recognition already running, stopping first...');
          try {
            recognitionRef.current.stop();
          } catch (stopErr) {
            // ignore
          }
          // 等待 onend 回调后再重启
          setTimeout(() => {
            try {
              if (recognitionRef.current) {
                isStartingRef.current = true;
                recognitionRef.current.start();
              }
            } catch (retryErr: any) {
              console.error('Retry start failed:', retryErr);
              isStartingRef.current = false;
              setError(`启动语音识别失败: ${retryErr.message || '未知错误'}`);
            }
          }, 200);
        } else {
          setError(`启动语音识别失败: ${err.message || '未知错误'}`);
        }
      }
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    console.log('stopListening called');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        // ignore
      }
    }
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
    startListening,
    stopListening,
    resetTranscript
  };
}
