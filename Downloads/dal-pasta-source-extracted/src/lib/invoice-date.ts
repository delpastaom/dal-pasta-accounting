const DAY_MS = 86400000;
const MAX_AGE_DAYS = 30;

/**
 * فواتير عُمان تُكتب يوم/شهر، فقد يُقرأ 06/11/2026 خطأً على أنه 11 يونيو.
 * إذا كان التاريخ بعيدًا أو في المستقبل، وتبديل اليوم بالشهر يجعله ضمن آخر 30 يومًا، يُعتمد التبديل.
 */
export function fixSwappedInvoiceDate(date: string, today: string): { date: string; corrected: boolean } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return { date, corrected: false };
  const [, year, month, day] = m;
  const swapped = `${year}-${day}-${month}`;
  const ageDays = (d: string) => (Date.parse(today) - Date.parse(d)) / DAY_MS;
  const isRecent = (d: string) => ageDays(d) >= 0 && ageDays(d) <= MAX_AGE_DAYS;
  if (month === day || Number(day) > 12 || isRecent(date) || !isRecent(swapped)) {
    return { date, corrected: false };
  }
  return { date: swapped, corrected: true };
}
