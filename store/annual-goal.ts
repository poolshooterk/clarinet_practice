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

export const useAnnualGoalsStore = create<State>()((set) => ({
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

  addGoal: async () => ({ ok: false, reason: 'unknown' }),
  updateGoal: async () => ({ ok: false, reason: 'unknown' }),
  removeGoal: async () => {},
  upsertMilestone: async () => ({ ok: false, reason: 'unknown' }),
  removeMilestone: async () => {},
  reviewMilestone: async () => ({ ok: false, reason: 'unknown' }),
  yearEndReview: async () => ({ ok: false, reason: 'unknown' }),
}));
