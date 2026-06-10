from flask import Blueprint, jsonify, request

from ..services.weather_service import get_weather

weather_bp = Blueprint("weather", __name__)


@weather_bp.route("/api/weather", methods=["GET"])
def get_city_weather():
    city = request.args.get("city", "北京").strip() or "北京"

    try:
        data = get_weather(city)
        return jsonify({"success": True, "data": data})
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 502
