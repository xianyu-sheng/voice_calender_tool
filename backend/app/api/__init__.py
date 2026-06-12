from .events import events_bp
from .calendars import calendars_bp
from .reminders import reminders_bp
from .todos import todos_bp
from .voice import voice_bp
from .weather import weather_bp
from .sync import sync_bp
from .backup import backup_bp
from .desktop import desktop_bp
from .assistant import assistant_bp

__all__ = [
    'events_bp',
    'calendars_bp',
    'reminders_bp',
    'todos_bp',
    'voice_bp',
    'weather_bp',
    'sync_bp',
    'backup_bp',
    'desktop_bp',
    'assistant_bp',
]
