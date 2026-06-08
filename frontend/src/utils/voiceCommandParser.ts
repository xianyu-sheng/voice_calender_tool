import { toLocalDateStr } from './dateUtils';
import { normalizeSpeechText } from './speechText';

export interface ParsedCommand {
  intent: 'create_event' | 'delete_event' | 'view_events' | 'edit_event' | 'set_reminder' | 'create_todo' | 'complete_todo' | 'delete_todo' | 'view_todos' | 'unknown';
  title?: string;
  date?: string;
  time?: string;
  end_time?: string;
  location?: string;
  description?: string;
  reminderMinutes?: number;
  priority?: 'low' | 'medium' | 'high';
  rawText: string;
  source?: string;
}

const INTENT_PATTERNS = {
  create_event: [
    /创建(一个)?(.*)事件/,
    /新建(一个)?(.*)事件/,
    /添加(一个)?(.*)事件/,
    /创建(一个)?(.*)日程/,
    /新建(一个)?(.*)日程/,
    /添加(一个)?(.*)日程/,
    /安排(一个)?(.*)会议/,
    /预约(.*)/,
  ],
  delete_event: [
    /删除(.*)事件/,
    /移除(.*)事件/,
    /取消(.*)事件/,
    /删除(.*)日程/,
    /取消(.*)会议/,
  ],
  view_events: [
    /查看(今天|明天|本周|本月|日程|事件|安排)/,
    /看看(今天|明天|本周|本月|日程|事件|安排)/,
    /显示(今天|明天|本周|本月|日程|事件|安排)/,
    /有什么(安排|日程|事件)/,
    /今天(有|有什么)(安排|日程|事件)/,
    /明天(有|有什么)(安排|日程|事件)/,
  ],
  set_reminder: [
    /提醒我(.*)/,
    /设置提醒(.*)/,
    /(.*)提醒(.*)/,
  ],
  create_todo: [
    /创建(一个)?(.*)任务/,
    /新建(一个)?(.*)任务/,
    /添加(一个)?(.*)任务/,
    /添加(一个)?(.*)待办/,
    /新建(一个)?(.*)待办/,
    /我(需要|要)(做|完成|处理)(.*)/,
    /记(下|住)(.*)/,
    /把(.+)(修改|改|整理|处理|提交|复习|准备|完成)/,
    /将(.+)(修改|改|整理|处理|提交|复习|准备|完成)/,
    /(修改|改|整理|处理|提交|复习|准备|完成)(.+)/,
    /(.*)(任务|待办|todo)/,
  ],
  complete_todo: [
    /完成(.*)任务/,
    /完成(.*)待办/,
    /做完(.*)/,
    /搞定了(.*)/,
    /完成了(.*)/,
    /标记(.*)完成/,
    /勾选(.*)/,
  ],
  delete_todo: [
    /删除(.*)任务/,
    /删除(.*)待办/,
    /移除(.*)任务/,
    /取消(.*)任务/,
    /不要(.*)任务/,
  ],
  view_todos: [
    /查看(今天|明天|本周|本月)的?(任务|待办)/,
    /看看(今天|明天|本周|本月)的?(任务|待办)/,
    /显示(今天|明天|本周|本月)的?(任务|待办)/,
    /有什么(任务|待办)/,
    /今天(有|有什么)(任务|待办)/,
    /我的(任务|待办)/,
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
    timeRange: /(\d{1,2}|一|二|三|四|五|六|七|八|九|十|十一|十二)[点时](半|\d{1,2}分?)?(?:到|至|-)(\d{1,2}|一|二|三|四|五|六|七|八|九|十|十一|十二)[点时](半|\d{1,2}分?)?/,
    relativeHours: /(\d+|[一二三四五六七八九十]+)小时后/,
    relativeMinutes: /(\d+|[一二三四五六七八九十]+)分钟后/,
    halfHour: /半/,
  },
};

const PRIORITY_PATTERNS = {
  high: /高优先|重要|紧急|急/,
  medium: /中优先|一般/,
  low: /低优先|不急|慢慢/,
};

const TITLE_ACTIONS = '修改|改|整理|处理|提交|复习|准备|完成';

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

function parseHourText(text: string): number {
  return CHINESE_NUMBERS[text] ?? parseInt(text);
}

function parseMinuteText(text?: string): number {
  if (!text) return 0;
  if (text === '半') return 30;
  return parseInt(text.replace('分', '')) || 0;
}

function normalizeHourByPeriod(hour: number, text: string): number {
  if (TIME_PATTERNS.time.afternoon.test(text) && hour < 12) {
    return hour + 12;
  }
  if (TIME_PATTERNS.time.evening.test(text) && hour < 12) {
    return hour + 12;
  }
  return hour;
}

function formatTime(hour: number, minute: number): string {
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

function extractTime(text: string): { date?: string; time?: string; end_time?: string; reminderMinutes?: number } {
  let date: string | undefined;
  let time: string | undefined;
  let end_time: string | undefined;
  let reminderMinutes: number | undefined;

  const today = new Date();

  if (TIME_PATTERNS.date.today.test(text)) {
    date = toLocalDateStr(today);
  } else if (TIME_PATTERNS.date.tomorrow.test(text)) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    date = toLocalDateStr(tomorrow);
  } else if (TIME_PATTERNS.date.dayAfterTomorrow.test(text)) {
    const dayAfter = new Date(today);
    dayAfter.setDate(dayAfter.getDate() + 2);
    date = toLocalDateStr(dayAfter);
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
    date = toLocalDateStr(nextWeek);
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
    date = toLocalDateStr(nextNextWeek);
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
    date = toLocalDateStr(targetDate);
  }

  const relativeWeeksMatch = text.match(TIME_PATTERNS.date.relativeWeeks);
  if (relativeWeeksMatch) {
    const weeks = parseChineseNumber(relativeWeeksMatch[1]);
    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + weeks * 7);
    date = toLocalDateStr(targetDate);
  }

  const timeRangeMatch = text.match(TIME_PATTERNS.time.timeRange);
  if (timeRangeMatch) {
    const startHour = normalizeHourByPeriod(parseHourText(timeRangeMatch[1]), text);
    const startMinute = parseMinuteText(timeRangeMatch[2]);
    let endHour = normalizeHourByPeriod(parseHourText(timeRangeMatch[3]), text);
    const endMinute = parseMinuteText(timeRangeMatch[4]);
    if (endHour < startHour && startHour >= 12 && endHour < 12) {
      endHour += 12;
    }
    time = formatTime(startHour, startMinute);
    end_time = formatTime(endHour, endMinute);
  }

  const hourMatch = text.match(TIME_PATTERNS.time.specificHour);
  if (!time && hourMatch) {
    const hour = normalizeHourByPeriod(parseInt(hourMatch[1]), text);
    const minute = hourMatch[2] ? parseInt(hourMatch[2]) : 0;
    time = formatTime(hour, minute);
  }

  const chineseHourMatch = text.match(TIME_PATTERNS.time.chineseHour);
  if (!time && chineseHourMatch) {
    const hour = normalizeHourByPeriod(CHINESE_NUMBERS[chineseHourMatch[1]] || 0, text);
    const halfMatch = text.match(TIME_PATTERNS.time.halfHour);
    const minute = halfMatch ? 30 : 0;
    time = formatTime(hour, minute);
  }

  const relativeHoursMatch = text.match(TIME_PATTERNS.time.relativeHours);
  if (relativeHoursMatch) {
    const hours = parseChineseNumber(relativeHoursMatch[1]);
    const targetTime = new Date(today);
    targetTime.setHours(targetTime.getHours() + hours);
    date = toLocalDateStr(targetTime);
    time = `${targetTime.getHours().toString().padStart(2, '0')}:${targetTime.getMinutes().toString().padStart(2, '0')}`;
  }

  const relativeMinutesMatch = text.match(TIME_PATTERNS.time.relativeMinutes);
  if (relativeMinutesMatch) {
    const minutes = parseChineseNumber(relativeMinutesMatch[1]);
    const targetTime = new Date(today);
    targetTime.setMinutes(targetTime.getMinutes() + minutes);
    date = toLocalDateStr(targetTime);
    time = `${targetTime.getHours().toString().padStart(2, '0')}:${targetTime.getMinutes().toString().padStart(2, '0')}`;
  }

  const reminderMatch = text.match(/提醒(我)?(提前)?(\d+|[一二三四五六七八九十]+)分钟/);
  if (reminderMatch) {
    reminderMinutes = parseChineseNumber(reminderMatch[3]);
  }

  return { date, time, end_time, reminderMinutes };
}

function extractPriority(text: string): 'low' | 'medium' | 'high' | undefined {
  if (PRIORITY_PATTERNS.high.test(text)) return 'high';
  if (PRIORITY_PATTERNS.medium.test(text)) return 'medium';
  if (PRIORITY_PATTERNS.low.test(text)) return 'low';
  return undefined;
}

function extractTitle(text: string, intent: string): string {
  let title = normalizeSpeechText(text);

  // 第一轮：去掉填充词/礼貌用语（LLM 能处理得更好，这里是 fallback）
  const fillerPatterns = [
    /你好|您好|嗨|哈喽|请|帮我|麻烦|谢谢|拜托|辛苦了/g,
    /我想|我要|我需要|能不能|可以|给我|帮我|来一个/g,
    /一下|吧|吗|呢|啊|哦|嗯|那个|这个|就是|然后|所以/g,
    /那个什么|就是那个/g,
  ];
  for (const pattern of fillerPatterns) {
    title = title.replace(pattern, '');
  }

  title = title
    .replace(new RegExp(`^把(.+?)(${TITLE_ACTIONS})(一下)?$`), '$2$1')
    .replace(new RegExp(`^将(.+?)(${TITLE_ACTIONS})(一下)?$`), '$2$1');

  // 第二轮：去掉关键词/动作词
  const commonPatterns = [
    /创建|新建|添加|一个|的/g,
    /删除|移除|取消|完成|做完|搞定|标记|勾选/g,
    /查看|看看|显示|有什么/g,
    /任务|待办|事件|日程|会议|安排/g,
    /明天|今天|后天|下周[一二三四五六日天]/g,
    /上午|下午|晚上|早上/g,
    /\d+[点时]\d*分?/g,
    /[一二三四五六七八九十]+点/g,
    /在(.+)/g,
    /我(需要|要)(做|完成|处理)/g,
    /记(下|住)/g,
    /把|将/g,
    /高优先|重要|紧急|急|中优先|一般|低优先|不急|慢慢/g,
  ];

  for (const pattern of commonPatterns) {
    title = title.replace(pattern, '');
  }

  // 清理多余空格和标点
  title = title.replace(/\s+/g, ' ').replace(/[,，。！!？?、；;：:]/g, '').trim();
  title = title.replace(new RegExp(`^(.+?)(${TITLE_ACTIONS})$`), '$2$1');

  if (!title || title.length === 0) {
    if (intent.includes('todo')) {
      title = '新任务';
    } else {
      title = '新事件';
    }
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
  const normalizedText = normalizeSpeechText(text);

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedText)) {
        const { date, time, end_time, reminderMinutes } = extractTime(normalizedText);
        const title = extractTitle(normalizedText, intent);
        const location = extractLocation(normalizedText);
        const priority = extractPriority(normalizedText);

        return {
          intent: intent as ParsedCommand['intent'],
          title,
          date,
          time,
          end_time,
          location,
          reminderMinutes,
          priority,
          rawText: normalizedText,
        };
      }
    }
  }

  const { date, time, end_time, reminderMinutes } = extractTime(normalizedText);
  if (date || time) {
    const title = extractTitle(normalizedText, 'create_event');
    return {
      intent: 'create_event',
      title,
      date,
      time,
      end_time,
      location: extractLocation(normalizedText),
      reminderMinutes,
      priority: extractPriority(normalizedText),
      rawText: normalizedText,
    };
  }

  return {
    intent: 'unknown',
    rawText: normalizedText,
  };
}
