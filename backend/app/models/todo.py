from datetime import datetime, date
from .. import db

class Todo(db.Model):
    __tablename__ = 'todos'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    title = db.Column(db.String(200), nullable=False)
    date = db.Column(db.Date, nullable=False)
    completed = db.Column(db.Boolean, default=False)
    progress = db.Column(db.Integer, default=0)
    priority = db.Column(db.String(20), default='medium')  # low, medium, high
    auto_postpone = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'date': self.date.isoformat() if self.date else None,
            'completed': self.completed,
            'progress': self.progress,
            'priority': self.priority,
            'auto_postpone': self.auto_postpone,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def __repr__(self):
        return f'<Todo {self.title}>'
