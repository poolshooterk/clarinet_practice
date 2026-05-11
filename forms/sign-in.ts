import { z } from 'zod';

export const signInSchema = z.object({
  email: z.email('メールアドレスの形式が正しくありません'),
  password: z.string().min(1, 'パスワードを入力してください'),
});

export type SignInValues = z.infer<typeof signInSchema>;
