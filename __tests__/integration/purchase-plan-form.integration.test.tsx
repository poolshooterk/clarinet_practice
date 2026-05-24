import { fireEvent, waitFor } from '@testing-library/react-native';

import { PurchasePlanForm } from '@/components/purchase-plan-form';
import { useInstrumentCatalogStore } from '@/store/instrument-catalog';
import { usePurchasePlanStore } from '@/store/purchase-plan';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useFocusEffect: jest.fn(),
  router: { push: jest.fn() },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(() => ({
      upsert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: 'plan-1',
          maker_id: 'maker-1',
          maker_name: 'Buffet Crampon',
          model_id: 'model-1',
          model_name: 'R13',
          target_price: 850000,
          monthly_savings_target: 30000,
        },
        error: null,
      }),
    })),
  },
}));

const sampleCatalog = {
  makers: [{ id: 'maker-1', name: 'Buffet Crampon' }],
  models: [{ id: 'model-1', makerId: 'maker-1', name: 'R13' }],
};

const samplePlan = {
  id: 'plan-1',
  makerId: 'maker-1',
  makerName: 'Buffet Crampon',
  modelId: 'model-1',
  modelName: 'R13',
  targetPrice: 850000,
  monthlyTarget: 30000,
};

describe('PurchasePlanForm (integration)', () => {
  beforeEach(() => {
    usePurchasePlanStore.setState({ plan: null, savings: [], loading: false });
    useInstrumentCatalogStore.setState({ ...sampleCatalog, loading: false });
    jest.clearAllMocks();
    (require('@/lib/supabase').supabase.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: 'user-1' } },
    });
  });

  it('plan が未登録のとき進捗カードと実績カードを表示しない', () => {
    renderWithProviders(<PurchasePlanForm />);
    expect(screen.queryByText('貯蓄進捗')).toBeNull();
    expect(screen.queryByText('貯蓄実績')).toBeNull();
  });

  it('plan が登録済みのとき進捗カードと実績カードを表示する', () => {
    usePurchasePlanStore.setState({ plan: samplePlan, savings: [], loading: false });
    renderWithProviders(<PurchasePlanForm />);
    expect(screen.getByText('貯蓄進捗')).toBeTruthy();
    expect(screen.getByText('貯蓄実績')).toBeTruthy();
  });

  it('2ヶ月より古い実績は表示されない', () => {
    const old = new Date();
    old.setMonth(old.getMonth() - 3);
    const oldYM = `${old.getFullYear()}-${String(old.getMonth() + 1).padStart(2, '0')}`;
    const oldFormatted = `${old.getFullYear()}年${old.getMonth() + 1}月`;
    usePurchasePlanStore.setState({
      plan: samplePlan,
      savings: [{ id: 'sav-old', yearMonth: oldYM, amount: 55555, memo: null }],
      loading: false,
    });
    renderWithProviders(<PurchasePlanForm />);
    // 3ヶ月前のエントリは貯蓄実績カードに表示されない
    expect(screen.queryByText(new RegExp(oldFormatted))).toBeNull();
  });

  it('当月の実績は表示される', () => {
    const now = new Date();
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    usePurchasePlanStore.setState({
      plan: samplePlan,
      savings: [{ id: 'sav-1', yearMonth: currentYM, amount: 55555, memo: 'テスト' }],
      loading: false,
    });
    renderWithProviders(<PurchasePlanForm />);
    // 貯蓄実績カードに当月エントリが表示される（進捗カードと合わせて複数箇所に出る）
    expect(screen.getAllByText(/55,555/).length).toBeGreaterThan(0);
    expect(screen.getByText(/テスト/)).toBeTruthy();
  });

  it('保存ボタン押下で upsertPlan が呼ばれ plan がセットされる', async () => {
    renderWithProviders(<PurchasePlanForm />);

    fireEvent.press(screen.getByLabelText('メーカー Buffet Crampon'));
    await waitFor(() => screen.getByLabelText('機種名 R13'));
    fireEvent.press(screen.getByLabelText('機種名 R13'));
    fireEvent.changeText(screen.getByLabelText('目標金額'), '850000');
    fireEvent.changeText(screen.getByLabelText('予定月額'), '30000');

    fireEvent.press(screen.getByText('保存'));

    await waitFor(() => {
      expect(usePurchasePlanStore.getState().plan).not.toBeNull();
    });
  });
});
