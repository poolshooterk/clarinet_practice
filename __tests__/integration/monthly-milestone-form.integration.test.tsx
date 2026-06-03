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
  it('新規時はテキスト欄に年間目標タイトルが初期表示される', () => {
    const { getByDisplayValue } = renderWithProviders(<MonthlyMilestoneForm />);
    expect(getByDisplayValue('X')).toBeTruthy();
  });

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

  // 保存で milestone がストアへ追加されても、新規フォームが編集モード (削除ボタン /
  // ヘッダータイトル変更) へ切り替わらないこと。切り替わると router.back() の最中に
  // ネイティブヘッダーが再構成され、保存時にアプリが即終了する回帰が起きる
  it('新規保存後も編集モードへ切り替わらない', async () => {
    useAnnualGoalsStore.setState({
      upsertMilestone: jest.fn(async (goalId: string, input: { month: number; text: string }) => {
        useAnnualGoalsStore.setState((s) => ({
          goals: s.goals.map((g) =>
            g.id === goalId
              ? {
                  ...g,
                  milestones: [
                    ...g.milestones,
                    {
                      id: 'm1',
                      month: input.month,
                      text: input.text,
                      numericTarget: null,
                      numericUnit: null,
                      reviewText: null,
                      achievement: null,
                      reviewedAt: null,
                    },
                  ],
                }
              : g,
          ),
        }));
        return { ok: true, milestoneId: 'm1' };
      }),
    } as never);
    const { getByPlaceholderText, getByText, queryByText } = renderWithProviders(
      <MonthlyMilestoneForm />,
    );
    expect(queryByText('削除')).toBeNull();
    fireEvent.changeText(getByPlaceholderText('例: ロングトーン強化'), '5月の目標');
    fireEvent.press(getByText('保存'));
    await waitFor(() => {
      expect(useAnnualGoalsStore.getState().goals[0].milestones).toHaveLength(1);
    });
    expect(queryByText('削除')).toBeNull();
  });
});
