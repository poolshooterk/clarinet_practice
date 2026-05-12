import { usePracticeLogStore } from '@/store/practice-log';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

jest.mock('@/store/textbook-catalog', () => ({
  useTextbookCatalogStore: {
    getState: jest.fn().mockReturnValue({ textbooks: [] }),
  },
}));

jest.mock('@/store/textbook-progress', () => ({
  useTextbookProgressStore: {
    getState: jest.fn().mockReturnValue({ upsert: jest.fn().mockResolvedValue(undefined) }),
  },
}));

const mockSupabase = () => jest.requireMock('@/lib/supabase').supabase;
const mockCatalog = () => jest.requireMock('@/store/textbook-catalog').useTextbookCatalogStore;
const mockProgress = () => jest.requireMock('@/store/textbook-progress').useTextbookProgressStore;

describe('usePracticeLogStore', () => {
  beforeEach(() => {
    usePracticeLogStore.setState({ sessions: [], loading: false });
    jest.clearAllMocks();
  });

  it('初期状態: sessions は空配列', () => {
    expect(usePracticeLogStore.getState().sessions).toEqual([]);
    expect(usePracticeLogStore.getState().loading).toBe(false);
  });

  it('fetchAll で sessions がセットされる', async () => {
    mockSupabase().auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    mockSupabase().from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockResolvedValue({
          data: [
            {
              id: 'session-1',
              practiced_at: '2026-05-12',
              duration_minutes: 45,
              memo: 'テスト',
              practice_session_textbooks: [
                {
                  textbook_id: 'tb-1',
                  current_page: 14,
                  textbooks: { title: 'ローズ 32のエチュード', total_pages: 32 },
                },
              ],
            },
          ],
          error: null,
        }),
      }),
    });

    await usePracticeLogStore.getState().fetchAll();

    const sessions = usePracticeLogStore.getState().sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: 'session-1',
      practicedAt: '2026-05-12',
      durationMinutes: 45,
      memo: 'テスト',
    });
    expect(sessions[0].textbookEntries[0]).toMatchObject({
      textbookId: 'tb-1',
      textbookTitle: 'ローズ 32のエチュード',
      currentPage: 14,
      totalPages: 32,
    });
  });

  it('fetchAll でユーザーが未ログインのとき sessions を変更せず from を呼ばない', async () => {
    usePracticeLogStore.setState({ sessions: [] });
    mockSupabase().auth.getUser.mockResolvedValueOnce({ data: { user: null } });

    await usePracticeLogStore.getState().fetchAll();

    expect(mockSupabase().from).not.toHaveBeenCalled();
    expect(usePracticeLogStore.getState().sessions).toEqual([]);
  });

  it('add でセッションが sessions の先頭に追加される', async () => {
    const existing = {
      id: 'old',
      practicedAt: '2026-05-11',
      durationMinutes: null,
      memo: null,
      textbookEntries: [],
    };
    usePracticeLogStore.setState({ sessions: [existing] });

    mockCatalog().getState.mockReturnValue({
      textbooks: [
        {
          id: 'tb-1',
          title: 'ローズ 32のエチュード',
          publisher: null,
          difficulty: null,
          totalPages: 32,
        },
      ],
    });
    mockSupabase().auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    mockSupabase().from.mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'new-session' }, error: null }),
        }),
      }),
    });
    mockSupabase().from.mockReturnValueOnce({
      insert: jest.fn().mockResolvedValue({ error: null }),
    });

    await usePracticeLogStore.getState().add({
      practicedAt: '2026-05-12',
      durationMinutes: undefined,
      memo: undefined,
      textbookEntries: [{ textbookId: 'tb-1', currentPage: 14 }],
    });

    const sessions = usePracticeLogStore.getState().sessions;
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe('new-session');
    expect(sessions[0].practicedAt).toBe('2026-05-12');
    expect(sessions[0].textbookEntries[0]).toMatchObject({
      textbookId: 'tb-1',
      textbookTitle: 'ローズ 32のエチュード',
      currentPage: 14,
      totalPages: 32,
    });
    expect(sessions[1].id).toBe('old');
    expect(mockProgress().getState().upsert).toHaveBeenCalledWith('tb-1', 14);
  });

  it('add でユーザーが未ログインのとき sessions を変更せず from を呼ばない', async () => {
    mockSupabase().auth.getUser.mockResolvedValueOnce({ data: { user: null } });

    await usePracticeLogStore.getState().add({
      practicedAt: '2026-05-12',
      textbookEntries: [],
    });

    expect(mockSupabase().from).not.toHaveBeenCalled();
    expect(usePracticeLogStore.getState().sessions).toEqual([]);
  });

  it('remove で対象セッションが削除される', async () => {
    usePracticeLogStore.setState({
      sessions: [
        {
          id: 'session-1',
          practicedAt: '2026-05-12',
          durationMinutes: null,
          memo: null,
          textbookEntries: [],
        },
        {
          id: 'session-2',
          practicedAt: '2026-05-11',
          durationMinutes: null,
          memo: null,
          textbookEntries: [],
        },
      ],
    });
    mockSupabase().from.mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    await usePracticeLogStore.getState().remove('session-1');

    const sessions = usePracticeLogStore.getState().sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe('session-2');
  });
});
