import React from 'react';

const Header: React.FC = () => {
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
        <span className="header-date">{new Date().toLocaleDateString('zh-CN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      </div>
    </header>
  );
};

export default Header;
