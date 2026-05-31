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
  const isStartingRef = useRef(false);
  const hasPermissionRef = useRef(false);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  // 检查麦克风权限
  const checkMicrophonePermission = useCallback(async () => {
    try {
      console.log('Checking microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('✓ Microphone permission granted');
      stream.getTracks().forEach(track => track.stop());
      hasPermissionRef.current = true;
      return true;
    } catch (err) {
      console.error('✗ Microphone permission denied:', err);
      hasPermissionRef.current = false;
      return false;
    }
  }, []);

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
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('✓ Speech recognition onstart fired');
      setIsListening(true);
      isStartingRef.current = false;
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      console.log('✓ Speech recognition onresult fired:', event);
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
        console.log('Interim transcript:', interim);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error('✗ Speech recognition onerror:', event.error, event);
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
          break;
        default:
          setError(`语音识别错误: ${event.error}`);
      }
    };

    recognition.onend = () => {
      console.log('✓ Speech recognition onend fired');
      setIsListening(false);
      isStartingRef.current = false;
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;
    console.log('✓ Speech recognition object created');

    // 预检查麦克风权限
    checkMicrophonePermission();

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [isSupported, checkMicrophonePermission]);

  const startListening = useCallback(async () => {
    console.log('=== startListening called ===');
    console.log('isSupported:', isSupported);
    console.log('isStarting:', isStartingRef.current);
    console.log('recognition exists:', !!recognitionRef.current);

    if (!isSupported) {
      setError('您的浏览器不支持语音识别功能，请使用 Chrome/Edge 浏览器');
      return;
    }

    if (isStartingRef.current) {
      console.log('Already starting, skipping...');
      return;
    }

    // 检查麦克风权限
    if (!hasPermissionRef.current) {
      console.log('Need to check microphone permission first...');
      const hasPermission = await checkMicrophonePermission();
      if (!hasPermission) {
        setError('需要麦克风权限才能使用语音识别');
        return;
      }
    }

    if (recognitionRef.current) {
      console.log('Setting isStarting = true');
      isStartingRef.current = true;
      setTranscript('');
      setInterimTranscript('');
      setError(null);

      try {
        console.log('Calling recognition.start()...');
        recognitionRef.current.start();
        console.log('recognition.start() called successfully');
      } catch (err: any) {
        console.error('recognition.start() threw error:', err);
        isStartingRef.current = false;

        if (err.name === 'InvalidStateError') {
          console.log('InvalidStateError - trying to stop and restart...');
          try {
            recognitionRef.current.stop();
          } catch (stopErr) {
            console.error('stop() error:', stopErr);
          }
          setTimeout(() => {
            try {
              console.log('Retrying start()...');
              isStartingRef.current = true;
              recognitionRef.current.start();
            } catch (retryErr: any) {
              console.error('Retry start failed:', retryErr);
              isStartingRef.current = false;
              setError(`启动语音识别失败: ${retryErr.message || '未知错误'}`);
            }
          }, 300);
        } else {
          setError(`启动语音识别失败: ${err.message || '未知错误'}`);
        }
      }
    }
  }, [isSupported, checkMicrophonePermission]);

  const stopListening = useCallback(() => {
    console.log('=== stopListening called ===');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error('stop() error:', err);
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
