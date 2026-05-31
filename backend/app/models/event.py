from datetime import datetime
from .. import db

class Event(db.Model):
    __tablename__ = 'events'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    location = db.Column(db.String(200), nullable=True)
    is_all_day = db.Column(db.Boolean, default=False)
    reminder_minutes = db.Column(db.Integer, default=15)
    recurrence_rule = db.Column(db.String(100), nullable=True)
    progress = db.Column(db.Integer, default=0)
    calendar_id = db.Column(db.Integer, db.ForeignKey('calendars.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    calendar = db.relationship('Calendar', backref=db.backref('events', lazy=True))
    reminders = db.relationship('Reminder', backref=db.backref('event', lazy=True), cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'start_time': self.start_time.isoformat() if self.start_time else None,
            'end_time': self.end_time.isoformat() if self.end_time else None,
            'location': self.location,
            'is_all_day': self.is_all_day,
            'progress': getattr(self, 'progress', 0),
            'reminder_minutes': self.reminder_minutes,
            'recurrence_rule': self.recurrence_rule,
            'calendar_id': self.calendar_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self):
        return f'<Event {self.title}>'
