import { z } from 'zod';

export const DIFFICULTY_OPTIONS = ['初心者', '初中級', '中級', '上級'] as const;
export type Difficulty = (typeof DIFFICULTY_OPTIONS)[number];

export const GENRE_OPTIONS = [
  'スケール',
  'エチュード',
  'ソナタ',
  'コンチェルト',
  'アンサンブル',
  'その他',
] as const;
export type Genre = (typeof GENRE_OPTIONS)[number];

export const textbookSchema = z.object({
  title: z.string().min(1, '教本名を入力してください'),
  publisher: z.string().optional(),
  genre: z.enum(GENRE_OPTIONS, { error: 'ジャンルを選択してください' }),
  difficulty: z.enum(DIFFICULTY_OPTIONS).optional(),
  totalPages: z.number().int().min(1, '1以上の整数を入力してください').optional(),
});

export type TextbookInput = z.infer<typeof textbookSchema>;
