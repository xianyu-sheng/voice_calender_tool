import React from 'react';
import { getCalendarMeta, toLocalDateStr } from '../utils/dateUtils';
import { getWeatherDisplay } from '../utils/weatherUtils';
import type { WeatherForecast } from '../utils/weatherUtils';

interface Event {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  color?: string;
  progress?: number;
}

interface TodoItem {
  id: number;
  title: string;
  date: string;
  completed: boolean;
  progress: number;
  priority: 'low' | 'medium' | 'high';
}

interface DayViewProps {
  currentDate: Date;
  events: Event[];
  todos: TodoItem[];
  weatherForecasts: Record<string, WeatherForecast>;
  weatherLocation: {
    city: string;
    source: 'device' | 'manual' | 'fallback';
    latitude?: number;
    longitude?: number;
  };
  weatherStatus: 'idle' | 'loading' | 'locating' | 'error';
  weatherError: string;
  onTimeClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
  onTodoToggle: (id: number) => void;
  onTodoProgressUpdate: (id: number, progress: number) => void;
  onEventProgressUpdate: (id: number, progress: number) => void;
  onAddTodo: () => void;
}


const DayView: React.FC<DayViewProps> = ({
  currentDate,
  events,
  todos,
  weatherForecasts,
  weatherLocation,
  weatherStatus,
  weatherError,
  onTimeClick,
  onEventClick,
  onTodoToggle,
  onTodoProgressUpdate,
  onEventProgressUpdate,
  onAddTodo
}) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ff4d4f';
      case 'medium': return '#faad14';
      case 'low': return '#52c41a';
      default: return '#1890ff';
    }
  };

  const getEventColor = (event: Event) => {
    return event.color || '#1890ff';
  };

  const today = new Date();
  const isToday = currentDate.toDateString() === today.toDateString();
  const currentDateStr = toLocalDateStr(currentDate);
  const calendarMeta = getCalendarMeta(currentDate);
  const weather = getWeatherDisplay(weatherForecasts[currentDateStr]);
  const metaHighlights = [calendarMeta.holiday, calendarMeta.solarTerm, calendarMeta.festival]
    .filter((item, index, array): item is string => Boolean(item) && array.indexOf(item) === index);
  const locationSourceLabel = weatherLocation.source === 'device'
    ? '定位'
    : weatherLocation.source === 'manual'
      ? '手动'
      : '备用';

  const completedTodos = todos.filter(t => t.completed).length;
  const todoProgress = todos.length > 0
    ? Math.round(todos.reduce((sum, t) => sum + t.progress, 0) / todos.length)
    : 0;

  // 用本地日期字符串过滤事件，避免时区偏差
  const dayEvents = events
    .filter(event => {
      const eventDateStr = toLocalDateStr(new Date(event.start_time));
      const match = eventDateStr === currentDateStr;
      // 调试日志：帮助排查日期过滤问题
      if (!match && events.length <= 20) {
        console.log(`[DayView] 事件 "${event.title}" 日期=${eventDateStr}, 当前=${currentDateStr}, 匹配=${match}, start_time原始=${event.start_time}`);
      }
      return match;
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  // 调试日志
  console.log(`[DayView] currentDateStr=${currentDateStr}, 总事件=${events.length}, 匹配事件=${dayEvents.length}`);
  if (events.length > 0) {
    console.log(`[DayView] 前3个事件:`, events.slice(0, 3).map(e => ({
      title: e.title,
      start_time: e.start_time,
      localDate: toLocalDateStr(new Date(e.start_time))
    })));
  }

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="day-view">
      <div className="day-header">
        <div className={`day-header-info ${isToday ? 'today' : ''}`}>
          <span className="day-header-label">{isToday ? '今天' : `${currentDate.getMonth() + 1}月${currentDate.getDate()}日`}</span>
          <span className={`day-header-date ${isToday ? 'today-date' : ''}`}>
            {currentDate.getMonth() + 1}月{currentDate.getDate()}日 · {['周日','周一','周二','周三','周四','周五','周六'][currentDate.getDay()]}
          </span>
        </div>
        <div className="day-meta-summary">
          <div className="day-meta-tags">
            <span>{calendarMeta.lunarMonth}{calendarMeta.lunarDay}</span>
            {metaHighlights.map(item => (
              <span key={item} className="meta-tag-highlight">{item}</span>
            ))}
            {calendarMeta.holidayType && (
              <span className={`holiday-badge ${calendarMeta.holidayType}`}>
                {calendarMeta.holidayType === 'off' ? '休' : '班'}
              </span>
            )}
          </div>
          <div className={`day-weather-summary ${weather.unavailable ? 'unavailable' : ''}`}>
            <span className="day-weather-city">📍 {weatherLocation.city}</span>
            <span className={`location-source ${weatherLocation.source}`}>{locationSourceLabel}</span>
            <span className="day-weather-icon">{weather.icon}</span>
            <span className="day-weather-label">
              {weatherStatus === 'locating'
                ? '正在定位'
                : weatherStatus === 'loading'
                ? '天气更新中'
                : weatherStatus === 'error'
                  ? weatherError || '天气获取失败'
                  : weather.label}
            </span>
            {weather.temperature && <span className="day-weather-temp">{weather.temperature}</span>}
          </div>
        </div>
      </div>

      <div className="day-content">
        {/* 左侧：今日任务 */}
        <div className="day-panel day-todos-panel">
          <div className="panel-header">
            <h3>📋 今日任务</h3>
            <button className="btn-add-todo" onClick={onAddTodo}>+</button>
          </div>

          {todos.length > 0 && (
            <div className="todos-progress">
              <div className="progress-info">
                <span>完成进度</span>
                <span>{completedTodos}/{todos.length}</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${todoProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          <div className="panel-body">
            <div className="todos-list">
              {todos.map(todo => (
                <div key={todo.id} className={`todo-item ${todo.completed ? 'completed' : ''}`}>
                  <div className="todo-main">
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => onTodoToggle(todo.id)}
                      className="todo-checkbox"
                    />
                    <span className="todo-title">{todo.title}</span>
                    <span
                      className="priority-badge"
                      style={{ backgroundColor: getPriorityColor(todo.priority) }}
                    >
                      {todo.priority === 'high' ? '高' : todo.priority === 'medium' ? '中' : '低'}
                    </span>
                  </div>
                  <div className="todo-progress">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={todo.progress}
                      onChange={(e) => onTodoProgressUpdate(todo.id, parseInt(e.target.value))}
                      className="progress-slider"
                      style={{
                        background: `linear-gradient(to right, ${getPriorityColor(todo.priority)} ${todo.progress}%, #e8e8e8 ${todo.progress}%)`
                      }}
                    />
                    <span className="progress-text">{todo.progress}%</span>
                  </div>
                </div>
              ))}
            </div>

            {todos.length === 0 && (
              <div className="empty-state">
                <p>暂无任务</p>
                <button className="btn-add-todo-text" onClick={onAddTodo}>+ 添加任务</button>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：今日事件 */}
        <div className="day-panel day-events-panel">
          <div className="panel-header">
            <h3>📅 今日事件</h3>
            <span className="events-count">{dayEvents.length} 个</span>
          </div>

          <div className="panel-body">
            {dayEvents.length > 0 ? (
              <div className="events-list">
                {dayEvents.map(event => (
                  <div
                    key={event.id}
                    className="event-card"
                    style={{ borderLeftColor: getEventColor(event) }}
                    onClick={() => onEventClick(event)}
                  >
                    <div className="event-card-header">
                      <div className="event-card-time">
                        <span className="event-time-icon">🕐</span>
                        <span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span>
                      </div>
                      <div
                        className="event-color-dot"
                        style={{ backgroundColor: getEventColor(event) }}
                      ></div>
                    </div>
                    <div className="event-card-body">
                      <h4 className="event-card-title">{event.title}</h4>
                      {event.location && (
                        <span className="event-card-location">📍 {event.location}</span>
                      )}
                    </div>
                    <div className="event-card-progress" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={event.progress || 0}
                        onChange={(e) => onEventProgressUpdate(event.id, parseInt(e.target.value))}
                        className="progress-slider"
                        style={{
                          background: `linear-gradient(to right, ${getEventColor(event)} ${event.progress || 0}%, #e8e8e8 ${event.progress || 0}%)`
                        }}
                      />
                      <span className="progress-text">{event.progress || 0}%</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <p>暂无事件</p>
                <p className="empty-hint">在时间轴上点击创建新事件</p>
              </div>
            )}

            {/* 时间轴 - 紧凑版，用于点击创建事件 */}
            <div className="mini-timeline">
              <div className="mini-timeline-header">时间轴 · 点击空白处创建事件</div>
              <div className="mini-timeline-grid">
                {hours.filter(h => h >= 6 && h <= 23).map(hour => (
                  <div
                    key={hour}
                    className="mini-time-slot"
                    onClick={() => {
                      const clickDate = new Date(currentDate);
                      clickDate.setHours(hour, 0, 0, 0);
                      onTimeClick(clickDate);
                    }}
                  >
                    <span className="mini-time-label">
                      {hour === 0 ? '12AM' : hour < 12 ? `${hour}AM` : hour === 12 ? '12PM' : `${hour-12}PM`}
                    </span>
                    <span className="mini-time-line">
                      {dayEvents
                        .filter(ev => {
                          const s = new Date(ev.start_time);
                          const e = new Date(ev.end_time);
                          return hour >= s.getHours() && hour < e.getHours();
                        })
                        .map(ev => (
                          <span
                            key={ev.id}
                            className="mini-event-tag"
                            style={{ backgroundColor: getEventColor(ev) }}
                            onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
                          >
                            {ev.title}
                          </span>
                        ))
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayView;
