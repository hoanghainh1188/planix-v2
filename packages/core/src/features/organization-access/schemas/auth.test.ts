import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpdateMeRequest, isIanaTimeZone } from './auth.ts';

describe('time zone names for user preferences (FR-030, code review Phase 10)', () => {
  it.each(['Asia/Ho_Chi_Minh', 'Asia/Tokyo', 'Europe/London', 'America/Argentina/Buenos_Aires', 'Europe/Kyiv', 'UTC'])(
    'accepts the IANA name %s',
    (zone) => {
      expect(isIanaTimeZone(zone)).toBe(true);
    },
  );

  it.each([
    ['asia/tokyo', 'wrong capitalization'],
    ['ASIA/TOKYO', 'wrong capitalization'],
    ['GMT', 'abbreviation'],
    ['Zulu', 'abbreviation'],
    ['EST', 'abbreviation'],
    ['Etc/GMT+5', 'Etc zones (inverted sign)'],
    ['Etc/UTC', 'Etc alias — use UTC'],
    ['UTC+7', 'offset'],
    ['+07:00', 'offset'],
    ['Mars/Olympus_Mons', 'unknown to the runtime'],
    ['', 'empty'],
  ])('refuses %s (%s)', (zone) => {
    expect(isIanaTimeZone(zone)).toBe(false);
  });

  it('keeps the name exactly as sent — never replaced by an ICU alias such as Asia/Saigon', () => {
    expect(UpdateMeRequest.parse({ timeZone: 'Asia/Ho_Chi_Minh' })).toEqual({ timeZone: 'Asia/Ho_Chi_Minh' });
  });

  describe('length is checked before the expensive checks (security review)', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });
    const longName = `Asia/${'A'.repeat(200_000)}`;

    it('refuses a name longer than 100 characters without asking Intl', () => {
      const intl = vi.spyOn(Intl, 'DateTimeFormat');
      expect(isIanaTimeZone(longName)).toBe(false);
      expect(UpdateMeRequest.safeParse({ timeZone: longName }).success).toBe(false);
      expect(intl).not.toHaveBeenCalled();
    });

    it('draws the limit at 100 characters: 100 reaches Intl, 101 does not', () => {
      const intl = vi.spyOn(Intl, 'DateTimeFormat');
      isIanaTimeZone(`Asia/${'A'.repeat(95)}`);
      expect(intl).toHaveBeenCalledTimes(1);
      isIanaTimeZone(`Asia/${'A'.repeat(96)}`);
      expect(intl).toHaveBeenCalledTimes(1);
    });
  });
});
