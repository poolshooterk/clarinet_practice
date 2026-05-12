import { useTextbookProgressStore } from '@/store/textbook-progress';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const mockSupabase = () => jest.requireMock('@/lib/supabase').supabase;

describe('useTextbookProgressStore', () => {
  beforeEach(() => {
    useTextbookProgressStore.setState({ progress: {} });
    jest.clearAllMocks();
  });

  it('初期状態: progress は空オブジェクト', () => {
    expect(useTextbookProgressStore.getState().progress).toEqual({});
  });

  it('fetchAll で progress マップがセットされる', async () => {
    mockSupabase().auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockSupabase().from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [
            { textbook_id: 'tb-1', current_page: 10 },
            { textbook_id: 'tb-2', current_page: 30 },
          ],
          error: null,
        }),
      }),
    });
    await useTextbookProgressStore.getState().fetchAll();
    expect(useTextbookProgressStore.getState().progress).toEqual({
      'tb-1': 10,
      'tb-2': 30,
    });
  });

  it('fetchAll でユーザーが未ログインのとき progress を変更しない', async () => {
    useTextbookProgressStore.setState({ progress: { 'tb-1': 5 } });
    mockSupabase().auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    await useTextbookProgressStore.getState().fetchAll();
    expect(useTextbookProgressStore.getState().progress).toEqual({ 'tb-1': 5 });
  });

  it('upsert で progress マップに追加される', async () => {
    mockSupabase().auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockSupabase().from.mockReturnValueOnce({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    });
    await useTextbookProgressStore.getState().upsert('tb-1', 15);
    expect(useTextbookProgressStore.getState().progress['tb-1']).toBe(15);
  });

  it('同一 textbookId の再 upsert で値が上書きされる', async () => {
    useTextbookProgressStore.setState({ progress: { 'tb-1': 10 } });
    mockSupabase().auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockSupabase().from.mockReturnValueOnce({
      upsert: jest.fn().mockResolvedValue({ error: null }),
    });
    await useTextbookProgressStore.getState().upsert('tb-1', 25);
    expect(useTextbookProgressStore.getState().progress['tb-1']).toBe(25);
  });

  it('upsert で Supabase がエラーを返したとき progress を変更しない', async () => {
    useTextbookProgressStore.setState({ progress: { 'tb-1': 10 } });
    mockSupabase().auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    mockSupabase().from.mockReturnValueOnce({
      upsert: jest.fn().mockResolvedValue({ error: new Error('network') }),
    });
    await useTextbookProgressStore.getState().upsert('tb-1', 25);
    expect(useTextbookProgressStore.getState().progress['tb-1']).toBe(10);
  });
});
