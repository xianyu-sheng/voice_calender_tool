import React from 'react';

interface Event {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  color?: string;
}

interface DayViewProps {
  currentDate: Date;
  events: Event[];
  onTimeClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
}

const DayView: React.FC<DayViewProps> = ({
  currentDate,
  events,
  onTimeClick,
  onEventClick
}) => {
  const getEventsForHour = (hour: number) => {
    return events.filter(event => {
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);
      const eventDate = eventStart.toDateString();
      const targetDate = currentDate.toDateString();

      if (eventDate !== targetDate) return false;

      const eventStartHour = eventStart.getHours();
      const eventEndHour = eventEnd.getHours();

      return hour >= eventStartHour && hour < eventEndHour;
    });
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const today = new Date();
  const isToday = currentDate.toDateString() === today.toDateString();

  return (
    <div className="day-view">
      <div className="day-header">
        <div className="time-gutter-header"></div>
        <div className={`day-column-header ${isToday ? 'today' : ''}`}>
          <span className="day-name">今天</span>
          <span className={`day-date ${isToday ? 'today-date' : ''}`}>
            {currentDate.getDate()}
          </span>
        </div>
      </div>

      <div className="day-body">
        <div className="time-gutter">
          {hours.map(hour => (
            <div key={hour} className="time-slot">
              <span className="time-label">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </span>
            </div>
          ))}
        </div>

        <div className="day-column">
          {hours.map(hour => {
            const hourEvents = getEventsForHour(hour);
            return (
              <div
                key={hour}
                className="day-cell"
                onClick={() => {
                  const clickDate = new Date(currentDate);
                  clickDate.setHours(hour, 0, 0, 0);
                  onTimeClick(clickDate);
                }}
              >
                {hourEvents.map(event => (
                  <div
                    key={event.id}
                    className="day-event"
                    style={{ backgroundColor: event.color || '#1890ff' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  >
                    <div className="event-header">
                      <span className="event-time">
                        {new Date(event.start_time).getHours().toString().padStart(2, '0')}:
                        {new Date(event.start_time).getMinutes().toString().padStart(2, '0')} -
                        {new Date(event.end_time).getHours().toString().padStart(2, '0')}:
                        {new Date(event.end_time).getMinutes().toString().padStart(2, '0')}
                      </span>
                    </div>
                    <div className="event-content">
                      <span className="event-title">{event.title}</span>
                      {event.location && (
                        <span className="event-location">📍 {event.location}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DayView;
