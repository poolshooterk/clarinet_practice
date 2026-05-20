import { calcSessionTime, type PracticeSession, usePracticeLogStore } from '@/store/practice-log';

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

jest.mock('@/lib/recording', () => ({
  finalizeRecording: jest.fn().mockResolvedValue(undefined),
  deleteRecording: jest.fn().mockResolvedValue(undefined),
}));

const mockRecording = () => jest.requireMock('@/lib/recording');

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
              duration_minutes: 25,
              memo: 'テスト',
              practice_session_textbooks: [
                {
                  textbook_id: 'tb-1',
                  current_page: 14,
                  duration_minutes: null,
                  tempo_bpm: null,
                  textbooks: {
                    title: 'ローズ 32のエチュード',
                    total_pages: 32,
                    genre: 'エチュード',
                  },
                },
              ],
              practice_session_basic_menus: [
                { menu_type: 'long_tone', duration_minutes: 15, tempo_bpms: null },
                { menu_type: 'tonguing', duration_minutes: 10, tempo_bpms: null },
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
      durationMinutes: 25,
      memo: 'テスト',
    });
    expect(sessions[0].textbookEntries[0]).toMatchObject({
      textbookId: 'tb-1',
      textbookTitle: 'ローズ 32のエチュード',
      currentPage: 14,
      totalPages: 32,
      genre: 'エチュード',
      durationMinutes: null,
    });
    expect(sessions[0].basicMenuEntries).toEqual([
      { menuType: 'long_tone', durationMinutes: 15, tempoBpms: [] },
      { menuType: 'tonguing', durationMinutes: 10, tempoBpms: [] },
    ]);
  });

  it('fetchAll で textbooks.genre が null のとき「その他」に正規化される', async () => {
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
              duration_minutes: null,
              memo: null,
              practice_session_textbooks: [
                {
                  textbook_id: 'tb-1',
                  current_page: 5,
                  duration_minutes: null,
                  tempo_bpm: null,
                  textbooks: { title: 'テスト教本', total_pages: null, genre: null },
                },
              ],
              practice_session_basic_menus: [],
            },
          ],
          error: null,
        }),
      }),
    });

    await usePracticeLogStore.getState().fetchAll();

    const sessions = usePracticeLogStore.getState().sessions;
    expect(sessions[0].textbookEntries[0].genre).toBe('その他');
  });

  it('fetchAll でユーザーが未ログインのとき sessions を変更せず from を呼ばない', async () => {
    usePracticeLogStore.setState({ sessions: [] });
    mockSupabase().auth.getUser.mockResolvedValueOnce({ data: { user: null } });

    await usePracticeLogStore.getState().fetchAll();

    expect(mockSupabase().from).not.toHaveBeenCalled();
    expect(usePracticeLogStore.getState().sessions).toEqual([]);
  });

  it('add で基礎練習あり: sessions の先頭に追加され durationMinutes が合計になる', async () => {
    const existing = {
      id: 'old',
      practicedAt: '2026-05-11',
      durationMinutes: null,
      otherMinutes: null,
      otherMemo: null,
      totalMinutes: null,
      memo: null,
      textbookEntries: [],
      basicMenuEntries: [],
    };
    usePracticeLogStore.setState({ sessions: [existing] });

    mockCatalog().getState.mockReturnValue({
      textbooks: [
        {
          id: 'tb-1',
          title: 'ローズ 32のエチュード',
          publisher: null,
          genre: 'エチュード',
          difficulty: null,
          totalPages: 32,
        },
      ],
    });
    mockSupabase().auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    // 1st from: practice_sessions insert
    mockSupabase().from.mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'new-session' }, error: null }),
        }),
      }),
    });
    // 2nd from: practice_session_textbooks insert
    mockSupabase().from.mockReturnValueOnce({
      insert: jest.fn().mockResolvedValue({ error: null }),
    });
    // 3rd from: practice_session_basic_menus insert
    mockSupabase().from.mockReturnValueOnce({
      insert: jest.fn().mockResolvedValue({ error: null }),
    });

    await usePracticeLogStore.getState().add({
      practicedAt: '2026-05-12',
      longToneMinutes: 15,
      tonguingMinutes: 10,
      textbookEntries: [{ textbookId: 'tb-1', currentPage: 14 }],
    });

    const sessions = usePracticeLogStore.getState().sessions;
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe('new-session');
    expect(sessions[0].practicedAt).toBe('2026-05-12');
    expect(sessions[0].durationMinutes).toBe(25);
    expect(sessions[0].basicMenuEntries).toEqual([
      { menuType: 'long_tone', durationMinutes: 15, tempoBpms: [] },
      { menuType: 'tonguing', durationMinutes: 10, tempoBpms: [] },
    ]);
    expect(sessions[0].otherMinutes).toBeNull();
    expect(sessions[0].textbookEntries[0]).toMatchObject({
      textbookId: 'tb-1',
      textbookTitle: 'ローズ 32のエチュード',
      currentPage: 14,
      totalPages: 32,
      genre: 'エチュード',
      durationMinutes: null,
    });
    expect(sessions[1].id).toBe('old');
    expect(mockProgress().getState().upsert).toHaveBeenCalledWith('tb-1', 14);
  });

  it('add で tonguingTempoBpms を渡すと basicMenuEntries に tempoBpms が入る', async () => {
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
      tonguingMinutes: 15,
      tonguingTempoBpms: [{ bpm: 80 }, { bpm: 120 }],
      textbookEntries: [],
    });

    const sessions = usePracticeLogStore.getState().sessions;
    expect(sessions[0].basicMenuEntries).toEqual([
      { menuType: 'tonguing', durationMinutes: 15, tempoBpms: [80, 120] },
    ]);
  });

  it('add で tonguingTempoBpms が空のとき tempoBpms が空配列になる', async () => {
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
      tonguingMinutes: 15,
      tonguingTempoBpms: [],
      textbookEntries: [],
    });

    const sessions = usePracticeLogStore.getState().sessions;
    expect(sessions[0].basicMenuEntries).toEqual([
      { menuType: 'tonguing', durationMinutes: 15, tempoBpms: [] },
    ]);
  });

  it('add で基礎練習なし: durationMinutes が null になる', async () => {
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

    await usePracticeLogStore.getState().add({
      practicedAt: '2026-05-12',
      textbookEntries: [],
    });

    const sessions = usePracticeLogStore.getState().sessions;
    expect(sessions[0].durationMinutes).toBeNull();
    expect(sessions[0].basicMenuEntries).toEqual([]);
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

  it('add で otherMinutes を渡すと sessions[0].otherMinutes に反映される', async () => {
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

    await usePracticeLogStore.getState().add({
      practicedAt: '2026-05-17',
      otherMinutes: 30,
      textbookEntries: [],
    });

    expect(usePracticeLogStore.getState().sessions[0].otherMinutes).toBe(30);
  });

  it('add でスケール教本の tempoBpms から max が tempo_bpm に格納される', async () => {
    mockCatalog().getState.mockReturnValue({
      textbooks: [
        {
          id: 'tb-scale',
          title: 'スケール練習',
          publisher: null,
          genre: 'スケール',
          difficulty: null,
          totalPages: null,
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
    const textbooksInsertMock = jest.fn().mockResolvedValue({ error: null });
    mockSupabase().from.mockReturnValueOnce({ insert: textbooksInsertMock });

    await usePracticeLogStore.getState().add({
      practicedAt: '2026-05-17',
      textbookEntries: [
        {
          textbookId: 'tb-scale',
          currentPage: 5,
          tempoBpms: [{ bpm: 60 }, { bpm: 80 }, { bpm: 100 }],
        },
      ],
    });

    expect(textbooksInsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ tempo_bpm: 100 })]),
    );
    expect(usePracticeLogStore.getState().sessions[0].textbookEntries[0].tempoBpm).toBe(100);
  });

  it('add で tempoBpms が空の場合 tempo_bpm は null になる', async () => {
    mockCatalog().getState.mockReturnValue({ textbooks: [] });
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
    const textbooksInsertMock = jest.fn().mockResolvedValue({ error: null });
    mockSupabase().from.mockReturnValueOnce({ insert: textbooksInsertMock });

    await usePracticeLogStore.getState().add({
      practicedAt: '2026-05-17',
      textbookEntries: [
        {
          textbookId: '123e4567-e89b-12d3-a456-426614174001',
          currentPage: 5,
          tempoBpms: [],
        },
      ],
    });

    expect(textbooksInsertMock).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ tempo_bpm: null })]),
    );
  });

  it('add で total_minutes が longToneMinutes + otherMinutes の合計になる', async () => {
    mockSupabase().auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    const sessionInsertMock = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: 'new-session' }, error: null }),
      }),
    });
    mockSupabase().from.mockReturnValueOnce({ insert: sessionInsertMock });
    // practice_session_basic_menus insert (long_tone)
    mockSupabase().from.mockReturnValueOnce({
      insert: jest.fn().mockResolvedValue({ error: null }),
    });

    await usePracticeLogStore.getState().add({
      practicedAt: '2026-05-17',
      longToneMinutes: 10,
      otherMinutes: 20,
      textbookEntries: [],
    });

    // basic = 10 (long_tone), nonBasic = 20 (otherMinutes) → total = 30
    expect(sessionInsertMock).toHaveBeenCalledWith(expect.objectContaining({ total_minutes: 30 }));
    expect(usePracticeLogStore.getState().sessions[0].totalMinutes).toBe(30);
  });

  it('add で otherMemo を渡すと sessions[0].otherMemo に反映される', async () => {
    mockSupabase().auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    const sessionInsertMock = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: 'new-session' }, error: null }),
      }),
    });
    mockSupabase().from.mockReturnValueOnce({ insert: sessionInsertMock });

    await usePracticeLogStore.getState().add({
      practicedAt: '2026-05-17',
      otherMemo: '曲の通し練習',
      textbookEntries: [],
    });

    expect(sessionInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ other_memo: '曲の通し練習' }),
    );
    expect(usePracticeLogStore.getState().sessions[0].otherMemo).toBe('曲の通し練習');
  });

  it('add でカタログに存在しない textbookId の genre は「その他」になる', async () => {
    mockCatalog().getState.mockReturnValue({ textbooks: [] });
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
      textbookEntries: [{ textbookId: 'unknown-tb', currentPage: 1 }],
    });

    const sessions = usePracticeLogStore.getState().sessions;
    expect(sessions[0].textbookEntries[0].genre).toBe('その他');
  });

  it('remove で対象セッションが削除される', async () => {
    usePracticeLogStore.setState({
      sessions: [
        {
          id: 'session-1',
          practicedAt: '2026-05-12',
          durationMinutes: null,
          otherMinutes: null,
          otherMemo: null,
          totalMinutes: null,
          memo: null,
          textbookEntries: [],
          basicMenuEntries: [],
        },
        {
          id: 'session-2',
          practicedAt: '2026-05-11',
          durationMinutes: null,
          otherMinutes: null,
          otherMemo: null,
          totalMinutes: null,
          memo: null,
          textbookEntries: [],
          basicMenuEntries: [],
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

  describe('update', () => {
    const existingSession: PracticeSession = {
      id: 'session-1',
      practicedAt: '2026-05-10',
      durationMinutes: 20,
      otherMinutes: null,
      otherMemo: null,
      totalMinutes: null,
      memo: null,
      textbookEntries: [],
      basicMenuEntries: [{ menuType: 'long_tone', durationMinutes: 20, tempoBpms: [] }],
    };

    beforeEach(() => {
      usePracticeLogStore.setState({
        sessions: [
          existingSession,
          {
            id: 'session-2',
            practicedAt: '2026-05-09',
            durationMinutes: null,
            otherMinutes: null,
            otherMemo: null,
            totalMinutes: null,
            memo: null,
            textbookEntries: [],
            basicMenuEntries: [],
          },
        ],
        loading: false,
      });
      mockCatalog().getState.mockReturnValue({ textbooks: [] });
    });

    it('基礎練習のみの更新でセッションが差し替えられる', async () => {
      // UPDATE practice_sessions
      mockSupabase().from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });
      // DELETE practice_session_textbooks
      mockSupabase().from.mockReturnValueOnce({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });
      // DELETE practice_session_basic_menus
      mockSupabase().from.mockReturnValueOnce({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });
      // INSERT practice_session_basic_menus
      mockSupabase().from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      await usePracticeLogStore.getState().update('session-1', {
        practicedAt: '2026-05-10',
        longToneMinutes: 30,
        tonguingMinutes: undefined,
        tonguingTempoBpms: [],
        memo: 'updated',
        textbookEntries: [],
      });

      const sessions = usePracticeLogStore.getState().sessions;
      expect(sessions).toHaveLength(2);
      expect(sessions[0]).toMatchObject({
        id: 'session-1',
        practicedAt: '2026-05-10',
        durationMinutes: 30,
        memo: 'updated',
        basicMenuEntries: [{ menuType: 'long_tone', durationMinutes: 30, tempoBpms: [] }],
        textbookEntries: [],
      });
      expect(sessions[1].id).toBe('session-2');
    });

    it('practice_sessions の UPDATE が失敗するとストアを変更しない', async () => {
      mockSupabase().from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: { message: 'DB error' } }),
        }),
      });

      await usePracticeLogStore.getState().update('session-1', {
        practicedAt: '2026-05-10',
        longToneMinutes: 30,
        textbookEntries: [],
      });

      expect(usePracticeLogStore.getState().sessions[0].durationMinutes).toBe(20);
    });

    it('教本エントリあり: textbooks DELETE + INSERT + upsert が呼ばれる', async () => {
      mockCatalog().getState.mockReturnValue({
        textbooks: [
          {
            id: 'tb-1',
            title: 'スケール',
            publisher: null,
            genre: 'スケール',
            difficulty: null,
            totalPages: null,
          },
        ],
      });
      // UPDATE practice_sessions
      mockSupabase().from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
      });
      // DELETE practice_session_textbooks
      mockSupabase().from.mockReturnValueOnce({
        delete: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
      });
      // INSERT practice_session_textbooks
      mockSupabase().from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null }),
      });
      // DELETE practice_session_basic_menus
      mockSupabase().from.mockReturnValueOnce({
        delete: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
      });

      await usePracticeLogStore.getState().update('session-1', {
        practicedAt: '2026-05-10',
        textbookEntries: [{ textbookId: 'tb-1', currentPage: 5, durationMinutes: 10 }],
      });

      expect(mockProgress().getState().upsert).toHaveBeenCalledWith('tb-1', 5);
      const updated = usePracticeLogStore.getState().sessions[0];
      expect(updated.textbookEntries[0]).toMatchObject({
        textbookId: 'tb-1',
        genre: 'スケール',
        currentPage: 5,
        durationMinutes: 10,
      });
    });
  });

  it('add: tempRecordingUri あり → finalizeRecording がセッションIDで呼ばれる', async () => {
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

    await usePracticeLogStore.getState().add(
      {
        practicedAt: '2026-05-19',
        longToneMinutes: undefined,
        tonguingMinutes: undefined,
        tonguingTempoBpms: [],
        otherMinutes: undefined,
        otherMemo: '',
        memo: '',
        textbookEntries: [],
      },
      'file:///data/recordings/tmp.m4a',
    );

    expect(mockRecording().finalizeRecording).toHaveBeenCalledWith('new-session');
  });

  it('add: tempRecordingUri なし → finalizeRecording は呼ばれない', async () => {
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

    await usePracticeLogStore.getState().add({
      practicedAt: '2026-05-19',
      longToneMinutes: undefined,
      tonguingMinutes: undefined,
      tonguingTempoBpms: [],
      otherMinutes: undefined,
      otherMemo: '',
      memo: '',
      textbookEntries: [],
    });

    expect(mockRecording().finalizeRecording).not.toHaveBeenCalled();
  });

  it('update: tempRecordingUri あり → finalizeRecording がセッションIDで呼ばれる', async () => {
    mockSupabase()
      .from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      })
      .mockReturnValueOnce({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      })
      .mockReturnValueOnce({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      });

    await usePracticeLogStore.getState().update(
      'session-abc',
      {
        practicedAt: '2026-05-19',
        longToneMinutes: undefined,
        tonguingMinutes: undefined,
        tonguingTempoBpms: [],
        otherMinutes: undefined,
        otherMemo: '',
        memo: '',
        textbookEntries: [],
      },
      'file:///data/recordings/tmp.m4a',
    );

    expect(mockRecording().finalizeRecording).toHaveBeenCalledWith('session-abc');
  });

  describe('UNIQUE 制約違反', () => {
    it('add: practice_sessions の insert が 23505 を返すと { ok: false, reason: "duplicate" } を返す', async () => {
      mockSupabase().auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-1' } },
      });
      mockSupabase().from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: '23505', message: 'duplicate key value' },
            }),
          }),
        }),
      });

      const result = await usePracticeLogStore.getState().add({
        practicedAt: '2026-05-20',
        textbookEntries: [],
      });

      expect(result).toEqual({ ok: false, reason: 'duplicate' });
      // 失敗時はストアに追加されない
      expect(usePracticeLogStore.getState().sessions).toHaveLength(0);
    });

    it('add: 成功時は { ok: true } を返す', async () => {
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

      const result = await usePracticeLogStore.getState().add({
        practicedAt: '2026-05-20',
        textbookEntries: [],
      });

      expect(result).toEqual({ ok: true });
    });

    it('add: 未ログイン時は { ok: false, reason: "unknown" } を返す', async () => {
      mockSupabase().auth.getUser.mockResolvedValueOnce({ data: { user: null } });

      const result = await usePracticeLogStore.getState().add({
        practicedAt: '2026-05-20',
        textbookEntries: [],
      });

      expect(result).toEqual({ ok: false, reason: 'unknown' });
    });

    it('update: practice_sessions の UPDATE が 23505 を返すと { ok: false, reason: "duplicate" } を返す', async () => {
      usePracticeLogStore.setState({
        sessions: [
          {
            id: 'session-1',
            practicedAt: '2026-05-19',
            durationMinutes: null,
            otherMinutes: null,
            otherMemo: null,
            totalMinutes: null,
            memo: null,
            textbookEntries: [],
            basicMenuEntries: [],
          },
        ],
      });
      mockSupabase().from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            error: { code: '23505', message: 'duplicate key value' },
          }),
        }),
      });

      const result = await usePracticeLogStore.getState().update('session-1', {
        practicedAt: '2026-05-20',
        textbookEntries: [],
      });

      expect(result).toEqual({ ok: false, reason: 'duplicate' });
      // 失敗時はストアが変更されない
      expect(usePracticeLogStore.getState().sessions[0].practicedAt).toBe('2026-05-19');
    });

    it('update: 成功時は { ok: true } を返す', async () => {
      usePracticeLogStore.setState({
        sessions: [
          {
            id: 'session-1',
            practicedAt: '2026-05-19',
            durationMinutes: null,
            otherMinutes: null,
            otherMemo: null,
            totalMinutes: null,
            memo: null,
            textbookEntries: [],
            basicMenuEntries: [],
          },
        ],
      });
      mockSupabase()
        .from.mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        })
        .mockReturnValueOnce({
          delete: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
        })
        .mockReturnValueOnce({
          delete: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
        });

      const result = await usePracticeLogStore.getState().update('session-1', {
        practicedAt: '2026-05-20',
        textbookEntries: [],
      });

      expect(result).toEqual({ ok: true });
    });
  });

  it('remove: deleteRecording がセッションIDで呼ばれる', async () => {
    usePracticeLogStore.setState({
      sessions: [
        {
          id: 'session-abc',
          practicedAt: '2026-05-19',
          durationMinutes: null,
          otherMinutes: null,
          otherMemo: null,
          totalMinutes: null,
          memo: null,
          textbookEntries: [],
          basicMenuEntries: [],
        },
      ],
    });
    mockSupabase().from.mockReturnValue({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    await usePracticeLogStore.getState().remove('session-abc');

    expect(mockRecording().deleteRecording).toHaveBeenCalledWith('session-abc');
  });
});

describe('calcSessionTime', () => {
  const base: PracticeSession = {
    id: 's1',
    practicedAt: '2026-05-16',
    durationMinutes: null,
    otherMinutes: null,
    otherMemo: null,
    totalMinutes: null,
    memo: null,
    textbookEntries: [],
    basicMenuEntries: [],
  };

  it('基礎練習もなく教本もなければ両方 0 になる', () => {
    expect(calcSessionTime(base)).toEqual({ basic: 0, nonBasic: 0 });
  });

  it('durationMinutes だけある場合は basic に加算される', () => {
    expect(calcSessionTime({ ...base, durationMinutes: 20 })).toEqual({ basic: 20, nonBasic: 0 });
  });

  it('スケール教本の durationMinutes は basic に加算される', () => {
    const session: PracticeSession = {
      ...base,
      durationMinutes: 20,
      textbookEntries: [
        {
          textbookId: 'tb-1',
          textbookTitle: 'スケール教本',
          currentPage: 5,
          totalPages: null,
          genre: 'スケール',
          durationMinutes: 15,
          tempoBpm: null,
        },
      ],
    };
    expect(calcSessionTime(session)).toEqual({ basic: 35, nonBasic: 0 });
  });

  it('エチュード教本の durationMinutes は basic に加算される', () => {
    const session: PracticeSession = {
      ...base,
      textbookEntries: [
        {
          textbookId: 'tb-2',
          textbookTitle: 'エチュード教本',
          currentPage: 10,
          totalPages: null,
          genre: 'エチュード',
          durationMinutes: 10,
          tempoBpm: null,
        },
      ],
    };
    expect(calcSessionTime(session)).toEqual({ basic: 10, nonBasic: 0 });
  });

  it('ソナタ教本の durationMinutes は nonBasic に加算される', () => {
    const session: PracticeSession = {
      ...base,
      durationMinutes: 20,
      textbookEntries: [
        {
          textbookId: 'tb-3',
          textbookTitle: 'ソナタ',
          currentPage: 1,
          totalPages: null,
          genre: 'ソナタ',
          durationMinutes: 25,
          tempoBpm: null,
        },
      ],
    };
    expect(calcSessionTime(session)).toEqual({ basic: 20, nonBasic: 25 });
  });

  it('混在する場合: basic と nonBasic が正しく分類される', () => {
    const session: PracticeSession = {
      ...base,
      durationMinutes: 15,
      textbookEntries: [
        {
          textbookId: 'tb-1',
          textbookTitle: 'スケール',
          currentPage: 5,
          totalPages: null,
          genre: 'スケール',
          durationMinutes: 10,
          tempoBpm: null,
        },
        {
          textbookId: 'tb-2',
          textbookTitle: 'コンチェルト',
          currentPage: 8,
          totalPages: null,
          genre: 'コンチェルト',
          durationMinutes: 20,
          tempoBpm: null,
        },
      ],
    };
    expect(calcSessionTime(session)).toEqual({ basic: 25, nonBasic: 20 });
  });

  it('durationMinutes が null の教本エントリは 0 として扱う', () => {
    const session: PracticeSession = {
      ...base,
      textbookEntries: [
        {
          textbookId: 'tb-1',
          textbookTitle: 'スケール',
          currentPage: 5,
          totalPages: null,
          genre: 'スケール',
          durationMinutes: null,
          tempoBpm: null,
        },
      ],
    };
    expect(calcSessionTime(session)).toEqual({ basic: 0, nonBasic: 0 });
  });

  it('otherMinutes がある場合は nonBasic に加算される', () => {
    expect(calcSessionTime({ ...base, otherMinutes: 20 })).toEqual({ basic: 0, nonBasic: 20 });
  });

  it('textbookOnly と otherMinutes が両方ある場合は nonBasic に合算される', () => {
    const session: PracticeSession = {
      ...base,
      otherMinutes: 10,
      textbookEntries: [
        {
          textbookId: 'tb-3',
          textbookTitle: 'ソナタ',
          currentPage: 1,
          totalPages: null,
          genre: 'ソナタ',
          durationMinutes: 25,
          tempoBpm: null,
        },
      ],
    };
    expect(calcSessionTime(session)).toEqual({ basic: 0, nonBasic: 35 });
  });
});
