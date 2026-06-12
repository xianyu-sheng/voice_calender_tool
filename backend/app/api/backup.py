import json
import os
import sqlite3
from datetime import datetime

from flask import Blueprint, Response, current_app, jsonify, send_file

from .. import db
from ..models import Calendar, Event, Reminder, Todo

backup_bp = Blueprint("backup", __name__)


def _sqlite_db_path():
    database = db.engine.url.database
    if not database:
        raise RuntimeError("当前数据库不是 SQLite 文件")

    if os.path.isabs(database):
        return database

    return os.path.abspath(os.path.join(current_app.instance_path, database))


def _backup_dir():
    directory = current_app.config.get("VOICE_CALENDAR_BACKUP_DIR")
    if not directory:
        directory = os.path.join(os.path.dirname(_sqlite_db_path()), "backups")
    os.makedirs(directory, exist_ok=True)
    return directory


def _safe_backup_path(filename):
    directory = os.path.abspath(_backup_dir())
    target = os.path.abspath(os.path.join(directory, filename))
    if not target.startswith(directory + os.sep):
        raise ValueError("备份文件名无效")
    return target


def _backup_sqlite(source_path, target_path):
    source = sqlite3.connect(source_path)
    target = sqlite3.connect(target_path)
    try:
        source.backup(target)
    finally:
        target.close()
        source.close()


def _backup_file_info(path):
    stat = os.stat(path)
    return {
        "name": os.path.basename(path),
        "size": stat.st_size,
        "created_at": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
    }


def _export_payload():
    return {
        "metadata": {
            "app": "voice-calendar",
            "version": 1,
            "exported_at": datetime.now().isoformat(timespec="seconds"),
        },
        "calendars": [item.to_dict() for item in Calendar.query.order_by(Calendar.id).all()],
        "events": [item.to_dict() for item in Event.query.order_by(Event.start_time).all()],
        "todos": [item.to_dict() for item in Todo.query.order_by(Todo.date, Todo.id).all()],
        "reminders": [item.to_dict() for item in Reminder.query.order_by(Reminder.reminder_time).all()],
    }


@backup_bp.route("/api/backup/list", methods=["GET"])
def list_backups():
    directory = _backup_dir()
    files = [
        _backup_file_info(os.path.join(directory, name))
        for name in os.listdir(directory)
        if name.endswith(".db")
    ]
    files.sort(key=lambda item: item["created_at"], reverse=True)
    return jsonify({"success": True, "data": files})


@backup_bp.route("/api/backup/create", methods=["POST"])
def create_backup():
    source_path = _sqlite_db_path()
    if not os.path.exists(source_path):
        return jsonify({"success": False, "error": "数据库文件不存在"}), 404

    filename = f"calendar_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.db"
    target_path = os.path.join(_backup_dir(), filename)
    _backup_sqlite(source_path, target_path)
    return jsonify({"success": True, "data": _backup_file_info(target_path)})


@backup_bp.route("/api/backup/export", methods=["GET"])
def export_json():
    payload = json.dumps(_export_payload(), ensure_ascii=False, indent=2)
    filename = f"voice_calendar_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    return Response(
        payload,
        mimetype="application/json; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@backup_bp.route("/api/backup/download/<path:filename>", methods=["GET"])
def download_backup(filename):
    target_path = _safe_backup_path(filename)
    if not os.path.exists(target_path):
        return jsonify({"success": False, "error": "备份文件不存在"}), 404
    return send_file(target_path, as_attachment=True, download_name=os.path.basename(target_path))
