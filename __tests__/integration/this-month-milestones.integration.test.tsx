import { ThisMonthMilestonesCard } from '@/components/this-month-milestones-card';
import { useAnnualGoalsStore } from '@/store/annual-goal';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

describe('ThisMonthMilestonesCard', () => {
  beforeEach(() => {
    useAnnualGoalsStore.setState({ goals: [], loading: false } as never);
  });

  it('当月のマイルストーン 0 件: 何も表示しない', () => {
    const { toJSON } = renderWithProviders(<ThisMonthMilestonesCard />);
    expect(toJSON()).toBeNull();
  });

  it('当月のマイルストーンがあるとき: タイトルと本文が表示される', () => {
    const now = new Date();
    useAnnualGoalsStore.setState({
      goals: [
        {
          id: 'g1',
          year: now.getFullYear(),
          title: '音色を磨く',
          numericTarget: null,
          numericUnit: null,
          yearEndReviewText: null,
          yearEndAchievement: null,
          yearEndReviewedAt: null,
          milestones: [
            {
              id: 'm1',
              month: now.getMonth() + 1,
              text: 'ロングトーン',
              numericTarget: null,
              numericUnit: null,
              reviewText: null,
              achievement: null,
              reviewedAt: null,
            },
          ],
        },
      ],
    } as never);
    const { getByText } = renderWithProviders(<ThisMonthMilestonesCard />);
    expect(getByText('音色を磨く')).toBeOnTheScreen();
    expect(getByText('ロングトーン')).toBeOnTheScreen();
  });
});
