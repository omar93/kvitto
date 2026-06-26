const pad = (n) => String(n).padStart(2, '0');

/**
 * @param {number} year
 * @param {number} month1to12
 * @param {number} day
 * @returns {string} tab name like "2026-06/07"
 */
export function tabNameForYmd(year, month1to12, day) {
  let y = year;
  let m = month1to12; // start month of the pay period
  if (day < 25) {
    m -= 1;
    if (m === 0) { m = 12; y -= 1; }
  }
  const endM = m === 12 ? 1 : m + 1;
  return `${y}-${pad(m)}/${pad(endM)}`;
}

/** @param {Date} [date] */
export function tabNameForDate(date = new Date()) {
  return tabNameForYmd(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** @param {string} s "YYYY-MM-DD" */
export function tabNameForDateString(s) {
  const [y, m, d] = s.split('-').map(Number);
  return tabNameForYmd(y, m, d);
}
