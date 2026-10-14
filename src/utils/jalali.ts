/**
 * Persian Jalali (Shamsi) Date Utilities & Number Helpers
 */

export function toPersianDigits(num: number | string | undefined | null): string {
  if (num === undefined || num === null) return '';
  const str = String(num);
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.replace(/[0-9]/g, (w) => persianDigits[parseInt(w, 10)]);
}

export function padZero(num: number | string, length: number = 2): string {
  const str = String(num).replace(/[^0-9]/g, '');
  return str.padStart(length, '0');
}

/**
 * Standard Jalali conversion algorithm
 */
export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    g_d_m[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

/**
 * Get current date in Jalali YYYY/MM/DD
 */
export function getCurrentJalaliDate(): string {
  const now = new Date();
  const [jy, jm, jd] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return `${jy}/${padZero(jm)}/${padZero(jd)}`;
}

export function getCurrentJalaliYear(): string {
  const now = new Date();
  const [jy] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return String(jy);
}

export function updateJalaliDateToCurrentYear(dateStr?: string | null): string {
  if (!dateStr || dateStr === '---' || dateStr.trim() === '') return '---';
  const currYear = getCurrentJalaliYear();
  return dateStr.replace(/^(140[0-3])/g, currYear);
}

export function compareJalaliDates(d1?: string, d2?: string): number {
  if (!d1 && !d2) return 0;
  if (!d1) return -1;
  if (!d2) return 1;

  const clean1 = d1.replace(/[^0-9/]/g, '').trim();
  const clean2 = d2.replace(/[^0-9/]/g, '').trim();

  if (clean1 === clean2) return 0;
  return clean1 < clean2 ? -1 : 1;
}

export function calculateAutoStatus(
  deadline: string,
  actualDate?: string,
): 'done' | 'late' | 'not_done' {
  if (actualDate && actualDate.trim().length >= 8) {
    const cmp = compareJalaliDates(actualDate.trim(), deadline.trim());
    if (cmp <= 0) {
      return 'done';
    } else {
      return 'late';
    }
  }
  return 'not_done';
}

export function formatEmployeeCode(code: string | number): string {
  const clean = String(code).replace(/[^0-9]/g, '');
  if (!clean) return '01';
  if (clean.length === 1) return `0${clean}`;
  return clean;
}

export const MONTH_NAMES_FA = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export function formatJalaliHuman(dateStr?: string): string {
  if (!dateStr) return '---';
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const year = parts[0];
    const monthIdx = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const monthName = MONTH_NAMES_FA[monthIdx] || parts[1];
    return `${toPersianDigits(day)} ${monthName} ${toPersianDigits(year)}`;
  }
  return toPersianDigits(dateStr);
}
