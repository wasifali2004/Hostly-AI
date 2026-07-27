import { buildCalendarFile } from './ics';

describe('buildCalendarFile', () => {
  it('creates a valid, escaped UTC calendar event', () => {
    const file = buildCalendarFile({
      id: 'event-1',
      title: 'Hostly, Live',
      description: 'Line one\nLine two',
      startsAt: new Date('2026-08-01T10:00:00.000Z'),
      endsAt: new Date('2026-08-01T11:00:00.000Z'),
      location: 'Hall A; Karachi',
    });

    expect(file).toContain('BEGIN:VCALENDAR');
    expect(file).toContain('DTSTART:20260801T100000Z');
    expect(file).toContain('SUMMARY:Hostly\\, Live');
    expect(file).toContain('DESCRIPTION:Line one\\nLine two');
    expect(file).toContain('END:VCALENDAR');
  });
});
