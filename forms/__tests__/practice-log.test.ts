import {
  AUTO_START_MENUS,
  BASIC_MENUS,
  formatClock,
  formatDate,
  practiceLogSchema,
  resolveAutoStartTimerKey,
  today,
} from '@/forms/practice-log';

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

    it('未来日 (翌日) はエラー', () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      const tomorrow = formatDate(d);
      const result = practiceLogSchema.safeParse({
        practicedAt: tomorrow,
        textbookEntries: [],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues.find((i) => i.path[0] === 'practicedAt')?.message).toBe(
        '未来の日付は入力できません',
      );
    });

    it('今日の日付は有効', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: today(),
        textbookEntries: [],
      });
      expect(result.success).toBe(true);
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

  describe('tonguingTempoBpms', () => {
    it('省略可能', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        textbookEntries: [],
      });
      expect(result.success).toBe(true);
    });

    it('空配列は有効', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        tonguingTempoBpms: [],
        textbookEntries: [],
      });
      expect(result.success).toBe(true);
    });

    it('単一要素 { bpm: 120 } は有効', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        tonguingTempoBpms: [{ bpm: 120 }],
        textbookEntries: [],
      });
      expect(result.success).toBe(true);
    });

    it('複数要素は有効', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        tonguingTempoBpms: [{ bpm: 80 }, { bpm: 100 }, { bpm: 120 }],
        textbookEntries: [],
      });
      expect(result.success).toBe(true);
    });

    it('bpm: 40 は有効（下限）', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        tonguingTempoBpms: [{ bpm: 40 }],
        textbookEntries: [],
      });
      expect(result.success).toBe(true);
    });

    it('bpm: 240 は有効（上限）', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        tonguingTempoBpms: [{ bpm: 240 }],
        textbookEntries: [],
      });
      expect(result.success).toBe(true);
    });

    it('bpm: 39 はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        tonguingTempoBpms: [{ bpm: 39 }],
        textbookEntries: [],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('40以上の整数を入力してください');
    });

    it('bpm: 241 はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        tonguingTempoBpms: [{ bpm: 241 }],
        textbookEntries: [],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('240以下の整数を入力してください');
    });

    it('bpm: 120.5 はエラー（小数）', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        tonguingTempoBpms: [{ bpm: 120.5 }],
        textbookEntries: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('otherMinutes', () => {
    it('省略可能', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-17',
        textbookEntries: [],
      });
      expect(result.success).toBe(true);
    });

    it('1 は有効', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-17',
        otherMinutes: 1,
        textbookEntries: [],
      });
      expect(result.success).toBe(true);
    });

    it('0 はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-17',
        otherMinutes: 0,
        textbookEntries: [],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('1以上の整数を入力してください');
    });

    it('小数はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-17',
        otherMinutes: 1.5,
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

    describe('textbookEntries[].durationMinutes', () => {
      it('省略可能', () => {
        const result = practiceLogSchema.safeParse({
          practicedAt: '2026-05-12',
          textbookEntries: [{ textbookId: '123e4567-e89b-12d3-a456-426614174001', currentPage: 5 }],
        });
        expect(result.success).toBe(true);
      });

      it('1 は有効', () => {
        const result = practiceLogSchema.safeParse({
          practicedAt: '2026-05-12',
          textbookEntries: [
            {
              textbookId: '123e4567-e89b-12d3-a456-426614174001',
              currentPage: 5,
              durationMinutes: 1,
            },
          ],
        });
        expect(result.success).toBe(true);
      });

      it('0 はエラー', () => {
        const result = practiceLogSchema.safeParse({
          practicedAt: '2026-05-12',
          textbookEntries: [
            {
              textbookId: '123e4567-e89b-12d3-a456-426614174001',
              currentPage: 5,
              durationMinutes: 0,
            },
          ],
        });
        expect(result.success).toBe(false);
      });
    });

    describe('textbookEntries[].tempoBpms', () => {
      it('省略可能', () => {
        const result = practiceLogSchema.safeParse({
          practicedAt: '2026-05-17',
          textbookEntries: [{ textbookId: '123e4567-e89b-12d3-a456-426614174001', currentPage: 0 }],
        });
        expect(result.success).toBe(true);
      });

      it('空配列は有効', () => {
        const result = practiceLogSchema.safeParse({
          practicedAt: '2026-05-17',
          textbookEntries: [
            {
              textbookId: '123e4567-e89b-12d3-a456-426614174001',
              currentPage: 0,
              tempoBpms: [],
            },
          ],
        });
        expect(result.success).toBe(true);
      });

      it('{ bpm: 120 } は有効', () => {
        const result = practiceLogSchema.safeParse({
          practicedAt: '2026-05-17',
          textbookEntries: [
            {
              textbookId: '123e4567-e89b-12d3-a456-426614174001',
              currentPage: 0,
              tempoBpms: [{ bpm: 120 }],
            },
          ],
        });
        expect(result.success).toBe(true);
      });

      it('bpm: 39 はエラー（下限未満）', () => {
        const result = practiceLogSchema.safeParse({
          practicedAt: '2026-05-17',
          textbookEntries: [
            {
              textbookId: '123e4567-e89b-12d3-a456-426614174001',
              currentPage: 0,
              tempoBpms: [{ bpm: 39 }],
            },
          ],
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe('40以上の整数を入力してください');
      });

      it('bpm: 241 はエラー（上限超過）', () => {
        const result = practiceLogSchema.safeParse({
          practicedAt: '2026-05-17',
          textbookEntries: [
            {
              textbookId: '123e4567-e89b-12d3-a456-426614174001',
              currentPage: 0,
              tempoBpms: [{ bpm: 241 }],
            },
          ],
        });
        expect(result.success).toBe(false);
        expect(result.error?.issues[0].message).toBe('240以下の整数を入力してください');
      });
    });
  });

  describe('reedNumber', () => {
    it('reedNumber が英数字のみなら有効', () => {
      const r = practiceLogSchema.safeParse({
        practicedAt: '2026-05-15',
        textbookEntries: [],
        reedNumber: 'A3b',
      });
      expect(r.success).toBe(true);
    });

    it('reedNumber が空文字なら有効（任意項目）', () => {
      const r = practiceLogSchema.safeParse({
        practicedAt: '2026-05-15',
        textbookEntries: [],
        reedNumber: '',
      });
      expect(r.success).toBe(true);
    });

    it('reedNumber が省略された場合も有効', () => {
      const r = practiceLogSchema.safeParse({
        practicedAt: '2026-05-15',
        textbookEntries: [],
      });
      expect(r.success).toBe(true);
    });

    it('reedNumber に記号が含まれる場合は拒否する', () => {
      const r = practiceLogSchema.safeParse({
        practicedAt: '2026-05-15',
        textbookEntries: [],
        reedNumber: 'A-3',
      });
      expect(r.success).toBe(false);
    });

    it('reedNumber に日本語が含まれる場合は拒否する', () => {
      const r = practiceLogSchema.safeParse({
        practicedAt: '2026-05-15',
        textbookEntries: [],
        reedNumber: '第3番',
      });
      expect(r.success).toBe(false);
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

describe('practiceLogSchema startTime/endTime', () => {
  const base = { practicedAt: '2020-01-01', textbookEntries: [] };

  it('HH:MM 形式の開始/終了を受け付ける', () => {
    const r = practiceLogSchema.safeParse({ ...base, startTime: '19:00', endTime: '19:50' });
    expect(r.success).toBe(true);
  });

  it('空文字は許容される (未入力)', () => {
    const r = practiceLogSchema.safeParse({ ...base, startTime: '', endTime: '' });
    expect(r.success).toBe(true);
  });

  it('片方だけの入力も許容される', () => {
    const r = practiceLogSchema.safeParse({ ...base, startTime: '19:00', endTime: '' });
    expect(r.success).toBe(true);
  });

  it('不正な形式は拒否される', () => {
    const r = practiceLogSchema.safeParse({ ...base, startTime: '9時' });
    expect(r.success).toBe(false);
  });
});

describe('formatClock', () => {
  it('epoch を HH:MM に整形する', () => {
    const d = new Date(2026, 0, 1, 19, 5, 0);
    expect(formatClock(d.getTime())).toBe('19:05');
  });
});

describe('resolveAutoStartTimerKey', () => {
  it('none はタイマーキーを返さない', () => {
    expect(resolveAutoStartTimerKey('none')).toBeNull();
  });

  it('基礎メニューは menu_type がそのままキーになる', () => {
    expect(resolveAutoStartTimerKey('long_tone')).toBe('long_tone');
    expect(resolveAutoStartTimerKey('tonguing')).toBe('tonguing');
  });

  it('その他は other キーになる', () => {
    expect(resolveAutoStartTimerKey('other')).toBe('other');
  });

  it('教本は 1 行目の field id からキーを組み立てる', () => {
    expect(resolveAutoStartTimerKey('textbook', 'abc123')).toBe('textbook-abc123');
  });

  it('教本行が無いときは自動開始しない', () => {
    expect(resolveAutoStartTimerKey('textbook')).toBeNull();
    expect(resolveAutoStartTimerKey('textbook', '')).toBeNull();
  });

  it('教本以外は field id を渡しても影響しない', () => {
    expect(resolveAutoStartTimerKey('long_tone', 'abc123')).toBe('long_tone');
  });

  it('AUTO_START_MENUS の全選択肢を解決できる', () => {
    for (const menu of AUTO_START_MENUS) {
      expect(() => resolveAutoStartTimerKey(menu.value, 'abc123')).not.toThrow();
    }
  });
});
