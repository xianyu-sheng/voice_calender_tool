import React from 'react';

interface Event {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  color?: string;
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
  onAddTodo
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return '#ff4d4f';
      case 'medium': return '#faad14';
      case 'low': return '#52c41a';
      default: return '#1890ff';
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const today = new Date();
  const isToday = currentDate.toDateString() === today.toDateString();

  const completedTodos = todos.filter(t => t.completed).length;
  const todoProgress = todos.length > 0
    ? Math.round(todos.reduce((sum, t) => sum + t.progress, 0) / todos.length)
    : 0;

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
    </div>
  );
};

export default DayView;
