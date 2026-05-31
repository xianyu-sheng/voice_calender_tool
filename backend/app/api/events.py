from flask import Blueprint, request, jsonify
from datetime import datetime
from ..utils import create_event, get_event, get_events, update_event, delete_event, update_event_progress

events_bp = Blueprint('events', __name__)

@events_bp.route('/api/events', methods=['POST'])
def create():
    data = request.get_json()
    if not data or not data.get('title') or not data.get('start_time') or not data.get('end_time'):
        return jsonify({'success': False, 'error': '缺少必要参数'}), 400

    try:
        start_time = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))
    except ValueError:
        return jsonify({'success': False, 'error': '时间格式无效'}), 400

    event = create_event(
        title=data['title'],
        start_time=start_time,
        end_time=end_time,
        description=data.get('description'),
        location=data.get('location'),
        is_all_day=data.get('is_all_day', False),
        reminder_minutes=data.get('reminder_minutes', 15),
        calendar_id=data.get('calendar_id')
    )

    return jsonify({'success': True, 'data': event.to_dict()}), 201

@events_bp.route('/api/events', methods=['GET'])
def get_all():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    calendar_id = request.args.get('calendar_id')

    start = datetime.fromisoformat(start_date) if start_date else None
    end = datetime.fromisoformat(end_date) if end_date else None

    events = get_events(start, end, calendar_id)
    return jsonify({'success': True, 'data': [e.to_dict() for e in events]})

@events_bp.route('/api/events/<int:event_id>', methods=['GET'])
def get_one(event_id):
    event = get_event(event_id)
    if not event:
        return jsonify({'success': False, 'error': '事件不存在'}), 404
    return jsonify({'success': True, 'data': event.to_dict()})

@events_bp.route('/api/events/<int:event_id>', methods=['PUT'])
def update(event_id):
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': '缺少参数'}), 400

    if 'start_time' in data:
        data['start_time'] = datetime.fromisoformat(data['start_time'].replace('Z', '+00:00'))
    if 'end_time' in data:
        data['end_time'] = datetime.fromisoformat(data['end_time'].replace('Z', '+00:00'))

    event = update_event(event_id, **data)
    if not event:
        return jsonify({'success': False, 'error': '事件不存在'}), 404

    return jsonify({'success': True, 'data': event.to_dict()})

@events_bp.route('/api/events/<int:event_id>', methods=['DELETE'])
def delete(event_id):
    if delete_event(event_id):
        return jsonify({'success': True, 'message': '事件已删除'})
    return jsonify({'success': False, 'error': '事件不存在'}), 404

@events_bp.route('/api/events/<int:event_id>/progress', methods=['PUT'])
def update_progress(event_id):
    data = request.get_json()
    if not data or 'progress' not in data:
        return jsonify({'success': False, 'error': '缺少progress参数'}), 400

    progress = data['progress']
    if not isinstance(progress, int) or progress < 0 or progress > 100:
        return jsonify({'success': False, 'error': 'progress必须是0-100的整数'}), 400

    event = update_event_progress(event_id, progress)
    if not event:
        return jsonify({'success': False, 'error': '事件不存在'}), 404

    return jsonify({'success': True, 'data': event.to_dict()})

@events_bp.route('/api/events/range', methods=['GET'])
def get_by_range():
    start = request.args.get('start')
    end = request.args.get('end')

    if not start or not end:
        return jsonify({'success': False, 'error': '需要start和end参数'}), 400

    try:
        start_date = datetime.fromisoformat(start)
        end_date = datetime.fromisoformat(end)
    except ValueError:
        return jsonify({'success': False, 'error': '时间格式无效'}), 400

    events = get_events(start_date, end_date)
    return jsonify({'success': True, 'data': [e.to_dict() for e in events]})
