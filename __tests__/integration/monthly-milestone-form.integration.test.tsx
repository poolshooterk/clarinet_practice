import { fireEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import MonthlyMilestoneForm from '@/app/monthly-milestone-form';
import { useAnnualGoalsStore } from '@/store/annual-goal';
import { renderWithProviders } from '@/test-utils/render';

const baseGoal = {
  id: 'g1',
  year: new Date().getFullYear(),
  title: 'X',
  numericTarget: null,
  numericUnit: null,
  yearEndReviewText: null,
  yearEndAchievement: null,
  yearEndReviewedAt: null,
  milestones: [],
};

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  Stack: { Screen: ({ children }: { children?: ReactNode }) => children ?? null },
  useLocalSearchParams: () => mockParams,
}));

const upsertSpy = jest.fn().mockResolvedValue({ ok: true, milestoneId: 'm1' });
const reviewSpy = jest.fn().mockResolvedValue({ ok: true });

beforeEach(() => {
  jest.clearAllMocks();
  upsertSpy.mockResolvedValue({ ok: true, milestoneId: 'm1' });
  reviewSpy.mockResolvedValue({ ok: true });
  useAnnualGoalsStore.setState({
    goals: [baseGoal],
    loading: false,
    upsertMilestone: upsertSpy,
    removeMilestone: jest.fn(),
    reviewMilestone: reviewSpy,
  } as never);
  mockParams = { goalId: 'g1', month: '5' };
});

describe('MonthlyMilestoneForm', () => {
  it('正常入力で upsertMilestone が呼ばれる', async () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(<MonthlyMilestoneForm />);
    fireEvent.changeText(getByPlaceholderText('例: ロングトーン強化'), 'X');
    fireEvent.press(getByText('保存'));
    await waitFor(() => {
      expect(upsertSpy).toHaveBeenCalledWith(
        'g1',
        expect.objectContaining({ month: 5, text: 'X' }),
      );
    });
  });
});
