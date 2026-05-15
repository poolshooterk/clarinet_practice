import {
  combineDateTime,
  formatDate,
  formatHeldAt,
  formatTime,
  lessonRecordSchema,
  splitHeldAt,
} from '@/forms/lesson-record';

describe('lessonRecordSchema', () => {
  it('date と time が揃っていれば有効', () => {
    expect(lessonRecordSchema.safeParse({ date: '2026-05-15', time: '14:00' }).success).toBe(true);
  });

  it('advice と notes を含む場合も有効', () => {
    expect(
      lessonRecordSchema.safeParse({
        date: '2026-05-15',
        time: '14:00',
        advice: 'タンギングを軽く',
        notes: '息のスピードが足りない',
      }).success,
    ).toBe(true);
  });

  it('date が空のとき拒否する', () => {
    const r = lessonRecordSchema.safeParse({ date: '', time: '14:00' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['date']);
  });

  it('date の形式が不正のとき拒否する', () => {
    expect(lessonRecordSchema.safeParse({ date: '2026/05/15', time: '14:00' }).success).toBe(false);
  });

  it('time が空のとき拒否する', () => {
    const r = lessonRecordSchema.safeParse({ date: '2026-05-15', time: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['time']);
  });

  it('time の形式が不正のとき拒否する', () => {
    expect(lessonRecordSchema.safeParse({ date: '2026-05-15', time: '14:00:00' }).success).toBe(
      false,
    );
  });

  it('advice と notes は省略可能', () => {
    expect(lessonRecordSchema.safeParse({ date: '2026-05-15', time: '14:00' }).success).toBe(true);
  });
});

describe('combineDateTime', () => {
  it('日付と時刻を JST オフセット付き文字列に結合する', () => {
    expect(combineDateTime('2026-05-15', '14:00')).toBe('2026-05-15T14:00:00+09:00');
  });
});

describe('formatDate', () => {
  it('Date を YYYY-MM-DD 文字列にフォーマットする', () => {
    expect(formatDate(new Date(2026, 4, 15))).toBe('2026-05-15');
  });
});

describe('formatTime', () => {
  it('Date を HH:MM 文字列にフォーマットする', () => {
    expect(formatTime(new Date(2026, 4, 15, 14, 30))).toBe('14:30');
  });
});

describe('splitHeldAt', () => {
  it('ISO 文字列を YYYY-MM-DD と HH:MM に分割する', () => {
    const { date, time } = splitHeldAt('2026-05-15T05:00:00.000Z');
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(time).toMatch(/^\d{2}:\d{2}$/);
  });
});

describe('formatHeldAt', () => {
  it('ISO 文字列を YYYY-MM-DD HH:MM 形式に変換する', () => {
    const result = formatHeldAt('2026-05-15T05:00:00.000Z');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });
});
