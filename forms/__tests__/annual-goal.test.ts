import {
  annualGoalSchema,
  monthlyMilestoneSchema,
  annualGoalYearEndReviewSchema,
  canReviewMilestone,
  canReviewAnnualGoal,
  calcGoalProgress,
} from '@/forms/annual-goal';

describe('annualGoalSchema', () => {
  it('正常: title と year のみで通る', () => {
    const result = annualGoalSchema.safeParse({ year: 2026, title: '音色を磨く' });
    expect(result.success).toBe(true);
  });

  it('数値目標 + 単位 を含めて通る', () => {
    const result = annualGoalSchema.safeParse({
      year: 2026,
      title: '教本を進める',
      numericTarget: 50,
      numericUnit: 'ページ',
    });
    expect(result.success).toBe(true);
  });

  it('title が空だとエラー', () => {
    const result = annualGoalSchema.safeParse({ year: 2026, title: '' });
    expect(result.success).toBe(false);
  });

  it('year が範囲外 (1999) だとエラー', () => {
    const result = annualGoalSchema.safeParse({ year: 1999, title: 'X' });
    expect(result.success).toBe(false);
  });

  it('year が範囲外 (2101) だとエラー', () => {
    const result = annualGoalSchema.safeParse({ year: 2101, title: 'X' });
    expect(result.success).toBe(false);
  });

  it('numericTarget が 0 だとエラー', () => {
    const result = annualGoalSchema.safeParse({ year: 2026, title: 'X', numericTarget: 0 });
    expect(result.success).toBe(false);
  });
});

describe('monthlyMilestoneSchema', () => {
  it('正常: month と text のみで通る', () => {
    const result = monthlyMilestoneSchema.safeParse({ month: 5, text: 'ロングトーン強化' });
    expect(result.success).toBe(true);
  });

  it('振り返り欄を含めて通る', () => {
    const result = monthlyMilestoneSchema.safeParse({
      month: 5,
      text: 'X',
      reviewText: 'よかった',
      achievement: 'achieved',
    });
    expect(result.success).toBe(true);
  });

  it('month=0 はエラー', () => {
    const result = monthlyMilestoneSchema.safeParse({ month: 0, text: 'X' });
    expect(result.success).toBe(false);
  });

  it('month=13 はエラー', () => {
    const result = monthlyMilestoneSchema.safeParse({ month: 13, text: 'X' });
    expect(result.success).toBe(false);
  });

  it('text が空だとエラー', () => {
    const result = monthlyMilestoneSchema.safeParse({ month: 5, text: '' });
    expect(result.success).toBe(false);
  });

  it('不正な achievement はエラー', () => {
    const result = monthlyMilestoneSchema.safeParse({
      month: 5,
      text: 'X',
      achievement: 'good',
    });
    expect(result.success).toBe(false);
  });
});

describe('annualGoalYearEndReviewSchema', () => {
  it('全フィールド任意のため空オブジェクトで通る', () => {
    const result = annualGoalYearEndReviewSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('正常: テキスト + 達成判定で通る', () => {
    const result = annualGoalYearEndReviewSchema.safeParse({
      yearEndReviewText: '今年は成長した',
      yearEndAchievement: 'partial',
    });
    expect(result.success).toBe(true);
  });

  it('不正な yearEndAchievement はエラー', () => {
    const result = annualGoalYearEndReviewSchema.safeParse({ yearEndAchievement: 'maybe' });
    expect(result.success).toBe(false);
  });
});

describe('canReviewMilestone', () => {
  it('過去の月: 常に true', () => {
    // milestone = 2026-03、today = 2026-05-01
    expect(canReviewMilestone(2026, 3, new Date(2026, 4, 1))).toBe(true);
  });

  it('未来の月: false', () => {
    // milestone = 2026-12、today = 2026-05-30
    expect(canReviewMilestone(2026, 12, new Date(2026, 4, 30))).toBe(false);
  });

  it('当月最終週 7 日目 (5月25日) ちょうど: true', () => {
    expect(canReviewMilestone(2026, 5, new Date(2026, 4, 25))).toBe(true);
  });

  it('当月最終週 7 日目の前日 (5月24日): false', () => {
    expect(canReviewMilestone(2026, 5, new Date(2026, 4, 24))).toBe(false);
  });

  it('当月の月末日 (5月31日): true', () => {
    expect(canReviewMilestone(2026, 5, new Date(2026, 4, 31))).toBe(true);
  });

  it('2月 (28日): 2月22日 ちょうどで true', () => {
    expect(canReviewMilestone(2026, 2, new Date(2026, 1, 22))).toBe(true);
  });

  it('2月: 2月21日 で false', () => {
    expect(canReviewMilestone(2026, 2, new Date(2026, 1, 21))).toBe(false);
  });

  it('うるう年 (2024年2月、29日): 2月23日 ちょうどで true', () => {
    expect(canReviewMilestone(2024, 2, new Date(2024, 1, 23))).toBe(true);
  });

  it('過去年: 常に true', () => {
    expect(canReviewMilestone(2025, 1, new Date(2026, 4, 30))).toBe(true);
  });
});

describe('canReviewAnnualGoal', () => {
  it('過去年: true', () => {
    expect(canReviewAnnualGoal(2025, new Date(2026, 4, 30))).toBe(true);
  });

  it('当年で 12月最終週開始 (12月25日): true', () => {
    expect(canReviewAnnualGoal(2026, new Date(2026, 11, 25))).toBe(true);
  });

  it('当年で 12月24日: false', () => {
    expect(canReviewAnnualGoal(2026, new Date(2026, 11, 24))).toBe(false);
  });

  it('未来年: false', () => {
    expect(canReviewAnnualGoal(2027, new Date(2026, 4, 30))).toBe(false);
  });
});

describe('calcGoalProgress', () => {
  it('milestones が空: unset=12 で他は 0', () => {
    expect(calcGoalProgress([])).toEqual({
      achieved: 0,
      partial: 0,
      unachieved: 0,
      unreviewed: 0,
      unset: 12,
    });
  });

  it('混合: 各 achievement を正しくカウント、未振り返りも区別', () => {
    const milestones = [
      { month: 1, text: 'A', achievement: 'achieved' as const },
      { month: 2, text: 'B', achievement: 'partial' as const },
      { month: 3, text: 'C', achievement: 'unachieved' as const },
      { month: 4, text: 'D', achievement: null },
      { month: 5, text: 'E', achievement: null },
    ];
    expect(calcGoalProgress(milestones)).toEqual({
      achieved: 1,
      partial: 1,
      unachieved: 1,
      unreviewed: 2,
      unset: 7, // 12 - 5
    });
  });

  it('12 件全て埋まる: unset=0', () => {
    const milestones = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      text: 'X',
      achievement: 'achieved' as const,
    }));
    expect(calcGoalProgress(milestones)).toEqual({
      achieved: 12,
      partial: 0,
      unachieved: 0,
      unreviewed: 0,
      unset: 0,
    });
  });
});
