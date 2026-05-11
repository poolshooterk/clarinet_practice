import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z.email('メールアドレスの形式が正しくありません'),
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
