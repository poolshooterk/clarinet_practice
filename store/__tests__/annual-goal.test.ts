import { useAnnualGoalsStore } from '@/store/annual-goal';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

const mockedSupabase = supabase as unknown as {
  auth: { getUser: jest.Mock };
  from: jest.Mock;
};

beforeEach(() => {
  useAnnualGoalsStore.setState({ goals: [], loading: false });
  jest.clearAllMocks();
  mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
});

describe('fetchAll', () => {
  it('annual_goals と nested milestones を取得して state に格納する', async () => {
    const row = {
      id: 'g1',
      year: 2026,
      title: '音色を磨く',
      numeric_target: null,
      numeric_unit: null,
      year_end_review_text: null,
      year_end_achievement: null,
      year_end_reviewed_at: null,
      monthly_milestones: [
        {
          id: 'm1',
          month: 5,
          text: 'ロングトーン',
          numeric_target: null,
          numeric_unit: null,
          review_text: null,
          achievement: null,
          reviewed_at: null,
        },
      ],
    };
    mockedSupabase.from.mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: [row], error: null }),
    });

    await useAnnualGoalsStore.getState().fetchAll();
    const goals = useAnnualGoalsStore.getState().goals;
    expect(goals).toHaveLength(1);
    expect(goals[0]).toMatchObject({
      id: 'g1',
      year: 2026,
      title: '音色を磨く',
      milestones: [{ id: 'm1', month: 5, text: 'ロングトーン' }],
    });
  });

  it('未ログイン時は何もしない', async () => {
    mockedSupabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    await useAnnualGoalsStore.getState().fetchAll();
    expect(mockedSupabase.from).not.toHaveBeenCalled();
  });

  it('error 時は goals を空にリセット', async () => {
    mockedSupabase.from.mockReturnValue({
      select: jest.fn().mockResolvedValue({ data: null, error: { message: 'oops' } }),
    });
    useAnnualGoalsStore.setState({ goals: [{ id: 'old' } as never] });
    await useAnnualGoalsStore.getState().fetchAll();
    expect(useAnnualGoalsStore.getState().goals).toEqual([]);
  });
});

describe('addGoal', () => {
  it('insert 成功時に goals に追加される', async () => {
    mockedSupabase.from.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'g1',
              year: 2026,
              title: 'X',
              numeric_target: null,
              numeric_unit: null,
              year_end_review_text: null,
              year_end_achievement: null,
              year_end_reviewed_at: null,
            },
            error: null,
          }),
        }),
      }),
    });
    const result = await useAnnualGoalsStore
      .getState()
      .addGoal({ year: 2026, title: 'X' });
    expect(result).toEqual({ ok: true, goalId: 'g1' });
    expect(useAnnualGoalsStore.getState().goals[0]).toMatchObject({ id: 'g1', title: 'X' });
  });

  it('error 時は { ok: false } を返す', async () => {
    mockedSupabase.from.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: { code: 'X' } }),
        }),
      }),
    });
    const result = await useAnnualGoalsStore
      .getState()
      .addGoal({ year: 2026, title: 'X' });
    expect(result).toEqual({ ok: false, reason: 'unknown' });
  });
});

describe('updateGoal', () => {
  it('成功時に state を更新する', async () => {
    useAnnualGoalsStore.setState({
      goals: [
        {
          id: 'g1',
          year: 2026,
          title: 'old',
          numericTarget: null,
          numericUnit: null,
          yearEndReviewText: null,
          yearEndAchievement: null,
          yearEndReviewedAt: null,
          milestones: [],
        },
      ],
    });
    mockedSupabase.from.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useAnnualGoalsStore
      .getState()
      .updateGoal('g1', { year: 2026, title: 'new', numericTarget: 50, numericUnit: 'ページ' });
    expect(useAnnualGoalsStore.getState().goals[0].title).toBe('new');
    expect(useAnnualGoalsStore.getState().goals[0].numericTarget).toBe(50);
  });
});

describe('removeGoal', () => {
  it('成功時に goals から除外', async () => {
    useAnnualGoalsStore.setState({
      goals: [
        { id: 'g1', milestones: [] } as never,
        { id: 'g2', milestones: [] } as never,
      ],
    });
    mockedSupabase.from.mockReturnValue({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useAnnualGoalsStore.getState().removeGoal('g1');
    expect(useAnnualGoalsStore.getState().goals.map((g) => g.id)).toEqual(['g2']);
  });
});
