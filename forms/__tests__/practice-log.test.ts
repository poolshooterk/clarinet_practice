import { practiceLogSchema, today } from '@/forms/practice-log';

const VALID_UUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';

describe('practiceLogSchema', () => {
  it('practicedAt のみと空の textbookEntries で合格する', () => {
    expect(
      practiceLogSchema.safeParse({ practicedAt: '2026-05-12', textbookEntries: [] }).success,
    ).toBe(true);
  });

  it('全フィールドが揃っていれば合格する', () => {
    expect(
      practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        durationMinutes: 45,
        memo: 'メモ',
        textbookEntries: [{ textbookId: VALID_UUID, currentPage: 14 }],
      }).success,
    ).toBe(true);
  });

  it('practicedAt が空文字のとき拒否する', () => {
    const r = practiceLogSchema.safeParse({ practicedAt: '', textbookEntries: [] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['practicedAt']);
  });

  it('practicedAt が YYYY/MM/DD 形式のとき拒否する', () => {
    const r = practiceLogSchema.safeParse({ practicedAt: '2026/05/12', textbookEntries: [] });
    expect(r.success).toBe(false);
  });

  it('durationMinutes が 1 のとき合格する', () => {
    expect(
      practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        durationMinutes: 1,
        textbookEntries: [],
      }).success,
    ).toBe(true);
  });

  it('durationMinutes が 0 のとき拒否する', () => {
    const r = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      durationMinutes: 0,
      textbookEntries: [],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['durationMinutes']);
  });

  it('durationMinutes が負数のとき拒否する', () => {
    const r = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      durationMinutes: -1,
      textbookEntries: [],
    });
    expect(r.success).toBe(false);
  });

  it('durationMinutes が小数のとき拒否する', () => {
    const r = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      durationMinutes: 1.5,
      textbookEntries: [],
    });
    expect(r.success).toBe(false);
  });

  it('durationMinutes が省略可能', () => {
    expect(
      practiceLogSchema.safeParse({ practicedAt: '2026-05-12', textbookEntries: [] }).success,
    ).toBe(true);
  });

  it('textbookId が uuid でないとき拒否する', () => {
    const r = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      textbookEntries: [{ textbookId: 'not-a-uuid', currentPage: 0 }],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['textbookEntries', 0, 'textbookId']);
  });

  it('currentPage が 0 のとき合格する（境界値）', () => {
    expect(
      practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        textbookEntries: [{ textbookId: VALID_UUID, currentPage: 0 }],
      }).success,
    ).toBe(true);
  });

  it('currentPage が負数のとき拒否する', () => {
    const r = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      textbookEntries: [{ textbookId: VALID_UUID, currentPage: -1 }],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['textbookEntries', 0, 'currentPage']);
  });

  it('currentPage が小数のとき拒否する', () => {
    const r = practiceLogSchema.safeParse({
      practicedAt: '2026-05-12',
      textbookEntries: [{ textbookId: VALID_UUID, currentPage: 1.5 }],
    });
    expect(r.success).toBe(false);
  });
});

describe('today', () => {
  it('YYYY-MM-DD 形式の文字列を返す', () => {
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
