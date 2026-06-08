import { useState, useEffect, useRef } from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import MonthView from './components/MonthView'
import WeekView from './components/WeekView'
import DayView from './components/DayView'
import EventModal from './components/EventModal'
import TodoModal from './components/TodoModal'
import SettingsModal from './components/SettingsModal'
import VoiceFeedback from './components/VoiceFeedback'
import VoiceLLMFeedback from './components/VoiceLLMFeedback'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis'
import { useReminder } from './hooks/useReminder'
import { parseVoiceCommand } from './utils/voiceCommandParser'
import type { ParsedCommand } from './utils/voiceCommandParser'
import { toLocalDateStr, todayStr } from './utils/dateUtils'
import './App.css'

interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
  color?: string;
  reminder_minutes?: number;
  progress?: number;
}

interface TodoItem {
  id: number;
  title: string;
  date: string;
  completed: boolean;
  progress: number;
  priority: 'low' | 'medium' | 'high';
  auto_postpone: boolean;
}

interface Calendar {
  id: number;
  name: string;
  color: string;
}

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [activeCalendars, setActiveCalendars] = useState<number[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [todoModalOpen, setTodoModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTodo, setSelectedTodo] = useState<TodoItem | null>(null);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('deepseek_api_key') || '');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // LLM 可视化状态
  const [llmStatus, setLlmStatus] = useState<'idle' | 'calling' | 'parsing' | 'result' | 'error'>('idle');
  const [llmRawText, setLlmRawText] = useState<string>('');
  const [llmResult, setLlmResult] = useState<any>(null);
  const [llmError, setLlmError] = useState<string>('');
  const [pendingCommand, setPendingCommand] = useState<ParsedCommand | null>(null);

  const {
    isListening,
    transcript,
    interimTranscript,
    error: speechError,
    isSupported,
    status: speechStatus,
    startListening,
    stopListening,
    resetTranscript
  } = useSpeechRecognition();

  const { speak, isSpeaking } = useSpeechSynthesis();
  const { requestPermission, hasPermission, scheduleReminder } = useReminder();

  useEffect(() => {
    fetchCalendars();
    fetchEvents();
    fetchTodos();
    requestPermission();
    autoPostponeTodos();

    // 每次启动时把 localStorage 中的 API key 同步到后端
    const savedDeepseek = localStorage.getItem('deepseek_api_key');

    if (savedDeepseek) {
      const config: any = {};
      if (savedDeepseek) config.api_key = savedDeepseek;

      console.log('[App] 同步 API key 到后端...');
      fetch('http://localhost:8000/api/voice/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      }).then(r => r.json()).then(d => {
        console.log('[App] API keys 同步:', d.success ? 'OK' : 'FAILED');
      }).catch(e => {
        console.error('[App] API keys 同步失败:', e);
      });
    }
  }, []);

  useEffect(() => {
    if (hasPermission && events.length > 0) {
      events.forEach(event => {
        if (event.reminder_minutes && new Date(event.start_time) > new Date()) {
          scheduleReminder(event);
        }
      });
    }
  }, [events, hasPermission]);

  useEffect(() => {
    if (transcript) {
      console.log('🔔 transcript 变化，触发语音命令处理:', transcript);
      handleVoiceCommandRef.current(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    if (voiceFeedback) {
      speak(voiceFeedback);
    }
  }, [voiceFeedback]);

  const fetchCalendars = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/calendars');
      const data = await response.json();
      if (data.success) {
        setCalendars(data.data);
        setActiveCalendars(data.data.map((c: Calendar) => c.id));
      }
    } catch (error) {
      console.error('Error fetching calendars:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/events');
      const data = await response.json();
      if (data.success) {
        setEvents(data.data);
        // 调试日志
        console.log(`[App] fetchEvents: 获取到 ${data.data.length} 个事件`);
        data.data.slice(0, 5).forEach((e: CalendarEvent) => {
          const d = new Date(e.start_time);
          console.log(`  事件 "${e.title}" start_time=${e.start_time}, 本地日期=${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`);
        });
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchTodos = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/todos');
      const data = await response.json();
      if (data.success) {
        setTodos(data.data);
      }
    } catch (error) {
      console.error('Error fetching todos:', error);
    }
  };

  const autoPostponeTodos = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/todos/postpone', {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        fetchTodos();
      }
    } catch (error) {
      console.error('Error postponing todos:', error);
    }
  };

  const parseWithHybrid = async (text: string): Promise<ParsedCommand> => {
    if (apiKey) {
      // 显示调用状态
      setLlmStatus('calling');
      setLlmRawText(text);
      setLlmResult(null);
      setLlmError('');

      // 延迟一下显示解析中状态（需要在 try 外部声明以便 finally 清理）
      let parsingTimer: ReturnType<typeof setTimeout> | null = null;

      try {
        parsingTimer = setTimeout(() => setLlmStatus('parsing'), 800);

        const response = await fetch('http://localhost:8000/api/voice/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, use_llm: true })
        });
        const data = await response.json();

        if (data.success && data.data.source === 'llm') {
          const result = data.data;
          // 显示结果
          setLlmResult(result);
          setLlmStatus('result');

          // 返回 LLM 解析结果，标记 source
          return {
            intent: result.intent || 'unknown',
            title: result.title,
            date: result.date,
            time: result.time,
            end_time: result.end_time,
            location: result.location,
            description: result.description,
            priority: result.priority,
            reminderMinutes: result.reminder_minutes,
            rawText: text,
            source: 'llm',
          };
        }

        // 后端返回了非 LLM 结果，降级到 regex
        if (data.data?.llm_error) {
          console.warn('LLM error from backend:', data.data.llm_error);
          setLlmError('LLM 解析失败: ' + data.data.llm_error + '（使用本地解析）');
          setLlmStatus('error');
        } else {
          setLlmStatus('idle');
        }
      } catch (err) {
        console.error('LLM parse error:', err);
        setLlmError('LLM 服务连接失败，使用本地解析');
        setLlmStatus('error');
        // 不返回，继续降级到 regex parser
      } finally {
        if (parsingTimer) clearTimeout(parsingTimer);
      }
    }

    // 降级：使用前端正则解析
    const regexResult = parseVoiceCommand(text);
    regexResult.source = 'regex';
    return regexResult;
  };

  const handleVoiceCommand = async (text: string) => {
    console.log('🔊 语音输入:', text);

    const command = await parseWithHybrid(text);
    console.log('📋 解析结果:', command);

    // LLM 解析的结果需要用户确认后再执行
    if (command.source === 'llm') {
      setPendingCommand(command);
      return;
    }

    // 正则解析的结果直接执行
    executeCommand(command);
  };

  // 用 ref 保存最新的 handleVoiceCommand，避免 effect 依赖问题
  const handleVoiceCommandRef = useRef(handleVoiceCommand);
  handleVoiceCommandRef.current = handleVoiceCommand;

  const executeCommand = async (command: ParsedCommand) => {
    switch (command.intent) {
      case 'create_event':
        await handleVoiceCreateEvent(command);
        break;
      case 'create_todo':
        await handleVoiceCreateTodo(command);
        break;
      case 'view_events':
        handleVoiceViewEvents(command);
        break;
      case 'delete_event':
        setVoiceFeedback('请在界面上选择要删除的事件');
        break;
      case 'complete_todo':
        await handleVoiceCompleteTodo(command);
        break;
      default:
        setVoiceFeedback('抱歉，我没有理解您的指令');
    }

    setTimeout(() => setVoiceFeedback(null), 3000);
    resetTranscript();
  };

  // 确认 LLM 解析结果，执行命令
  const handleLLMConfirm = async () => {
    if (pendingCommand) {
      setLlmStatus('idle');
      setLlmResult(null);
      await executeCommand(pendingCommand);
      setPendingCommand(null);
    }
  };

  // 取消 LLM 解析结果
  const handleLLMCancel = () => {
    setLlmStatus('idle');
    setLlmResult(null);
    setPendingCommand(null);
    resetTranscript();
  };

  const handleVoiceCreateEvent = async (command: ParsedCommand) => {
    const now = new Date();
    let startDate = new Date(now);

    if (command.date) {
      startDate = new Date(command.date);
    }

    if (command.time) {
      const [hours, minutes] = command.time.split(':').map(Number);
      startDate.setHours(hours, minutes, 0, 0);
    } else {
      startDate.setHours(now.getHours() + 1, 0, 0, 0);
    }

    const endDate = new Date(startDate);
    if (command.end_time) {
      const [endHours, endMinutes] = command.end_time.split(':').map(Number);
      endDate.setHours(endHours, endMinutes, 0, 0);
      if (endDate <= startDate) {
        endDate.setDate(endDate.getDate() + 1);
      }
    } else {
      endDate.setHours(endDate.getHours() + 1);
    }

    const eventData = {
      title: command.title || '新事件',
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      description: command.description,
      location: command.location,
      reminder_minutes: command.reminderMinutes ?? 15
    };

    try {
      const response = await fetch('http://localhost:8000/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData)
      });

      const data = await response.json();
      if (data.success) {
        setVoiceFeedback(`已创建事件: ${eventData.title}`);
        fetchEvents();
      }
    } catch (error) {
      setVoiceFeedback('创建事件失败，请重试');
    }
  };

  const handleVoiceCreateTodo = async (command: ParsedCommand) => {
    const today = todayStr();
    const todoData = {
      title: command.title || '新任务',
      date: command.date || today,
      priority: command.priority || 'medium',
      auto_postpone: true
    };

    try {
      const response = await fetch('http://localhost:8000/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(todoData)
      });

      const data = await response.json();
      if (data.success) {
        setVoiceFeedback(`已创建任务: ${todoData.title}`);
        fetchTodos();
      }
    } catch (error) {
      setVoiceFeedback('创建任务失败，请重试');
    }
  };

  const handleVoiceCompleteTodo = async (command: ParsedCommand) => {
    const todo = todos.find(t => t.title.includes(command.title || ''));
    if (todo) {
      await handleToggleTodo(todo.id);
      setVoiceFeedback(`已完成任务: ${todo.title}`);
    } else {
      setVoiceFeedback('未找到该任务');
    }
  };

  const handleVoiceViewEvents = (command: ParsedCommand) => {
    const text = command.rawText;

    if (text.includes('今天')) {
      setCurrentDate(new Date());
      setView('day');
      setVoiceFeedback('已切换到今天');
    } else if (text.includes('明天')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setCurrentDate(tomorrow);
      setView('day');
      setVoiceFeedback('已切换到明天');
    } else if (text.includes('本周') || text.includes('这周')) {
      setCurrentDate(new Date());
      setView('week');
      setVoiceFeedback('已切换到本周视图');
    } else if (text.includes('本月') || text.includes('这个月')) {
      setCurrentDate(new Date());
      setView('month');
      setVoiceFeedback('已切换到本月视图');
    }
  };

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (view === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateSelect = (date: Date) => {
    console.log(`[App] handleDateSelect:`, date.toISOString(), 'local:', date.getFullYear(), date.getMonth()+1, date.getDate());
    setCurrentDate(date);
    if (view === 'month') {
      setView('day');
    }
  };

  const handleTimeClick = (date: Date) => {
    setSelectedDate(date);
    setSelectedEvent(null);
    setModalOpen(true);
  };

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setModalOpen(true);
  };

  const handleCalendarToggle = (id: number) => {
    setActiveCalendars(prev =>
      prev.includes(id)
        ? prev.filter(c => c !== id)
        : [...prev, id]
    );
  };

  const handleEventDrop = async (eventId: number, newStartTime: Date, newEndTime: Date) => {
    const event = events.find(e => e.id === eventId);
    if (!event) return;

    const updatedEvent = {
      ...event,
      start_time: newStartTime.toISOString(),
      end_time: newEndTime.toISOString()
    };

    try {
      const response = await fetch(`http://localhost:8000/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedEvent)
      });

      const data = await response.json();
      if (data.success) {
        setVoiceFeedback(`已移动事件: ${event.title}`);
        fetchEvents();
      }
    } catch (error) {
      console.error('Error moving event:', error);
      setVoiceFeedback('移动事件失败，请重试');
    }
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleSaveApiKey = (config: { deepseekApiKey: string }) => {
    setApiKey(config.deepseekApiKey);

    localStorage.setItem('deepseek_api_key', config.deepseekApiKey);

    const backendConfig: any = {};
    if (config.deepseekApiKey) backendConfig.api_key = config.deepseekApiKey;

    fetch('http://localhost:8000/api/voice/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backendConfig)
    });

    setVoiceFeedback('语音设置已保存');
    setTimeout(() => setVoiceFeedback(null), 2000);
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'create':
        setSelectedDate(new Date());
        setSelectedEvent(null);
        setModalOpen(true);
        break;
      case 'add_todo':
        setSelectedDate(new Date());
        setSelectedTodo(null);
        setTodoModalOpen(true);
        break;
      case 'today':
        handleToday();
        setView('day');
        break;
      case 'view_todos':
        handleToday();
        setView('day');
        break;
      case 'week':
        handleToday();
        setView('week');
        break;
      case 'month':
        handleToday();
        setView('month');
        break;
      case 'settings':
        setSettingsOpen(true);
        break;
    }
  };

  const handleSaveEvent = async (event: { id?: number; title: string; start_time: string; end_time: string; description?: string; location?: string; reminder_minutes?: number; progress?: number }) => {
    try {
      const method = event.id ? 'PUT' : 'POST';
      const url = event.id
        ? `http://localhost:8000/api/events/${event.id}`
        : 'http://localhost:8000/api/events';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event)
      });

      const data = await response.json();
      if (data.success) {
        setModalOpen(false);
        setSelectedEvent(null);
        fetchEvents();
      } else {
        console.error('Save failed:', data.error);
        setVoiceFeedback(`保存失败: ${data.error || '请重试'}`);
        setTimeout(() => setVoiceFeedback(null), 3000);
      }
    } catch (error) {
      console.error('Error saving event:', error);
      setVoiceFeedback('保存失败，请检查网络连接');
      setTimeout(() => setVoiceFeedback(null), 3000);
    }
  };

  const handleDeleteEvent = async (id: number) => {
    try {
      const response = await fetch(`http://localhost:8000/api/events/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        setModalOpen(false);
        fetchEvents();
      }
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  const handleToggleTodo = async (id: number) => {
    try {
      const response = await fetch(`http://localhost:8000/api/todos/${id}/toggle`, {
        method: 'PUT'
      });

      const data = await response.json();
      if (data.success) {
        fetchTodos();
      }
    } catch (error) {
      console.error('Error toggling todo:', error);
    }
  };

  const handleUpdateTodoProgress = async (id: number, progress: number) => {
    try {
      const response = await fetch(`http://localhost:8000/api/todos/${id}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress })
      });

      const data = await response.json();
      if (data.success) {
        fetchTodos();
      }
    } catch (error) {
      console.error('Error updating todo progress:', error);
    }
  };

  const handleUpdateEventProgress = async (id: number, progress: number) => {
    try {
      const response = await fetch(`http://localhost:8000/api/events/${id}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress })
      });

      const data = await response.json();
      if (data.success) {
        fetchEvents();
      }
    } catch (error) {
      console.error('Error updating event progress:', error);
    }
  };

  const handleSaveTodo = async (todo: { id?: number; title: string; date: string; priority?: string; auto_postpone?: boolean }) => {
    try {
      const method = todo.id ? 'PUT' : 'POST';
      const url = todo.id
        ? `http://localhost:8000/api/todos/${todo.id}`
        : 'http://localhost:8000/api/todos';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(todo)
      });

      const data = await response.json();
      if (data.success) {
        setTodoModalOpen(false);
        fetchTodos();
      }
    } catch (error) {
      console.error('Error saving todo:', error);
    }
  };

  const handleDeleteTodo = async (id: number) => {
    try {
      const response = await fetch(`http://localhost:8000/api/todos/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        setTodoModalOpen(false);
        fetchTodos();
      }
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  };

  const handleDateClickForTodo = (date: Date) => {
    setSelectedDate(date);
    setSelectedTodo(null);
    setTodoModalOpen(true);
  };

  const filteredEvents = events.filter(event => {
    if (calendars.length === 0) return true;
    const calendarId = event.id % calendars.length || 1;
    return activeCalendars.includes(calendarId);
  });

  const getTodosForDate = (date: Date) => {
    const dateStr = toLocalDateStr(date);
    return todos.filter(todo => todo.date === dateStr);
  };

  const overallProgress = todos.length > 0
    ? Math.round(todos.reduce((sum, t) => sum + t.progress, 0) / todos.length)
    : 0;

  return (
    <div className="app">
      <Header
        onDateDoubleClick={() => { setView('month'); setCurrentDate(new Date()); }}
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="app-body">
        <Sidebar
          view={view}
          onViewChange={setView}
          currentDate={currentDate}
          onToday={handleToday}
          onPrev={handlePrev}
          onNext={handleNext}
          calendars={calendars}
          onCalendarToggle={handleCalendarToggle}
          activeCalendars={activeCalendars}
          isListening={isListening}
          voiceStatus={speechStatus}
          onVoiceToggle={handleVoiceToggle}
          isSupported={isSupported}
          onQuickAction={handleQuickAction}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="main-content">
          <div className="content-wrapper">
            {view === 'month' && (
              <MonthView
                currentDate={currentDate}
                events={filteredEvents}
                todos={todos}
                onDateClick={handleDateSelect}
                onEventClick={handleEventClick}
                onTodoToggle={handleToggleTodo}
                onDateClickForTodo={handleDateClickForTodo}
              />
            )}
            {view === 'week' && (
              <WeekView
                currentDate={currentDate}
                events={filteredEvents}
                todos={todos}
                onTimeClick={handleTimeClick}
                onEventClick={handleEventClick}
                onEventDrop={handleEventDrop}
                onTodoToggle={handleToggleTodo}
              />
            )}
            {view === 'day' && (
              <DayView
                currentDate={currentDate}
                events={filteredEvents}
                todos={getTodosForDate(currentDate)}
                onTimeClick={handleTimeClick}
                onEventClick={handleEventClick}
                onTodoToggle={handleToggleTodo}
                onTodoProgressUpdate={handleUpdateTodoProgress}
                onEventProgressUpdate={handleUpdateEventProgress}
                onAddTodo={() => handleDateClickForTodo(currentDate)}
              />
            )}
          </div>

          <div className="progress-bar-container">
            <div className="progress-label">
              <span>今日进度</span>
              <span>{overallProgress}%</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${overallProgress}%` }}
              ></div>
            </div>
          </div>
        </main>
      </div>

      <VoiceFeedback
        isListening={isListening}
        transcript={interimTranscript}
        feedback={voiceFeedback}
        error={speechError}
        isSpeaking={isSpeaking}
        status={speechStatus}
      />

      <VoiceLLMFeedback
        status={llmStatus}
        rawText={llmRawText}
        result={llmResult}
        error={llmError}
        onConfirm={handleLLMConfirm}
        onCancel={handleLLMCancel}
      />

      <EventModal
        event={selectedEvent}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        isEdit={!!selectedEvent}
      />

      <TodoModal
        todo={selectedTodo}
        isOpen={todoModalOpen}
        onClose={() => setTodoModalOpen(false)}
        onSave={handleSaveTodo}
        onDelete={handleDeleteTodo}
        selectedDate={selectedDate}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveApiKey}
        currentConfig={{
          deepseekApiKey: apiKey,
        }}
      />
    </div>
  );
}

export default App
