from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any

from ..models import Event, Todo


WEEKDAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"]

WEATHER_CODE_LABELS = {
    0: "晴",
    1: "少云",
    2: "多云",
    3: "阴",
    45: "雾",
    48: "雾凇",
    51: "小毛毛雨",
    53: "毛毛雨",
    55: "大毛毛雨",
    56: "冻毛毛雨",
    57: "强冻毛毛雨",
    61: "小雨",
    63: "中雨",
    65: "大雨",
    66: "冻雨",
    67: "强冻雨",
    71: "小雪",
    73: "中雪",
    75: "大雪",
    77: "雪粒",
    80: "阵雨",
    81: "强阵雨",
    82: "暴雨",
    85: "小阵雪",
    86: "强阵雪",
    95: "雷雨",
    96: "雷雨冰雹",
    99: "强雷雨冰雹",
}


def _today() -> date:
    return datetime.now().date()


def _date_label(target: date) -> str:
    today = _today()
    if target == today:
        return "今天"
    if target == today + timedelta(days=1):
        return "明天"
    if target == today + timedelta(days=2):
        return "后天"
    return f"{target.month}月{target.day}日"


def _weekday_label(target: date) -> str:
    return WEEKDAY_NAMES[target.weekday()]


def _parse_target_date(text: str) -> date:
    today = _today()
    if "后天" in text:
        return today + timedelta(days=2)
    if "明天" in text:
        return today + timedelta(days=1)
    if "昨天" in text:
        return today - timedelta(days=1)

    weekday_map = {
        "周一": 0,
        "星期一": 0,
        "礼拜一": 0,
        "周二": 1,
        "星期二": 1,
        "礼拜二": 1,
        "周三": 2,
        "星期三": 2,
        "礼拜三": 2,
        "周四": 3,
        "星期四": 3,
        "礼拜四": 3,
        "周五": 4,
        "星期五": 4,
        "礼拜五": 4,
        "周六": 5,
        "星期六": 5,
        "礼拜六": 5,
        "周日": 6,
        "周天": 6,
        "星期日": 6,
        "星期天": 6,
        "礼拜日": 6,
        "礼拜天": 6,
    }

    for keyword, weekday in weekday_map.items():
        if keyword in text:
            week_start = _week_start(today)
            if "下周" in text or "下星期" in text or "下礼拜" in text:
                week_start += timedelta(days=7)
            return week_start + timedelta(days=weekday)

    return today


def _week_start(target: date) -> date:
    return target - timedelta(days=target.weekday())


def _parse_week_range(text: str) -> tuple[date, date]:
    start = _week_start(_today())
    if "下周" in text or "下星期" in text or "下礼拜" in text:
        start += timedelta(days=7)
    return start, start + timedelta(days=6)


def _events_for_day(target: date) -> list[Event]:
    start = datetime.combine(target, time.min)
    end = datetime.combine(target, time.max)
    return (
        Event.query.filter(Event.start_time <= end, Event.end_time >= start)
        .order_by(Event.start_time)
        .all()
    )


def _todos_for_day(target: date) -> list[Todo]:
    return Todo.query.filter(Todo.date == target).order_by(Todo.priority, Todo.created_at).all()


def _event_minutes(event: Event) -> int:
    if not event.start_time or not event.end_time:
        return 0
    delta = event.end_time - event.start_time
    return max(0, int(delta.total_seconds() // 60))


def _day_load(target: date) -> dict[str, Any]:
    events = _events_for_day(target)
    todos = _todos_for_day(target)
    priority_weights = {"high": 75, "medium": 45, "low": 25}
    todo_score = sum(priority_weights.get(todo.priority, 45) for todo in todos if not todo.completed)
    event_score = sum(_event_minutes(event) for event in events)
    return {
        "date": target,
        "events": events,
        "todos": todos,
        "score": event_score + todo_score,
        "event_minutes": event_score,
    }


def _format_time(value: datetime | None) -> str:
    if not value:
        return ""
    return value.strftime("%H:%M")


def _format_event_brief(event: Event) -> str:
    start = _format_time(event.start_time)
    if event.is_all_day or not start:
        return event.title
    return f"{start} {event.title}"


def _temperature_text(forecast: dict[str, Any]) -> str:
    min_temp = forecast.get("temperature_min")
    max_temp = forecast.get("temperature_max")
    if isinstance(min_temp, (int, float)) and isinstance(max_temp, (int, float)):
        return f"{round(min_temp)}到{round(max_temp)}度"
    if isinstance(max_temp, (int, float)):
        return f"最高{round(max_temp)}度"
    if isinstance(min_temp, (int, float)):
        return f"最低{round(min_temp)}度"
    return "温度暂无"


def _forecast_for_day(target: date, forecasts: Any) -> dict[str, Any] | None:
    target_key = target.isoformat()
    if isinstance(forecasts, dict):
        forecast = forecasts.get(target_key)
        return forecast if isinstance(forecast, dict) else None

    if isinstance(forecasts, list):
        for forecast in forecasts:
            if isinstance(forecast, dict) and forecast.get("date") == target_key:
                return forecast
    return None


def _weather_summary(target: date, forecasts: Any) -> dict[str, Any]:
    forecast = _forecast_for_day(target, forecasts)
    if not forecast:
        return {
            "available": False,
            "label": "暂无预报",
            "temperature": "",
            "advice": "这天暂时没有可用天气预报。",
        }

    code = forecast.get("weather_code")
    label = WEATHER_CODE_LABELS.get(code, "未知") if isinstance(code, int) else "未知"
    temperature = _temperature_text(forecast)
    precipitation = forecast.get("precipitation_probability")

    risky_keywords = ("雨", "雪", "雷", "雾", "冰雹")
    is_risky = any(keyword in label for keyword in risky_keywords)
    if isinstance(precipitation, (int, float)) and precipitation >= 50:
        is_risky = True

    if is_risky:
        advice = "出门建议带伞，路上多预留一点时间。"
    else:
        advice = "天气看起来适合出门。"

    return {
        "available": True,
        "label": label,
        "temperature": temperature,
        "precipitation_probability": precipitation,
        "advice": advice,
    }


def _answer_free_day(text: str) -> dict[str, Any]:
    start, end = _parse_week_range(text)
    search_start = max(start, _today()) if start <= _today() <= end else start
    days = (end - search_start).days + 1
    loads = [_day_load(search_start + timedelta(days=index)) for index in range(days)]
    lightest = min(loads, key=lambda item: (item["score"], item["event_minutes"]))
    target = lightest["date"]
    events = lightest["events"]
    todos = lightest["todos"]

    period = "下周" if start > _week_start(_today()) else "这周"
    answer = (
        f"{period}{target.month}月{target.day}日{_weekday_label(target)}相对比较空，"
        f"有{len(events)}个日程、{len(todos)}个任务。"
    )
    if not events and not todos:
        answer += "这天目前基本空出来了。"

    return {
        "answer": answer,
        "view": "week",
        "date": target.isoformat(),
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "intent": "free_day",
        "counts": {"events": len(events), "todos": len(todos)},
    }


def _answer_day_schedule(text: str, forecasts: Any, weather_location: dict[str, Any] | None) -> dict[str, Any]:
    target = _parse_target_date(text)
    events = _events_for_day(target)
    todos = _todos_for_day(target)
    label = _date_label(target)
    wants_weather = any(keyword in text for keyword in ("天气", "出门", "外出", "出去", "适合"))

    if wants_weather:
        weather = _weather_summary(target, forecasts)
        city = ""
        if isinstance(weather_location, dict):
            city = weather_location.get("city") or weather_location.get("name") or ""
        place = f"{city}" if city and city not in {"正在定位", "当前位置"} else ""

        if weather["available"]:
            answer = f"{label}{place}{weather['label']}，{weather['temperature']}。{weather['advice']}"
        else:
            answer = f"{label}暂时没有可用天气预报，我先按日程给你看。"

        if events or todos:
            answer += f"另外你有{len(events)}个日程、{len(todos)}个任务。"
        else:
            answer += "当天安排不多。"

        return {
            "answer": answer,
            "view": "day",
            "date": target.isoformat(),
            "intent": "weather_advice",
            "weather": weather,
            "counts": {"events": len(events), "todos": len(todos)},
        }

    if not events and not todos:
        answer = f"{label}暂时没有日程和任务，比较空。"
    else:
        if events:
            event_text = "、".join(_format_event_brief(event) for event in events[:3])
            if len(events) > 3:
                event_text += f"等{len(events)}个日程"
            event_part = f"日程有{event_text}"
        else:
            event_part = "没有日程"

        if todos:
            todo_text = "、".join(todo.title for todo in todos[:3])
            if len(todos) > 3:
                todo_text += f"等{len(todos)}个任务"
            todo_part = f"任务有{todo_text}"
        else:
            todo_part = "没有任务"

        answer = f"{label}{event_part}；{todo_part}。"

    return {
        "answer": answer,
        "view": "day",
        "date": target.isoformat(),
        "intent": "day_schedule",
        "counts": {"events": len(events), "todos": len(todos)},
    }


def answer_assistant_query(
    text: str,
    forecasts: Any = None,
    weather_location: dict[str, Any] | None = None,
) -> dict[str, Any]:
    normalized_text = (text or "").strip()
    if not normalized_text:
        return {
            "answer": "你可以直接问我今天或明天有什么安排。",
            "view": "day",
            "date": _today().isoformat(),
            "intent": "unknown",
        }

    free_day_keywords = ("哪天", "什么时候", "哪一天")
    if any(keyword in normalized_text for keyword in free_day_keywords) and any(
        keyword in normalized_text for keyword in ("空", "有空", "比较空", "最空")
    ):
        return _answer_free_day(normalized_text)

    return _answer_day_schedule(normalized_text, forecasts or {}, weather_location)
