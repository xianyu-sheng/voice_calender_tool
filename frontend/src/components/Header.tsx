import React from 'react';

interface HeaderProps {
  onDateDoubleClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onDateDoubleClick }) => {
  return (
    <header className="header">
      <div className="header-left">
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
