import React from 'react';

interface SidebarProps {
  view: 'day' | 'week' | 'month';
  onViewChange: (view: 'day' | 'week' | 'month') => void;
  currentDate: Date;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  calendars: Array<{ id: number; name: string; color: string }>;
  onCalendarToggle: (id: number) => void;
  activeCalendars: number[];
  isListening: boolean;
  voiceStatus?: 'idle' | 'connecting' | 'listening' | 'error';
  onVoiceToggle: () => void;
  isSupported: boolean;
  onQuickAction: (action: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  view,
  onViewChange,
  currentDate,
  onToday,
  onPrev,
  onNext,
  calendars,
  onCalendarToggle,
  activeCalendars,
  isListening,
  voiceStatus = 'idle',
  onVoiceToggle,
  isSupported,
  onQuickAction,
  isOpen = true,
  onClose
}) => {
  const monthNames = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ];

  const formatMonth = () => {
    return `${currentDate.getFullYear()}年 ${monthNames[currentDate.getMonth()]}`;
  };

  const quickCommands = [
    { icon: '+', text: '创建事件', action: 'create' },
    { icon: '✓', text: '添加任务', action: 'add_todo' },
    { icon: '?', text: '查看今天', action: 'today' },
    { icon: '📋', text: '查看任务', action: 'view_todos' },
    { icon: 'W', text: '查看本周', action: 'week' },
    { icon: 'M', text: '查看本月', action: 'month' },
    { icon: '⚙', text: '语音设置', action: 'settings' },
    { icon: '⇄', text: '设备同步', action: 'sync' },
  ];

  const handleAction = (action: string) => {
    onQuickAction(action);
    // Mobile: close sidebar after action
    if (window.innerWidth <= 768 && onClose) {
      onClose();
    }
  };

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'active' : ''}`}
        onClick={onClose}
      />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-section voice-section">
          <button
            className={`btn-voice-sidebar ${isListening ? 'listening pulse-animation' : ''} ${!isSupported ? 'disabled' : ''}`}
            onClick={onVoiceToggle}
            disabled={!isSupported}
            style={{
              background: isListening
                ? 'linear-gradient(135deg, #ff4d4f 0%, #ff7875 100%)'
                : 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)',
              transform: isListening ? 'scale(1.05)' : 'scale(1)',
              boxShadow: isListening
                ? '0 4px 20px rgba(255, 77, 79, 0.5)'
                : '0 2px 8px rgba(114, 46, 209, 0.3)'
            }}
          >
            <div className="voice-icon-wrapper">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
              {isListening && (
                <>
                  <div className="voice-ripple-container">
                    <span className="voice-ripple ripple-1"></span>
                    <span className="voice-ripple ripple-2"></span>
                    <span className="voice-ripple ripple-3"></span>
                  </div>
                  <div className="listening-dot"></div>
                </>
              )}
            </div>
            <span className="voice-text" style={{ fontWeight: isListening ? '700' : '500' }}>
              {!isSupported ? '❌ 不支持语音'
                : voiceStatus === 'connecting' ? '🟡 连接中...'
                : voiceStatus === 'listening' ? '🔴 正在录音...'
                : isListening ? '🔴 正在录音...'
                : '🎤 点击开始语音'}
            </span>
            {isListening && (
              <span className="voice-hint">说完后点击结束</span>
            )}
          </button>
        </div>

        <div className="sidebar-divider"></div>

        <div className="sidebar-section nav-section">
          <div className="month-nav">
            <button className="btn-nav-sidebar" onClick={onPrev}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M10.354 4.354a.5.5 0 00-.708-.708l-4 4a.5.5 0 000 .708l4 4a.5.5 0 00.708-.708L6.707 8l3.647-3.646z"/>
              </svg>
            </button>
            <span className="month-title">{formatMonth()}</span>
            <button className="btn-nav-sidebar" onClick={onNext}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5.646 4.354a.5.5 0 01.708-.708l4 4a.5.5 0 010 .708l-4 4a.5.5 0 01-.708-.708L9.293 8 5.646 4.354z"/>
              </svg>
            </button>
          </div>
          <button className="btn-today-sidebar" onClick={onToday}>
            今天
          </button>
        </div>

        <div className="sidebar-divider"></div>

        <div className="sidebar-section view-section">
          <h3 className="section-title">视图</h3>
          <div className="view-buttons">
            <button
              className={`btn-view-sidebar ${view === 'day' ? 'active' : ''}`}
              onClick={() => onViewChange('day')}
            >
              日
            </button>
            <button
              className={`btn-view-sidebar ${view === 'week' ? 'active' : ''}`}
              onClick={() => onViewChange('week')}
            >
              周
            </button>
            <button
              className={`btn-view-sidebar ${view === 'month' ? 'active' : ''}`}
              onClick={() => onViewChange('month')}
            >
              月
            </button>
          </div>
        </div>

        <div className="sidebar-divider"></div>

        <div className="sidebar-section commands-section">
          <h3 className="section-title">快捷指令</h3>
          <div className="quick-commands">
            {quickCommands.map((cmd, index) => (
              <button
                key={index}
                className="btn-quick-command"
                onClick={() => handleAction(cmd.action)}
              >
                <span className="cmd-icon">{cmd.icon}</span>
                <span className="cmd-text">{cmd.text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-divider"></div>

        <div className="sidebar-section calendars-section">
          <h3 className="section-title">日历</h3>
          <div className="calendar-list">
            {calendars.map(calendar => (
              <label key={calendar.id} className="calendar-item">
                <input
                  type="checkbox"
                  checked={activeCalendars.includes(calendar.id)}
                  onChange={() => onCalendarToggle(calendar.id)}
                />
                <span
                  className="calendar-color"
                  style={{ backgroundColor: calendar.color }}
                ></span>
                <span className="calendar-name">{calendar.name}</span>
              </label>
            ))}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
