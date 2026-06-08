import React, { useState, useEffect } from 'react';

interface VoiceConfig {
  deepseekApiKey: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: VoiceConfig) => void;
  currentConfig: VoiceConfig;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentConfig
}) => {
  const [deepseekKey, setDeepseekKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDeepseekKey(currentConfig.deepseekApiKey);
    }
  }, [isOpen, currentConfig]);

  const handleSave = () => {
    onSave({
      deepseekApiKey: deepseekKey,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>语音设置</h2>
          <button className="btn-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
            </svg>
          </button>
        </div>

        <div className="settings-form">
          {/* Speech Recognition */}
          <div className="settings-info">
            <div className="info-text">
              <h3>语音识别</h3>
              <p>使用本地 Vosk 中文模型将语音转为文字。</p>
              <p>无需联网，不需要配置云端语音 API Key。</p>
            </div>
          </div>

          <div className="sidebar-divider" style={{ margin: '16px 0' }}></div>

          {/* LLM Parsing */}
          <div className="settings-info">
            <div className="info-text">
              <h3>智能语义解析（可选）</h3>
              <p>接入 DeepSeek 大模型，智能提取任务标题、时间、地点等。</p>
            </div>
          </div>

          <div className="form-group">
            <label>DeepSeek API Key（可选）</label>
            <div className="api-key-input">
              <input
                type={showKey ? 'text' : 'password'}
                value={deepseekKey}
                onChange={e => setDeepseekKey(e.target.value)}
                placeholder="sk-..."
              />
              <button className="btn-toggle-visibility" onClick={() => setShowKey(!showKey)}>
                {showKey ? '隐藏' : '显示'}
              </button>
            </div>
            <p className="form-hint">
              获取: <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer">platform.deepseek.com</a>
              （不填则使用本地解析）
            </p>
          </div>

          <div className="settings-note">
            <ul>
              <li>Vosk → 离线语音转文字</li>
              <li>DeepSeek → 语义解析，提取任务信息（可选，需要联网）</li>
            </ul>
          </div>

          <div className="form-actions">
            <button className="btn btn-secondary" onClick={onClose}>取消</button>
            <button className="btn btn-primary" onClick={handleSave}>保存</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
