import { fireEvent, waitFor } from '@testing-library/react-native';

import { AccessoriesForm } from '@/components/accessories-form';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('@/store/equipment', () => ({
  useEquipmentStore: jest.fn((selector) =>
    selector({
      equipment: {
        instrument: {
          makerId: 'maker-1',
          makerName: 'Buffet Crampon',
          modelId: 'model-1',
          modelName: 'R13',
          startDate: '2024-01-01',
        },
        reed: { name: 'Vandoren V12', startDate: '2025-01-01' },
        ligature: { name: 'Vandoren M/O', startDate: '2025-01-01' },
        mouthpiece: { name: 'Vandoren B45', startDate: '2025-01-01' },
      },
      loaded: true,
      loading: false,
      fetchEquipment: jest.fn(),
      saveEquipment: jest.fn().mockResolvedValue({ ok: true }),
    }),
  ),
}));

const defaultEquipmentState = {
  equipment: {
    instrument: {
      makerId: 'maker-1',
      makerName: 'Buffet Crampon',
      modelId: 'model-1',
      modelName: 'R13',
      startDate: '2024-01-01',
    },
    reed: { name: 'Vandoren V12', startDate: '2025-01-01' },
    ligature: { name: 'Vandoren M/O', startDate: '2025-01-01' },
    mouthpiece: { name: 'Vandoren B45', startDate: '2025-01-01' },
  },
  loaded: true,
  loading: false,
  fetchEquipment: jest.fn(),
  saveEquipment: jest.fn().mockResolvedValue({ ok: true }),
};

describe('AccessoriesForm (integration)', () => {
  beforeEach(() => {
    const { useEquipmentStore } = jest.requireMock('@/store/equipment');
    useEquipmentStore.mockImplementation((selector: (s: typeof defaultEquipmentState) => unknown) =>
      selector(defaultEquipmentState),
    );
  });

  it('リード名が表示される', async () => {
    renderWithProviders(<AccessoriesForm />);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Vandoren V12')).toBeTruthy();
    });
  });

  it('リード名を変更して保存すると saveEquipment が呼ばれる', async () => {
    const { useEquipmentStore } = jest.requireMock('@/store/equipment');
    const mockSave = jest.fn().mockResolvedValue({ ok: true });
    useEquipmentStore.mockImplementation((selector: (s: typeof defaultEquipmentState) => unknown) =>
      selector({ ...defaultEquipmentState, saveEquipment: mockSave }),
    );
    renderWithProviders(<AccessoriesForm />);
    const reedInput = screen.getByLabelText('リード名');
    fireEvent.changeText(reedInput, 'Rico Royal');
    fireEvent.press(screen.getByText('保存'));
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
    });
    const callArg = mockSave.mock.calls[0][0];
    expect(callArg.reed.name).toBe('Rico Royal');
    expect(callArg.instrument.makerId).toBe('maker-1');
  });

  it('equipment が null のとき案内メッセージが表示される', async () => {
    const { useEquipmentStore } = jest.requireMock('@/store/equipment');
    useEquipmentStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({
        equipment: null,
        loaded: true,
        loading: false,
        fetchEquipment: jest.fn(),
        saveEquipment: jest.fn(),
      }),
    );
    renderWithProviders(<AccessoriesForm />);
    await waitFor(() => {
      expect(screen.getByText(/楽器情報が未登録/)).toBeTruthy();
    });
  });
});
