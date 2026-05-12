import { textbookSchema } from '@/forms/textbook';

describe('textbookSchema', () => {
  it('title のみで有効', () => {
    expect(textbookSchema.safeParse({ title: 'ローズ' }).success).toBe(true);
  });

  it('全フィールドが揃っていれば有効', () => {
    expect(
      textbookSchema.safeParse({
        title: 'ローズ 32のエチュード',
        publisher: '全音楽譜出版社',
        difficulty: '中級',
      }).success,
    ).toBe(true);
  });

  it('title が空文字のとき拒否する', () => {
    const r = textbookSchema.safeParse({ title: '' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path).toEqual(['title']);
  });

  it('difficulty が無効な値のとき拒否する', () => {
    const r = textbookSchema.safeParse({ title: 'テスト', difficulty: '超上級' });
    expect(r.success).toBe(false);
  });

  it('difficulty が省略可能', () => {
    expect(textbookSchema.safeParse({ title: 'テスト' }).success).toBe(true);
  });

  it('publisher が省略可能', () => {
    expect(textbookSchema.safeParse({ title: 'テスト' }).success).toBe(true);
  });
});
