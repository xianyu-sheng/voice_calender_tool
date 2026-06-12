import ipaddress
import socket
from datetime import datetime

from flask import Blueprint, jsonify, request

from ..models import Calendar, Event, Reminder, Todo

sync_bp = Blueprint("sync", __name__)


def _is_lan_ipv4(ip_address):
    try:
        address = ipaddress.ip_address(ip_address)
    except ValueError:
        return False

    return address.version == 4 and address.is_private and not address.is_loopback


def _get_lan_addresses():
    addresses = set()

    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            address = info[4][0]
            if address and not address.startswith("127.") and _is_lan_ipv4(address):
                addresses.add(address)
    except OSError:
        pass

    probe = None
    try:
        probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        probe.settimeout(0.2)
        probe.connect(("223.5.5.5", 80))
        address = probe.getsockname()[0]
        if address and not address.startswith("127."):
            addresses.add(address)
    except OSError:
        pass
    finally:
        if probe is not None:
            try:
                probe.close()
            except OSError:
                pass

    return sorted(addresses)


@sync_bp.route("/api/sync/info", methods=["GET"])
def sync_info():
    port = request.host.split(":")[-1] if ":" in request.host else "8000"
    lan_addresses = _get_lan_addresses()
    lan_urls = [f"http://{address}:{port}" for address in lan_addresses]

    return jsonify(
        {
            "success": True,
            "data": {
                "device_name": socket.gethostname(),
                "current_url": request.host_url.rstrip("/"),
                "local_url": f"http://127.0.0.1:{port}",
                "lan_urls": lan_urls,
                "stats": {
                    "events": Event.query.count(),
                    "todos": Todo.query.count(),
                    "calendars": Calendar.query.count(),
                    "reminders": Reminder.query.count(),
                },
                "server_time": datetime.now().isoformat(timespec="seconds"),
            },
        }
    )
