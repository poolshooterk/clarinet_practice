import { z } from 'zod';

export const BASIC_MENUS = [
  { type: 'long_tone', label: 'ロングトーン' },
  { type: 'tonguing', label: 'タンギング' },
] as const;

export type BasicMenuType = (typeof BASIC_MENUS)[number]['type'];

export const BASIC_GENRES = ['スケール', 'エチュード'] as const;

const tonguingBpmEntrySchema = z.object({
  bpm: z
    .number()
    .int()
    .min(40, '40以上の整数を入力してください')
    .max(240, '240以下の整数を入力してください'),
});

const textbookEntrySchema = z.object({
  textbookId: z.string().uuid('教本を選択してください'),
  currentPage: z.number().int().min(0, '0以上の整数を入力してください'),
  durationMinutes: z.number().int().min(1, '1以上の整数を入力してください').nullable().optional(),
  tempoBpms: z.array(tonguingBpmEntrySchema).optional(),
});

export const practiceLogSchema = z.object({
  practicedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日付を入力してください')
    .refine((s) => s <= today(), '未来の日付は入力できません'),
  longToneMinutes: z.number().int().min(1, '1以上の整数を入力してください').nullable().optional(),
  tonguingMinutes: z.number().int().min(1, '1以上の整数を入力してください').nullable().optional(),
  tonguingTempoBpms: z.array(tonguingBpmEntrySchema).optional(),
  otherMinutes: z.number().int().min(1, '1以上の整数を入力してください').nullable().optional(),
  otherMemo: z.string().optional(),
  memo: z.string().optional(),
  textbookEntries: z.array(textbookEntrySchema),
  reedNumber: z
    .string()
    .regex(/^[a-zA-Z0-9]*$/, '英数字のみ入力できます')
    .optional(),
});

export type PracticeLogInput = z.infer<typeof practiceLogSchema>;

export function today(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
