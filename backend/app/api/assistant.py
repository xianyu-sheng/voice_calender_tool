from flask import Blueprint, jsonify, request

from ..services.assistant_service import answer_assistant_query

assistant_bp = Blueprint("assistant", __name__)


@assistant_bp.route("/api/assistant/query", methods=["POST"])
def query_assistant():
    data = request.get_json(silent=True) or {}
    text = str(data.get("text") or "").strip()
    if not text:
        return jsonify({"success": False, "error": "缺少问题文本"}), 400

    try:
        answer = answer_assistant_query(
            text,
            forecasts=data.get("weather_forecasts") or data.get("forecasts") or {},
            weather_location=data.get("weather_location") or {},
        )
        return jsonify({"success": True, "data": answer})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
