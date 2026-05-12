import { z } from 'zod';

export const DIFFICULTY_OPTIONS = ['初心者', '初中級', '中級', '上級'] as const;
export type Difficulty = (typeof DIFFICULTY_OPTIONS)[number];

export const textbookSchema = z.object({
  title: z.string().min(1, '教本名を入力してください'),
  publisher: z.string().optional(),
  difficulty: z.enum(DIFFICULTY_OPTIONS).optional(),
});

export type TextbookInput = z.infer<typeof textbookSchema>;
