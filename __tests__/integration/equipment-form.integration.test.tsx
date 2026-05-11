import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';

import { EquipmentForm } from '@/components/equipment-form';
import { useEquipmentStore } from '@/store/equipment';
import { renderWithProviders, screen } from '@/test-utils/render';

describe('EquipmentForm (integration)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useEquipmentStore.setState({ equipment: null });
  });

  it('空送信でエラーが表示される（スモーク）', async () => {
    renderWithProviders(<EquipmentForm />);

    fireEvent.press(screen.getByText('保存する'));

    await waitFor(() => {
      expect(screen.getAllByText('名前を入力してください').length).toBeGreaterThan(0);
    });
  });

  it('全項目入力して保存すると onSubmit が正しい値で呼ばれる', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<EquipmentForm onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByLabelText('楽器名'), 'B♭クラリネット');
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
    expect(onSubmit.mock.calls[0][0]).toEqual({
      instrument: { name: 'B♭クラリネット', startDate: '2020-04-01' },
      reed: { name: 'Vandoren V12', startDate: '2024-01-15' },
      ligature: { name: 'Vandoren M/O', startDate: '2023-06-10' },
      mouthpiece: { name: 'Vandoren B45', startDate: '2022-03-20' },
    });
  });

  it('プリセットチップをタップすると機材名欄に反映される', async () => {
    renderWithProviders(<EquipmentForm />);

    fireEvent.press(screen.getByLabelText('B♭クラリネット'));

    await waitFor(() => {
      expect(screen.getByLabelText('楽器名').props.value).toBe('B♭クラリネット');
    });
  });

  it('ストアに保存済みデータがあればフォームの初期値として表示される', () => {
    useEquipmentStore.setState({
      equipment: {
        instrument: { name: 'B♭クラリネット', startDate: '2020-04-01' },
        reed: { name: 'Vandoren V12', startDate: '2024-01-15' },
        ligature: { name: 'Vandoren M/O', startDate: '2023-06-10' },
        mouthpiece: { name: 'Vandoren B45', startDate: '2022-03-20' },
      },
    });

    renderWithProviders(<EquipmentForm />);

    expect(screen.getByLabelText('楽器名').props.value).toBe('B♭クラリネット');
    expect(screen.getByLabelText('リード名').props.value).toBe('Vandoren V12');
  });
});
