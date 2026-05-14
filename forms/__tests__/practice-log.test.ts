import { BASIC_MENUS, practiceLogSchema, today } from '@/forms/practice-log';

describe('practiceLogSchema', () => {
  describe('有効なケース', () => {
    it('最小限: practicedAt と空の textbookEntries のみ', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        textbookEntries: [],
      });
      expect(result.success).toBe(true);
    });

    it('全項目あり', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        longToneMinutes: 15,
        tonguingMinutes: 10,
        memo: 'テスト',
        textbookEntries: [{ textbookId: '123e4567-e89b-12d3-a456-426614174001', currentPage: 5 }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('practicedAt', () => {
    it('空文字はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '',
        textbookEntries: [],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('日付を入力してください');
    });

    it('YYYY/MM/DD 形式はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026/05/12',
        textbookEntries: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('longToneMinutes', () => {
    it('省略可能', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        textbookEntries: [],
      });
      expect(result.success).toBe(true);
    });

    it('1 は有効', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        longToneMinutes: 1,
        textbookEntries: [],
      });
      expect(result.success).toBe(true);
    });

    it('0 はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        longToneMinutes: 0,
        textbookEntries: [],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('1以上の整数を入力してください');
    });

    it('負数はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        longToneMinutes: -1,
        textbookEntries: [],
      });
      expect(result.success).toBe(false);
    });

    it('小数はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        longToneMinutes: 1.5,
        textbookEntries: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('tonguingMinutes', () => {
    it('省略可能', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        textbookEntries: [],
      });
      expect(result.success).toBe(true);
    });

    it('1 は有効', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        tonguingMinutes: 1,
        textbookEntries: [],
      });
      expect(result.success).toBe(true);
    });

    it('0 はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        tonguingMinutes: 0,
        textbookEntries: [],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('1以上の整数を入力してください');
    });

    it('小数はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        tonguingMinutes: 1.5,
        textbookEntries: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('textbookEntries', () => {
    it('UUID でない textbookId はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        textbookEntries: [{ textbookId: 'not-uuid', currentPage: 0 }],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('教本を選択してください');
    });

    it('currentPage が負数はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        textbookEntries: [{ textbookId: '123e4567-e89b-12d3-a456-426614174001', currentPage: -1 }],
      });
      expect(result.success).toBe(false);
    });

    it('currentPage が小数はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        textbookEntries: [{ textbookId: '123e4567-e89b-12d3-a456-426614174001', currentPage: 1.5 }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('BASIC_MENUS', () => {
    it('long_tone と tonguing が含まれる', () => {
      const types = BASIC_MENUS.map((m) => m.type);
      expect(types).toContain('long_tone');
      expect(types).toContain('tonguing');
    });

    it('各メニューに label がある', () => {
      for (const menu of BASIC_MENUS) {
        expect(menu.label).toBeTruthy();
      }
    });
  });
});

describe('today()', () => {
  it('YYYY-MM-DD 形式で返す', () => {
    const result = today();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
