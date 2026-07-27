export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  location?: string | null;
  url?: string | null;
}

const escapeText = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');

const utc = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');

const fold = (line: string) => {
  const chunks: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, 'utf8') > 73) {
    let index = 70;
    while (Buffer.byteLength(rest.slice(0, index), 'utf8') > 73) index -= 1;
    chunks.push(rest.slice(0, index));
    rest = ` ${rest.slice(index)}`;
  }
  chunks.push(rest);
  return chunks.join('\r\n');
};

export function buildCalendarFile(event: CalendarEvent): string {
  const now = utc(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hostly AI//Event Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}@hostly.ai`,
    `DTSTAMP:${now}`,
    `DTSTART:${utc(event.startsAt)}`,
    `DTEND:${utc(event.endsAt)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    event.location ? `LOCATION:${escapeText(event.location)}` : null,
    event.url ? `URL:${event.url}` : null,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((line): line is string => Boolean(line));
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
