from flask import Blueprint, request, jsonify
from ..utils import create_calendar, get_calendars
from ..models import Calendar
from .. import db

calendars_bp = Blueprint('calendars', __name__)

@calendars_bp.route('/api/calendars', methods=['POST'])
def create():
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({'success': False, 'error': '缺少日历名称'}), 400

    calendar = create_calendar(
        name=data['name'],
        color=data.get('color', '#1890ff'),
        is_default=data.get('is_default', False)
    )

    return jsonify({'success': True, 'data': calendar.to_dict()}), 201

@calendars_bp.route('/api/calendars', methods=['GET'])
def get_all():
    calendars = get_calendars()
    return jsonify({'success': True, 'data': [c.to_dict() for c in calendars]})

@calendars_bp.route('/api/calendars/<int:calendar_id>', methods=['PUT'])
def update(calendar_id):
    calendar = Calendar.query.get(calendar_id)
    if not calendar:
        return jsonify({'success': False, 'error': '日历不存在'}), 404

    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': '缺少参数'}), 400

    if 'name' in data:
        calendar.name = data['name']
    if 'color' in data:
        calendar.color = data['color']
    if 'is_default' in data:
        calendar.is_default = data['is_default']

    db.session.commit()
    return jsonify({'success': True, 'data': calendar.to_dict()})

@calendars_bp.route('/api/calendars/<int:calendar_id>', methods=['DELETE'])
def delete(calendar_id):
    calendar = Calendar.query.get(calendar_id)
    if not calendar:
        return jsonify({'success': False, 'error': '日历不存在'}), 404

    db.session.delete(calendar)
    db.session.commit()
    return jsonify({'success': True, 'message': '日历已删除'})
