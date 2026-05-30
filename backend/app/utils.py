from datetime import datetime, timedelta
from . import db
from .models import Event, Calendar, Reminder

def create_event(title, start_time, end_time, description=None, location=None,
                 is_all_day=False, reminder_minutes=15, calendar_id=None):
    event = Event(
        title=title,
        description=description,
        start_time=start_time,
        end_time=end_time,
        location=location,
        is_all_day=is_all_day,
        reminder_minutes=reminder_minutes,
        calendar_id=calendar_id
    )
    db.session.add(event)
    db.session.commit()

    if reminder_minutes and reminder_minutes > 0:
        reminder_time = start_time - timedelta(minutes=reminder_minutes)
        create_reminder(event.id, reminder_time)

    return event

def get_event(event_id):
    return Event.query.get(event_id)

def get_events(start_date=None, end_date=None, calendar_id=None):
    query = Event.query
    if start_date:
        query = query.filter(Event.start_time >= start_date)
    if end_date:
        query = query.filter(Event.end_time <= end_date)
    if calendar_id:
        query = query.filter(Event.calendar_id == calendar_id)
    return query.order_by(Event.start_time).all()

def update_event(event_id, **kwargs):
    event = Event.query.get(event_id)
    if not event:
        return None
    for key, value in kwargs.items():
        if hasattr(event, key):
            setattr(event, key, value)
    db.session.commit()
    return event

def delete_event(event_id):
    event = Event.query.get(event_id)
    if not event:
        return False
    db.session.delete(event)
    db.session.commit()
    return True

def create_calendar(name, color='#1890ff', is_default=False):
    calendar = Calendar(name=name, color=color, is_default=is_default)
    db.session.add(calendar)
    db.session.commit()
    return calendar

def get_calendars():
    return Calendar.query.all()

def create_reminder(event_id, reminder_time):
    reminder = Reminder(event_id=event_id, reminder_time=reminder_time)
    db.session.add(reminder)
    db.session.commit()
    return reminder

def get_pending_reminders():
    now = datetime.utcnow()
    return Reminder.query.filter(
        Reminder.reminder_time <= now,
        Reminder.is_sent == False
    ).all()

def mark_reminder_sent(reminder_id):
    reminder = Reminder.query.get(reminder_id)
    if reminder:
        reminder.is_sent = True
        db.session.commit()
    return reminder
