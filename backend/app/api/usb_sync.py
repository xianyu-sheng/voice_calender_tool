from flask import Blueprint, jsonify

from ..services.usb_sync_service import check_usb_sync, get_usb_sync_state

usb_sync_bp = Blueprint("usb_sync", __name__)


@usb_sync_bp.route("/api/usb-sync/status", methods=["GET"])
def usb_sync_status():
    return jsonify({"success": True, "data": get_usb_sync_state()})


@usb_sync_bp.route("/api/usb-sync/refresh", methods=["POST"])
def usb_sync_refresh():
    return jsonify({"success": True, "data": check_usb_sync(enable_reverse=True)})
