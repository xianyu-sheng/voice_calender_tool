import React from 'react';
import { toLocalDateStr } from '../utils/dateUtils';

interface LLMResult {
  intent: string;
  title?: string;
  date?: string;
  time?: string;
  end_time?: string;
  location?: string;
  description?: string;
  priority?: string;
  reminder_minutes?: number;
}

interface VoiceLLMFeedbackProps {
  status: 'idle' | 'calling' | 'parsing' | 'result' | 'error';
  rawText?: string;
  result?: LLMResult | null;
  error?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

const VoiceLLMFeedback: React.FC<VoiceLLMFeedbackProps> = ({
  status,
  rawText,
  result,
  error,
  onConfirm,
  onCancel
}) => {
  if (status === 'idle') return null;

  const getIntentLabel = (intent: string) => {
    switch (intent) {
      case 'create_event': return '创建事件';
      case 'create_todo': return '创建任务';
      case 'view_events': return '查看日程';
      case 'delete_event': return '删除事件';
      case 'complete_todo': return '完成任务';
      default: return '未知操作';
    }
  };

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'high': return '🔴 高优先级';
      case 'medium': return '🟡 中优先级';
      case 'low': return '🟢 低优先级';
      default: return '中优先级';
    }
  };

  const formatTime = (time?: string) => {
    if (!time) return '';
    const [hours, minutes] = time.split(':');
    const h = parseInt(hours);
    if (h < 12) return `上午 ${time}`;
    if (h === 12) return `中午 ${time}`;
    return `下午 ${h - 12}:${minutes}`;
  };

  const formatDate = (date?: string) => {
    if (!date) return '今天';
    const today = toLocalDateStr(new Date());
    const tomorrow = toLocalDateStr(new Date(Date.now() + 86400000));
    if (date === today) return '今天';
    if (date === tomorrow) return '明天';
    const d = new Date(date);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  return (
    <div className="llm-feedback">
      {/* 调用中状态 */}
      {status === 'calling' && (
        <div className="llm-card llm-calling">
          <div className="llm-header">
            <div className="llm-spinner"></div>
            <span className="llm-title">正在调用大模型...</span>
          </div>
          <div className="llm-body">
            <div className="llm-raw-text">
              <span className="llm-label">语音输入：</span>
              <span className="llm-text">{rawText}</span>
            </div>
            <div className="llm-steps">
              <div className="llm-step active">
                <span className="step-icon">📡</span>
                <span>连接 DeepSeek API...</span>
              </div>
              <div className="llm-step">
                <span className="step-icon">🧠</span>
                <span>分析语义中...</span>
              </div>
              <div className="llm-step">
                <span className="step-icon">📋</span>
                <span>提取日程信息...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 解析中状态 */}
      {status === 'parsing' && (
        <div className="llm-card llm-parsing">
          <div className="llm-header">
            <div className="llm-spinner"></div>
            <span className="llm-title">AI 正在分析...</span>
          </div>
          <div className="llm-body">
            <div className="llm-raw-text">
              <span className="llm-label">语音输入：</span>
              <span className="llm-text">{rawText}</span>
            </div>
            <div className="llm-steps">
              <div className="llm-step completed">
                <span className="step-icon">✅</span>
                <span>连接成功</span>
              </div>
              <div className="llm-step active">
                <span className="step-icon">🧠</span>
                <span>分析语义中...</span>
              </div>
              <div className="llm-step">
                <span className="step-icon">📋</span>
                <span>提取日程信息...</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 结果展示 */}
      {status === 'result' && result && (
        <div className="llm-card llm-result">
          <div className="llm-header">
            <span className="llm-icon">✨</span>
            <span className="llm-title">AI 分析完成</span>
          </div>
          <div className="llm-body">
            <div className="llm-raw-text">
              <span className="llm-label">语音输入：</span>
              <span className="llm-text">{rawText}</span>
            </div>

            <div className="llm-parsed-result">
              <div className="result-header">
                <span className="result-intent">{getIntentLabel(result.intent)}</span>
              </div>

              <div className="result-fields">
                {result.title && (
                  <div className="result-field">
                    <span className="field-icon">📝</span>
                    <span className="field-label">标题</span>
                    <span className="field-value">{result.title}</span>
                  </div>
                )}

                {result.date && (
                  <div className="result-field">
                    <span className="field-icon">📅</span>
                    <span className="field-label">日期</span>
                    <span className="field-value">{formatDate(result.date)}</span>
                  </div>
                )}

                {result.time && (
                  <div className="result-field">
                    <span className="field-icon">⏰</span>
                    <span className="field-label">时间</span>
                    <span className="field-value">
                      {formatTime(result.time)}
                      {result.end_time && ` - ${formatTime(result.end_time)}`}
                    </span>
                  </div>
                )}

                {result.location && (
                  <div className="result-field">
                    <span className="field-icon">📍</span>
                    <span className="field-label">地点</span>
                    <span className="field-value">{result.location}</span>
                  </div>
                )}

                {result.priority && (
                  <div className="result-field">
                    <span className="field-icon">🏷️</span>
                    <span className="field-label">优先级</span>
                    <span className="field-value">{getPriorityLabel(result.priority)}</span>
                  </div>
                )}

                {result.description && (
                  <div className="result-field">
                    <span className="field-icon">📄</span>
                    <span className="field-label">备注</span>
                    <span className="field-value">{result.description}</span>
                  </div>
                )}

                {result.reminder_minutes !== undefined && result.reminder_minutes > 0 && (
                  <div className="result-field">
                    <span className="field-icon">🔔</span>
                    <span className="field-label">提醒</span>
                    <span className="field-value">提前 {result.reminder_minutes} 分钟</span>
                  </div>
                )}
              </div>
            </div>

            <div className="llm-actions">
              <button className="llm-btn llm-btn-confirm" onClick={onConfirm}>
                ✓ 确认创建
              </button>
              <button className="llm-btn llm-btn-cancel" onClick={onCancel}>
                ✕ 取消
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {status === 'error' && (
        <div className="llm-card llm-error">
          <div className="llm-header">
            <span className="llm-icon">❌</span>
            <span className="llm-title">分析失败</span>
          </div>
          <div className="llm-body">
            <div className="llm-raw-text">
              <span className="llm-label">语音输入：</span>
              <span className="llm-text">{rawText}</span>
            </div>
            <div className="llm-error-msg">{error || '无法解析该指令，请重试'}</div>
            <div className="llm-actions">
              <button className="llm-btn llm-btn-cancel" onClick={onCancel}>
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceLLMFeedback;
