import {
  startOfMonth, endOfMonth, addMonths,
  differenceInCalendarDays, getDaysInMonth, max, min,
} from "date-fns";

/** Sum of (actual_days_in_period / daysInMonth) for every month the expense spans. */
export function totalDayUnits(start: Date, end: Date): number {
  let units = 0;
  let cur = startOfMonth(start);
  const last = startOfMonth(end);
  while (cur <= last) {
    const mStart = max([start, startOfMonth(cur)]);
    const mEnd = min([end, endOfMonth(cur)]);
    const dim = getDaysInMonth(cur);
    units += (differenceInCalendarDays(mEnd, mStart) + 1) / dim;
    cur = addMonths(cur, 1);
  }
  return Math.max(units, 1 / 31);
}
