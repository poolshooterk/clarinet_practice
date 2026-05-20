import type { ClarinetEquipment } from '@/forms/equipment';
import { useEquipmentStore } from '@/store/equipment';
import { useInstrumentCatalogStore } from '@/store/instrument-catalog';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

const mockFrom = () => jest.requireMock('@/lib/supabase').supabase.from as jest.Mock;
const mockGetUser = () => jest.requireMock('@/lib/supabase').supabase.auth.getUser as jest.Mock;

const sampleCatalog = {
  makers: [{ id: 'maker-1', name: 'Buffet Crampon' }],
  models: [{ id: 'model-1', makerId: 'maker-1', name: 'R13' }],
};

const sampleEquipment: ClarinetEquipment = {
  instrument: {
    makerId: 'maker-1',
    makerName: 'Buffet Crampon',
    modelId: 'model-1',
    modelName: 'R13',
    purchasePrice: 850000,
    startDate: '2020-04-01',
    photoUri: 'file:///local/photo.jpg',
  },
  reed: { name: 'Vandoren V12', startDate: '2024-01-15' },
  ligature: { name: 'Vandoren M/O', startDate: '2023-06-10' },
  mouthpiece: { name: 'Vandoren B45', startDate: '2022-03-20' },
};

describe('useEquipmentStore', () => {
  beforeEach(() => {
    useEquipmentStore.setState({ equipment: null, loaded: false, loading: false });
    useInstrumentCatalogStore.setState({
      makers: sampleCatalog.makers,
      models: sampleCatalog.models,
      loading: false,
      // fetchEquipment 内で fetchAll が呼ばれるため no-op 化してテスト中の supabase アクセスを抑制
      fetchAll: jest.fn().mockResolvedValue(undefined),
    });
    jest.clearAllMocks();
    mockGetUser().mockResolvedValue({ data: { user: { id: 'user-1' } } });
  });

  it('初期状態は equipment=null, loaded=false', () => {
    expect(useEquipmentStore.getState().equipment).toBeNull();
    expect(useEquipmentStore.getState().loaded).toBe(false);
  });

  it('fetchEquipment: 未認証なら loaded=true で early return、equipment は null のまま', async () => {
    mockGetUser().mockResolvedValueOnce({ data: { user: null } });
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment).toBeNull();
    expect(useEquipmentStore.getState().loaded).toBe(true);
    expect(mockFrom()).not.toHaveBeenCalled();
  });

  it('fetchEquipment: 行が無い (maybeSingle が null) → equipment=null, loaded=true', async () => {
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    });
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment).toBeNull();
    expect(useEquipmentStore.getState().loaded).toBe(true);
  });

  it('fetchEquipment: 正常な row → スネーク→キャメル変換 + カタログから maker/model 名解決', async () => {
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              instrument_maker_id: 'maker-1',
              instrument_model_id: 'model-1',
              instrument_purchase_price: 850000,
              instrument_start_date: '2020-04-01',
              instrument_photo_uri: 'file:///local/photo.jpg',
              reed_name: 'Vandoren V12',
              reed_start_date: '2024-01-15',
              ligature_name: 'Vandoren M/O',
              ligature_start_date: '2023-06-10',
              mouthpiece_name: 'Vandoren B45',
              mouthpiece_start_date: '2022-03-20',
            },
            error: null,
          }),
        }),
      }),
    });
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment).toEqual(sampleEquipment);
    expect(useEquipmentStore.getState().loaded).toBe(true);
  });

  it('fetchEquipment: instrument の必須項目が欠落していれば equipment は null 扱い', async () => {
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({
            data: {
              instrument_maker_id: null,
              instrument_model_id: null,
              instrument_purchase_price: null,
              instrument_start_date: null,
              instrument_photo_uri: null,
              reed_name: 'V12',
              reed_start_date: '2024-01-15',
              ligature_name: null,
              ligature_start_date: null,
              mouthpiece_name: null,
              mouthpiece_start_date: null,
            },
            error: null,
          }),
        }),
      }),
    });
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment).toBeNull();
    expect(useEquipmentStore.getState().loaded).toBe(true);
  });

  it('fetchEquipment: error が返っても loaded=true、equipment は維持される', async () => {
    useEquipmentStore.setState({ equipment: sampleEquipment });
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: new Error('network') }),
        }),
      }),
    });
    await useEquipmentStore.getState().fetchEquipment();
    expect(useEquipmentStore.getState().equipment).toEqual(sampleEquipment);
    expect(useEquipmentStore.getState().loaded).toBe(true);
  });

  it('saveEquipment: 未認証なら { ok: false } で state は変わらない', async () => {
    mockGetUser().mockResolvedValueOnce({ data: { user: null } });
    const result = await useEquipmentStore.getState().saveEquipment(sampleEquipment);
    expect(result).toEqual({ ok: false });
    expect(useEquipmentStore.getState().equipment).toBeNull();
  });

  it('saveEquipment: upsert が正しい payload で呼ばれ、成功時は state が更新される', async () => {
    const upsertMock = jest.fn().mockResolvedValue({ error: null });
    mockFrom().mockReturnValueOnce({ upsert: upsertMock });

    const result = await useEquipmentStore.getState().saveEquipment(sampleEquipment);
    expect(result).toEqual({ ok: true });
    expect(useEquipmentStore.getState().equipment).toEqual(sampleEquipment);
    expect(useEquipmentStore.getState().loaded).toBe(true);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    const payload = upsertMock.mock.calls[0][0];
    expect(payload).toMatchObject({
      user_id: 'user-1',
      instrument_maker_id: 'maker-1',
      instrument_model_id: 'model-1',
      instrument_purchase_price: 850000,
      instrument_start_date: '2020-04-01',
      instrument_photo_uri: 'file:///local/photo.jpg',
      reed_name: 'Vandoren V12',
      reed_start_date: '2024-01-15',
      ligature_name: 'Vandoren M/O',
      ligature_start_date: '2023-06-10',
      mouthpiece_name: 'Vandoren B45',
      mouthpiece_start_date: '2022-03-20',
    });
    expect(payload.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('saveEquipment: 任意項目 (purchasePrice / photoUri) が undefined なら null として送信される', async () => {
    const upsertMock = jest.fn().mockResolvedValue({ error: null });
    mockFrom().mockReturnValueOnce({ upsert: upsertMock });

    const minimal: ClarinetEquipment = {
      ...sampleEquipment,
      instrument: {
        ...sampleEquipment.instrument,
        purchasePrice: undefined,
        photoUri: undefined,
      },
    };
    await useEquipmentStore.getState().saveEquipment(minimal);
    expect(upsertMock.mock.calls[0][0]).toMatchObject({
      instrument_purchase_price: null,
      instrument_photo_uri: null,
    });
  });

  it('saveEquipment: error が返ったら { ok: false } で state は変わらない', async () => {
    mockFrom().mockReturnValueOnce({
      upsert: jest.fn().mockResolvedValue({ error: new Error('upsert error') }),
    });
    const result = await useEquipmentStore.getState().saveEquipment(sampleEquipment);
    expect(result).toEqual({ ok: false });
    expect(useEquipmentStore.getState().equipment).toBeNull();
  });
});
