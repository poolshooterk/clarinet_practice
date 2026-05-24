import { fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { usePurchasePlanStore } from '@/store/purchase-plan';
import { renderWithProviders, screen } from '@/test-utils/render';

import PurchasePlanSavingsFormScreen from '../purchase-plan-savings-form';

jest.mock('expo-router', () => ({
  useLocalSearchParams: jest.fn(),
  router: { back: jest.fn() },
  Stack: { Screen: jest.fn(() => null) },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

function getRouterBack() {
  return jest.requireMock('expo-router').router.back as jest.Mock;
}

beforeEach(() => {
  jest.clearAllMocks();
  const { useLocalSearchParams } = jest.requireMock('expo-router');
  (useLocalSearchParams as jest.Mock).mockReturnValue({ planId: 'plan-1' });

  usePurchasePlanStore.setState({ plan: null, savings: [] });
});

describe('PurchasePlanSavingsFormScreen', () => {
  describe('追加モード (id なし)', () => {
    it('年月・金額・メモのフィールドが表示される', async () => {
      renderWithProviders(<PurchasePlanSavingsFormScreen />);
      await waitFor(() => {
        expect(screen.getByLabelText('年月')).toBeTruthy();
        expect(screen.getByLabelText('金額')).toBeTruthy();
        expect(screen.getByLabelText('メモ')).toBeTruthy();
      });
    });

    it('年月と金額を入力して保存すると addSaving が呼ばれ router.back() が実行される', async () => {
      const addSaving = jest.fn().mockResolvedValue(undefined);
      // addSaving をストアに注入する
      usePurchasePlanStore.setState((prev) => ({ ...prev, addSaving }));

      renderWithProviders(<PurchasePlanSavingsFormScreen />);

      fireEvent.changeText(screen.getByLabelText('年月'), '2026-05');
      fireEvent.changeText(screen.getByLabelText('金額'), '30000');
      fireEvent.press(screen.getByText('保存'));

      await waitFor(() => {
        expect(addSaving).toHaveBeenCalledTimes(1);
        expect(addSaving).toHaveBeenCalledWith('plan-1', {
          yearMonth: '2026-05',
          amount: 30000,
          memo: null,
        });
        expect(getRouterBack()).toHaveBeenCalled();
      });
    });
  });

  describe('編集モード (id あり)', () => {
    const existingEntry = {
      id: 'saving-1',
      yearMonth: '2026-03',
      amount: 25000,
      memo: 'ボーナス',
    };

    beforeEach(() => {
      const { useLocalSearchParams } = jest.requireMock('expo-router');
      (useLocalSearchParams as jest.Mock).mockReturnValue({
        planId: 'plan-1',
        id: 'saving-1',
      });
      usePurchasePlanStore.setState((prev) => ({ ...prev, savings: [existingEntry] }));
    });

    it('既存の年月と金額がフォームに初期表示される', async () => {
      renderWithProviders(<PurchasePlanSavingsFormScreen />);
      await waitFor(() => {
        expect(screen.getByDisplayValue('2026-03')).toBeTruthy();
        expect(screen.getByDisplayValue('25000')).toBeTruthy();
      });
    });

    it('金額を変更して保存すると updateSaving が呼ばれる', async () => {
      const updateSaving = jest.fn().mockResolvedValue(undefined);
      usePurchasePlanStore.setState((prev) => ({
        ...prev,
        savings: [existingEntry],
        updateSaving,
      }));

      renderWithProviders(<PurchasePlanSavingsFormScreen />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('25000')).toBeTruthy();
      });

      fireEvent.changeText(screen.getByLabelText('金額'), '40000');
      fireEvent.press(screen.getByText('保存'));

      await waitFor(() => {
        expect(updateSaving).toHaveBeenCalledTimes(1);
        expect(updateSaving).toHaveBeenCalledWith(
          'saving-1',
          expect.objectContaining({ amount: 40000 }),
        );
        expect(getRouterBack()).toHaveBeenCalled();
      });
    });

    it('削除ボタン押下後 Alert で確認し、削除を選ぶと removeSaving が呼ばれる', async () => {
      const removeSaving = jest.fn().mockResolvedValue(undefined);
      usePurchasePlanStore.setState((prev) => ({
        ...prev,
        savings: [existingEntry],
        removeSaving,
      }));

      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
        // 「削除」ボタンの onPress を即時呼び出す
        const deleteButton = buttons?.find((b) => b.text === '削除');
        deleteButton?.onPress?.();
      });

      renderWithProviders(<PurchasePlanSavingsFormScreen />);

      const trashButton = screen.getByLabelText('削除');
      fireEvent.press(trashButton);

      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith(
          '削除確認',
          '貯蓄実績を削除しますか？',
          expect.any(Array),
        );
        expect(removeSaving).toHaveBeenCalledWith('saving-1');
        expect(getRouterBack()).toHaveBeenCalled();
      });

      alertSpy.mockRestore();
    });
  });
});
