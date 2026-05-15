import { textbookSchema } from '@/forms/textbook';

describe('textbookSchema', () => {
  it('title と genre で有効', () => {
    expect(textbookSchema.safeParse({ title: 'ローズ', genre: 'エチュード' }).success).toBe(true);
  });

  it('全フィールドが揃っていれば有効', () => {
    expect(
      textbookSchema.safeParse({
        title: 'ローズ 32のエチュード',
        publisher: '全音楽譜出版社',
        genre: 'エチュード',
        difficulty: '中級',
      }).success,
    ).toBe(true);
  });

  it('title が空文字のとき拒否する', () => {
    const r = textbookSchema.safeParse({ title: '', genre: 'エチュード' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['title']);
  });

  it('difficulty が無効な値のとき拒否する', () => {
    const r = textbookSchema.safeParse({
      title: 'テスト',
      genre: 'エチュード',
      difficulty: '超上級',
    });
    expect(r.success).toBe(false);
  });

  it('difficulty が省略可能', () => {
    expect(textbookSchema.safeParse({ title: 'テスト', genre: 'エチュード' }).success).toBe(true);
  });

  it('publisher が省略可能', () => {
    expect(textbookSchema.safeParse({ title: 'テスト', genre: 'エチュード' }).success).toBe(true);
  });

  it('totalPages が省略可能', () => {
    expect(textbookSchema.safeParse({ title: 'テスト', genre: 'エチュード' }).success).toBe(true);
  });

  it('totalPages に正整数を渡すと有効', () => {
    expect(
      textbookSchema.safeParse({ title: 'テスト', genre: 'エチュード', totalPages: 100 }).success,
    ).toBe(true);
  });

  it('totalPages に 0 を渡すと拒否する', () => {
    const r = textbookSchema.safeParse({ title: 'テスト', genre: 'エチュード', totalPages: 0 });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['totalPages']);
  });

  it('totalPages に負数を渡すと拒否する', () => {
    const r = textbookSchema.safeParse({ title: 'テスト', genre: 'エチュード', totalPages: -1 });
    expect(r.success).toBe(false);
  });

  it('totalPages に小数を渡すと拒否する', () => {
    const r = textbookSchema.safeParse({ title: 'テスト', genre: 'エチュード', totalPages: 1.5 });
    expect(r.success).toBe(false);
  });

  it('genre が未指定のとき拒否する', () => {
    const r = textbookSchema.safeParse({ title: 'テスト' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe('ジャンルを選択してください');
  });

  it('genre に有効な値を渡すと pass', () => {
    for (const g of [
      'スケール',
      'エチュード',
      'ソナタ',
      'コンチェルト',
      'アンサンブル',
      'その他',
    ] as const) {
      expect(textbookSchema.safeParse({ title: 'テスト', genre: g }).success).toBe(true);
    }
  });

  it('genre に無効な文字列を渡すと拒否する', () => {
    const r = textbookSchema.safeParse({ title: 'テスト', genre: 'jazz' });
    expect(r.success).toBe(false);
  });
});
