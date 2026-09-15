export interface DateTimeFormatOptions {
  readonly timeZone: string;
  readonly locale: 'vi' | 'en';
}

const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$/;

/** Formats a UTC instant from the API in the user's IANA time zone (FR-030). Never uses the machine time zone. */
export function formatDateTime(isoUtc: string, { timeZone, locale }: DateTimeFormatOptions): string {
  if (!UTC_ISO.test(isoUtc)) throw new RangeError(`Expected an ISO 8601 UTC timestamp, got "${isoUtc}"`);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(isoUtc));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const date =
    locale === 'vi'
      ? `${part('day')}/${part('month')}/${part('year')}`
      : `${part('month')}/${part('day')}/${part('year')}`;
  return `${part('hour')}:${part('minute')} ${date}`;
}
