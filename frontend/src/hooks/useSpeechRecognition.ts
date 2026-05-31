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
  const isListeningRef = useRef(false);

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
    recognition.continuous = false;  // 单次识别，识别完成自动结束
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('Speech recognition started');
      setIsListening(true);
      isListeningRef.current = true;
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
        console.log('Final transcript:', final);
        setTranscript(prev => prev + final);
        setInterimTranscript('');
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('Speech recognition error:', event.error);
      setError(event.error);
      setIsListening(false);
      isListeningRef.current = false;

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
        default:
          setError(`语音识别错误: ${event.error}`);
      }
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      setIsListening(false);
      isListeningRef.current = false;
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;
    console.log('Speech recognition initialized');

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [isSupported]);

  const startListening = useCallback(() => {
    console.log('startListening called, isSupported:', isSupported, 'isListening:', isListeningRef.current);

    if (!isSupported) {
      setError('您的浏览器不支持语音识别功能，请使用 Chrome/Edge 浏览器');
      return;
    }

    if (recognitionRef.current && !isListeningRef.current) {
      console.log('Starting speech recognition...');
      setTranscript('');
      setInterimTranscript('');
      setError(null);

      try {
        recognitionRef.current.start();
      } catch (err: any) {
        console.error('Speech recognition start error:', err);
        if (err.name === 'InvalidStateError') {
          // 如果已经在运行，先停止再重启
          console.log('Recognition already running, stopping first...');
          recognitionRef.current.stop();
          setTimeout(() => {
            try {
              recognitionRef.current.start();
            } catch (retryErr: any) {
              setError(`启动语音识别失败: ${retryErr.message || '未知错误'}`);
            }
          }, 100);
        } else {
          setError(`启动语音识别失败: ${err.message || '未知错误'}`);
        }
      }
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    console.log('stopListening called, isListening:', isListeningRef.current);
    if (recognitionRef.current && isListeningRef.current) {
      recognitionRef.current.stop();
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
