import React from 'react';

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

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const today = new Date();
  const isToday = currentDate.toDateString() === today.toDateString();

  const completedTodos = todos.filter(t => t.completed).length;
  const todoProgress = todos.length > 0
    ? Math.round(todos.reduce((sum, t) => sum + t.progress, 0) / todos.length)
    : 0;

  // Filter events for current date and sort by start_time (creation order)
  const dayEvents = events
    .filter(event => {
      const eventDate = new Date(event.start_time);
      return eventDate.toDateString() === currentDate.toDateString();
    })
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <div className="day-view">
      <div className="day-header">
        <div className="time-gutter-header"></div>
        <div className={`day-column-header ${isToday ? 'today' : ''}`}>
          <span className="day-name">{isToday ? '今天' : `${currentDate.getMonth() + 1}月${currentDate.getDate()}日`}</span>
          <span className={`day-date ${isToday ? 'today-date' : ''}`}>
            {currentDate.getDate()}
          </span>
        </div>
      </div>

      <div className="day-content">
        <div className="day-todos-panel">
          <div className="todos-header">
            <h3>今日任务</h3>
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
            <div className="empty-todos">
              <p>暂无任务</p>
              <button className="btn-add-todo-text" onClick={onAddTodo}>添加任务</button>
            </div>
          )}
        </div>

        <div className="day-timeline">
          {/* Events List Section */}
          <div className="events-section">
            <div className="events-section-header">
              <h3>今日事件</h3>
              <span className="events-count">{dayEvents.length} 个事件</span>
            </div>

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
              <div className="empty-events">
                <p>暂无事件</p>
                <p className="empty-events-hint">点击下方时间轴创建新事件</p>
              </div>
            )}
          </div>

          {/* Timeline Section */}
          <div className="timeline-section">
            <div className="timeline-section-header">
              <h3>时间轴</h3>
            </div>
            <div className="timeline-grid">
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
                {hours.map(hour => (
                  <div
                    key={hour}
                    className="day-cell"
                    onClick={() => {
                      const clickDate = new Date(currentDate);
                      clickDate.setHours(hour, 0, 0, 0);
                      onTimeClick(clickDate);
                    }}
                  >
                    {dayEvents
                      .filter(event => {
                        const eventStart = new Date(event.start_time);
                        const eventEnd = new Date(event.end_time);
                        return hour >= eventStart.getHours() && hour < eventEnd.getHours();
                      })
                      .map(event => (
                        <div
                          key={event.id}
                          className="day-event-marker"
                          style={{ backgroundColor: getEventColor(event) }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(event);
                          }}
                        >
                          <span className="day-event-marker-title">{event.title}</span>
                        </div>
                      ))
                    }
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
