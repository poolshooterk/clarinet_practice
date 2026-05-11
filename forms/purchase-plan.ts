import { z } from 'zod';

export const purchasePlanSchema = z.object({
  makerId: z.string().min(1, 'メーカーを選択してください'),
  makerName: z.string().min(1),
  modelId: z.string().min(1, '機種名を選択してください'),
  modelName: z.string().min(1),
  targetPrice: z.number().positive('正の値を入力してください'),
  currentSavings: z.number().min(0, '0以上の値を入力してください'),
  monthlySavings: z.number().positive('正の値を入力してください'),
});

export type PurchasePlan = z.infer<typeof purchasePlanSchema>;

export function calcPurchaseDate(
  targetPrice: number,
  currentSavings: number,
  monthlySavings: number,
): { months: number; yearMonth: string } | null {
  if (monthlySavings <= 0) return null;
  const remaining = targetPrice - currentSavings;
  if (remaining <= 0) return { months: 0, yearMonth: '今すぐ購入可能' };
  const months = Math.ceil(remaining / monthlySavings);
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return { months, yearMonth: `${y}年${m}月ごろ` };
}
