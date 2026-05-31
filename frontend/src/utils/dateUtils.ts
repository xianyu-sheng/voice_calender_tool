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
