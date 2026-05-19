import { z } from 'zod';

export const resetPasswordOtpSchema = z.object({
  email: z.email('メールアドレスの形式が正しくありません'),
  token: z
    .string()
    .length(6, '6桁のコードを入力してください')
    .regex(/^\d{6}$/, '数字6桁で入力してください'),
});

export type ResetPasswordOtpValues = z.infer<typeof resetPasswordOtpSchema>;
