import { z } from 'zod';

export const HOMEWORK_STATUS_VALUES = ['not_started', 'in_progress', 'done'] as const;
export type HomeworkStatus = (typeof HOMEWORK_STATUS_VALUES)[number];

export const HOMEWORK_STATUS_LABELS: Record<HomeworkStatus, string> = {
  not_started: '未着手',
  in_progress: '進行中',
  done: '完了',
};

export const homeworkSchema = z.object({
  content: z.string().min(1, '入力してください'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, '日付を入力してください')
    .or(z.literal(''))
    .nullable()
    .optional(),
  textbookId: z.string().nullable().optional(),
  reviewNote: z.string().nullable().optional(),
  status: z.enum(HOMEWORK_STATUS_VALUES),
});

export type HomeworkInput = z.infer<typeof homeworkSchema>;
