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

export const calcUsagePeriod = (startDate: string, now = new Date()): string | null => {
  const start = parseYmd(startDate);
  if (!start) return null;

  let years = now.getFullYear() - start.getFullYear();
  let months = now.getMonth() - start.getMonth();

  // 当月の日付がまだ開始日に達していなければ満月数を1引く
  if (now.getDate() < start.getDate()) {
    months--;
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  if (years < 0) return null;
  if (years === 0 && months === 0) return '1ヶ月未満';
  if (years === 0) return `${months}ヶ月`;
  if (months === 0) return `${years}年`;
  return `${years}年${months}ヶ月`;
};

export const startDateSchema = z
  .string()
  .min(1, '使用開始日を入力してください')
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 形式で入力してください')
  .refine((s) => parseYmd(s) !== null, '有効な日付を入力してください')
  .refine((s) => parseYmd(s)! <= today(), '未来の日付は選択できません');

export const instrumentItemSchema = z.object({
  makerId: z.string().min(1, 'メーカーを選択してください'),
  makerName: z.string().min(1),
  modelId: z.string().min(1, '機種名を選択してください'),
  modelName: z.string().min(1),
  purchasePrice: z.number().optional(),
  startDate: startDateSchema,
});

export const equipmentItemSchema = z.object({
  name: z.string().min(1, '名前を入力してください'),
  startDate: startDateSchema,
});

export const clarinetEquipmentSchema = z.object({
  instrument: instrumentItemSchema,
  reed: equipmentItemSchema,
  ligature: equipmentItemSchema,
  mouthpiece: equipmentItemSchema,
});

export type InstrumentItem = z.infer<typeof instrumentItemSchema>;
export type EquipmentItem = z.infer<typeof equipmentItemSchema>;
export type ClarinetEquipment = z.infer<typeof clarinetEquipmentSchema>;
