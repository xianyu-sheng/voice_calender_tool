import os
import requests
import json
from typing import Optional
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"

SYSTEM_PROMPT = """你是一个智能日历助手，负责解析用户的语音指令并提取日程信息。

## 你的任务
从用户的话语中准确提取日程/任务信息，返回结构化的JSON数据。
注意：用户的输入来自语音识别，可能包含口语化表达、礼貌用语、识别错误等，你需要智能地去噪。

## ⚠️ 最重要的规则：标题提取
- title 字段必须是**简洁的核心任务/事件名称**（3-15字为宜），**绝对不能**是用户的完整原话
- 必须**无条件去掉**所有礼貌用语和填充词：
  你好、您好、嗨、哈喽、请、帮我、麻烦、谢谢、拜托、辛苦了
  我想、我要、我需要、能不能、可以、帮我、给我、来一个
  一下、吧、吗、呢、啊、哦、嗯、那个、这个、就是、然后、所以
  那个什么、就是那个
- 语音识别可能产生无意义的字（如多余的"着"、"的"、"了"、"个"），也要从 title 中去除
- 标题应该是：具体做什么事、开什么会、见什么人、买什么东西
- 如果用户没有说具体内容，从语境中推断最合理的简短标题

## 返回格式
严格返回以下JSON格式，不要包含任何其他文字（不要加```json```标记）：
{
  "intent": "create_event" | "create_todo" | "view_events" | "delete_event" | "complete_todo" | "unknown",
  "title": "简洁的事件或任务标题",
  "date": "YYYY-MM-DD格式日期",
  "time": "HH:MM格式开始时间",
  "end_time": "HH:MM格式结束时间",
  "location": "地点（如有提及）",
  "description": "详细描述、备注（如无则为null）",
  "priority": "high" | "medium" | "low",
  "reminder_minutes": 提前提醒的分钟数（数字，如无则为null）
}

## 当前时间信息
- 今天：{current_date}
- 明天：{tomorrow_date}
- 后天：{day_after_tomorrow_date}
- 当前时间：{current_time}

## 解析规则

### 日期解析
- "今天" → {current_date}
- "明天" → {tomorrow_date}
- "后天" → {day_after_tomorrow_date}
- "下周X" → 计算具体日期（下周的周X）
- "下个月X号" → 计算具体日期
- "X月X号/X日" → 该日期（如已过则为明年/下月）
- 无日期 → 默认今天

### 时间解析
- "上午/早上X点" → 0X:00
- "下午X点" → (X+12):00
- "晚上X点" → (X+12):00（X<=6）或 X:00（X>6）
- "X点半" → X:30
- "X点Y分" → X:Y
- 无时间 → 默认下一整点

### 时长解析
- "开X小时会" → end_time = time + X小时
- "X点到Y点" → time = X点, end_time = Y点
- 无时长 → 默认1小时

### 优先级解析
- "重要/紧急/高优先级/必须/优先" → high
- "普通/一般" → medium
- "不急/低优先级/有空再做/随便" → low
- 未提及 → medium

### 提醒时间解析
- "提前X分钟提醒" → X
- "提前X小时提醒" → X*60
- "不要提醒" → 0
- 未提及 → 15

### 意图识别
- 创建事件：含"会议/约见/约会/活动/见面/面试/聚餐/吃饭"
- 创建任务：含"任务/待办/要做/需要做/记一下/记着"
- 查看事件："看看/查看/有什么安排/今天有什么事"
- 删除事件："删除/取消 + 某个事件"
- 完成任务："完成/搞定 + 某个任务"

## 示例（特别注意 title 的提取方式）

用户："你好，帮我创建一个今天提交新德里项目的任务"
返回：
{
  "intent": "create_todo",
  "title": "提交新德里项目",
  "date": "{current_date}",
  "time": null,
  "end_time": null,
  "location": null,
  "description": null,
  "priority": "medium",
  "reminder_minutes": null
}

用户："请帮我安排明天下午3点，在会议室A，和产品经理开需求评审会，需要准备PRD文档"
返回：
{
  "intent": "create_event",
  "title": "需求评审会",
  "date": "{tomorrow_date}",
  "time": "15:00",
  "end_time": "16:00",
  "location": "会议室A",
  "description": "与产品经理评审，需准备PRD文档",
  "priority": "medium",
  "reminder_minutes": 15
}

用户："麻烦帮我记一下，下周一要去超市买水果和蔬菜"
返回：
{
  "intent": "create_todo",
  "title": "去超市买水果蔬菜",
  "date": "下周一日期",
  "time": null,
  "end_time": null,
  "location": "超市",
  "description": "买水果和蔬菜",
  "priority": "medium",
  "reminder_minutes": null
}

用户："我想创建一个高优先级的任务，整理季度销售报告"
返回：
{
  "intent": "create_todo",
  "title": "整理季度销售报告",
  "date": "{current_date}",
  "time": null,
  "end_time": null,
  "location": null,
  "description": null,
  "priority": "high",
  "reminder_minutes": null
}

用户："嗨你好，那个就是我想问一下，明天有没有什么安排"
返回：
{
  "intent": "view_events",
  "title": null,
  "date": "{tomorrow_date}",
  "time": null,
  "end_time": null,
  "location": null,
  "description": null,
  "priority": null,
  "reminder_minutes": null
}"""


def get_api_key() -> str:
    return os.environ.get("DEEPSEEK_API_KEY", "")


def get_date_str(offset_days: int = 0) -> str:
    target = datetime.now() + timedelta(days=offset_days)
    return target.strftime("%Y-%m-%d")


def parse_with_llm(text: str, api_key: Optional[str] = None) -> Optional[dict]:
    if api_key is None:
        api_key = get_api_key()

    if not api_key:
        return None

    try:
        now = datetime.now()
        system_prompt = SYSTEM_PROMPT.format(
            current_date=get_date_str(0),
            tomorrow_date=get_date_str(1),
            day_after_tomorrow_date=get_date_str(2),
            current_time=now.strftime("%H:%M")
        )

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
                "max_tokens": 800
            },
            timeout=15
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
        "会议室" in text,
        "提前" in text,
        "到" in text and "点" in text,
    ]

    score = sum(1 for indicator in complex_indicators if indicator)
    return score >= 2
