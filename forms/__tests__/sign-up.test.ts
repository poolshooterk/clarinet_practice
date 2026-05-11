import { signUpSchema } from '@/forms/sign-up';

const valid = {
  email: 'test@example.com',
  password: 'password1',
  confirmPassword: 'password1',
};

describe('signUpSchema', () => {
  it('有効な値を通す', () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  describe('email', () => {
    it('無効な形式 → エラー', () => {
      const r = signUpSchema.safeParse({ ...valid, email: 'bad' });
      expect(r.success).toBe(false);
      if (!r.success)
        expect(r.error.issues[0].message).toBe('メールアドレスの形式が正しくありません');
    });
  });

  describe('password', () => {
    it('7文字 → エラー', () => {
      const r = signUpSchema.safeParse({
        ...valid,
        password: 'short12',
        confirmPassword: 'short12',
      });
      expect(r.success).toBe(false);
      if (!r.success)
        expect(r.error.issues[0].message).toBe('パスワードは8文字以上で入力してください');
    });

    it('8文字（境界値）→ 通す', () => {
      const p = 'exactly8';
      expect(signUpSchema.safeParse({ ...valid, password: p, confirmPassword: p }).success).toBe(
        true,
      );
    });
  });

  describe('confirmPassword', () => {
    it('パスワード不一致 → エラー', () => {
      const r = signUpSchema.safeParse({ ...valid, confirmPassword: 'different' });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toBe('パスワードが一致しません');
    });

    it('空文字 → エラー', () => {
      const r = signUpSchema.safeParse({ ...valid, confirmPassword: '' });
      expect(r.success).toBe(false);
    });
  });
});
