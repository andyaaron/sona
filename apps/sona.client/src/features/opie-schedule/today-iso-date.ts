/** Local YYYY-MM-DD for `<input type="date">` and the API's `date` param. */
export function todayIsoDate(now = new Date()): string {
  return toIsoDate(now)
}

/** `date` ± `days`, as YYYY-MM-DD. Computed in local time so DST never skips a day. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return toIsoDate(new Date(y, m - 1, d + days))
}

function toIsoDate(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
}
