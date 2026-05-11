import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { PurchasePlanForm } from '@/components/purchase-plan-form';
import { useInstrumentCatalogStore } from '@/store/instrument-catalog';
import { usePurchasePlanStore } from '@/store/purchase-plan';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  useFocusEffect: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockResolvedValue({ data: [], error: null }),
      insert: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

const sampleCatalog = {
  makers: [{ id: 'maker-1', name: 'Buffet Crampon' }],
  models: [{ id: 'model-1', makerId: 'maker-1', name: 'Prestige' }],
};

describe('PurchasePlanForm (integration)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    usePurchasePlanStore.setState({ plan: null });
    useInstrumentCatalogStore.setState({ ...sampleCatalog, loading: false });
  });

  it('金額入力前は購入可能時期が表示されない', () => {
    renderWithProviders(<PurchasePlanForm />);
    expect(screen.queryByText(/ごろ|今すぐ購入可能/)).toBeNull();
  });

  it('目標金額・現在の貯蓄額・月の貯蓄額を入力すると購入可能時期がリアルタイムで表示される', async () => {
    renderWithProviders(<PurchasePlanForm />);

    fireEvent.changeText(screen.getByLabelText('目標金額'), '850000');
    fireEvent.changeText(screen.getByLabelText('現在の貯蓄額'), '200000');
    fireEvent.changeText(screen.getByLabelText('月の貯蓄額'), '30000');

    await waitFor(() => {
      expect(screen.getByText(/ごろ/)).toBeTruthy();
    });
  });

  it('今すぐ購入可能ケース: 貯蓄額 >= 目標金額で "今すぐ購入可能" が表示される', async () => {
    renderWithProviders(<PurchasePlanForm />);

    fireEvent.changeText(screen.getByLabelText('目標金額'), '200000');
    fireEvent.changeText(screen.getByLabelText('現在の貯蓄額'), '300000');
    fireEvent.changeText(screen.getByLabelText('月の貯蓄額'), '30000');

    await waitFor(() => {
      expect(screen.getByText('今すぐ購入可能')).toBeTruthy();
    });
  });

  it('楽器を選択して金額を入力すると Zustand ストアに自動保存される', async () => {
    renderWithProviders(<PurchasePlanForm />);

    fireEvent.press(screen.getByLabelText('メーカー Buffet Crampon'));
    await waitFor(() => screen.getByLabelText('機種名 Prestige'));
    fireEvent.press(screen.getByLabelText('機種名 Prestige'));

    fireEvent.changeText(screen.getByLabelText('目標金額'), '850000');
    fireEvent.changeText(screen.getByLabelText('現在の貯蓄額'), '200000');
    fireEvent.changeText(screen.getByLabelText('月の貯蓄額'), '30000');

    await waitFor(() => {
      const plan = usePurchasePlanStore.getState().plan;
      expect(plan).not.toBeNull();
      expect(plan!.targetPrice).toBe(850000);
      expect(plan!.makerId).toBe('maker-1');
    });
  });

  it('currentSavings が 0 でも "今すぐ購入可能" が正しく表示される', async () => {
    renderWithProviders(<PurchasePlanForm />);

    fireEvent.changeText(screen.getByLabelText('目標金額'), '100000');
    fireEvent.changeText(screen.getByLabelText('現在の貯蓄額'), '0');
    fireEvent.changeText(screen.getByLabelText('月の貯蓄額'), '50000');

    await waitFor(() => {
      expect(screen.getByText(/ごろ/)).toBeTruthy();
    });
  });
});
