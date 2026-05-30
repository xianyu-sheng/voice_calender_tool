import React, { useState, useEffect } from 'react';

interface EventData {
  id?: number;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  reminder_minutes?: number;
}

interface EventModalProps {
  event?: EventData | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: EventData) => void;
  onDelete?: (id: number) => void;
  isEdit?: boolean;
}

const EventModal: React.FC<EventModalProps> = ({
  event,
  isOpen,
  onClose,
  onSave,
  onDelete,
  isEdit = false
}) => {
  const [formData, setFormData] = useState<EventData>({
    title: '',
    description: '',
    start_time: '',
    end_time: '',
    location: '',
    reminder_minutes: 15
  });
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (event) {
      setFormData(event);
    } else {
      const now = new Date();
      const startTime = new Date(now);
      startTime.setMinutes(0, 0, 0);
      const endTime = new Date(startTime);
      endTime.setHours(endTime.getHours() + 1);

      setFormData({
        title: '',
        description: '',
        start_time: startTime.toISOString().slice(0, 16),
        end_time: endTime.toISOString().slice(0, 16),
        location: '',
        reminder_minutes: 15
      });
    }
    setErrors({});
  }, [event, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: {[key: string]: string} = {};

    if (!formData.title.trim()) {
      newErrors.title = '请输入事件标题';
    }

    if (!formData.start_time) {
      newErrors.start_time = '请选择开始时间';
    }

    if (!formData.end_time) {
      newErrors.end_time = '请选择结束时间';
    }

    if (formData.start_time && formData.end_time) {
      const start = new Date(formData.start_time);
      const end = new Date(formData.end_time);
      if (end <= start) {
        newErrors.end_time = '结束时间必须晚于开始时间';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await onSave(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (event?.id && onDelete) {
      if (window.confirm('确定要删除这个事件吗？')) {
        onDelete(event.id);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isEdit ? '编辑事件' : '新建事件'}</h2>
          <button className="btn-close" onClick={onClose}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="event-form">
          <div className={`form-group ${errors.title ? 'has-error' : ''}`}>
            <label htmlFor="title">事件标题 *</label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={e => {
                setFormData({ ...formData, title: e.target.value });
                if (errors.title) setErrors({ ...errors, title: '' });
              }}
              placeholder="输入事件标题"
              className={errors.title ? 'input-error' : ''}
            />
            {errors.title && <span className="error-message">{errors.title}</span>}
          </div>

          <div className="form-row">
            <div className={`form-group ${errors.start_time ? 'has-error' : ''}`}>
              <label htmlFor="start_time">开始时间 *</label>
              <input
                type="datetime-local"
                id="start_time"
                value={formData.start_time}
                onChange={e => {
                  setFormData({ ...formData, start_time: e.target.value });
                  if (errors.start_time) setErrors({ ...errors, start_time: '' });
                }}
                className={errors.start_time ? 'input-error' : ''}
              />
              {errors.start_time && <span className="error-message">{errors.start_time}</span>}
            </div>

            <div className={`form-group ${errors.end_time ? 'has-error' : ''}`}>
              <label htmlFor="end_time">结束时间 *</label>
              <input
                type="datetime-local"
                id="end_time"
                value={formData.end_time}
                onChange={e => {
                  setFormData({ ...formData, end_time: e.target.value });
                  if (errors.end_time) setErrors({ ...errors, end_time: '' });
                }}
                className={errors.end_time ? 'input-error' : ''}
              />
              {errors.end_time && <span className="error-message">{errors.end_time}</span>}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="location">地点</label>
            <input
              type="text"
              id="location"
              value={formData.location || ''}
              onChange={e => setFormData({ ...formData, location: e.target.value })}
              placeholder="添加地点"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">描述</label>
            <textarea
              id="description"
              value={formData.description || ''}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              placeholder="添加描述"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="reminder">提醒时间</label>
            <select
              id="reminder"
              value={formData.reminder_minutes || 15}
              onChange={e => setFormData({ ...formData, reminder_minutes: parseInt(e.target.value) })}
            >
              <option value={0}>不提醒</option>
              <option value={5}>5分钟前</option>
              <option value={10}>10分钟前</option>
              <option value={15}>15分钟前</option>
              <option value={30}>30分钟前</option>
              <option value={60}>1小时前</option>
            </select>
          </div>

          <div className="form-actions">
            {isEdit && onDelete && event?.id && (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDelete}
              >
                删除事件
              </button>
            )}
            <div className="form-actions-right">
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                取消
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? '保存中...' : (isEdit ? '保存' : '创建')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventModal;
