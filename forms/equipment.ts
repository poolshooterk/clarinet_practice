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

const equipmentItemSchema = z.object({
  name: z.string().min(1, '名前を入力してください'),
  startDate: z
    .string()
    .min(1, '使用開始日を入力してください')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 形式で入力してください')
    .refine((s) => parseYmd(s) !== null, '有効な日付を入力してください')
    .refine((s) => parseYmd(s)! <= today(), '未来の日付は選択できません'),
});

export const clarinetEquipmentSchema = z.object({
  instrument: equipmentItemSchema,
  reed: equipmentItemSchema,
  ligature: equipmentItemSchema,
  mouthpiece: equipmentItemSchema,
});

export type EquipmentItem = z.infer<typeof equipmentItemSchema>;
export type ClarinetEquipment = z.infer<typeof clarinetEquipmentSchema>;
