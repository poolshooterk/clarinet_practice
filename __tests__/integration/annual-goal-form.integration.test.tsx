import { fireEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import AnnualGoalForm from '@/app/annual-goal-form';
import { useAnnualGoalsStore } from '@/store/annual-goal';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  Stack: { Screen: ({ children }: { children?: ReactNode }) => children ?? null },
  useLocalSearchParams: () => ({}),
}));

const addGoalSpy = jest.fn().mockResolvedValue({ ok: true, goalId: 'g1' });

beforeEach(() => {
  jest.clearAllMocks();
  addGoalSpy.mockResolvedValue({ ok: true, goalId: 'g1' });
  useAnnualGoalsStore.setState({
    goals: [],
    loading: false,
    addGoal: addGoalSpy,
    updateGoal: jest.fn(),
    removeGoal: jest.fn(),
  } as never);
});

describe('AnnualGoalForm (新規)', () => {
  it('タイトル空送信でエラーが表示される', async () => {
    const { getByText } = renderWithProviders(<AnnualGoalForm />);
    fireEvent.press(getByText('保存'));
    await waitFor(() => {
      expect(getByText('入力してください')).toBeOnTheScreen();
    });
    expect(addGoalSpy).not.toHaveBeenCalled();
  });

  it('正常入力で addGoal が呼ばれる', async () => {
    const { getByPlaceholderText, getByText } = renderWithProviders(<AnnualGoalForm />);
    fireEvent.changeText(getByPlaceholderText('例: 音色を磨く'), 'X');
    fireEvent.press(getByText('保存'));
    await waitFor(() => {
      expect(addGoalSpy).toHaveBeenCalled();
    });
  });
});
