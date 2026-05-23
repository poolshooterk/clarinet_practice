import { z } from 'zod';

export const purchasePlanSchema = z.object({
  makerId: z.string().min(1, 'メーカーを選択してください'),
  makerName: z.string().min(1),
  modelId: z.string().min(1, '機種名を選択してください'),
  modelName: z.string().min(1),
  targetPrice: z
    .number()
    .positive('正の値を入力してください')
    .nullable()
    .refine((v): v is number => v !== null, { message: '正の値を入力してください' }),
  monthlyTarget: z
    .number()
    .positive('正の値を入力してください')
    .nullable()
    .refine((v): v is number => v !== null, { message: '正の値を入力してください' }),
});

export const purchasePlanSavingsSchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, 'YYYY-MM 形式で入力してください'),
  amount: z
    .number()
    .int()
    .positive('正の値を入力してください')
    .nullable()
    .refine((v): v is number => v !== null, { message: '金額を入力してください' }),
  memo: z.string().nullable(),
});

export type PurchasePlan = z.infer<typeof purchasePlanSchema>;
export type PurchasePlanSavingsInput = z.infer<typeof purchasePlanSavingsSchema>;

export function calcPurchaseDate(
  targetPrice: number,
  currentSavings: number,
  monthlyTarget: number,
): { months: number; yearMonth: string } | null {
  if (monthlyTarget <= 0) return null;
  const remaining = targetPrice - currentSavings;
  if (remaining <= 0) return { months: 0, yearMonth: '今すぐ購入可能' };
  const months = Math.ceil(remaining / monthlyTarget);
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return { months, yearMonth: `${y}年${m}月ごろ` };
}
