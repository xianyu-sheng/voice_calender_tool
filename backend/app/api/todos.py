from flask import Blueprint, request, jsonify
from datetime import datetime, date
from ..utils import create_todo, get_todo, get_todos, update_todo, delete_todo, toggle_todo, update_todo_progress, postpone_todos

todos_bp = Blueprint('todos', __name__)

@todos_bp.route('/api/todos', methods=['POST'])
def create():
    data = request.get_json()
    if not data or not data.get('title'):
        return jsonify({'success': False, 'error': '缺少必要参数'}), 400

    try:
        todo_date = date.fromisoformat(data['date']) if data.get('date') else date.today()
    except ValueError:
        return jsonify({'success': False, 'error': '日期格式无效'}), 400

    todo = create_todo(
        title=data['title'],
        todo_date=todo_date,
        priority=data.get('priority', 'medium'),
        auto_postpone=data.get('auto_postpone', True)
    )

    return jsonify({'success': True, 'data': todo.to_dict()}), 201

@todos_bp.route('/api/todos', methods=['GET'])
def get_all():
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    start = date.fromisoformat(start_date) if start_date else None
    end = date.fromisoformat(end_date) if end_date else None

    todos = get_todos(start, end)
    return jsonify({'success': True, 'data': [t.to_dict() for t in todos]})

@todos_bp.route('/api/todos/<int:todo_id>', methods=['GET'])
def get_one(todo_id):
    todo = get_todo(todo_id)
    if not todo:
        return jsonify({'success': False, 'error': '任务不存在'}), 404
    return jsonify({'success': True, 'data': todo.to_dict()})

@todos_bp.route('/api/todos/<int:todo_id>', methods=['PUT'])
def update(todo_id):
    data = request.get_json()
    if not data:
        return jsonify({'success': False, 'error': '缺少参数'}), 400

    if 'date' in data:
        try:
            data['date'] = date.fromisoformat(data['date'])
        except ValueError:
            return jsonify({'success': False, 'error': '日期格式无效'}), 400

    todo = update_todo(todo_id, **data)
    if not todo:
        return jsonify({'success': False, 'error': '任务不存在'}), 404

    return jsonify({'success': True, 'data': todo.to_dict()})

@todos_bp.route('/api/todos/<int:todo_id>', methods=['DELETE'])
def delete(todo_id):
    if delete_todo(todo_id):
        return jsonify({'success': True, 'message': '任务已删除'})
    return jsonify({'success': False, 'error': '任务不存在'}), 404

@todos_bp.route('/api/todos/<int:todo_id>/toggle', methods=['PUT'])
def toggle(todo_id):
    todo = toggle_todo(todo_id)
    if not todo:
        return jsonify({'success': False, 'error': '任务不存在'}), 404
    return jsonify({'success': True, 'data': todo.to_dict()})

@todos_bp.route('/api/todos/<int:todo_id>/progress', methods=['PUT'])
def update_progress(todo_id):
    data = request.get_json()
    if not data or 'progress' not in data:
        return jsonify({'success': False, 'error': '缺少progress参数'}), 400

    progress = data['progress']
    if not isinstance(progress, (int, float)) or progress < 0 or progress > 100:
        return jsonify({'success': False, 'error': 'progress必须是0-100之间的数字'}), 400

    todo = update_todo_progress(todo_id, progress)
    if not todo:
        return jsonify({'success': False, 'error': '任务不存在'}), 404

    return jsonify({'success': True, 'data': todo.to_dict()})

@todos_bp.route('/api/todos/postpone', methods=['POST'])
def postpone():
    count = postpone_todos()
    return jsonify({'success': True, 'data': {'postponed_count': count}})
