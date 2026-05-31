import { useState, useCallback, useRef } from 'react';

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

export function useSpeechRecognition(): SpeechRecognitionHook {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const isSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = useCallback(() => {
    console.log('=== startListening called ===');

    if (!isSupported) {
      setError('您的浏览器不支持语音识别，请使用 Chrome/Edge');
      return;
    }

    // 如果已经在运行，停止它
    if (recognitionRef.current) {
      console.log('Stopping existing recognition...');
      try {
        recognitionRef.current.abort();
      } catch (e) {
        // ignore
      }
      recognitionRef.current = null;
    }

    // 立即设置状态，给用户视觉反馈
    setIsListening(true);
    setTranscript('');
    setInterimTranscript('');
    setError(null);

    console.log('Creating new SpeechRecognition instance...');
    const SpeechRecognition = (window as any).SpeechRecognition ||
                              (window as any).webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log('✓ onstart fired');
    };

    recognition.onresult = (event: any) => {
      console.log('✓ onresult fired');
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
        console.log('✓ Final:', final);
        setTranscript(prev => prev + final);
        setInterimTranscript('');
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('✗ onerror:', event.error);
      setIsListening(false);
      recognitionRef.current = null;

      if (event.error !== 'aborted' && event.error !== 'no-speech') {
        setError(`语音识别错误: ${event.error}`);
      }
    };

    recognition.onend = () => {
      console.log('✓ onend fired');
      setIsListening(false);
      recognitionRef.current = null;
      setInterimTranscript('');
    };

    recognitionRef.current = recognition;

    try {
      console.log('Calling start()...');
      recognition.start();
      console.log('start() called successfully');
    } catch (err: any) {
      console.error('start() error:', err);
      setIsListening(false);
      recognitionRef.current = null;
      setError(`启动失败: ${err.message}`);
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    console.log('=== stopListening called ===');
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    setIsListening(false);
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
