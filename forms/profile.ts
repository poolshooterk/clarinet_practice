import { z } from 'zod';

export const today = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

export const parseYmd = (s: string) => {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const profileSchema = z.object({
  name: z.string().min(1, '名前を入力してください'),
  email: z.email('メールアドレスの形式が正しくありません'),
  age: z
    .number({ message: '数値で入力してください' })
    .int('整数で入力してください')
    .min(0, '0 以上で入力してください')
    .optional(),
  birthday: z
    .string()
    .min(1, '生年月日を入力してください')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 形式で入力してください')
    .refine((s) => parseYmd(s) !== null, '有効な日付を入力してください')
    .refine(
      (s) => parseYmd(s)! >= new Date('1900-01-01'),
      '1900-01-01 以降の日付を入力してください',
    )
    .refine((s) => parseYmd(s)! <= today(), '未来の日付は選択できません'),
  score: z
    .number({ message: 'スコアを指定してください' })
    .min(0, '0 以上で指定してください')
    .max(100, '100 以下で指定してください'),
  agreed: z.boolean().refine((v) => v === true, {
    message: '利用規約への同意が必要です',
  }),
});

export type ProfileValues = z.infer<typeof profileSchema>;
