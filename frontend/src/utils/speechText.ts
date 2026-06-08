const CJK_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;

const WORD_CORRECTIONS: Array<[RegExp, string]> = [
  [/代办/g, '待办'],
  [/日成/g, '日程'],
  [/日承/g, '日程'],
  [/事建/g, '事件'],
  [/热文/g, '论文'],
];

function normalizeFullWidthDigits(text: string): string {
  return text.replace(/[０-９]/g, char =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );
}

function compactChineseSpacing(text: string): string {
  let current = text;
  let previous = '';

  while (current !== previous) {
    previous = current;
    current = current
      .replace(/([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff])\s+([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff])/g, '$1$2')
      .replace(/([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff])\s+(\d)/g, '$1$2')
      .replace(/(\d)\s+([\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff])/g, '$1$2');
  }

  return current;
}

export function normalizeSpeechText(text: string): string {
  let normalized = normalizeFullWidthDigits(text)
    .trim()
    .toLowerCase()
    .replace(/[，。！？、；：]/g, ' ')
    .replace(/\s+/g, ' ');

  normalized = compactChineseSpacing(normalized);

  for (const [pattern, replacement] of WORD_CORRECTIONS) {
    normalized = normalized.replace(pattern, replacement);
  }

  if (CJK_PATTERN.test(normalized)) {
    normalized = compactChineseSpacing(normalized);
  }

  return normalized.trim();
}
