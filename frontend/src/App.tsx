import { useState, useEffect, useCallback } from 'react'
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
      handleVoiceCommand(transcript);
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

      try {
        // 模拟解析过程延迟
        setTimeout(() => setLlmStatus('parsing'), 800);

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

          // 返回解析结果
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
            rawText: text
          };
        }
      } catch (error) {
        console.error('LLM parse error:', error);
        setLlmError('网络错误，请检查连接');
        setLlmStatus('error');
      }
    }
    return parseVoiceCommand(text);
  };

  const handleVoiceCommand = useCallback(async (text: string) => {
    const command = await parseWithHybrid(text);
    console.log('Parsed command:', command);

    // 如果是 LLM 结果，等待用户确认
    if (llmStatus === 'result' && command.source === 'llm') {
      setPendingCommand(command);
      return; // 不立即执行，等待用户确认
    }

    // 正则解析的结果直接执行
    executeCommand(command);
  }, [apiKey, llmStatus]);

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

  // 确认 LLM 结果
  const handleLLMConfirm = async () => {
    if (pendingCommand) {
      setLlmStatus('idle');
      await executeCommand(pendingCommand);
      setPendingCommand(null);
    }
  };

  // 取消 LLM 结果
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
    endDate.setHours(endDate.getHours() + 1);

    const eventData = {
      title: command.title || '新事件',
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      location: command.location,
      reminder_minutes: command.reminderMinutes || 15
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
    const today = new Date().toISOString().split('T')[0];
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

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('deepseek_api_key', key);
    if (key) {
      fetch('http://localhost:8000/api/voice/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key })
      });
    }
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

  const handleSaveEvent = async (event: { id?: number; title: string; start_time: string; end_time: string; description?: string; location?: string; reminder_minutes?: number }) => {
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
        fetchEvents();
      }
    } catch (error) {
      console.error('Error saving event:', error);
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
    const dateStr = date.toISOString().split('T')[0];
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
        currentApiKey={apiKey}
      />
    </div>
  );
}

export default App
