// Simple English <-> Korean alias mapping for popular KOSPI/KOSDAQ stocks
// This is a lightweight front-end enhancement to help foreign users search Korean stocks by English names.

export const enToKoMap = new Map([
  ['samsung electronics', '삼성전자'],
  ['sk hynix', 'SK하이닉스'],
  ['hyundai motor', '현대차'],
  ['hyundai motors', '현대차'],
  ['kia', '기아'],
  ['naver', '네이버'],
  ['kakao', '카카오'],
  ['lg energy solution', 'LG에너지솔루션'],
  ['lg chem', 'LG화학'],
  ['posco holdings', '포스코홀딩스'],
  ['celltrion', '셀트리온'],
  ['samsung biologics', '삼성바이오로직스'],
  ['hybe', '하이브'],
  ['kt', 'KT'],
  ['sk telecom', 'SK텔레콤'],
]);

export function koFromEn(query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return null;
  return enToKoMap.get(q) || null;
}
