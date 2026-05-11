import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { EquipmentForm } from '@/components/equipment-form';
import { useEquipmentStore } from '@/store/equipment';
import { useInstrumentCatalogStore } from '@/store/instrument-catalog';
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
  makers: [
    { id: 'maker-1', name: 'Buffet Crampon' },
    { id: 'maker-2', name: 'Yamaha' },
  ],
  models: [
    { id: 'model-1', makerId: 'maker-1', name: 'R13' },
    { id: 'model-2', makerId: 'maker-1', name: 'E11' },
    { id: 'model-3', makerId: 'maker-2', name: 'YCL-650' },
  ],
};

describe('EquipmentForm (integration)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useEquipmentStore.setState({ equipment: null });
    useInstrumentCatalogStore.setState({ ...sampleCatalog, loading: false });
  });

  it('空送信でバリデーションエラーが表示される（スモーク）', async () => {
    renderWithProviders(<EquipmentForm />);
    fireEvent.press(screen.getByText('保存する'));
    await waitFor(() => {
      expect(screen.getAllByText('名前を入力してください').length).toBeGreaterThan(0);
    });
  });

  it('メーカーチップをタップすると機種名チップが展開される', async () => {
    renderWithProviders(<EquipmentForm />);
    fireEvent.press(screen.getByLabelText('メーカー Buffet Crampon'));
    await waitFor(() => {
      expect(screen.getByLabelText('機種名 R13')).toBeTruthy();
    });
  });

  it('全項目入力して保存すると onSubmit が正しい値で呼ばれる', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<EquipmentForm onSubmit={onSubmit} />);

    fireEvent.press(screen.getByLabelText('メーカー Buffet Crampon'));
    await waitFor(() => screen.getByLabelText('機種名 R13'));
    fireEvent.press(screen.getByLabelText('機種名 R13'));

    fireEvent.changeText(screen.getByLabelText('楽器使用開始日'), '2020-04-01');
    fireEvent.changeText(screen.getByLabelText('リード名'), 'Vandoren V12');
    fireEvent.changeText(screen.getByLabelText('リード使用開始日'), '2024-01-15');
    fireEvent.changeText(screen.getByLabelText('リガチャー名'), 'Vandoren M/O');
    fireEvent.changeText(screen.getByLabelText('リガチャー使用開始日'), '2023-06-10');
    fireEvent.changeText(screen.getByLabelText('マウスピース名'), 'Vandoren B45');
    fireEvent.changeText(screen.getByLabelText('マウスピース使用開始日'), '2022-03-20');

    fireEvent.press(screen.getByText('保存する'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0].instrument).toEqual({
      makerId: 'maker-1',
      makerName: 'Buffet Crampon',
      modelId: 'model-1',
      modelName: 'R13',
      startDate: '2020-04-01',
    });
    expect(onSubmit.mock.calls[0][0].reed).toEqual({
      name: 'Vandoren V12',
      startDate: '2024-01-15',
    });
  }, 15000);

  it('ストアに保存済みデータがあればフォームの初期値として表示される', () => {
    useEquipmentStore.setState({
      equipment: {
        instrument: {
          makerId: 'maker-1',
          makerName: 'Buffet Crampon',
          modelId: 'model-1',
          modelName: 'R13',
          startDate: '2020-04-01',
        },
        reed: { name: 'Vandoren V12', startDate: '2024-01-15' },
        ligature: { name: 'Vandoren M/O', startDate: '2023-06-10' },
        mouthpiece: { name: 'Vandoren B45', startDate: '2022-03-20' },
      },
    });
    renderWithProviders(<EquipmentForm />);
    expect(screen.getByLabelText('リード名').props.value).toBe('Vandoren V12');
  });
});
