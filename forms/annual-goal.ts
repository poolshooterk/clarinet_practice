import { z } from 'zod';

export const ACHIEVEMENT_VALUES = ['achieved', 'partial', 'unachieved'] as const;
export type Achievement = (typeof ACHIEVEMENT_VALUES)[number];

export const ACHIEVEMENT_LABELS: Record<Achievement, string> = {
  achieved: '達成',
  partial: '一部達成',
  unachieved: '未達成',
};

export const annualGoalSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  title: z.string().min(1, '入力してください'),
  numericTarget: z.number().int().positive('正の値を入力してください').nullable().optional(),
  numericUnit: z.string().max(20).nullable().optional(),
});

export const monthlyMilestoneSchema = z.object({
  month: z.number().int().min(1).max(12),
  text: z.string().min(1, '入力してください'),
  numericTarget: z.number().int().positive('正の値を入力してください').nullable().optional(),
  numericUnit: z.string().max(20).nullable().optional(),
  reviewText: z.string().nullable().optional(),
  achievement: z.enum(ACHIEVEMENT_VALUES).nullable().optional(),
});

export const annualGoalYearEndReviewSchema = z.object({
  yearEndReviewText: z.string().nullable().optional(),
  yearEndAchievement: z.enum(ACHIEVEMENT_VALUES).nullable().optional(),
});

export type AnnualGoalInput = z.infer<typeof annualGoalSchema>;
export type MonthlyMilestoneInput = z.infer<typeof monthlyMilestoneSchema>;
export type YearEndReviewInput = z.infer<typeof annualGoalYearEndReviewSchema>;
