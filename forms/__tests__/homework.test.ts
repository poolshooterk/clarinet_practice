import { HOMEWORK_STATUS_LABELS, homeworkSchema } from '@/forms/homework';

describe('homeworkSchema', () => {
  it('内容のみで valid (status 必須)', () => {
    const r = homeworkSchema.safeParse({ content: 'ロングトーン強化', status: 'not_started' });
    expect(r.success).toBe(true);
  });

  it('内容が空だと invalid', () => {
    const r = homeworkSchema.safeParse({ content: '', status: 'not_started' });
    expect(r.success).toBe(false);
  });

  it('期限 YYYY-MM-DD / 空文字を許容', () => {
    expect(
      homeworkSchema.safeParse({ content: 'x', status: 'done', dueDate: '2026-08-15' }).success,
    ).toBe(true);
    expect(homeworkSchema.safeParse({ content: 'x', status: 'done', dueDate: '' }).success).toBe(
      true,
    );
  });

  it('不正な status は拒否', () => {
    const r = homeworkSchema.safeParse({ content: 'x', status: 'wip' });
    expect(r.success).toBe(false);
  });

  it('ラベルが日本語で定義される', () => {
    expect(HOMEWORK_STATUS_LABELS.in_progress).toBe('進行中');
  });
});
