import React, { useState } from 'react';

interface Event {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  color?: string;
}

interface WeekViewProps {
  currentDate: Date;
  events: Event[];
  onTimeClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
  onEventDrop?: (eventId: number, newStartTime: Date, newEndTime: Date) => void;
}

const WeekView: React.FC<WeekViewProps> = ({
  currentDate,
  events,
  onTimeClick,
  onEventClick,
  onEventDrop
}) => {
  const [draggedEvent, setDraggedEvent] = useState<Event | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ date: Date; hour: number } | null>(null);

  const handleDragStart = (e: React.DragEvent, event: Event) => {
    setDraggedEvent(event);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, date: Date, hour: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverCell({ date, hour });
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = (e: React.DragEvent, date: Date, hour: number) => {
    e.preventDefault();
    setDragOverCell(null);

    if (draggedEvent && onEventDrop) {
      const eventStart = new Date(draggedEvent.start_time);
      const eventEnd = new Date(draggedEvent.end_time);
      const duration = eventEnd.getTime() - eventStart.getTime();

      const newStartTime = new Date(date);
      newStartTime.setHours(hour, 0, 0, 0);
      const newEndTime = new Date(newStartTime.getTime() + duration);

      onEventDrop(draggedEvent.id, newStartTime, newEndTime);
    }
    setDraggedEvent(null);
  };

  const getWeekDates = () => {
    const dates = [];
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(startOfWeek.getDate() - day);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const getEventsForDateAndHour = (date: Date, hour: number) => {
    return events.filter(event => {
      const eventStart = new Date(event.start_time);
      const eventEnd = new Date(event.end_time);
      const eventDate = eventStart.toDateString();
      const targetDate = date.toDateString();

      if (eventDate !== targetDate) return false;

      const eventStartHour = eventStart.getHours();
      const eventEndHour = eventEnd.getHours();

      return hour >= eventStartHour && hour < eventEndHour;
    });
  };

  const weekDates = getWeekDates();
  const today = new Date();
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

  return (
    <div className="week-view">
      <div className="week-header">
        <div className="time-gutter-header"></div>
        {weekDates.map((date, index) => {
          const isToday = date.toDateString() === today.toDateString();
          return (
            <div
              key={index}
              className={`week-day-header ${isToday ? 'today' : ''}`}
            >
              <span className="day-name">{dayNames[index]}</span>
              <span className={`day-date ${isToday ? 'today-date' : ''}`}>
                {date.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      <div className="week-body">
        <div className="time-gutter">
          {hours.map(hour => (
            <div key={hour} className="time-slot">
              <span className="time-label">
                {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
              </span>
            </div>
          ))}
        </div>

        <div className="week-columns">
          {weekDates.map((date, dateIndex) => (
            <div key={dateIndex} className="week-column">
              {hours.map(hour => {
                const hourEvents = getEventsForDateAndHour(date, hour);
                return (
                  <div
                    key={hour}
                    className={`week-cell ${dragOverCell && dragOverCell.date.toDateString() === date.toDateString() && dragOverCell.hour === hour ? 'drag-over' : ''}`}
                    onClick={() => {
                      const clickDate = new Date(date);
                      clickDate.setHours(hour, 0, 0, 0);
                      onTimeClick(clickDate);
                    }}
                    onDragOver={(e) => handleDragOver(e, date, hour)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, date, hour)}
                  >
                    {hourEvents.map(event => (
                      <div
                        key={event.id}
                        className="week-event"
                        style={{ backgroundColor: event.color || '#1890ff' }}
                        draggable
                        onDragStart={(e) => handleDragStart(e, event)}
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
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeekView;
