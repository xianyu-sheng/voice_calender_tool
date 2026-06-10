/**
 * 将 Date 对象格式化为本地 YYYY-MM-DD 字符串
 * 不受时区影响，始终返回本地日期
 */
export function toLocalDateStr(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取今天的本地日期字符串
 */
export function todayStr(): string {
  return toLocalDateStr(new Date());
}

export interface CalendarMeta {
  date: string;
  lunar: string;
  lunarMonth: string;
  lunarDay: string;
  festival?: string;
  solarTerm?: string;
  holiday?: string;
  holidayType?: 'off' | 'work';
}

const lunarFormatter = new Intl.DateTimeFormat('zh-CN-u-ca-chinese', {
  month: 'long',
  day: 'numeric',
});

const lunarMonthNamePattern = /([正一二三四五六七八九十冬腊闰]+)月/;
const lunarDayMap: Record<number, string> = {
  1: '初一',
  2: '初二',
  3: '初三',
  4: '初四',
  5: '初五',
  6: '初六',
  7: '初七',
  8: '初八',
  9: '初九',
  10: '初十',
  11: '十一',
  12: '十二',
  13: '十三',
  14: '十四',
  15: '十五',
  16: '十六',
  17: '十七',
  18: '十八',
  19: '十九',
  20: '二十',
  21: '廿一',
  22: '廿二',
  23: '廿三',
  24: '廿四',
  25: '廿五',
  26: '廿六',
  27: '廿七',
  28: '廿八',
  29: '廿九',
  30: '三十',
};

const solarFestivals: Record<string, string> = {
  '01-01': '元旦',
  '02-14': '情人节',
  '03-08': '妇女节',
  '03-12': '植树节',
  '05-01': '劳动节',
  '05-04': '青年节',
  '06-01': '儿童节',
  '07-01': '建党节',
  '08-01': '建军节',
  '09-10': '教师节',
  '10-01': '国庆节',
  '12-24': '平安夜',
  '12-25': '圣诞节',
};

const lunarFestivals: Record<string, string> = {
  '正月-初一': '春节',
  '正月-十五': '元宵节',
  '二月-初二': '龙抬头',
  '五月-初五': '端午节',
  '七月-初七': '七夕',
  '七月-十五': '中元节',
  '八月-十五': '中秋节',
  '九月-初九': '重阳节',
  '腊月-初八': '腊八节',
  '腊月-廿三': '北方小年',
  '腊月-廿四': '南方小年',
};

const legalHolidayOverrides: Record<string, { name: string; type: 'off' | 'work' }> = {
  '2026-01-01': { name: '元旦休', type: 'off' },
  '2026-01-02': { name: '元旦休', type: 'off' },
  '2026-01-03': { name: '元旦休', type: 'off' },
  '2026-01-04': { name: '元旦班', type: 'work' },
  '2026-02-15': { name: '春节休', type: 'off' },
  '2026-02-16': { name: '除夕休', type: 'off' },
  '2026-02-17': { name: '春节休', type: 'off' },
  '2026-02-18': { name: '春节休', type: 'off' },
  '2026-02-19': { name: '春节休', type: 'off' },
  '2026-02-20': { name: '春节休', type: 'off' },
  '2026-02-21': { name: '春节休', type: 'off' },
  '2026-02-22': { name: '春节休', type: 'off' },
  '2026-02-14': { name: '春节班', type: 'work' },
  '2026-02-28': { name: '春节班', type: 'work' },
  '2026-04-04': { name: '清明休', type: 'off' },
  '2026-04-05': { name: '清明休', type: 'off' },
  '2026-04-06': { name: '清明休', type: 'off' },
  '2026-05-01': { name: '劳动节休', type: 'off' },
  '2026-05-02': { name: '劳动节休', type: 'off' },
  '2026-05-03': { name: '劳动节休', type: 'off' },
  '2026-05-04': { name: '劳动节休', type: 'off' },
  '2026-05-05': { name: '劳动节休', type: 'off' },
  '2026-04-26': { name: '劳动节班', type: 'work' },
  '2026-05-09': { name: '劳动节班', type: 'work' },
  '2026-06-19': { name: '端午休', type: 'off' },
  '2026-06-20': { name: '端午休', type: 'off' },
  '2026-06-21': { name: '端午休', type: 'off' },
  '2026-09-25': { name: '中秋休', type: 'off' },
  '2026-09-26': { name: '中秋休', type: 'off' },
  '2026-09-27': { name: '中秋休', type: 'off' },
  '2026-10-01': { name: '国庆休', type: 'off' },
  '2026-10-02': { name: '国庆休', type: 'off' },
  '2026-10-03': { name: '国庆休', type: 'off' },
  '2026-10-04': { name: '国庆休', type: 'off' },
  '2026-10-05': { name: '国庆休', type: 'off' },
  '2026-10-06': { name: '国庆休', type: 'off' },
  '2026-10-07': { name: '国庆休', type: 'off' },
  '2026-09-20': { name: '国庆班', type: 'work' },
  '2026-10-10': { name: '国庆班', type: 'work' },
};

const solarTermInfo = [
  0,
  21208,
  42467,
  63836,
  85337,
  107014,
  128867,
  150921,
  173149,
  195551,
  218072,
  240693,
  263343,
  285989,
  308563,
  331033,
  353350,
  375494,
  397447,
  419210,
  440795,
  462224,
  483532,
  504758,
];

const solarTermNames = [
  '小寒',
  '大寒',
  '立春',
  '雨水',
  '惊蛰',
  '春分',
  '清明',
  '谷雨',
  '立夏',
  '小满',
  '芒种',
  '夏至',
  '小暑',
  '大暑',
  '立秋',
  '处暑',
  '白露',
  '秋分',
  '寒露',
  '霜降',
  '立冬',
  '小雪',
  '大雪',
  '冬至',
];

function getLunarParts(date: Date) {
  const formatted = lunarFormatter.format(date);
  const monthMatch = formatted.match(lunarMonthNamePattern);
  const dayMatch = formatted.match(/(\d+)/);
  const lunarMonth = monthMatch ? `${monthMatch[1]}月` : '';
  const lunarDay = dayMatch ? lunarDayMap[Number(dayMatch[1])] || dayMatch[1] : '';
  return {
    lunarMonth,
    lunarDay,
    lunar: lunarDay === '初一' && lunarMonth ? lunarMonth : lunarDay,
  };
}

function getSolarTerm(date: Date) {
  const year = date.getFullYear();
  const base = Date.UTC(1900, 0, 6, 2, 5);

  for (let index = 0; index < solarTermInfo.length; index += 1) {
    const termDate = new Date(31556925974.7 * (year - 1900) + solarTermInfo[index] * 60000 + base);
    if (termDate.getUTCMonth() === date.getMonth() && termDate.getUTCDate() === date.getDate()) {
      return solarTermNames[index];
    }
  }

  return undefined;
}

function getFestival(date: Date, lunarMonth: string, lunarDay: string) {
  const monthDay = toLocalDateStr(date).slice(5);
  return solarFestivals[monthDay] || lunarFestivals[`${lunarMonth}-${lunarDay}`];
}

export function getCalendarMeta(date: Date): CalendarMeta {
  const dateStr = toLocalDateStr(date);
  const { lunarMonth, lunarDay, lunar } = getLunarParts(date);
  const solarTerm = getSolarTerm(date);
  const holiday = legalHolidayOverrides[dateStr];
  const festival = getFestival(date, lunarMonth, lunarDay);

  return {
    date: dateStr,
    lunar,
    lunarMonth,
    lunarDay,
    festival,
    solarTerm,
    holiday: holiday?.name,
    holidayType: holiday?.type,
  };
}
