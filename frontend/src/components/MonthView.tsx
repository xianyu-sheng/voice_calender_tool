import React from 'react';
import { getCalendarMeta, toLocalDateStr } from '../utils/dateUtils';
import { getWeatherDisplay } from '../utils/weatherUtils';
import type { WeatherForecast } from '../utils/weatherUtils';

interface Event {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  color?: string;
  location?: string;
}

interface TodoItem {
  id: number;
  title: string;
  date: string;
  completed: boolean;
  progress: number;
  priority: 'low' | 'medium' | 'high';
}

interface MonthViewProps {
  currentDate: Date;
  events: Event[];
  todos: TodoItem[];
  weatherForecasts: Record<string, WeatherForecast>;
  onDateClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
  onTodoToggle: (id: number) => void;
  onDateClickForTodo: (date: Date) => void;
}

const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  events,
  todos,
  weatherForecasts,
  onDateClick,
  onEventClick,
  onTodoToggle,
  onDateClickForTodo
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

  const getTodosForDate = (date: Date) => {
    return todos.filter(todo => todo.date === toLocalDateStr(date));
  };

  const handleDayClick = (date: Date) => {
    onDateClick(date);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ff4d4f';
      case 'medium': return '#faad14';
      case 'low': return '#52c41a';
      default: return '#1890ff';
    }
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];
    const today = new Date();

    const renderDay = (date: Date, key: string, isCurrentMonth: boolean) => {
      const isToday = date.toDateString() === today.toDateString();
      const dateStr = toLocalDateStr(date);
      const meta = getCalendarMeta(date);
      const dayEvents = isCurrentMonth ? getEventsForDate(date) : [];
      const dayTodos = isCurrentMonth ? getTodosForDate(date) : [];
      const hasContent = dayEvents.length > 0 || dayTodos.length > 0;
      const weather = getWeatherDisplay(weatherForecasts[dateStr]);
      const metaLabel = meta.holiday || meta.solarTerm || meta.festival || meta.lunar;

      return (
        <div
          key={key}
          className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${hasContent ? 'has-events' : ''} ${meta.holidayType === 'off' ? 'holiday-off' : ''} ${meta.holidayType === 'work' ? 'holiday-work' : ''}`}
          onClick={() => handleDayClick(date)}
        >
          <div className="month-day-header">
            <span className={`day-number ${isToday ? 'today-number' : ''}`}>
              {date.getDate()}
            </span>
            {hasContent && (
              <span className="event-count">{dayEvents.length + dayTodos.length}</span>
            )}
          </div>
          <div className="day-meta-row">
            <span className={`day-lunar ${meta.festival || meta.solarTerm || meta.holiday ? 'festival' : ''}`}>
              {metaLabel}
            </span>
            {meta.holidayType && (
              <span className={`holiday-badge ${meta.holidayType}`}>
                {meta.holidayType === 'off' ? '休' : '班'}
              </span>
            )}
          </div>
          <div className={`day-weather ${weather.unavailable ? 'unavailable' : ''}`} title={weather.label}>
            <span className="weather-icon">{weather.icon}</span>
            <span className="weather-temp">{weather.temperature}</span>
          </div>
          {hasContent && (
            <div className="event-dots">
              {dayEvents.slice(0, 3).map((event) => (
                <span
                  key={`event-${event.id}`}
                  className="event-dot"
                  style={{ backgroundColor: event.color || '#1890ff' }}
                  onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                />
              ))}
              {dayTodos.slice(0, 3).map((todo) => (
                <span
                  key={`todo-${todo.id}`}
                  className="todo-dot"
                  style={{ backgroundColor: getPriorityColor(todo.priority) }}
                  onClick={(e) => { e.stopPropagation(); onTodoToggle(todo.id); }}
                />
              ))}
              {(dayEvents.length + dayTodos.length) > 6 && (
                <span className="more-dots" onClick={(e) => { e.stopPropagation(); onDateClickForTodo(date); }}>+{dayEvents.length + dayTodos.length - 6}</span>
              )}
            </div>
          )}
        </div>
      );
    };

    const prevMonthDays = getDaysInMonth(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    for (let i = firstDay - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, day);
      days.push(renderDay(date, `prev-${day}`, false));
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
      days.push(renderDay(date, String(day), true));
    }

    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, day);
      days.push(renderDay(date, `next-${day}`, false));
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
