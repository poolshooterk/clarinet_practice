import { signInSchema } from '@/forms/sign-in';

const valid = { email: 'test@example.com', password: 'pass1234' };

describe('signInSchema', () => {
  it('有効な値を通す', () => {
    expect(signInSchema.safeParse(valid).success).toBe(true);
  });

  describe('email', () => {
    it('空文字 → エラー', () => {
      const r = signInSchema.safeParse({ ...valid, email: '' });
      expect(r.success).toBe(false);
      if (!r.success)
        expect(r.error.issues[0].message).toBe('メールアドレスの形式が正しくありません');
    });

    it('無効な形式 → エラー', () => {
      const r = signInSchema.safeParse({ ...valid, email: 'not-an-email' });
      expect(r.success).toBe(false);
      if (!r.success)
        expect(r.error.issues[0].message).toBe('メールアドレスの形式が正しくありません');
    });

    it.each(['a@b.co', 'user+tag@example.co.jp'])('有効なメール %p を通す', (email) => {
      expect(signInSchema.safeParse({ ...valid, email }).success).toBe(true);
    });
  });

  describe('password', () => {
    it('空文字 → エラー', () => {
      const r = signInSchema.safeParse({ ...valid, password: '' });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toBe('パスワードを入力してください');
    });

    it('1文字以上なら通す', () => {
      expect(signInSchema.safeParse({ ...valid, password: 'x' }).success).toBe(true);
    });
  });
});
