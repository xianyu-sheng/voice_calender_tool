import React from 'react';

interface HeaderProps {
  onDateDoubleClick?: () => void;
  onMenuToggle?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onDateDoubleClick, onMenuToggle }) => {
  return (
    <header className="header">
      <div className="header-left">
        <button className="btn-mobile-menu" onClick={onMenuToggle}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12h18M3 6h18M3 18h18" />
          </svg>
        </button>
        <div className="logo">
          <span className="logo-icon">📅</span>
          <span className="logo-text">语音日历</span>
        </div>
      </div>
      <div className="header-center">
        <span className="header-subtitle">智能日程管理</span>
      </div>
      <div className="header-right">
        <span
          className="header-date clickable"
          onDoubleClick={onDateDoubleClick}
          title="双击返回月视图"
        >
          {new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
      </div>
    </header>
  );
};

export default Header;
