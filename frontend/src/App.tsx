import { useState, useEffect, useRef } from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import MonthView from './components/MonthView'
import WeekView from './components/WeekView'
import DayView from './components/DayView'
import EventModal from './components/EventModal'
import TodoModal from './components/TodoModal'
import SettingsModal from './components/SettingsModal'
import SyncModal from './components/SyncModal'
import VoiceFeedback from './components/VoiceFeedback'
import VoiceLLMFeedback from './components/VoiceLLMFeedback'
import { useSpeechRecognition } from './hooks/useSpeechRecognition'
import { useSpeechSynthesis } from './hooks/useSpeechSynthesis'
import { useReminder } from './hooks/useReminder'
import { parseVoiceCommand } from './utils/voiceCommandParser'
import type { ParsedCommand } from './utils/voiceCommandParser'
import { apiFetch, apiUrl } from './utils/api'
import { toLocalDateStr, todayStr } from './utils/dateUtils'
import type { WeatherForecast } from './utils/weatherUtils'
import { getWeatherDisplay } from './utils/weatherUtils'
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

interface WeatherLocation {
  city: string;
  source: 'device' | 'manual' | 'fallback';
  latitude?: number;
  longitude?: number;
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

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
  const [syncOpen, setSyncOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('deepseek_api_key') || '');
  const [weatherCity, setWeatherCity] = useState<string>(() => localStorage.getItem('weather_city') || '');
  const [weatherLocation, setWeatherLocation] = useState<WeatherLocation>(() => ({
    city: localStorage.getItem('weather_city') || '正在定位',
    source: 'fallback',
  }));
  const [weatherForecasts, setWeatherForecasts] = useState<Record<string, WeatherForecast>>({});
  const [weatherStatus, setWeatherStatus] = useState<'idle' | 'loading' | 'locating' | 'error'>('idle');
  const [weatherError, setWeatherError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
  });

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
    refreshWeatherByLocation();
    requestPermission();
    autoPostponeTodos();

    // 每次启动时把 localStorage 中的 API key 同步到后端
    const savedDeepseek = localStorage.getItem('deepseek_api_key');

    if (savedDeepseek) {
      const config: any = {};
      if (savedDeepseek) config.api_key = savedDeepseek;

      console.log('[App] 同步 API key 到后端...');
      apiFetch('/api/voice/config', {
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
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
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
      const response = await apiFetch('/api/calendars');
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
      const response = await apiFetch('/api/events');
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
      const response = await apiFetch('/api/todos');
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
      const response = await apiFetch('/api/todos/postpone', {
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
    setLlmStatus('calling');
    setLlmRawText(text);
    setLlmResult(null);
    setLlmError('');

    let parsingTimer: ReturnType<typeof setTimeout> | null = null;

    try {
      parsingTimer = setTimeout(() => setLlmStatus('parsing'), 800);

      const response = await apiFetch('/api/voice/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, use_llm: true, api_key: apiKey || undefined })
      });
      const data = await response.json();

      if (data.success && data.data.source === 'llm') {
        const result = data.data;
        setLlmResult(result);
        setLlmStatus('result');

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

      if (data.data?.llm_error) {
        console.warn('LLM error from backend:', data.data.llm_error);
        setLlmError('DeepSeek 解析失败，已使用本地解析');
        setLlmStatus('error');
      } else {
        setLlmStatus('idle');
      }
    } catch (err) {
      console.error('LLM parse error:', err);
      setLlmError('语义解析服务连接失败，已使用本地解析');
      setLlmStatus('error');
    } finally {
      if (parsingTimer) clearTimeout(parsingTimer);
    }

    // 降级：使用前端正则解析
    const regexResult = parseVoiceCommand(text);
    regexResult.source = 'regex';
    return regexResult;
  };

  const refreshCoreData = () => {
    fetchCalendars();
    fetchEvents();
    fetchTodos();
  };

  useEffect(() => {
    const intervalId = window.setInterval(refreshCoreData, 30000);
    const handleFocus = () => refreshCoreData();

    window.addEventListener('focus', handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const applyWeatherData = (data: any, source: WeatherLocation['source']) => {
    const forecasts: WeatherForecast[] = data.forecasts || [];
    const forecastMap = forecasts.reduce<Record<string, WeatherForecast>>((acc, forecast) => {
      acc[forecast.date] = forecast;
      return acc;
    }, {});
    const place = data.place || {};

    setWeatherForecasts(forecastMap);
    setWeatherLocation({
      city: data.city || place.name || (source === 'device' ? '当前位置' : weatherCity || '备用城市'),
      source,
      latitude: place.latitude,
      longitude: place.longitude,
    });
    setWeatherStatus('idle');
  };

  const fetchWeatherByCity = async (city = weatherCity, source: WeatherLocation['source'] = 'manual') => {
    const normalizedCity = city.trim();
    if (!normalizedCity) {
      setWeatherStatus('error');
      setWeatherError('请先允许定位，或在设置里填写备用城市');
      return;
    }

    setWeatherStatus('loading');
    setWeatherError('');

    try {
      const response = await apiFetch(`/api/weather?city=${encodeURIComponent(normalizedCity)}`);
      const data = await response.json();
      if (data.success) {
        applyWeatherData(data.data, source);
      } else {
        setWeatherError(data.error || '天气获取失败');
        setWeatherStatus('error');
      }
    } catch (error) {
      console.error('Error fetching weather:', error);
      setWeatherError('天气服务连接失败');
      setWeatherStatus('error');
    }
  };

  const fetchWeatherByCoordinates = async (latitude: number, longitude: number) => {
    setWeatherStatus('loading');
    setWeatherError('');

    try {
      const params = new URLSearchParams({
        lat: String(latitude),
        lon: String(longitude),
        label: '当前位置',
      });
      const response = await apiFetch(`/api/weather?${params.toString()}`);
      const data = await response.json();
      if (data.success) {
        applyWeatherData(data.data, 'device');
      } else {
        setWeatherError(data.error || '天气获取失败');
        setWeatherStatus('error');
        if (weatherCity.trim()) {
          fetchWeatherByCity(weatherCity, 'fallback');
        }
      }
    } catch (error) {
      console.error('Error fetching weather by location:', error);
      setWeatherError('天气服务连接失败');
      setWeatherStatus('error');
      if (weatherCity.trim()) {
        fetchWeatherByCity(weatherCity, 'fallback');
      }
    }
  };

  const refreshWeatherByLocation = () => {
    if (!navigator.geolocation) {
      fetchWeatherByCity(weatherCity, 'fallback');
      return;
    }

    setWeatherStatus('locating');
    setWeatherError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        fetchWeatherByCoordinates(latitude, longitude);
      },
      (error) => {
        console.warn('Geolocation failed:', error);
        setWeatherError('无法读取电脑位置，已使用备用城市');
        fetchWeatherByCity(weatherCity, 'fallback');
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const commandNeedsConfirmation = (command: ParsedCommand) => {
    return ['create_event', 'create_todo', 'complete_todo', 'delete_event', 'delete_todo'].includes(command.intent);
  };

  const startOfWeek = (date: Date) => {
    const result = new Date(date);
    const day = result.getDay() || 7;
    result.setDate(result.getDate() - day + 1);
    result.setHours(0, 0, 0, 0);
    return result;
  };

  const resolveQueryDate = (text: string) => {
    const target = new Date();
    if (text.includes('明天')) {
      target.setDate(target.getDate() + 1);
    } else if (text.includes('后天')) {
      target.setDate(target.getDate() + 2);
    }
    target.setHours(0, 0, 0, 0);
    return target;
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = toLocalDateStr(date);
    return events.filter(event => toLocalDateStr(new Date(event.start_time)) === dateStr);
  };

  const getDayLoad = (date: Date) => {
    const dateEvents = getEventsForDate(date);
    const dateTodos = getTodosForDate(date);
    const eventMinutes = dateEvents.reduce((sum, event) => {
      const start = new Date(event.start_time).getTime();
      const end = new Date(event.end_time).getTime();
      return sum + Math.max(0, Math.round((end - start) / 60000));
    }, 0);
    return {
      date,
      events: dateEvents,
      todos: dateTodos,
      score: eventMinutes + dateTodos.filter(todo => !todo.completed).length * 45,
    };
  };

  const formatEventBrief = (event: CalendarEvent) => {
    const start = new Date(event.start_time);
    return `${start.getHours().toString().padStart(2, '0')}:${start.getMinutes().toString().padStart(2, '0')} ${event.title}`;
  };

  const runAssistantQuery = async (text: string) => {
    try {
      const response = await apiFetch('/api/assistant/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          weather_forecasts: weatherForecasts,
          weather_location: weatherLocation,
        }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'assistant query failed');
      }

      const result = data.data;
      if (result?.date) {
        const targetDate = new Date(`${result.date}T00:00:00`);
        if (!Number.isNaN(targetDate.getTime())) {
          setCurrentDate(targetDate);
        }
      }
      if (result?.view === 'day' || result?.view === 'week' || result?.view === 'month') {
        setView(result.view);
      }

      return result?.answer || '我已经帮你看过了。';
    } catch (error) {
      console.error('Assistant query error:', error);
      return answerScheduleQuestion(text);
    }
  };

  const answerScheduleQuestion = (text: string) => {
    if (text.includes('哪天') && (text.includes('空') || text.includes('有空'))) {
      const weekStart = startOfWeek(text.includes('下周') ? new Date(Date.now() + 7 * 86400000) : new Date());
      const searchStart = text.includes('下周') ? weekStart : new Date(Math.max(weekStart.getTime(), new Date().setHours(0, 0, 0, 0)));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const dayCount = Math.max(1, Math.round((weekEnd.getTime() - searchStart.getTime()) / 86400000) + 1);
      const weekLoads = Array.from({ length: dayCount }, (_, index) => {
        const date = new Date(searchStart);
        date.setDate(searchStart.getDate() + index);
        return getDayLoad(date);
      });
      const lightest = [...weekLoads].sort((a, b) => a.score - b.score)[0];
      const weekday = lightest.date.toLocaleDateString('zh-CN', { weekday: 'long', month: 'numeric', day: 'numeric' });
      setCurrentDate(lightest.date);
      setView('week');
      return `${weekday}相对比较空，有 ${lightest.events.length} 个日程、${lightest.todos.length} 个任务。`;
    }

    const targetDate = resolveQueryDate(text);
    const dateLabel = text.includes('明天') ? '明天' : text.includes('后天') ? '后天' : '今天';
    const dateEvents = getEventsForDate(targetDate);
    const dateTodos = getTodosForDate(targetDate);
    const forecast = weatherForecasts[toLocalDateStr(targetDate)];
    const weather = getWeatherDisplay(forecast);

    setCurrentDate(targetDate);
    setView('day');

    if (text.includes('天气') || text.includes('出门') || text.includes('外出')) {
      if (weather.unavailable) {
        return `${dateLabel}暂时没有可用天气预报，我已经切到${dateLabel}的日程。`;
      }
      const rainy = ['雨', '雷', '雪'].some(keyword => weather.label.includes(keyword));
      const taskText = dateEvents.length || dateTodos.length
        ? `另外你有 ${dateEvents.length} 个日程、${dateTodos.length} 个任务。`
        : '当天安排不多。';
      return `${dateLabel}${weather.label}，${weather.temperature || '温度暂无'}。${rainy ? '出门建议带伞并预留路上时间。' : '天气看起来适合出门。'}${taskText}`;
    }

    if (dateEvents.length === 0 && dateTodos.length === 0) {
      return `${dateLabel}暂时没有日程和任务，比较空。`;
    }

    const eventText = dateEvents.length
      ? `日程有 ${dateEvents.slice(0, 3).map(formatEventBrief).join('、')}`
      : '没有日程';
    const todoText = dateTodos.length
      ? `任务有 ${dateTodos.slice(0, 3).map(todo => todo.title).join('、')}`
      : '没有任务';
    return `${dateLabel}${eventText}；${todoText}。`;
  };

  const showCommandConfirmation = (command: ParsedCommand) => {
    setPendingCommand(command);
    setLlmRawText(command.rawText);
    setLlmError('');
    setLlmResult({
      intent: command.intent,
      title: command.title,
      date: command.date,
      time: command.time,
      end_time: command.end_time,
      location: command.location,
      description: command.description,
      priority: command.priority,
      reminder_minutes: command.reminderMinutes,
      source: command.source,
    });
    setLlmStatus('result');
  };

  const handleVoiceCommand = async (text: string) => {
    console.log('🔊 语音输入:', text);

    const localCommand = parseVoiceCommand(text);
    if (localCommand.intent === 'assistant_query') {
      localCommand.source = 'regex';
      setLlmStatus('idle');
      setLlmResult(null);
      await executeCommand(localCommand);
      return;
    }

    const command = await parseWithHybrid(text);
    console.log('📋 解析结果:', command);

    if (commandNeedsConfirmation(command)) {
      showCommandConfirmation(command);
      return;
    }

    setLlmStatus('idle');
    setLlmResult(null);

    await executeCommand(command);
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
      case 'assistant_query':
        setVoiceFeedback(await runAssistantQuery(command.rawText));
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
      const response = await apiFetch('/api/events', {
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
      const response = await apiFetch('/api/todos', {
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
      const response = await apiFetch(`/api/events/${eventId}`, {
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

  const handleSaveSettings = (config: { deepseekApiKey: string; weatherCity: string }) => {
    setApiKey(config.deepseekApiKey);

    localStorage.setItem('deepseek_api_key', config.deepseekApiKey);

    const nextWeatherCity = config.weatherCity.trim();
    setWeatherCity(nextWeatherCity);
    if (nextWeatherCity) {
      localStorage.setItem('weather_city', nextWeatherCity);
      fetchWeatherByCity(nextWeatherCity, 'manual');
    } else {
      localStorage.removeItem('weather_city');
      refreshWeatherByLocation();
    }

    const backendConfig: any = {};
    if (config.deepseekApiKey) backendConfig.api_key = config.deepseekApiKey;

    apiFetch('/api/voice/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backendConfig)
    });

    setVoiceFeedback('设置已保存');
    setTimeout(() => setVoiceFeedback(null), 2000);
  };

  const handleInstallApp = async () => {
    if (!installPrompt) {
      return false;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      setInstallPrompt(null);
      setIsStandalone(true);
      return true;
    }

    return false;
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
      case 'sync':
        setSyncOpen(true);
        break;
    }
  };

  const handleSaveEvent = async (event: { id?: number; title: string; start_time: string; end_time: string; description?: string; location?: string; reminder_minutes?: number; progress?: number }) => {
    try {
      const method = event.id ? 'PUT' : 'POST';
      const url = event.id
        ? apiUrl(`/api/events/${event.id}`)
        : apiUrl('/api/events');

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
      const response = await apiFetch(`/api/events/${id}`, {
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
      const response = await apiFetch(`/api/todos/${id}/toggle`, {
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
      const response = await apiFetch(`/api/todos/${id}/progress`, {
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
      const response = await apiFetch(`/api/events/${id}/progress`, {
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
        ? apiUrl(`/api/todos/${todo.id}`)
        : apiUrl('/api/todos');

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
      const response = await apiFetch(`/api/todos/${id}`, {
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
                weatherForecasts={weatherForecasts}
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
                weatherForecasts={weatherForecasts}
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
                weatherForecasts={weatherForecasts}
                weatherLocation={weatherLocation}
                weatherStatus={weatherStatus}
                weatherError={weatherError}
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
        onSave={handleSaveSettings}
        currentConfig={{
          deepseekApiKey: apiKey,
          weatherCity,
        }}
      />

      <SyncModal
        isOpen={syncOpen}
        isInstallable={!!installPrompt}
        isStandalone={isStandalone}
        onClose={() => setSyncOpen(false)}
        onInstall={handleInstallApp}
        onRefreshData={refreshCoreData}
      />
    </div>
  );
}

export default App
