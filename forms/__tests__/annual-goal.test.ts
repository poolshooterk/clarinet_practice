import {
  annualGoalSchema,
  monthlyMilestoneSchema,
  annualGoalYearEndReviewSchema,
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
