import React, { useState } from 'react';

interface SidebarProps {
  currentDate: Date;
  onDateSelect: (date: Date) => void;
  calendars: Array<{ id: number; name: string; color: string }>;
  onCalendarToggle: (id: number) => void;
  activeCalendars: number[];
}

const Sidebar: React.FC<SidebarProps> = ({
  currentDate,
  onDateSelect,
  calendars,
  onCalendarToggle,
  activeCalendars
}) => {
  const [miniCalendarDate, setMiniCalendarDate] = useState(new Date());

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const renderMiniCalendar = () => {
    const daysInMonth = getDaysInMonth(miniCalendarDate);
    const firstDay = getFirstDayOfMonth(miniCalendarDate);
    const days = [];
    const today = new Date();
    const selectedDate = currentDate;

    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="mini-day empty"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(miniCalendarDate.getFullYear(), miniCalendarDate.getMonth(), day);
      const isToday = date.toDateString() === today.toDateString();
      const isSelected = date.toDateString() === selectedDate.toDateString();
      const isCurrentMonth = date.getMonth() === miniCalendarDate.getMonth();

      days.push(
        <div
          key={day}
          className={`mini-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${!isCurrentMonth ? 'other-month' : ''}`}
          onClick={() => onDateSelect(date)}
        >
          {day}
        </div>
      );
    }

    return days;
  };

  const handlePrevMonth = () => {
    setMiniCalendarDate(new Date(miniCalendarDate.getFullYear(), miniCalendarDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setMiniCalendarDate(new Date(miniCalendarDate.getFullYear(), miniCalendarDate.getMonth() + 1, 1));
  };

  const monthNames = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-section mini-calendar-section">
        <div className="mini-calendar-header">
          <button className="btn-mini-nav" onClick={handlePrevMonth}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10.354 4.354a.5.5 0 00-.708-.708l-4 4a.5.5 0 000 .708l4 4a.5.5 0 00.708-.708L6.707 8l3.647-3.646z"/>
            </svg>
          </button>
          <span className="mini-calendar-title">
            {miniCalendarDate.getFullYear()}年 {monthNames[miniCalendarDate.getMonth()]}
          </span>
          <button className="btn-mini-nav" onClick={handleNextMonth}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.646 4.354a.5.5 0 01.708-.708l4 4a.5.5 0 010 .708l-4 4a.5.5 0 01-.708-.708L9.293 8 5.646 4.354z"/>
            </svg>
          </button>
        </div>
        <div className="mini-calendar-weekdays">
          <span>日</span>
          <span>一</span>
          <span>二</span>
          <span>三</span>
          <span>四</span>
          <span>五</span>
          <span>六</span>
        </div>
        <div className="mini-calendar-days">
          {renderMiniCalendar()}
        </div>
      </div>

      <div className="sidebar-divider"></div>

      <div className="sidebar-section calendars-section">
        <h3 className="section-title">我的日历</h3>
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

      <div className="sidebar-divider"></div>

      <div className="sidebar-section voice-hints-section">
        <h3 className="section-title">语音指令示例</h3>
        <div className="voice-hints">
          <div className="voice-hint">
            <span className="hint-icon">🎤</span>
            <span className="hint-text">"创建明天下午3点的会议"</span>
          </div>
          <div className="voice-hint">
            <span className="hint-icon">🎤</span>
            <span className="hint-text">"查看今天的安排"</span>
          </div>
          <div className="voice-hint">
            <span className="hint-icon">🎤</span>
            <span className="hint-text">"删除下周三的会议"</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
