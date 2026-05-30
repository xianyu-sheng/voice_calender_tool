export interface ParsedCommand {
  intent: 'create_event' | 'delete_event' | 'view_events' | 'edit_event' | 'set_reminder' | 'unknown';
  title?: string;
  date?: string;
  time?: string;
  location?: string;
  reminderMinutes?: number;
  rawText: string;
}

const INTENT_PATTERNS = {
  create_event: [
    /创建(一个)?(.*)/,
    /新建(一个)?(.*)/,
    /添加(一个)?(.*)/,
    /添加日程(.*)/,
    /新建日程(.*)/,
    /我(明天|今天|下周|后天)?(上午|下午|晚上)?(\d+点|十点|九点|八点|七点|六点|五点|四点|三点|两点|一点)?(.*)/,
  ],
  delete_event: [
    /删除(.*)/,
    /移除(.*)/,
    /取消(.*)/,
  ],
  view_events: [
    /查看(今天|明天|本周|本月|日程|事件)/,
    /看看(今天|明天|本周|本月|日程|事件)/,
    /显示(今天|明天|本周|本月|日程|事件)/,
    /有什么(安排|日程|事件)/,
  ],
  set_reminder: [
    /提醒我(.*)/,
    /设置提醒(.*)/,
    /(.*)提醒(.*)/,
  ],
};

const TIME_PATTERNS = {
  date: {
    today: /今天/,
    tomorrow: /明天/,
    dayAfterTomorrow: /后天/,
    nextWeek: /下周(一|二|三|四|五|六|日|天)/,
    nextNextWeek: /下下周(一|二|三|四|五|六|日|天)/,
    specificDate: /(\d{1,2})月(\d{1,2})[日号]/,
    relativeDays: /(\d+|[一二三四五六七八九十]+)天后/,
    relativeWeeks: /(\d+|[一二三四五六七八九十]+)周后/,
  },
  time: {
    morning: /上午|早上/,
    afternoon: /下午/,
    evening: /晚上/,
    specificHour: /(\d{1,2})[点时](\d{1,2})?分?/,
    chineseHour: /(一|二|三|四|五|六|七|八|九|十|十一|十二)点/,
    relativeHours: /(\d+|[一二三四五六七八九十]+)小时后/,
    relativeMinutes: /(\d+|[一二三四五六七八九十]+)分钟后/,
    halfHour: /半/,
  },
};

const CHINESE_NUMBER_MAP: { [key: string]: number } = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  '十一': 11, '十二': 12, '两': 2,
};

const CHINESE_NUMBERS: { [key: string]: number } = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  '十一': 11, '十二': 12,
};

function parseChineseNumber(text: string): number {
  if (CHINESE_NUMBER_MAP[text]) {
    return CHINESE_NUMBER_MAP[text];
  }
  const num = parseInt(text);
  return isNaN(num) ? 0 : num;
}

function extractTime(text: string): { date?: string; time?: string; reminderMinutes?: number } {
  let date: string | undefined;
  let time: string | undefined;
  let reminderMinutes: number | undefined;

  const today = new Date();

  if (TIME_PATTERNS.date.today.test(text)) {
    date = today.toISOString().split('T')[0];
  } else if (TIME_PATTERNS.date.tomorrow.test(text)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    date = tomorrow.toISOString().split('T')[0];
  } else if (TIME_PATTERNS.date.dayAfterTomorrow.test(text)) {
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    date = dayAfter.toISOString().split('T')[0];
  }

  const nextWeekMatch = text.match(TIME_PATTERNS.date.nextWeek);
  if (nextWeekMatch) {
    const dayMap: { [key: string]: number } = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
    const targetDay = dayMap[nextWeekMatch[1]] ?? 0;
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const currentDay = nextWeek.getDay();
    const diff = targetDay - currentDay;
    nextWeek.setDate(nextWeek.getDate() + (diff >= 0 ? diff : diff + 7));
    date = nextWeek.toISOString().split('T')[0];
  }

  const nextNextWeekMatch = text.match(TIME_PATTERNS.date.nextNextWeek);
  if (nextNextWeekMatch) {
    const dayMap: { [key: string]: number } = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0 };
    const targetDay = dayMap[nextNextWeekMatch[1]] ?? 0;
    const nextNextWeek = new Date(today);
    nextNextWeek.setDate(nextNextWeek.getDate() + 14);
    const currentDay = nextNextWeek.getDay();
    const diff = targetDay - currentDay;
    nextNextWeek.setDate(nextNextWeek.getDate() + (diff >= 0 ? diff : diff + 7));
    date = nextNextWeek.toISOString().split('T')[0];
  }

  const specificDateMatch = text.match(TIME_PATTERNS.date.specificDate);
  if (specificDateMatch) {
    const month = parseInt(specificDateMatch[1]);
    const day = parseInt(specificDateMatch[2]);
    const year = today.getFullYear();
    date = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  const relativeDaysMatch = text.match(TIME_PATTERNS.date.relativeDays);
  if (relativeDaysMatch) {
    const days = parseChineseNumber(relativeDaysMatch[1]);
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + days);
    date = targetDate.toISOString().split('T')[0];
  }

  const relativeWeeksMatch = text.match(TIME_PATTERNS.date.relativeWeeks);
  if (relativeWeeksMatch) {
    const weeks = parseChineseNumber(relativeWeeksMatch[1]);
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + weeks * 7);
    date = targetDate.toISOString().split('T')[0];
  }

  const hourMatch = text.match(TIME_PATTERNS.time.specificHour);
  if (hourMatch) {
    let hour = parseInt(hourMatch[1]);
    const minute = hourMatch[2] ? parseInt(hourMatch[2]) : 0;

    if (TIME_PATTERNS.time.afternoon.test(text) && hour < 12) {
      hour += 12;
    } else if (TIME_PATTERNS.time.evening.test(text) && hour < 12) {
      hour += 12;
    }

    time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  const chineseHourMatch = text.match(TIME_PATTERNS.time.chineseHour);
  if (chineseHourMatch) {
    let hour = CHINESE_NUMBERS[chineseHourMatch[1]] || 0;

    if (TIME_PATTERNS.time.afternoon.test(text) && hour < 12) {
      hour += 12;
    } else if (TIME_PATTERNS.time.evening.test(text) && hour < 12) {
      hour += 12;
    }

    const halfMatch = text.match(TIME_PATTERNS.time.halfHour);
    const minute = halfMatch ? 30 : 0;
    time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  const relativeHoursMatch = text.match(TIME_PATTERNS.time.relativeHours);
  if (relativeHoursMatch) {
    const hours = parseChineseNumber(relativeHoursMatch[1]);
    const targetTime = new Date(today);
    targetTime.setHours(targetTime.getHours() + hours);
    date = targetTime.toISOString().split('T')[0];
    time = `${targetTime.getHours().toString().padStart(2, '0')}:${targetTime.getMinutes().toString().padStart(2, '0')}`;
  }

  const relativeMinutesMatch = text.match(TIME_PATTERNS.time.relativeMinutes);
  if (relativeMinutesMatch) {
    const minutes = parseChineseNumber(relativeMinutesMatch[1]);
    const targetTime = new Date(today);
    targetTime.setMinutes(targetTime.getMinutes() + minutes);
    date = targetTime.toISOString().split('T')[0];
    time = `${targetTime.getHours().toString().padStart(2, '0')}:${targetTime.getMinutes().toString().padStart(2, '0')}`;
  }

  const reminderMatch = text.match(/提醒(我)?(提前)?(\d+|[一二三四五六七八九十]+)分钟/);
  if (reminderMatch) {
    reminderMinutes = parseChineseNumber(reminderMatch[3]);
  }

  return { date, time, reminderMinutes };
}

function extractTitle(text: string, intent: string): string {
  let title = text;

  if (intent === 'create_event') {
    title = title
      .replace(/创建|新建|添加|一个|日程|事件/g, '')
      .replace(/明天|今天|后天|下周[一二三四五六日天]/g, '')
      .replace(/上午|下午|晚上|早上/g, '')
      .replace(/\d+[点时]\d*分?/g, '')
      .replace(/[一二三四五六七八九十]+点/g, '')
      .replace(/在(.*)/, '')
      .trim();
  }

  if (!title || title.length === 0) {
    title = '新事件';
  }

  return title;
}

function extractLocation(text: string): string | undefined {
  const locationMatch = text.match(/在(.+?)(?:$|创建|新建|添加|明天|今天|后天|上午|下午|晚上|\d+点)/);
  if (locationMatch) {
    return locationMatch[1].trim();
  }
  return undefined;
}

export function parseVoiceCommand(text: string): ParsedCommand {
  const normalizedText = text.trim().toLowerCase();

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedText)) {
        const { date, time, reminderMinutes } = extractTime(normalizedText);
        const title = extractTitle(text, intent);
        const location = extractLocation(normalizedText);

        return {
          intent: intent as ParsedCommand['intent'],
          title,
          date,
          time,
          location,
          reminderMinutes,
          rawText: text,
        };
      }
    }
  }

  const { date, time, reminderMinutes } = extractTime(normalizedText);
  if (date || time) {
    const title = extractTitle(text, 'create_event');
    return {
      intent: 'create_event',
      title,
      date,
      time,
      location: extractLocation(normalizedText),
      reminderMinutes,
      rawText: text,
    };
  }

  return {
    intent: 'unknown',
    rawText: text,
  };
}
