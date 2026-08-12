import { z } from 'zod';

export const BASIC_MENUS = [
  { type: 'long_tone', label: 'ロングトーン' },
  { type: 'tonguing', label: 'タンギング' },
] as const;

export type BasicMenuType = (typeof BASIC_MENUS)[number]['type'];

export const BASIC_GENRES = ['スケール', 'エチュード'] as const;

/** 練習開始時に自動で計測を始めるメニューの選択肢 (設定画面で選ぶ) */
export const AUTO_START_MENUS = [
  { value: 'none', label: '自動開始しない' },
  { value: 'long_tone', label: 'ロングトーン' },
  { value: 'tonguing', label: 'タンギング' },
  { value: 'textbook', label: '教本 (1つ目)' },
  { value: 'other', label: 'その他' },
] as const;

export type AutoStartMenu = (typeof AUTO_START_MENUS)[number]['value'];

/**
 * 自動開始メニューを練習記録フォームのタイマーキーへ解決する。
 * 教本は `useFieldArray` の 1 行目の field id からキーを組み立てるため、
 * 教本行が無い (= id が渡らない) 場合は自動開始しない。
 */
export function resolveAutoStartTimerKey(
  menu: AutoStartMenu,
  firstTextbookFieldId?: string,
): string | null {
  switch (menu) {
    case 'long_tone':
    case 'tonguing':
    case 'other':
      return menu;
    case 'textbook':
      return firstTextbookFieldId ? `textbook-${firstTextbookFieldId}` : null;
    default:
      return null;
  }
}

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
  startTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, '時刻は HH:MM 形式で入力してください')
    .or(z.literal(''))
    .nullable()
    .optional(),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, '時刻は HH:MM 形式で入力してください')
    .or(z.literal(''))
    .nullable()
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

export function formatClock(epochMs: number): string {
  const d = new Date(epochMs);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}
