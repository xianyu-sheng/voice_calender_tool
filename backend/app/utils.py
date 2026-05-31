from datetime import datetime, timedelta, date
from . import db
from .models import Event, Calendar, Reminder, Todo

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

def create_todo(title, todo_date, priority='medium', auto_postpone=True):
    todo = Todo(
        title=title,
        date=todo_date,
        priority=priority,
        auto_postpone=auto_postpone
    )
    db.session.add(todo)
    db.session.commit()
    return todo

def get_todo(todo_id):
    return Todo.query.get(todo_id)

def get_todos(start_date=None, end_date=None):
    query = Todo.query
    if start_date:
        query = query.filter(Todo.date >= start_date)
    if end_date:
        query = query.filter(Todo.date <= end_date)
    return query.order_by(Todo.date, Todo.priority).all()

def update_todo(todo_id, **kwargs):
    todo = Todo.query.get(todo_id)
    if not todo:
        return None
    for key, value in kwargs.items():
        if hasattr(todo, key):
            setattr(todo, key, value)
    db.session.commit()
    return todo

def delete_todo(todo_id):
    todo = Todo.query.get(todo_id)
    if not todo:
        return False
    db.session.delete(todo)
    db.session.commit()
    return True

def toggle_todo(todo_id):
    todo = Todo.query.get(todo_id)
    if not todo:
        return None
    todo.completed = not todo.completed
    if todo.completed:
        todo.progress = 100
    db.session.commit()
    return todo

def update_todo_progress(todo_id, progress):
    todo = Todo.query.get(todo_id)
    if not todo:
        return None
    todo.progress = progress
    if progress >= 100:
        todo.completed = True
    db.session.commit()
    return todo

def postpone_todos():
    today = date.today()
    yesterday = today - timedelta(days=1)
    todos_to_postpone = Todo.query.filter(
        Todo.date <= yesterday,
        Todo.completed == False,
        Todo.auto_postpone == True
    ).all()

    for todo in todos_to_postpone:
        todo.date = today

    db.session.commit()
    return len(todos_to_postpone)
