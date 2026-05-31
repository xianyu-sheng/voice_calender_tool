import React, { useState, useEffect } from 'react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string) => void;
  currentApiKey: string;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentApiKey
}) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setApiKey(currentApiKey);
    }
  }, [isOpen, currentApiKey]);

  const handleSave = () => {
    onSave(apiKey);
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
          <div className="settings-info">
            <div className="info-icon">🤖</div>
            <div className="info-text">
              <h3>智能语音解析</h3>
              <p>接入 DeepSeek 大模型，支持更自然的语音指令理解。</p>
              <p>例如：帮我安排下周三和产品组的评审会议，需要准备PPT</p>
            </div>
          </div>

          <div className="form-group">
            <label>DeepSeek API Key</label>
            <div className="api-key-input">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <button
                className="btn-toggle-visibility"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? '🙈' : '👁️'}
              </button>
            </div>
            <p className="form-hint">
              获取 API Key: <a href="https://platform.deepseek.com" target="_blank" rel="noopener noreferrer">platform.deepseek.com</a>
            </p>
          </div>

          <div className="settings-note">
            <p><strong>混合解析模式：</strong></p>
            <ul>
              <li>简单指令（如"创建事件：开会"）→ 本地正则解析（快速）</li>
              <li>复杂指令（如"帮我安排..."）→ 大模型解析（准确）</li>
              <li>不填 API Key 也可正常使用基础语音功能</li>
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
