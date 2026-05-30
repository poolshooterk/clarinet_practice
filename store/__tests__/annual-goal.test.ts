import { supabase } from '@/lib/supabase';
import { useAnnualGoalsStore } from '@/store/annual-goal';

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
    const result = await useAnnualGoalsStore.getState().addGoal({ year: 2026, title: 'X' });
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
    const result = await useAnnualGoalsStore.getState().addGoal({ year: 2026, title: 'X' });
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
      goals: [{ id: 'g1', milestones: [] } as never, { id: 'g2', milestones: [] } as never],
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

describe('upsertMilestone', () => {
  const baseGoal = {
    id: 'g1',
    year: 2026,
    title: 'X',
    numericTarget: null,
    numericUnit: null,
    yearEndReviewText: null,
    yearEndAchievement: null,
    yearEndReviewedAt: null,
    milestones: [],
  };

  it('新規月: 該当 goal の milestones に追加', async () => {
    useAnnualGoalsStore.setState({ goals: [baseGoal] });
    mockedSupabase.from.mockReturnValue({
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'm1',
              month: 5,
              text: 'A',
              numeric_target: null,
              numeric_unit: null,
              review_text: null,
              achievement: null,
              reviewed_at: null,
            },
            error: null,
          }),
        }),
      }),
    });
    await useAnnualGoalsStore.getState().upsertMilestone('g1', { month: 5, text: 'A' });
    expect(useAnnualGoalsStore.getState().goals[0].milestones).toHaveLength(1);
    expect(useAnnualGoalsStore.getState().goals[0].milestones[0].month).toBe(5);
  });

  it('既存月: 該当 milestone を置き換え', async () => {
    useAnnualGoalsStore.setState({
      goals: [
        {
          ...baseGoal,
          milestones: [
            {
              id: 'm1',
              month: 5,
              text: 'old',
              numericTarget: null,
              numericUnit: null,
              reviewText: null,
              achievement: null,
              reviewedAt: null,
            },
          ],
        },
      ],
    });
    mockedSupabase.from.mockReturnValue({
      upsert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              id: 'm1',
              month: 5,
              text: 'new',
              numeric_target: 10,
              numeric_unit: 'ページ',
              review_text: null,
              achievement: null,
              reviewed_at: null,
            },
            error: null,
          }),
        }),
      }),
    });
    await useAnnualGoalsStore
      .getState()
      .upsertMilestone('g1', { month: 5, text: 'new', numericTarget: 10, numericUnit: 'ページ' });
    const milestones = useAnnualGoalsStore.getState().goals[0].milestones;
    expect(milestones).toHaveLength(1);
    expect(milestones[0].text).toBe('new');
    expect(milestones[0].numericTarget).toBe(10);
  });
});

describe('removeMilestone', () => {
  it('成功時に milestones から除外', async () => {
    useAnnualGoalsStore.setState({
      goals: [
        {
          id: 'g1',
          year: 2026,
          title: 'X',
          numericTarget: null,
          numericUnit: null,
          yearEndReviewText: null,
          yearEndAchievement: null,
          yearEndReviewedAt: null,
          milestones: [
            {
              id: 'm1',
              month: 5,
              text: 'A',
              numericTarget: null,
              numericUnit: null,
              reviewText: null,
              achievement: null,
              reviewedAt: null,
            },
          ],
        },
      ],
    });
    mockedSupabase.from.mockReturnValue({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    await useAnnualGoalsStore.getState().removeMilestone('m1');
    expect(useAnnualGoalsStore.getState().goals[0].milestones).toEqual([]);
  });
});

describe('reviewMilestone', () => {
  it('既存 milestone を review 内容で更新', async () => {
    useAnnualGoalsStore.setState({
      goals: [
        {
          id: 'g1',
          year: 2026,
          title: 'X',
          numericTarget: null,
          numericUnit: null,
          yearEndReviewText: null,
          yearEndAchievement: null,
          yearEndReviewedAt: null,
          milestones: [
            {
              id: 'm1',
              month: 5,
              text: 'A',
              numericTarget: null,
              numericUnit: null,
              reviewText: null,
              achievement: null,
              reviewedAt: null,
            },
          ],
        },
      ],
    });
    mockedSupabase.from.mockReturnValue({
      update: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'm1',
                month: 5,
                text: 'A',
                numeric_target: null,
                numeric_unit: null,
                review_text: 'いいかんじ',
                achievement: 'partial',
                reviewed_at: '2026-05-25T00:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      }),
    });
    await useAnnualGoalsStore
      .getState()
      .reviewMilestone('m1', { reviewText: 'いいかんじ', achievement: 'partial' });
    const m = useAnnualGoalsStore.getState().goals[0].milestones[0];
    expect(m.achievement).toBe('partial');
    expect(m.reviewText).toBe('いいかんじ');
    expect(m.reviewedAt).toBe('2026-05-25T00:00:00Z');
  });
});

describe('yearEndReview', () => {
  it('annual goal の年末振り返り欄を更新', async () => {
    useAnnualGoalsStore.setState({
      goals: [
        {
          id: 'g1',
          year: 2026,
          title: 'X',
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
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                year_end_review_text: 'よい一年だった',
                year_end_achievement: 'achieved',
                year_end_reviewed_at: '2026-12-31T00:00:00Z',
              },
              error: null,
            }),
          }),
        }),
      }),
    });
    await useAnnualGoalsStore.getState().yearEndReview('g1', {
      yearEndReviewText: 'よい一年だった',
      yearEndAchievement: 'achieved',
    });
    const g = useAnnualGoalsStore.getState().goals[0];
    expect(g.yearEndAchievement).toBe('achieved');
    expect(g.yearEndReviewText).toBe('よい一年だった');
  });
});
