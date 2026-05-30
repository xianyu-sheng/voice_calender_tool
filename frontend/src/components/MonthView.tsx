import React, { useState } from 'react';

interface Event {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  color?: string;
  location?: string;
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
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

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

  const handleDayClick = (date: Date, dayEvents: Event[]) => {
    const dateKey = date.toDateString();
    if (dayEvents.length > 0) {
      setExpandedDate(expandedDate === dateKey ? null : dateKey);
    }
    onDateClick(date);
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
      const dateKey = date.toDateString();
      const isExpanded = expandedDate === dateKey;

      days.push(
        <div
          key={day}
          className={`calendar-day ${isToday ? 'today' : ''} ${isExpanded ? 'expanded' : ''} ${dayEvents.length > 0 ? 'has-events' : ''}`}
          onClick={() => handleDayClick(date, dayEvents)}
        >
          <div className="day-header">
            <span className={`day-number ${isToday ? 'today-number' : ''}`}>
              {day}
            </span>
            {dayEvents.length > 0 && (
              <span className="event-count">{dayEvents.length}</span>
            )}
          </div>
          {!isExpanded && dayEvents.length > 0 && (
            <div className="event-dots">
              {dayEvents.slice(0, 3).map((event) => (
                <span
                  key={event.id}
                  className="event-dot"
                  style={{ backgroundColor: event.color || '#1890ff' }}
                />
              ))}
              {dayEvents.length > 3 && <span className="more-dots">+{dayEvents.length - 3}</span>}
            </div>
          )}
          {isExpanded && (
            <div className="day-events-expanded">
              {dayEvents.map(event => (
                <div
                  key={event.id}
                  className="event-item-compact"
                  style={{ borderLeftColor: event.color || '#1890ff' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(event);
                  }}
                >
                  <span className="event-time-compact">
                    {new Date(event.start_time).getHours().toString().padStart(2, '0')}:
                    {new Date(event.start_time).getMinutes().toString().padStart(2, '0')}
                  </span>
                  <span className="event-title-compact">{event.title}</span>
                </div>
              ))}
            </div>
          )}
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
        <div className="weekday">日</div>
        <div className="weekday">一</div>
        <div className="weekday">二</div>
        <div className="weekday">三</div>
        <div className="weekday">四</div>
        <div className="weekday">五</div>
        <div className="weekday">六</div>
      </div>
      <div className="calendar-grid">
        {renderCalendarDays()}
      </div>
    </div>
  );
};

export default MonthView;
