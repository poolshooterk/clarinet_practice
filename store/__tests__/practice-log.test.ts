import {
  calcSessionTime,
  groupSessionsByDate,
  MAX_SESSIONS_PER_DAY,
  nextSessionNo,
  type PracticeSession,
  usePracticeLogStore,
} from '@/store/practice-log';

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
  finalizeRecording: jest.fn().mockResolvedValue('file:///data/recordings/new-session-1.m4a'),
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
        order: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'session-1',
                practiced_at: '2026-05-12',
                session_no: 1,
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
                practice_session_recordings: [],
              },
            ],
            error: null,
          }),
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
        order: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'session-1',
                practiced_at: '2026-05-12',
                session_no: 1,
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
                practice_session_recordings: [],
              },
            ],
            error: null,
          }),
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
      sessionNo: 1,
      durationMinutes: null,
      otherMinutes: null,
      otherMemo: null,
      totalMinutes: null,
      memo: null,
      reedNumber: null,
      startTime: null,
      endTime: null,
      textbookEntries: [],
      basicMenuEntries: [],
      recordings: [],
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

  describe('add 開始/終了時刻', () => {
    it('start_time/end_time を insert し、total は分数からのみ算出される', async () => {
      mockSupabase().auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
      const insert = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'new-1' }, error: null }),
        }),
      });
      mockSupabase().from.mockReturnValue({ insert });

      const result = await usePracticeLogStore.getState().add({
        practicedAt: '2020-01-01',
        longToneMinutes: 10,
        textbookEntries: [],
        startTime: '19:00',
        endTime: '19:50',
      } as any);

      expect(result).toEqual({ ok: true });
      // 最初の insert(=practice_sessions) 引数に start_time/end_time が入る
      const sessionInsertArg = insert.mock.calls[0][0];
      expect(sessionInsertArg.start_time).toBe('19:00');
      expect(sessionInsertArg.end_time).toBe('19:50');
      // total は longTone 10 分のみ (時刻は不参入)
      expect(sessionInsertArg.total_minutes).toBe(10);
      const session = usePracticeLogStore.getState().sessions[0];
      expect(session.startTime).toBe('19:00');
      expect(session.endTime).toBe('19:50');
    });
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
          sessionNo: 1,
          durationMinutes: null,
          otherMinutes: null,
          otherMemo: null,
          totalMinutes: null,
          memo: null,
          reedNumber: null,
          startTime: null,
          endTime: null,
          textbookEntries: [],
          basicMenuEntries: [],
          recordings: [],
        },
        {
          id: 'session-2',
          practicedAt: '2026-05-11',
          sessionNo: 1,
          durationMinutes: null,
          otherMinutes: null,
          otherMemo: null,
          totalMinutes: null,
          memo: null,
          reedNumber: null,
          startTime: null,
          endTime: null,
          textbookEntries: [],
          basicMenuEntries: [],
          recordings: [],
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
      sessionNo: 1,
      durationMinutes: 20,
      otherMinutes: null,
      otherMemo: null,
      totalMinutes: null,
      memo: null,
      reedNumber: null,
      startTime: null,
      endTime: null,
      textbookEntries: [],
      basicMenuEntries: [{ menuType: 'long_tone', durationMinutes: 20, tempoBpms: [] }],
      recordings: [],
    };

    beforeEach(() => {
      usePracticeLogStore.setState({
        sessions: [
          existingSession,
          {
            id: 'session-2',
            practicedAt: '2026-05-09',
            sessionNo: 1,
            durationMinutes: null,
            otherMinutes: null,
            otherMemo: null,
            totalMinutes: null,
            memo: null,
            reedNumber: null,
            startTime: null,
            endTime: null,
            textbookEntries: [],
            basicMenuEntries: [],
            recordings: [],
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

  it('add: tempRecordings あり → finalizeRecording が (tempUri, sessionId, index) で呼ばれる', async () => {
    mockSupabase().auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    // session insert
    mockSupabase().from.mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'new-session' }, error: null }),
        }),
      }),
    });
    // practice_session_recordings insert
    mockSupabase().from.mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'rec-1' }, error: null }),
        }),
      }),
    });

    await usePracticeLogStore
      .getState()
      .add({ practicedAt: '2026-05-19', textbookEntries: [] }, [
        { tempUri: 'file:///data/recordings/tmp-1234.m4a', memo: '前半練習' },
      ]);

    expect(mockRecording().finalizeRecording).toHaveBeenCalledWith(
      'file:///data/recordings/tmp-1234.m4a',
      'new-session',
      1,
    );
    expect(usePracticeLogStore.getState().sessions[0].recordings).toHaveLength(1);
    expect(usePracticeLogStore.getState().sessions[0].recordings[0]).toMatchObject({
      id: 'rec-1',
      index: 1,
      memo: '前半練習',
    });
  });

  it('add: tempRecordings なし → finalizeRecording は呼ばれない', async () => {
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
      textbookEntries: [],
    });

    expect(mockRecording().finalizeRecording).not.toHaveBeenCalled();
  });

  it('update: deletedRecordingIds → 削除対象録音の localUri で deleteRecording が呼ばれ recordings から除去される', async () => {
    usePracticeLogStore.setState({
      sessions: [
        {
          id: 'session-1',
          practicedAt: '2026-05-19',
          sessionNo: 1,
          durationMinutes: null,
          otherMinutes: null,
          otherMemo: null,
          totalMinutes: null,
          memo: null,
          reedNumber: null,
          startTime: null,
          endTime: null,
          textbookEntries: [],
          basicMenuEntries: [],
          recordings: [
            {
              id: 'rec-1',
              index: 1 as const,
              localUri: 'file:///data/recordings/session-1-1.m4a',
              memo: null,
            },
            {
              id: 'rec-2',
              index: 2 as const,
              localUri: 'file:///data/recordings/session-1-2.m4a',
              memo: null,
            },
          ],
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
    // DELETE practice_session_basic_menus
    mockSupabase().from.mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
    });
    // DELETE practice_session_recordings
    mockSupabase().from.mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({
        in: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    await usePracticeLogStore
      .getState()
      .update('session-1', { practicedAt: '2026-05-19', textbookEntries: [] }, [], ['rec-1']);

    expect(mockRecording().deleteRecording).toHaveBeenCalledWith(
      'file:///data/recordings/session-1-1.m4a',
    );
    const recordings = usePracticeLogStore.getState().sessions[0].recordings;
    expect(recordings).toHaveLength(1);
    expect(recordings[0].id).toBe('rec-2');
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
            sessionNo: 1,
            durationMinutes: null,
            otherMinutes: null,
            otherMemo: null,
            totalMinutes: null,
            memo: null,
            reedNumber: null,
            startTime: null,
            endTime: null,
            textbookEntries: [],
            basicMenuEntries: [],
            recordings: [],
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
            sessionNo: 1,
            durationMinutes: null,
            otherMinutes: null,
            otherMemo: null,
            totalMinutes: null,
            memo: null,
            reedNumber: null,
            startTime: null,
            endTime: null,
            textbookEntries: [],
            basicMenuEntries: [],
            recordings: [],
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

  it('remove: 各録音の localUri で deleteRecording が呼ばれる', async () => {
    usePracticeLogStore.setState({
      sessions: [
        {
          id: 'session-abc',
          practicedAt: '2026-05-19',
          sessionNo: 1,
          durationMinutes: null,
          otherMinutes: null,
          otherMemo: null,
          totalMinutes: null,
          memo: null,
          reedNumber: null,
          startTime: null,
          endTime: null,
          textbookEntries: [],
          basicMenuEntries: [],
          recordings: [
            {
              id: 'rec-1',
              index: 1 as const,
              localUri: 'file:///data/recordings/session-abc-1.m4a',
              memo: null,
            },
            {
              id: 'rec-2',
              index: 2 as const,
              localUri: 'file:///data/recordings/session-abc-2.m4a',
              memo: null,
            },
          ],
        },
      ],
    });
    mockSupabase().from.mockReturnValue({
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ error: null }),
      }),
    });

    await usePracticeLogStore.getState().remove('session-abc');

    expect(mockRecording().deleteRecording).toHaveBeenCalledWith(
      'file:///data/recordings/session-abc-1.m4a',
    );
    expect(mockRecording().deleteRecording).toHaveBeenCalledWith(
      'file:///data/recordings/session-abc-2.m4a',
    );
  });

  it('add: reedNumber が sessions に保存される', async () => {
    mockSupabase().auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    // session insert
    mockSupabase().from.mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'session-new' },
            error: null,
          }),
        }),
      }),
    });

    await usePracticeLogStore.getState().add({
      practicedAt: '2026-05-21',
      textbookEntries: [],
      reedNumber: 'A3',
    });

    expect(mockSupabase().from).toHaveBeenCalledWith('practice_sessions');
    const insertCall = mockSupabase().from.mock.results[0].value.insert;
    expect(insertCall).toHaveBeenCalledWith(expect.objectContaining({ reed_number: 'A3' }));
  });

  it('fetchAll: reed_number が reedNumber にマップされる', async () => {
    mockSupabase().auth.getUser.mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
    });
    mockSupabase().from.mockReturnValueOnce({
      select: jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          order: jest.fn().mockResolvedValue({
            data: [
              {
                id: 'session-1',
                practiced_at: '2026-05-21',
                session_no: 1,
                duration_minutes: null,
                other_minutes: null,
                other_memo: null,
                total_minutes: null,
                memo: null,
                reed_number: 'B2',
                practice_session_textbooks: [],
                practice_session_basic_menus: [],
                practice_session_recordings: [],
              },
            ],
            error: null,
          }),
        }),
      }),
    });

    await usePracticeLogStore.getState().fetchAll();
    expect(usePracticeLogStore.getState().sessions[0].reedNumber).toBe('B2');
  });
});

describe('calcSessionTime', () => {
  const base: PracticeSession = {
    id: 's1',
    practicedAt: '2026-05-16',
    sessionNo: 1,
    durationMinutes: null,
    otherMinutes: null,
    otherMemo: null,
    totalMinutes: null,
    memo: null,
    reedNumber: null,
    startTime: null,
    endTime: null,
    textbookEntries: [],
    basicMenuEntries: [],
    recordings: [],
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

describe('usePracticeLogStore 録音の付け替え', () => {
  const seedSession = (recordings: PracticeSession['recordings']): PracticeSession => ({
    id: 'session-1',
    practicedAt: '2026-05-12',
    sessionNo: 1,
    durationMinutes: null,
    otherMinutes: null,
    otherMemo: null,
    totalMinutes: null,
    memo: null,
    reedNumber: null,
    startTime: null,
    endTime: null,
    textbookEntries: [],
    basicMenuEntries: [],
    recordings,
  });

  beforeEach(() => {
    usePracticeLogStore.setState({ sessions: [], loading: false });
    jest.clearAllMocks();
  });

  it('insertRecording: 空き index にファイルを移動して DB 挿入し state に追加する', async () => {
    usePracticeLogStore.setState({
      sessions: [
        seedSession([{ id: 'rec-1', index: 1, localUri: 'file:///s1-1.m4a', memo: null }]),
      ],
    });
    mockRecording().finalizeRecording.mockResolvedValueOnce('file:///session-1-2.m4a');
    mockSupabase().from.mockReturnValueOnce({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'rec-new' } }),
        }),
      }),
    });

    const rec = await usePracticeLogStore
      .getState()
      .insertRecording('session-1', 'file:///src.m4a', 'メモ');

    expect(mockRecording().finalizeRecording).toHaveBeenCalledWith(
      'file:///src.m4a',
      'session-1',
      2,
    );
    expect(rec).toEqual({
      id: 'rec-new',
      index: 2,
      localUri: 'file:///session-1-2.m4a',
      memo: 'メモ',
    });
    const recordings = usePracticeLogStore.getState().sessions[0].recordings;
    expect(recordings.map((r) => r.id)).toEqual(['rec-1', 'rec-new']);
  });

  it('insertRecording: 空きスロットが無い場合は null を返し state を変えない', async () => {
    usePracticeLogStore.setState({
      sessions: [
        seedSession([
          { id: 'rec-1', index: 1, localUri: 'file:///s1-1.m4a', memo: null },
          { id: 'rec-2', index: 2, localUri: 'file:///s1-2.m4a', memo: null },
          { id: 'rec-3', index: 3, localUri: 'file:///s1-3.m4a', memo: null },
        ]),
      ],
    });

    const rec = await usePracticeLogStore
      .getState()
      .insertRecording('session-1', 'file:///src.m4a', null);

    expect(rec).toBeNull();
    expect(mockRecording().finalizeRecording).not.toHaveBeenCalled();
    expect(usePracticeLogStore.getState().sessions[0].recordings).toHaveLength(3);
  });

  it('deleteRecordingRow: DB 行のみ削除し state から除外する (ファイルは消さない)', async () => {
    usePracticeLogStore.setState({
      sessions: [
        seedSession([
          { id: 'rec-1', index: 1, localUri: 'file:///s1-1.m4a', memo: null },
          { id: 'rec-2', index: 2, localUri: 'file:///s1-2.m4a', memo: null },
        ]),
      ],
    });
    const eqMock = jest.fn().mockResolvedValue({ error: null });
    mockSupabase().from.mockReturnValueOnce({ delete: jest.fn().mockReturnValue({ eq: eqMock }) });

    await usePracticeLogStore.getState().deleteRecordingRow('session-1', 'rec-1');

    expect(eqMock).toHaveBeenCalledWith('id', 'rec-1');
    expect(mockRecording().deleteRecording).not.toHaveBeenCalled();
    expect(usePracticeLogStore.getState().sessions[0].recordings.map((r) => r.id)).toEqual([
      'rec-2',
    ]);
  });
});

describe('nextSessionNo / groupSessionsByDate', () => {
  const s = (id: string, practicedAt: string, sessionNo: number): PracticeSession => ({
    id,
    practicedAt,
    sessionNo,
    durationMinutes: null,
    otherMinutes: null,
    otherMemo: null,
    totalMinutes: null,
    memo: null,
    reedNumber: null,
    startTime: null,
    endTime: null,
    textbookEntries: [],
    basicMenuEntries: [],
    recordings: [],
  });

  describe('nextSessionNo', () => {
    it('その日に記録が無ければ 1', () => {
      expect(nextSessionNo([], '2026-08-12')).toBe(1);
    });

    it('1 が埋まっていれば 2', () => {
      expect(nextSessionNo([s('a', '2026-08-12', 1)], '2026-08-12')).toBe(2);
    });

    it('欠番があればその最小値を再利用する', () => {
      const sessions = [s('a', '2026-08-12', 1), s('c', '2026-08-12', 3)];
      expect(nextSessionNo(sessions, '2026-08-12')).toBe(2);
    });

    it('3 件埋まっていれば null', () => {
      const sessions = [s('a', '2026-08-12', 1), s('b', '2026-08-12', 2), s('c', '2026-08-12', 3)];
      expect(nextSessionNo(sessions, '2026-08-12')).toBeNull();
    });

    it('別日の記録は影響しない', () => {
      const sessions = [s('a', '2026-08-11', 1), s('b', '2026-08-11', 2), s('c', '2026-08-11', 3)];
      expect(nextSessionNo(sessions, '2026-08-12')).toBe(1);
    });

    it('excludeId を渡すと自分の番号を空きとして扱う', () => {
      const sessions = [s('a', '2026-08-12', 1), s('b', '2026-08-12', 2), s('c', '2026-08-12', 3)];
      expect(nextSessionNo(sessions, '2026-08-12', 'b')).toBe(2);
    });

    it('MAX_SESSIONS_PER_DAY は 3', () => {
      expect(MAX_SESSIONS_PER_DAY).toBe(3);
    });
  });

  describe('groupSessionsByDate', () => {
    it('空配列は空配列', () => {
      expect(groupSessionsByDate([])).toEqual([]);
    });

    it('日付降順・同日は sessionNo 昇順に並べる', () => {
      const sessions = [s('c', '2026-08-12', 2), s('a', '2026-08-11', 1), s('b', '2026-08-12', 1)];
      const groups = groupSessionsByDate(sessions);
      expect(groups.map((g) => g.date)).toEqual(['2026-08-12', '2026-08-11']);
      expect(groups[0].sessions.map((x) => x.id)).toEqual(['b', 'c']);
      expect(groups[1].sessions.map((x) => x.id)).toEqual(['a']);
    });

    it('元の配列を破壊しない', () => {
      const sessions = [s('c', '2026-08-12', 2), s('b', '2026-08-12', 1)];
      groupSessionsByDate(sessions);
      expect(sessions.map((x) => x.id)).toEqual(['c', 'b']);
    });
  });
});

describe('1 日の記録上限', () => {
  const s = (id: string, practicedAt: string, sessionNo: number): PracticeSession => ({
    id,
    practicedAt,
    sessionNo,
    durationMinutes: null,
    otherMinutes: null,
    otherMemo: null,
    totalMinutes: null,
    memo: null,
    reedNumber: null,
    startTime: null,
    endTime: null,
    textbookEntries: [],
    basicMenuEntries: [],
    recordings: [],
  });

  beforeEach(() => {
    usePracticeLogStore.setState({ sessions: [], loading: false });
    jest.clearAllMocks();
    mockCatalog().getState.mockReturnValue({ textbooks: [] });
  });

  it('add: 同日 2 件目は session_no 2 で insert される', async () => {
    usePracticeLogStore.setState({ sessions: [s('a', '2026-08-12', 1)] });
    mockSupabase().auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });
    const insert = jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data: { id: 'new-session' }, error: null }),
      }),
    });
    mockSupabase().from.mockReturnValueOnce({ insert });

    const result = await usePracticeLogStore
      .getState()
      .add({ practicedAt: '2026-08-12', textbookEntries: [] });

    expect(result).toEqual({ ok: true });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ session_no: 2 }));
    expect(usePracticeLogStore.getState().sessions[0].sessionNo).toBe(2);
  });

  it('add: 同日 3 件あると DB に触らず { ok: false, reason: "limit" }', async () => {
    usePracticeLogStore.setState({
      sessions: [s('a', '2026-08-12', 1), s('b', '2026-08-12', 2), s('c', '2026-08-12', 3)],
    });
    mockSupabase().auth.getUser.mockResolvedValueOnce({ data: { user: { id: 'user-1' } } });

    const result = await usePracticeLogStore
      .getState()
      .add({ practicedAt: '2026-08-12', textbookEntries: [] });

    expect(result).toEqual({ ok: false, reason: 'limit' });
    expect(mockSupabase().from).not.toHaveBeenCalled();
  });

  it('update: 日付を変えなければ session_no は据え置き', async () => {
    usePracticeLogStore.setState({ sessions: [s('a', '2026-08-12', 2)] });
    const update = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
    mockSupabase().from.mockReturnValueOnce({ update });
    mockSupabase().from.mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
    });
    mockSupabase().from.mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
    });

    const result = await usePracticeLogStore
      .getState()
      .update('a', { practicedAt: '2026-08-12', textbookEntries: [] });

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ session_no: 2 }));
  });

  it('update: 日付を変えると移動先の空き番号で採番し直す', async () => {
    usePracticeLogStore.setState({
      sessions: [s('a', '2026-08-12', 2), s('b', '2026-08-11', 1)],
    });
    const update = jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
    mockSupabase().from.mockReturnValueOnce({ update });
    mockSupabase().from.mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
    });
    mockSupabase().from.mockReturnValueOnce({
      delete: jest.fn().mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) }),
    });

    const result = await usePracticeLogStore
      .getState()
      .update('a', { practicedAt: '2026-08-11', textbookEntries: [] });

    expect(result).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ session_no: 2 }));
    expect(usePracticeLogStore.getState().sessions[0].sessionNo).toBe(2);
  });

  it('update: 移動先の日が満杯なら DB に触らず limit', async () => {
    usePracticeLogStore.setState({
      sessions: [
        s('a', '2026-08-12', 1),
        s('b', '2026-08-11', 1),
        s('c', '2026-08-11', 2),
        s('d', '2026-08-11', 3),
      ],
    });

    const result = await usePracticeLogStore
      .getState()
      .update('a', { practicedAt: '2026-08-11', textbookEntries: [] });

    expect(result).toEqual({ ok: false, reason: 'limit' });
    expect(mockSupabase().from).not.toHaveBeenCalled();
  });
});
