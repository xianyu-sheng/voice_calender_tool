import json
import os
import re
from datetime import datetime, timedelta
from typing import Any, Optional

import requests
from dotenv import load_dotenv

load_dotenv()

DEEPSEEK_API_URL = os.environ.get("DEEPSEEK_API_URL", "https://api.deepseek.com/v1/chat/completions")
DEEPSEEK_MODEL = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")

ALLOWED_INTENTS = {
    "create_event",
    "create_todo",
    "view_events",
    "assistant_query",
    "delete_event",
    "complete_todo",
    "unknown",
}

TITLE_ACTIONS = (
    "写完",
    "改完",
    "做完",
    "完成",
    "修改",
    "整理",
    "处理",
    "提交",
    "复习",
    "准备",
    "购买",
    "买",
)

SYSTEM_PROMPT = """你是“语音日历”的语义解析器。你的唯一任务是把用户的中文语音转写文本解析成一个严格 JSON 对象，供程序直接创建任务、事件或回答日程问题。

当前日期时间：
- 今天：__CURRENT_DATE__
- 明天：__TOMORROW_DATE__
- 后天：__DAY_AFTER_TOMORROW_DATE__
- 当前时间：__CURRENT_TIME__

输出硬性规则：
1. 只能输出一个合法 JSON 对象，不能输出 Markdown、解释、注释、代码块。
2. 必须包含所有字段；没有的信息用 null。
3. intent 只能是 create_event、create_todo、view_events、assistant_query、delete_event、complete_todo、unknown。
4. date 必须是 YYYY-MM-DD；time/end_time 必须是 HH:MM；不要输出“今天”“明天”“下周一”等自然语言日期。
5. reminder_minutes 必须是数字或 null。

JSON 结构：
{
  "intent": "create_event | create_todo | view_events | assistant_query | delete_event | complete_todo | unknown",
  "title": "简洁标题或 null",
  "date": "YYYY-MM-DD 或 null",
  "time": "HH:MM 或 null",
  "end_time": "HH:MM 或 null",
  "location": "地点或 null",
  "description": "备注或 null",
  "priority": "high | medium | low | null",
  "reminder_minutes": 15
}

意图判断：
- create_todo：用户要创建任务、待办、事项，或表达“要做/写完/修改/提交/整理/复习/准备/买/处理/完成某事”。没有明确开始时间的学习、写作、工作事项通常是任务。
- create_event：用户要安排有固定时间段或地点的事件，例如会议、日程、约见、面试、聚餐、活动、看医生、开会。
- assistant_query：用户希望得到自然语言回答或建议，例如“我明天有什么安排”“这周哪天比较空”“明天重庆天气适合出门吗”。
- view_events：用户明确要求切换/查看今天、明天、本周、本月视图，但不需要总结回答。
- complete_todo：用户说完成、做完、搞定、勾选某个已有任务。
- delete_event：用户说删除、取消某个事件或日程。

标题提取铁律：
- title 必须是核心动作 + 对象，短而自然，例如“写完论文”“修改论文”“整理销售报告”“需求评审会”。
- 绝对不要把完整原话放进 title。
- 必须删除这些口语/礼貌/指令词：请、请你、帮我、为我、给我、麻烦、我想、我要、我需要、能不能、可以、创建一个、新建一个、添加一个、任务、待办、事件、日程、一下、吧、吗、呢、啊、哦、嗯、那个、这个、就是、然后。
- “把/将 + 对象 + 动作”必须改成“动作 + 对象”：例如“将论文写完” -> “写完论文”，“把报告整理一下” -> “整理报告”。
- 对 create_todo 要保留动作词；不要把“写完论文”简化成“论文”。
- 对 complete_todo，title 应该是已有任务的名称或核心对象，可以去掉“完成/做完/搞定”。

日期与时间：
- 今天 -> __CURRENT_DATE__
- 明天 -> __TOMORROW_DATE__
- 后天 -> __DAY_AFTER_TOMORROW_DATE__
- 没有日期：创建任务/事件默认 date = __CURRENT_DATE__。
- 没有明确几点：time = null，end_time = null。
- “下午三点” -> 15:00；“晚上八点” -> 20:00；“九点半” -> 09:30 或结合上午/下午判断。
- 任务通常不需要 time/end_time，除非用户明确说几点提醒或几点做。

优先级与提醒：
- 重要、紧急、必须、尽快 -> high
- 不急、有空、低优先级 -> low
- 未提及 -> create_todo/create_event 使用 medium，其他 intent 使用 null
- “提前 10 分钟提醒” -> reminder_minutes = 10；未提及提醒 -> null

示例：
用户：请你为我创建一个今天将论文写完的任务
输出：
{
  "intent": "create_todo",
  "title": "写完论文",
  "date": "__CURRENT_DATE__",
  "time": null,
  "end_time": null,
  "location": null,
  "description": null,
  "priority": "medium",
  "reminder_minutes": null
}

用户：帮我添加一个明天修改论文的待办
输出：
{
  "intent": "create_todo",
  "title": "修改论文",
  "date": "__TOMORROW_DATE__",
  "time": null,
  "end_time": null,
  "location": null,
  "description": null,
  "priority": "medium",
  "reminder_minutes": null
}

用户：明天下午三点在会议室A和产品经理开需求评审会，提前十分钟提醒
输出：
{
  "intent": "create_event",
  "title": "需求评审会",
  "date": "__TOMORROW_DATE__",
  "time": "15:00",
  "end_time": "16:00",
  "location": "会议室A",
  "description": "和产品经理开会",
  "priority": "medium",
  "reminder_minutes": 10
}

用户：今天有什么安排
输出：
{
  "intent": "assistant_query",
  "title": null,
  "date": "__CURRENT_DATE__",
  "time": null,
  "end_time": null,
  "location": null,
  "description": null,
  "priority": null,
  "reminder_minutes": null
}

用户：查看今天
输出：
{
  "intent": "view_events",
  "title": null,
  "date": "__CURRENT_DATE__",
  "time": null,
  "end_time": null,
  "location": null,
  "description": null,
  "priority": null,
  "reminder_minutes": null
}
"""


def get_api_key() -> str:
    return os.environ.get("DEEPSEEK_API_KEY", "")


def get_date_str(offset_days: int = 0) -> str:
    target = datetime.now() + timedelta(days=offset_days)
    return target.strftime("%Y-%m-%d")


def _render_system_prompt() -> str:
    now = datetime.now()
    return (
        SYSTEM_PROMPT
        .replace("__CURRENT_DATE__", get_date_str(0))
        .replace("__TOMORROW_DATE__", get_date_str(1))
        .replace("__DAY_AFTER_TOMORROW_DATE__", get_date_str(2))
        .replace("__CURRENT_TIME__", now.strftime("%H:%M"))
    )


def _extract_json(content: str) -> Optional[dict[str, Any]]:
    text = content.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text, flags=re.IGNORECASE).strip()
        text = re.sub(r"```$", "", text).strip()

    candidates = [text]
    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        candidates.append(text[start:end + 1])

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            continue
    return None


def _clean_title(
    value: Any,
    intent: str,
    original_text: str,
    location: Optional[str] = None,
) -> Optional[str]:
    title = "" if value is None else str(value)
    if title.strip().lower() in {"", "null", "none", "无", "没有"}:
        title = original_text

    title = title.strip()
    title = re.sub(r"[，。！？、；：,.!?;:]", " ", title)
    title = re.sub(r"\s+", "", title)

    fillers = [
        "请你为我",
        "请你帮我",
        "麻烦你帮我",
        "请帮我",
        "麻烦帮我",
        "你为我",
        "你帮我",
        "请你",
        "帮我",
        "为我",
        "给我",
        "麻烦",
        "拜托",
        "谢谢",
        "辛苦了",
        "我想",
        "我要",
        "我需要",
        "能不能",
        "可以",
        "请",
        "一下",
        "吧",
        "吗",
        "呢",
        "啊",
        "哦",
        "嗯",
        "那个",
        "这个",
        "就是",
        "然后",
        "所以",
    ]
    for filler in fillers:
        title = title.replace(filler, "")

    title = re.sub(r"(创建|新建|添加|安排|设置)(一个|一项|个)?", "", title)
    title = re.sub(r"(今天|明天|后天|本周|这周|本月|这个月|下周[一二三四五六日天]?)", "", title)
    title = re.sub(r"(上午|下午|晚上|早上|中午)", "", title)
    title = re.sub(r"\d{1,2}[点时](\d{1,2}分?)?", "", title)
    title = re.sub(r"[一二三四五六七八九十两]+点(半|[一二三四五六七八九十两]+分?)?", "", title)
    title = re.sub(r"(高优先级?|中优先级?|低优先级?|重要|紧急|不急|普通|一般)", "", title)
    title = re.sub(r"^(任务|待办|事项|事件|日程)", "", title)
    title = re.sub(r"(的)?(任务|待办|事项|事件|日程)$", "", title)

    if location:
        escaped_location = re.escape(str(location).strip())
        if escaped_location:
            title = re.sub(rf"在?{escaped_location}", "", title, flags=re.IGNORECASE)

    action_pattern = "|".join(TITLE_ACTIONS)
    title = re.sub(rf"^(把|将)(.+?)({action_pattern})(一下)?$", r"\3\2", title)

    if intent in {"complete_todo", "delete_event"}:
        title = re.sub(r"^(完成|做完|搞定|标记|勾选|删除|取消|移除)", "", title)
        title = re.sub(r"(完成|做完|搞定|删除|取消|移除)$", "", title)
    elif intent == "create_event":
        title = re.sub(r"^(和|与|跟|同).+?(开|参加|进行|举行|安排)", "", title)
        title = re.sub(r"^在.+?(开|参加|进行|举行|安排)", "", title)
        title = re.sub(r"^(开|参加|进行|举行|安排)", "", title)
    else:
        title = re.sub(rf"^(.+?)({action_pattern})$", r"\2\1", title)

    title = re.sub(r"\s+", "", title).strip()
    return title or None


def _valid_date(value: Any) -> Optional[str]:
    if not isinstance(value, str) or not value:
        return None
    try:
        datetime.strptime(value, "%Y-%m-%d")
        return value
    except ValueError:
        return None


def _valid_time(value: Any) -> Optional[str]:
    if not isinstance(value, str) or not re.match(r"^\d{2}:\d{2}$", value):
        return None
    hour, minute = value.split(":")
    if 0 <= int(hour) <= 23 and 0 <= int(minute) <= 59:
        return value
    return None


def _coerce_reminder(value: Any) -> Optional[int]:
    if value in (None, "", "null"):
        return None
    try:
        minutes = int(value)
    except (TypeError, ValueError):
        return None
    return minutes if minutes >= 0 else None


def _sanitize_result(parsed: dict[str, Any], original_text: str) -> dict[str, Any]:
    intent = parsed.get("intent")
    if intent not in ALLOWED_INTENTS:
        intent = "unknown"

    title = _clean_title(parsed.get("title"), intent, original_text, parsed.get("location"))
    if intent == "create_todo" and not title:
        title = "新任务"
    elif intent == "create_event" and not title:
        title = "新事件"
    elif intent in {"view_events", "unknown"}:
        title = None

    date = _valid_date(parsed.get("date"))
    if not date and intent in {"create_todo", "create_event", "view_events", "assistant_query"}:
        date = get_date_str(0)

    time = _valid_time(parsed.get("time"))
    end_time = _valid_time(parsed.get("end_time"))
    if intent == "create_todo":
        time = None
        end_time = None

    priority = parsed.get("priority")
    if priority not in {"high", "medium", "low"}:
        priority = "medium" if intent in {"create_todo", "create_event"} else None

    return {
        "intent": intent,
        "title": title,
        "date": date,
        "time": time,
        "end_time": end_time,
        "location": parsed.get("location") or None,
        "description": parsed.get("description") or None,
        "priority": priority,
        "reminder_minutes": _coerce_reminder(parsed.get("reminder_minutes")),
    }


def parse_with_llm(text: str, api_key: Optional[str] = None) -> Optional[dict[str, Any]]:
    if api_key is None:
        api_key = get_api_key()

    if not api_key:
        return None

    try:
        response = requests.post(
            DEEPSEEK_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": DEEPSEEK_MODEL,
                "messages": [
                    {"role": "system", "content": _render_system_prompt()},
                    {"role": "user", "content": text},
                ],
                "temperature": 0,
                "max_tokens": 500,
            },
            timeout=20,
        )

        if response.status_code != 200:
            print(f"DeepSeek API error {response.status_code}: {response.text[:500]}")
            return None

        result = response.json()
        content = result["choices"][0]["message"]["content"]
        parsed = _extract_json(content)
        if not parsed:
            print(f"DeepSeek returned non-JSON content: {content[:500]}")
            return None

        return _sanitize_result(parsed, text)

    except Exception as e:
        print(f"LLM API error: {e}")
        return None


def is_complex_command(text: str) -> bool:
    complex_indicators = [
        len(text) > 15,
        "并且" in text,
        "然后" in text,
        "还要" in text,
        "另外" in text,
        "准备" in text,
        "需要" in text and "做" in text,
        "描述" in text or "备注" in text,
        "说明" in text,
        "详情" in text,
        "会议室" in text,
        "提前" in text,
        "到" in text and "点" in text,
    ]

    score = sum(1 for indicator in complex_indicators if indicator)
    return score >= 2
