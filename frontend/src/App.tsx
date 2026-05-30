import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import MonthView from './components/MonthView'
import WeekView from './components/WeekView'
import DayView from './components/DayView'
import EventModal from './components/EventModal'
import VoiceFeedback from './components/VoiceFeedback'
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

interface Calendar {
  id: number;
  name: string;
  color: string;
}

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('month');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [activeCalendars, setActiveCalendars] = useState<number[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [_selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [voiceFeedback, setVoiceFeedback] = useState<string | null>(null);

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
    requestPermission();
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

  const handleVoiceCommand = useCallback(async (text: string) => {
    const command = parseVoiceCommand(text);
    console.log('Parsed command:', command);

    switch (command.intent) {
      case 'create_event':
        await handleVoiceCreateEvent(command);
        break;
      case 'view_events':
        handleVoiceViewEvents(command);
        break;
      case 'delete_event':
        setVoiceFeedback('请在界面上选择要删除的事件');
        break;
      default:
        setVoiceFeedback('抱歉，我没有理解您的指令。请试试"创建事件"或"查看今天"');
    }

    setTimeout(() => setVoiceFeedback(null), 3000);
    resetTranscript();
  }, []);

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
      reminder_minutes: 15
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

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
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

  const filteredEvents = events.filter(event =>
    activeCalendars.includes(event.id % calendars.length || 1)
  );

  return (
    <div className="app">
      <Header
        currentDate={currentDate}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        view={view}
        onViewChange={setView}
        onVoiceStart={handleVoiceToggle}
        isListening={isListening}
        isSupported={isSupported}
      />

      <div className="app-body">
        <Sidebar
          currentDate={currentDate}
          onDateSelect={handleDateSelect}
          calendars={calendars}
          onCalendarToggle={handleCalendarToggle}
          activeCalendars={activeCalendars}
        />

        <main className="main-content">
          {view === 'month' && (
            <MonthView
              currentDate={currentDate}
              events={filteredEvents}
              onDateClick={handleDateSelect}
              onEventClick={handleEventClick}
            />
          )}
          {view === 'week' && (
            <WeekView
              currentDate={currentDate}
              events={filteredEvents}
              onTimeClick={handleTimeClick}
              onEventClick={handleEventClick}
            />
          )}
          {view === 'day' && (
            <DayView
              currentDate={currentDate}
              events={filteredEvents}
              onTimeClick={handleTimeClick}
              onEventClick={handleEventClick}
            />
          )}
        </main>
      </div>

      <VoiceFeedback
        isListening={isListening}
        transcript={interimTranscript}
        feedback={voiceFeedback}
        error={speechError}
        isSpeaking={isSpeaking}
      />

      <EventModal
        event={selectedEvent}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        isEdit={!!selectedEvent}
      />
    </div>
  )
}

export default App
