import React, { useState, useEffect } from 'react';

interface TodoItem {
  id: number;
  title: string;
  date: string;
  completed: boolean;
  progress: number;
  priority: 'low' | 'medium' | 'high';
  auto_postpone: boolean;
}

interface TodoModalProps {
  todo: TodoItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (todo: { id?: number; title: string; date: string; priority?: string; auto_postpone?: boolean }) => void;
  onDelete: (id: number) => void;
  selectedDate: Date | null;
}

const TodoModal: React.FC<TodoModalProps> = ({
  todo,
  isOpen,
  onClose,
  onSave,
  onDelete,
  selectedDate
}) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [autoPostpone, setAutoPostpone] = useState(true);

  useEffect(() => {
    if (todo) {
      setTitle(todo.title);
      setDate(todo.date);
      setPriority(todo.priority);
      setAutoPostpone(todo.auto_postpone);
    } else if (selectedDate) {
      setTitle('');
      setDate(selectedDate.toISOString().split('T')[0]);
      setPriority('medium');
      setAutoPostpone(true);
    }
  }, [todo, selectedDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: todo?.id,
      title,
      date,
      priority,
      auto_postpone: autoPostpone
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content todo-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{todo ? '编辑任务' : '新建任务'}</h2>
          <button className="btn-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="todo-form">
          <div className="form-group">
            <label>任务名称</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="输入任务名称"
              required
            />
          </div>

          <div className="form-group">
            <label>日期</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>优先级</label>
            <div className="priority-selector">
              <button
                type="button"
                className={`priority-btn low ${priority === 'low' ? 'active' : ''}`}
                onClick={() => setPriority('low')}
              >
                低
              </button>
              <button
                type="button"
                className={`priority-btn medium ${priority === 'medium' ? 'active' : ''}`}
                onClick={() => setPriority('medium')}
              >
                中
              </button>
              <button
                type="button"
                className={`priority-btn high ${priority === 'high' ? 'active' : ''}`}
                onClick={() => setPriority('high')}
              >
                高
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={autoPostpone}
                onChange={e => setAutoPostpone(e.target.checked)}
              />
              <span>未完成自动顺延到下一天</span>
            </label>
          </div>

          <div className="form-actions">
            {todo && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => onDelete(todo.id)}
              >
                删除
              </button>
            )}
            <div className="form-actions-right">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                取消
              </button>
              <button type="submit" className="btn btn-primary">
                {todo ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TodoModal;
