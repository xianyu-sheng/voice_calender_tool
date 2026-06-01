import React from 'react';

interface VoiceFeedbackProps {
  isListening: boolean;
  transcript: string;
  feedback: string | null;
  error: string | null;
  isSpeaking?: boolean;
  status?: 'idle' | 'connecting' | 'listening' | 'error';
}

const VoiceFeedback: React.FC<VoiceFeedbackProps> = ({
  isListening,
  transcript,
  feedback,
  error,
  isSpeaking = false,
  status = 'idle'
}) => {
  // 什么都不显示
  if (!isListening && !feedback && !error && !isSpeaking) {
    return null;
  }

  return (
    <div className="voice-feedback">
      {/* 连接中状态 */}
      {status === 'connecting' && isListening && (
        <div className="voice-listening voice-connecting">
          <div className="voice-wave">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div className="voice-transcript voice-status-text">
            🔗 正在连接语音服务...
          </div>
        </div>
      )}

      {/* 正在聆听状态 */}
      {status === 'listening' && isListening && (
        <div className="voice-listening voice-active">
          <div className="voice-wave listening-active">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div className="voice-transcript">
            {transcript || '🎤 正在聆听，请说话...'}
          </div>
        </div>
      )}

      {/* 旧版兼容：isListening 但没有明确 status */}
      {isListening && status !== 'connecting' && status !== 'listening' && (
        <div className="voice-listening">
          <div className="voice-wave">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div className="voice-transcript">
            {transcript || '正在聆听...'}
          </div>
        </div>
      )}

      {/* 成功反馈消息 */}
      {feedback && !isListening && (
        <div className={`voice-message ${isSpeaking ? 'voice-speaking' : 'voice-success'}`}>
          {isSpeaking ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="speaking-icon">
              <path d="M8 3a.5.5 0 01.5.5v5a.5.5 0 01-1 0v-5A.5.5 0 018 3z"/>
              <path d="M10.5 8a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"/>
              <path d="M12 8a4 4 0 11-8 0 4 4 0 018 0zm-1 0a3 3 0 10-6 0 3 3 0 006 0z"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 16A8 8 0 108 0a8 8 0 000 16zm3.78-9.72a.75.75 0 00-1.06-1.06L7 8.94 5.28 7.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l4.25-4.25z"/>
            </svg>
          )}
          {feedback}
        </div>
      )}

      {/* 错误消息 */}
      {error && !isListening && (
        <div className="voice-message voice-error">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 16A8 8 0 108 0a8 8 0 000 16zM5.354 4.646a.5.5 0 10-.708.708L7.293 8l-2.647 2.646a.5.5 0 00.708.708L8 8.707l2.646 2.647a.5.5 0 00.708-.708L8.707 8l2.647-2.646a.5.5 0 00-.708-.708L8 7.293 5.354 4.646z"/>
          </svg>
          <span style={{ whiteSpace: 'pre-line' }}>{error}</span>
        </div>
      )}
    </div>
  );
};

export default VoiceFeedback;
