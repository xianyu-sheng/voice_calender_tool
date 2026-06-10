from flask import Blueprint, jsonify, request

from ..services.weather_service import get_weather, get_weather_by_coordinates

weather_bp = Blueprint("weather", __name__)


@weather_bp.route("/api/weather", methods=["GET"])
def get_city_weather():
    city = request.args.get("city", "").strip()
    latitude = request.args.get("lat", "").strip()
    longitude = request.args.get("lon", "").strip()
    label = request.args.get("label", "当前位置").strip() or "当前位置"

    try:
        if latitude and longitude:
            data = get_weather_by_coordinates(float(latitude), float(longitude), label)
        elif city:
            data = get_weather(city)
        else:
            return jsonify({"success": False, "error": "需要城市名或经纬度"}), 400
        return jsonify({"success": True, "data": data})
    except ValueError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"success": False, "error": str(exc)}), 502
