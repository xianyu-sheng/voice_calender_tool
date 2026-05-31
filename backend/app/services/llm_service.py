import requests
import json
from typing import Optional
from datetime import datetime, timedelta


DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

SYSTEM_PROMPT = """你是一个日历助手，负责解析用户的语音指令。

请从用户的话语中提取以下信息，返回JSON格式：
{
  "intent": "create_event" | "create_todo" | "view_events" | "delete_event" | "unknown",
  "title": "事件或任务标题",
  "date": "YYYY-MM-DD格式日期（如果提到）",
  "time": "HH:MM格式时间（如果提到）",
  "end_time": "HH:MM格式结束时间（如果提到）",
  "location": "地点（如果提到）",
  "description": "描述或备注（如果有）",
  "priority": "high" | "medium" | "low"（如果提到优先级）,
  "reminder_minutes": 提前提醒分钟数（如果提到）
}

当前日期：{current_date}

注意事项：
1. 如果用户说"明天"，日期是{tomorrow_date}
2. 如果用户说"后天"，日期是{day_after_tomorrow_date}
3. 如果用户说"下周X"，计算具体日期
4. 如果没有明确时间，默认为下一个整点
5. 从"高优先级/重要/紧急"推断priority为high
6. 从"低优先级/不急"推断priority为low
7. description字段用于提取用户的备注、准备事项等额外信息

只返回JSON，不要其他文字。"""


def get_date_str(offset_days: int = 0) -> str:
    target = datetime.now() + timedelta(days=offset_days)
    return target.strftime("%Y-%m-%d")


def parse_with_llm(text: str, api_key: str) -> Optional[dict]:
    if not api_key:
        return None

    system_prompt = SYSTEM_PROMPT.format(
        current_date=get_date_str(0),
        tomorrow_date=get_date_str(1),
        day_after_tomorrow_date=get_date_str(2)
    )

    try:
        response = requests.post(
            DEEPSEEK_API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": "deepseek-chat",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": text}
                ],
                "temperature": 0.1,
                "max_tokens": 500
            },
            timeout=10
        )

        if response.status_code == 200:
            result = response.json()
            content = result["choices"][0]["message"]["content"]
            content = content.strip()
            if content.startswith("```"):
                content = content.split("\n", 1)[1] if "\n" in content else content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            try:
                parsed = json.loads(content)
                if "intent" in parsed:
                    return parsed
            except json.JSONDecodeError:
                pass

        return None

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
    ]

    score = sum(1 for indicator in complex_indicators if indicator)
    return score >= 2
