import { create } from 'zustand';

import type {
  Achievement,
  AnnualGoalInput,
  MonthlyMilestoneInput,
  YearEndReviewInput,
} from '@/forms/annual-goal';
import { supabase } from '@/lib/supabase';

export type Milestone = {
  id: string;
  month: number;
  text: string;
  numericTarget: number | null;
  numericUnit: string | null;
  reviewText: string | null;
  achievement: Achievement | null;
  reviewedAt: string | null;
};

export type AnnualGoal = {
  id: string;
  year: number;
  title: string;
  numericTarget: number | null;
  numericUnit: string | null;
  yearEndReviewText: string | null;
  yearEndAchievement: Achievement | null;
  yearEndReviewedAt: string | null;
  milestones: Milestone[];
};

export type ReviewInput = {
  reviewText: string | null;
  achievement: Achievement;
};

export type MutationResult =
  | { ok: true; goalId?: string; milestoneId?: string }
  | { ok: false; reason: 'unknown' };

type GoalRow = {
  id: string;
  year: number;
  title: string;
  numeric_target: number | null;
  numeric_unit: string | null;
  year_end_review_text: string | null;
  year_end_achievement: Achievement | null;
  year_end_reviewed_at: string | null;
  monthly_milestones: MilestoneRow[];
};

type MilestoneRow = {
  id: string;
  month: number;
  text: string;
  numeric_target: number | null;
  numeric_unit: string | null;
  review_text: string | null;
  achievement: Achievement | null;
  reviewed_at: string | null;
};

const GOAL_SELECT =
  'id, year, title, numeric_target, numeric_unit, ' +
  'year_end_review_text, year_end_achievement, year_end_reviewed_at, ' +
  'monthly_milestones ( id, month, text, numeric_target, numeric_unit, ' +
  'review_text, achievement, reviewed_at )';

function mapMilestone(row: MilestoneRow): Milestone {
  return {
    id: row.id,
    month: row.month,
    text: row.text,
    numericTarget: row.numeric_target,
    numericUnit: row.numeric_unit,
    reviewText: row.review_text,
    achievement: row.achievement,
    reviewedAt: row.reviewed_at,
  };
}

function mapGoal(row: GoalRow): AnnualGoal {
  return {
    id: row.id,
    year: row.year,
    title: row.title,
    numericTarget: row.numeric_target,
    numericUnit: row.numeric_unit,
    yearEndReviewText: row.year_end_review_text,
    yearEndAchievement: row.year_end_achievement,
    yearEndReviewedAt: row.year_end_reviewed_at,
    milestones: (row.monthly_milestones ?? []).map(mapMilestone),
  };
}

type State = {
  goals: AnnualGoal[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  addGoal: (input: AnnualGoalInput) => Promise<MutationResult>;
  updateGoal: (id: string, input: AnnualGoalInput) => Promise<MutationResult>;
  removeGoal: (id: string) => Promise<void>;
  upsertMilestone: (goalId: string, input: MonthlyMilestoneInput) => Promise<MutationResult>;
  removeMilestone: (id: string) => Promise<void>;
  reviewMilestone: (id: string, review: ReviewInput) => Promise<MutationResult>;
  yearEndReview: (goalId: string, review: YearEndReviewInput) => Promise<MutationResult>;
};

export const useAnnualGoalsStore = create<State>()((set, get) => ({
  goals: [],
  loading: false,

  fetchAll: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    set({ loading: true });
    const { data, error } = await supabase.from('annual_goals').select(GOAL_SELECT);
    set({ loading: false });

    if (error || !data) {
      set({ goals: [] });
      return;
    }
    const goals = (data as unknown as GoalRow[]).map(mapGoal);
    set({ goals });
  },

  addGoal: async (input) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return { ok: false, reason: 'unknown' };
    const { data, error } = await supabase
      .from('annual_goals')
      .insert({
        user_id: userData.user.id,
        year: input.year,
        title: input.title,
        numeric_target: input.numericTarget ?? null,
        numeric_unit: input.numericUnit ?? null,
      })
      .select(
        'id, year, title, numeric_target, numeric_unit, ' +
          'year_end_review_text, year_end_achievement, year_end_reviewed_at',
      )
      .single();
    if (error || !data) return { ok: false, reason: 'unknown' };
    const row = data as unknown as Omit<GoalRow, 'monthly_milestones'>;
    const goal = mapGoal({ ...row, monthly_milestones: [] });
    set({ goals: [goal, ...get().goals] });
    return { ok: true, goalId: goal.id };
  },

  updateGoal: async (id, input) => {
    const { error } = await supabase
      .from('annual_goals')
      .update({
        year: input.year,
        title: input.title,
        numeric_target: input.numericTarget ?? null,
        numeric_unit: input.numericUnit ?? null,
      })
      .eq('id', id);
    if (error) return { ok: false, reason: 'unknown' };
    set({
      goals: get().goals.map((g) =>
        g.id === id
          ? {
              ...g,
              year: input.year,
              title: input.title,
              numericTarget: input.numericTarget ?? null,
              numericUnit: input.numericUnit ?? null,
            }
          : g,
      ),
    });
    return { ok: true, goalId: id };
  },

  removeGoal: async (id) => {
    const { error } = await supabase.from('annual_goals').delete().eq('id', id);
    if (error) return;
    set({ goals: get().goals.filter((g) => g.id !== id) });
  },

  upsertMilestone: async (goalId, input) => {
    const { data, error } = await supabase
      .from('monthly_milestones')
      .upsert(
        {
          annual_goal_id: goalId,
          month: input.month,
          text: input.text,
          numeric_target: input.numericTarget ?? null,
          numeric_unit: input.numericUnit ?? null,
        },
        { onConflict: 'annual_goal_id,month' },
      )
      .select(
        'id, month, text, numeric_target, numeric_unit, review_text, achievement, reviewed_at',
      )
      .single();
    if (error || !data) return { ok: false, reason: 'unknown' };
    const milestone = mapMilestone(data as unknown as MilestoneRow);
    set({
      goals: get().goals.map((g) => {
        if (g.id !== goalId) return g;
        const existing = g.milestones.findIndex((m) => m.month === milestone.month);
        const nextMilestones =
          existing >= 0
            ? g.milestones.map((m, i) => (i === existing ? milestone : m))
            : [...g.milestones, milestone];
        return { ...g, milestones: nextMilestones };
      }),
    });
    return { ok: true, milestoneId: milestone.id };
  },

  removeMilestone: async (id) => {
    const { error } = await supabase.from('monthly_milestones').delete().eq('id', id);
    if (error) return;
    set({
      goals: get().goals.map((g) => ({
        ...g,
        milestones: g.milestones.filter((m) => m.id !== id),
      })),
    });
  },

  reviewMilestone: async () => ({ ok: false, reason: 'unknown' }),
  yearEndReview: async () => ({ ok: false, reason: 'unknown' }),
}));
