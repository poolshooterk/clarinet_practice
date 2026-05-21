import { z } from 'zod';

export const textbookEntrySchema = z.object({
  textbookId: z.string().uuid('教本を選択してください'),
  currentPage: z.number().int().min(0, '0以上の整数を入力してください'),
  durationMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
  tempoBpm: z
    .number()
    .int()
    .min(40, '40以上の整数を入力してください')
    .max(240, '240以下の整数を入力してください')
    .optional(),
});

export type TextbookEntryInput = z.infer<typeof textbookEntrySchema>;

export const lessonRecordSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付を入力してください'),
  time: z.string().regex(/^\d{2}:\d{2}$/, '時刻を入力してください'),
  advice: z.string().optional(),
  notes: z.string().optional(),
  textbookEntries: z.array(textbookEntrySchema),
});

export type LessonRecordInput = z.infer<typeof lessonRecordSchema>;

export function today(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function currentTime(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

export function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${min}`;
}

export function combineDateTime(date: string, time: string): string {
  return `${date}T${time}:00+09:00`;
}

export function splitHeldAt(heldAt: string): { date: string; time: string } {
  const d = new Date(heldAt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

export function formatHeldAt(heldAt: string): string {
  const { date, time } = splitHeldAt(heldAt);
  return `${date} ${time}`;
}
