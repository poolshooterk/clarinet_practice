import { ThisMonthMilestonesCard } from '@/components/this-month-milestones-card';
import { useAnnualGoalsStore } from '@/store/annual-goal';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

function makeMilestone(month: number, text: string) {
  return {
    id: `m${month}`,
    month,
    text,
    numericTarget: null,
    numericUnit: null,
    reviewText: null,
    achievement: null,
    reviewedAt: null,
  };
}

describe('ThisMonthMilestonesCard', () => {
  beforeEach(() => {
    useAnnualGoalsStore.setState({ goals: [], loading: false } as never);
  });

  it('選択月のマイルストーン 0 件: 何も表示しない', () => {
    const { toJSON } = renderWithProviders(<ThisMonthMilestonesCard month="2026-06" />);
    expect(toJSON()).toBeNull();
  });

  it('選択月のマイルストーンだけを表示し、他の月のものは表示しない', () => {
    useAnnualGoalsStore.setState({
      goals: [
        {
          id: 'g1',
          year: 2026,
          title: '音色を磨く',
          numericTarget: null,
          numericUnit: null,
          yearEndReviewText: null,
          yearEndAchievement: null,
          yearEndReviewedAt: null,
          milestones: [makeMilestone(5, '5月ロングトーン'), makeMilestone(6, '6月タンギング')],
        },
      ],
    } as never);
    const { getByText, queryByText } = renderWithProviders(
      <ThisMonthMilestonesCard month="2026-05" />,
    );
    expect(getByText('5月のマイルストーン')).toBeOnTheScreen();
    expect(getByText('5月ロングトーン')).toBeOnTheScreen();
    expect(queryByText('6月タンギング')).toBeNull();
  });
});
