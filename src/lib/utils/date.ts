// Formats a date-only string (YYYY-MM-DD, e.g. from a Postgres `date` column or an
// <input type="date">) for display without shifting across timezones.
// `new Date("2026-06-15")` parses as UTC midnight; formatting that in a timezone behind
// UTC (e.g. US Pacific) rolls the displayed date back by one day. Parsing the components
// into the local Date constructor instead avoids that shift entirely.
export function formatDateOnly(
  dateStr: string | null | undefined,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
): string {
  if (!dateStr) return '—'
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', options)
}
