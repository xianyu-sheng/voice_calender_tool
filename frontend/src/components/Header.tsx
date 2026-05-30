import React from 'react';

interface HeaderProps {
  currentDate: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  view: 'day' | 'week' | 'month';
  onViewChange: (view: 'day' | 'week' | 'month') => void;
  onVoiceStart: () => void;
  isListening: boolean;
}

const Header: React.FC<HeaderProps> = ({
  currentDate,
  onPrev,
  onNext,
  onToday,
  view,
  onViewChange,
  onVoiceStart,
  isListening
}) => {
  const monthNames = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ];

  const formatTitle = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    return `${year}年 ${monthNames[month]}`;
  };

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <span className="logo-icon">📅</span>
          <span className="logo-text">语音日历</span>
        </div>
      </div>

      <div className="header-center">
        <button className="btn-nav btn-today" onClick={onToday}>
          今天
        </button>
        <div className="nav-arrows">
          <button className="btn-nav" onClick={onPrev}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"/>
            </svg>
          </button>
          <button className="btn-nav" onClick={onNext}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"/>
            </svg>
          </button>
        </div>
        <h1 className="header-title">{formatTitle()}</h1>
      </div>

      <div className="header-right">
        <div className="view-switcher">
          <button
            className={`btn-view ${view === 'day' ? 'active' : ''}`}
            onClick={() => onViewChange('day')}
          >
            日
          </button>
          <button
            className={`btn-view ${view === 'week' ? 'active' : ''}`}
            onClick={() => onViewChange('week')}
          >
            周
          </button>
          <button
            className={`btn-view ${view === 'month' ? 'active' : ''}`}
            onClick={() => onViewChange('month')}
          >
            月
          </button>
        </div>

        <button
          className={`btn-voice ${isListening ? 'listening' : ''}`}
          onClick={onVoiceStart}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10 3a1 1 0 00-1 1v4a1 1 0 002 0V4a1 1 0 00-1-1z"/>
            <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 110-12 6 6 0 010 12z"/>
            <path d="M10 14a4 4 0 100-8 4 4 0 000 8zm0-2a2 2 0 110-4 2 2 0 010 4z"/>
          </svg>
          {isListening ? '正在聆听...' : '语音输入'}
        </button>
      </div>
    </header>
  );
};

export default Header;
