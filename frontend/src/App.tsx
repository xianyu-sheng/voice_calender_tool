import { useState, useEffect } from 'react'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import MonthView from './components/MonthView'
import WeekView from './components/WeekView'
import DayView from './components/DayView'
import EventModal from './components/EventModal'
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
  const [isListening, setIsListening] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [_selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchCalendars();
    fetchEvents();
  }, []);

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

  const handleVoiceStart = () => {
    setIsListening(!isListening);
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
        onVoiceStart={handleVoiceStart}
        isListening={isListening}
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
