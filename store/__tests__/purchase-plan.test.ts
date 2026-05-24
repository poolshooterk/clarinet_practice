import { usePurchasePlanStore } from '@/store/purchase-plan';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

const mockFrom = () => jest.requireMock('@/lib/supabase').supabase.from as jest.Mock;
const mockGetUser = () =>
  jest.requireMock('@/lib/supabase').supabase.auth.getUser as jest.Mock;

describe('usePurchasePlanStore', () => {
  beforeEach(() => {
    usePurchasePlanStore.setState({ plan: null, savings: [], loading: false });
    jest.clearAllMocks();
    mockGetUser().mockResolvedValue({ data: { user: { id: 'user-1' } } });
  });

  it('初期状態: plan は null、savings は空配列', () => {
    const { plan, savings } = usePurchasePlanStore.getState();
    expect(plan).toBeNull();
    expect(savings).toEqual([]);
  });

  it('fetchAll: plan と savings がセットされる', async () => {
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({
        data: [
          {
            id: 'plan-1',
            maker_id: 'maker-1',
            maker_name: 'Buffet Crampon',
            model_id: 'model-1',
            model_name: 'R13',
            target_price: 850000,
            monthly_savings_target: 30000,
            purchase_plan_savings: [
              { id: 'sav-1', year_month: '2026-05', amount: 30000, memo: null },
            ],
          },
        ],
        error: null,
      }),
    });
    await usePurchasePlanStore.getState().fetchAll();
    const { plan, savings } = usePurchasePlanStore.getState();
    expect(plan).not.toBeNull();
    expect(plan!.id).toBe('plan-1');
    expect(plan!.targetPrice).toBe(850000);
    expect(plan!.monthlyTarget).toBe(30000);
    expect(savings).toHaveLength(1);
    expect(savings[0].amount).toBe(30000);
    expect(savings[0].yearMonth).toBe('2026-05');
  });

  it('fetchAll: データなしのとき plan は null のまま', async () => {
    mockFrom().mockReturnValueOnce({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    });
    await usePurchasePlanStore.getState().fetchAll();
    expect(usePurchasePlanStore.getState().plan).toBeNull();
  });

  it('fetchAll: ユーザー未認証のとき何もしない', async () => {
    mockGetUser().mockResolvedValue({ data: { user: null } });
    await usePurchasePlanStore.getState().fetchAll();
    expect(mockFrom()).not.toHaveBeenCalled();
  });

  it('upsertPlan: plan がストアに追加される', async () => {
    mockFrom().mockReturnValueOnce({
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
    });
    await usePurchasePlanStore.getState().upsertPlan({
      makerId: 'maker-1',
      makerName: 'Buffet Crampon',
      modelId: 'model-1',
      modelName: 'R13',
      targetPrice: 850000,
      monthlyTarget: 30000,
    });
    const { plan } = usePurchasePlanStore.getState();
    expect(plan).not.toBeNull();
    expect(plan!.id).toBe('plan-1');
    expect(plan!.monthlyTarget).toBe(30000);
  });

  it('addSaving: savings にエントリが追加される', async () => {
    usePurchasePlanStore.setState({
      plan: {
        id: 'plan-1',
        makerId: 'maker-1',
        makerName: 'BC',
        modelId: 'm-1',
        modelName: 'R13',
        targetPrice: 850000,
        monthlyTarget: 30000,
      },
      savings: [],
      loading: false,
    });
    mockFrom().mockReturnValueOnce({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { id: 'sav-1', year_month: '2026-05', amount: 30000, memo: null },
        error: null,
      }),
    });
    await usePurchasePlanStore
      .getState()
      .addSaving('plan-1', { yearMonth: '2026-05', amount: 30000, memo: null });
    const { savings } = usePurchasePlanStore.getState();
    expect(savings).toHaveLength(1);
    expect(savings[0].id).toBe('sav-1');
    expect(savings[0].amount).toBe(30000);
  });

  it('updateSaving: 既存エントリが更新される', async () => {
    usePurchasePlanStore.setState({
      plan: {
        id: 'plan-1',
        makerId: 'maker-1',
        makerName: 'BC',
        modelId: 'm-1',
        modelName: 'R13',
        targetPrice: 850000,
        monthlyTarget: 30000,
      },
      savings: [{ id: 'sav-1', yearMonth: '2026-05', amount: 30000, memo: null }],
      loading: false,
    });
    mockFrom().mockReturnValueOnce({
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    });
    await usePurchasePlanStore
      .getState()
      .updateSaving('sav-1', { yearMonth: '2026-05', amount: 60000, memo: 'ボーナス' });
    const { savings } = usePurchasePlanStore.getState();
    expect(savings[0].amount).toBe(60000);
    expect(savings[0].memo).toBe('ボーナス');
  });

  it('removeSaving: 対象エントリが削除される', async () => {
    usePurchasePlanStore.setState({
      plan: {
        id: 'plan-1',
        makerId: 'maker-1',
        makerName: 'BC',
        modelId: 'm-1',
        modelName: 'R13',
        targetPrice: 850000,
        monthlyTarget: 30000,
      },
      savings: [
        { id: 'sav-1', yearMonth: '2026-05', amount: 30000, memo: null },
        { id: 'sav-2', yearMonth: '2026-04', amount: 20000, memo: null },
      ],
      loading: false,
    });
    mockFrom().mockReturnValueOnce({
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockResolvedValue({ error: null }),
    });
    await usePurchasePlanStore.getState().removeSaving('sav-1');
    const { savings } = usePurchasePlanStore.getState();
    expect(savings).toHaveLength(1);
    expect(savings[0].id).toBe('sav-2');
  });
});
