from flask import Blueprint, request, jsonify
from datetime import datetime
from ..utils import create_reminder, get_pending_reminders, mark_reminder_sent
from ..models import Reminder
from .. import db

reminders_bp = Blueprint('reminders', __name__)

@reminders_bp.route('/api/reminders', methods=['POST'])
def create():
    data = request.get_json()
    if not data or not data.get('event_id') or not data.get('reminder_time'):
        return jsonify({'success': False, 'error': '缺少必要参数'}), 400

    try:
        reminder_time = datetime.fromisoformat(data['reminder_time'].replace('Z', '+00:00'))
    except ValueError:
        return jsonify({'success': False, 'error': '时间格式无效'}), 400

    reminder = create_reminder(
        event_id=data['event_id'],
        reminder_time=reminder_time
    )

    return jsonify({'success': True, 'data': reminder.to_dict()}), 201

@reminders_bp.route('/api/reminders', methods=['GET'])
def get_all():
    reminders = Reminder.query.all()
    return jsonify({'success': True, 'data': [r.to_dict() for r in reminders]})

@reminders_bp.route('/api/reminders/pending', methods=['GET'])
def get_pending():
    reminders = get_pending_reminders()
    return jsonify({'success': True, 'data': [r.to_dict() for r in reminders]})

@reminders_bp.route('/api/reminders/<int:reminder_id>/sent', methods=['PUT'])
def mark_sent(reminder_id):
    reminder = mark_reminder_sent(reminder_id)
    if not reminder:
        return jsonify({'success': False, 'error': '提醒不存在'}), 404
    return jsonify({'success': True, 'data': reminder.to_dict()})

@reminders_bp.route('/api/reminders/<int:reminder_id>', methods=['DELETE'])
def delete(reminder_id):
    reminder = Reminder.query.get(reminder_id)
    if not reminder:
        return jsonify({'success': False, 'error': '提醒不存在'}), 404

    db.session.delete(reminder)
    db.session.commit()
    return jsonify({'success': True, 'message': '提醒已删除'})
