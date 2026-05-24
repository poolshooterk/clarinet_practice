import { create } from 'zustand';

import type { PurchasePlan, PurchasePlanSavingsInput } from '@/forms/purchase-plan';
import { supabase } from '@/lib/supabase';

export type SavingsEntry = {
  id: string;
  yearMonth: string;
  amount: number;
  memo: string | null;
};

export type PurchasePlanRecord = {
  id: string;
  makerId: string;
  makerName: string;
  modelId: string;
  modelName: string;
  targetPrice: number;
  monthlyTarget: number;
};

type PurchasePlanRow = {
  id: string;
  maker_id: string;
  maker_name: string;
  model_id: string;
  model_name: string;
  target_price: number;
  monthly_savings_target: number;
  purchase_plan_savings: { id: string; year_month: string; amount: number; memo: string | null }[];
};

type PurchasePlanState = {
  plan: PurchasePlanRecord | null;
  savings: SavingsEntry[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  upsertPlan: (input: PurchasePlan) => Promise<void>;
  addSaving: (planId: string, input: PurchasePlanSavingsInput) => Promise<void>;
  updateSaving: (id: string, input: PurchasePlanSavingsInput) => Promise<void>;
  removeSaving: (id: string) => Promise<void>;
};

export const usePurchasePlanStore = create<PurchasePlanState>()((set, get) => ({
  plan: null,
  savings: [],
  loading: false,

  fetchAll: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    set({ loading: true });
    const { data, error } = await supabase
      .from('purchase_plans')
      .select(
        'id, maker_id, maker_name, model_id, model_name, target_price, monthly_savings_target, ' +
          'purchase_plan_savings ( id, year_month, amount, memo )',
      );
    set({ loading: false });

    if (error || !data || data.length === 0) {
      set({ plan: null, savings: [] });
      return;
    }

    const row = (data as unknown as PurchasePlanRow[])[0];
    set({
      plan: {
        id: row.id,
        makerId: row.maker_id,
        makerName: row.maker_name,
        modelId: row.model_id,
        modelName: row.model_name,
        targetPrice: row.target_price,
        monthlyTarget: row.monthly_savings_target,
      },
      savings: (row.purchase_plan_savings ?? []).map((s) => ({
        id: s.id,
        yearMonth: s.year_month,
        amount: s.amount,
        memo: s.memo,
      })),
    });
  },

  upsertPlan: async (input: PurchasePlan) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const { data, error } = await supabase
      .from('purchase_plans')
      .upsert(
        {
          user_id: userData.user.id,
          maker_id: input.makerId,
          maker_name: input.makerName,
          model_id: input.modelId,
          model_name: input.modelName,
          target_price: input.targetPrice,
          monthly_savings_target: input.monthlyTarget,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      )
      .select(
        'id, maker_id, maker_name, model_id, model_name, target_price, monthly_savings_target',
      )
      .single();

    if (error || !data) return;

    const row = data as unknown as Omit<PurchasePlanRow, 'purchase_plan_savings'>;
    set({
      plan: {
        id: row.id,
        makerId: row.maker_id,
        makerName: row.maker_name,
        modelId: row.model_id,
        modelName: row.model_name,
        targetPrice: row.target_price,
        monthlyTarget: row.monthly_savings_target,
      },
    });
  },

  addSaving: async (planId: string, input: PurchasePlanSavingsInput) => {
    const { data, error } = await supabase
      .from('purchase_plan_savings')
      .insert({
        purchase_plan_id: planId,
        year_month: input.yearMonth,
        amount: input.amount,
        memo: input.memo || null,
      })
      .select('id, year_month, amount, memo')
      .single();

    if (error || !data) return;

    const row = data as { id: string; year_month: string; amount: number; memo: string | null };
    set({
      savings: [
        { id: row.id, yearMonth: row.year_month, amount: row.amount, memo: row.memo },
        ...get().savings,
      ],
    });
  },

  updateSaving: async (id: string, input: PurchasePlanSavingsInput) => {
    const { error } = await supabase
      .from('purchase_plan_savings')
      .update({
        year_month: input.yearMonth,
        amount: input.amount,
        memo: input.memo || null,
      })
      .eq('id', id);

    if (error) return;

    set({
      savings: get().savings.map((s) =>
        s.id === id
          ? { ...s, yearMonth: input.yearMonth, amount: input.amount, memo: input.memo || null }
          : s,
      ),
    });
  },

  removeSaving: async (id: string) => {
    const { error } = await supabase.from('purchase_plan_savings').delete().eq('id', id);
    if (error) return;
    set({ savings: get().savings.filter((s) => s.id !== id) });
  },
}));
