import React from 'react';

interface Event {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  color?: string;
}

interface MonthViewProps {
  currentDate: Date;
  events: Event[];
  onDateClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
}

const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  events,
  onDateClick,
  onEventClick
}) => {
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.start_time);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];
    const today = new Date();

    const prevMonthDays = getDaysInMonth(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, day);
      days.push(
        <div key={`prev-${day}`} className="calendar-day other-month" onClick={() => onDateClick(date)}>
          <span className="day-number">{day}</span>
        </div>
      );
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      const isToday = date.toDateString() === today.toDateString();
      const dayEvents = getEventsForDate(date);

      days.push(
        <div
          key={day}
          className={`calendar-day ${isToday ? 'today' : ''}`}
          onClick={() => onDateClick(date)}
        >
          <span className={`day-number ${isToday ? 'today-number' : ''}`}>
            {day}
          </span>
          <div className="day-events">
            {dayEvents.slice(0, 3).map(event => (
              <div
                key={event.id}
                className="event-item"
                style={{ backgroundColor: event.color || '#1890ff' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onEventClick(event);
                }}
              >
                <span className="event-time">
                  {new Date(event.start_time).getHours().toString().padStart(2, '0')}:
                  {new Date(event.start_time).getMinutes().toString().padStart(2, '0')}
                </span>
                <span className="event-title">{event.title}</span>
              </div>
            ))}
            {dayEvents.length > 3 && (
              <div className="event-more">+{dayEvents.length - 3} 更多</div>
            )}
          </div>
        </div>
      );
    }

    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, day);
      days.push(
        <div key={`next-${day}`} className="calendar-day other-month" onClick={() => onDateClick(date)}>
          <span className="day-number">{day}</span>
        </div>
      );
    }

    return days;
  };

  return (
    <div className="month-view">
      <div className="weekday-header">
        <div className="weekday">周日</div>
        <div className="weekday">周一</div>
        <div className="weekday">周二</div>
        <div className="weekday">周三</div>
        <div className="weekday">周四</div>
        <div className="weekday">周五</div>
        <div className="weekday">周六</div>
      </div>
      <div className="calendar-grid">
        {renderCalendarDays()}
      </div>
    </div>
  );
};

export default MonthView;
