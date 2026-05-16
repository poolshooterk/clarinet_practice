# 練習記録編集・時間合計・楽器写真 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 練習記録の編集・削除対応、教本ジャンル別の時間合計表示、楽器写真登録の 3 機能を追加する。

**Architecture:** `store/practice-log.ts` に `update` アクションと `calcSessionTime` ヘルパーを追加し、フォームは `initialValues` prop で新規/編集を切り替える。楽器写真は `expo-image-picker` + `expo-file-system` で撮影し URI を AsyncStorage に永続化する。

**Tech Stack:** Zustand v5, React Hook Form, Tamagui, Supabase JS, expo-image-picker, expo-file-system

---

## File Map

| 操作   | ファイル                               | 変更内容                                                                      |
| ------ | -------------------------------------- | ----------------------------------------------------------------------------- |
| Modify | `forms/practice-log.ts`                | `BASIC_GENRES` 定数を追加・export                                             |
| Modify | `store/practice-log.ts`                | `TextbookEntry.genre` 追加、`update` アクション追加、`calcSessionTime` export |
| Modify | `store/__tests__/practice-log.test.ts` | `fetchAll`/`add` テストに `genre` を追加、`update` テストを追加               |
| Modify | `app/(tabs)/index.tsx`                 | 時間表示を基礎/教本分類に変更、タップで編集遷移、ロングプレス廃止             |
| Modify | `components/practice-log-form.tsx`     | `initialValues` prop 追加、フォーム内合計を基礎/教本分類に変更                |
| Modify | `app/practice-log-form.tsx`            | 編集モード (id パラメータ)、削除ボタン                                        |
| Modify | `forms/equipment.ts`                   | `instrumentItemSchema` に `photoUri` 追加                                     |
| Modify | `forms/__tests__/equipment.test.ts`    | `photoUri` のテスト追加                                                       |
| Modify | `components/equipment-form.tsx`        | 写真セクション UI 追加                                                        |

---

## Task 1: TextbookEntry に genre を追加し既存テストを更新

**Files:**

- Modify: `store/practice-log.ts`
- Modify: `store/__tests__/practice-log.test.ts`

- [ ] **Step 1: `TextbookEntry` 型と `SessionRow` 型に `genre` を追加する**

`store/practice-log.ts` の `TextbookEntry` と `SessionRow` を以下に差し替える:

```ts
type TextbookEntry = {
  textbookId: string;
  textbookTitle: string;
  currentPage: number;
  totalPages: number | null;
  genre: string;
  durationMinutes: number | null;
};

// SessionRow の textbooks フィールドも更新
type SessionRow = {
  id: string;
  practiced_at: string;
  duration_minutes: number | null;
  memo: string | null;
  practice_session_textbooks: {
    textbook_id: string;
    current_page: number;
    duration_minutes: number | null;
    textbooks: { title: string; total_pages: number | null; genre: string } | null;
  }[];
  practice_session_basic_menus: {
    menu_type: string;
    duration_minutes: number;
    tempo_bpms: number[] | null;
  }[];
};
```

- [ ] **Step 2: `fetchAll` の SELECT クエリと マッピングに `genre` を追加する**

`fetchAll` の SELECT 文を変更する:

```ts
// 変更前
'practice_session_textbooks ( textbook_id, current_page, duration_minutes, textbooks ( title, total_pages ) ), ' +
// 変更後
'practice_session_textbooks ( textbook_id, current_page, duration_minutes, textbooks ( title, total_pages, genre ) ), ' +
```

`fetchAll` のマッピングに `genre` を追加する:

```ts
textbookEntries: (row.practice_session_textbooks ?? []).map((entry) => ({
  textbookId: entry.textbook_id,
  textbookTitle: entry.textbooks?.title ?? '',
  currentPage: entry.current_page,
  totalPages: entry.textbooks?.total_pages ?? null,
  genre: entry.textbooks?.genre ?? 'その他',
  durationMinutes: entry.duration_minutes ?? null,
})),
```

- [ ] **Step 3: `add` アクションの `newSession` に `genre` を追加する**

`add` アクション内の `newSession.textbookEntries` マッピングを更新する:

```ts
textbookEntries: input.textbookEntries.map((entry) => {
  const tb = catalogTextbooks.find((t) => t.id === entry.textbookId);
  return {
    textbookId: entry.textbookId,
    textbookTitle: tb?.title ?? '',
    currentPage: entry.currentPage,
    totalPages: tb?.totalPages ?? null,
    genre: tb?.genre ?? 'その他',
    durationMinutes: entry.durationMinutes ?? null,
  };
}),
```

- [ ] **Step 4: 既存テストの `fetchAll` モックデータに `genre` を追加する**

`store/__tests__/practice-log.test.ts` の `fetchAll` テスト内、`textbooks` モックに `genre` を追加する:

```ts
// 変更前
textbooks: { title: 'ローズ 32のエチュード', total_pages: 32 },
// 変更後
textbooks: { title: 'ローズ 32のエチュード', total_pages: 32, genre: 'エチュード' },
```

`fetchAll` のアサーションに `genre` を追加する:

```ts
expect(sessions[0].textbookEntries[0]).toMatchObject({
  textbookId: 'tb-1',
  textbookTitle: 'ローズ 32のエチュード',
  currentPage: 14,
  totalPages: 32,
  genre: 'エチュード',
  durationMinutes: null,
});
```

- [ ] **Step 5: 既存テストの `add` モックデータに `genre` を追加する**

`add` テスト内、`mockCatalog().getState.mockReturnValue` の textbooks に `genre` を追加する:

```ts
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
```

`add` のアサーションに `genre` を追加する:

```ts
expect(sessions[0].textbookEntries[0]).toMatchObject({
  textbookId: 'tb-1',
  textbookTitle: 'ローズ 32のエチュード',
  currentPage: 14,
  totalPages: 32,
  genre: 'エチュード',
  durationMinutes: null,
});
```

- [ ] **Step 6: テストを実行して全件パスすることを確認する**

```bash
npx jest store/__tests__/practice-log.test.ts
```

期待出力: `Tests: X passed`

- [ ] **Step 7: コミット**

```bash
git add store/practice-log.ts store/__tests__/practice-log.test.ts
git commit -m "feat: TextbookEntry に genre フィールドを追加し fetchAll/add を更新"
```

---

## Task 2: BASIC_GENRES 定数と calcSessionTime ヘルパーを実装（TDD）

**Files:**

- Modify: `forms/practice-log.ts`
- Modify: `store/practice-log.ts`
- Modify: `store/__tests__/practice-log.test.ts`

- [ ] **Step 1: `forms/practice-log.ts` に `BASIC_GENRES` を追加する**

既存の `BASIC_MENUS` 定数の下に追加する:

```ts
export const BASIC_GENRES = ['スケール', 'エチュード'] as const;
```

- [ ] **Step 2: `calcSessionTime` のテストを書く**

`store/__tests__/practice-log.test.ts` の末尾に追加する:

```ts
import { calcSessionTime } from '@/store/practice-log';

describe('calcSessionTime', () => {
  const base: PracticeSession = {
    id: 's1',
    practicedAt: '2026-05-16',
    durationMinutes: null,
    memo: null,
    textbookEntries: [],
    basicMenuEntries: [],
  };

  it('基礎練習もなく教本もなければ両方 0 になる', () => {
    expect(calcSessionTime(base)).toEqual({ basic: 0, textbook: 0 });
  });

  it('durationMinutes だけある場合は basic に加算される', () => {
    expect(calcSessionTime({ ...base, durationMinutes: 20 })).toEqual({ basic: 20, textbook: 0 });
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
        },
      ],
    };
    expect(calcSessionTime(session)).toEqual({ basic: 35, textbook: 0 });
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
        },
      ],
    };
    expect(calcSessionTime(session)).toEqual({ basic: 10, textbook: 0 });
  });

  it('ソナタ教本の durationMinutes は textbook に加算される', () => {
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
        },
      ],
    };
    expect(calcSessionTime(session)).toEqual({ basic: 20, textbook: 25 });
  });

  it('混在する場合: basic と textbook が正しく分類される', () => {
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
        },
        {
          textbookId: 'tb-2',
          textbookTitle: 'コンチェルト',
          currentPage: 8,
          totalPages: null,
          genre: 'コンチェルト',
          durationMinutes: 20,
        },
      ],
    };
    expect(calcSessionTime(session)).toEqual({ basic: 25, textbook: 20 });
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
        },
      ],
    };
    expect(calcSessionTime(session)).toEqual({ basic: 0, textbook: 0 });
  });
});
```

- [ ] **Step 3: テストが失敗することを確認する（calcSessionTime 未実装のため）**

```bash
npx jest store/__tests__/practice-log.test.ts -t 'calcSessionTime'
```

期待出力: FAIL（`calcSessionTime` is not exported）

- [ ] **Step 4: `store/practice-log.ts` に `calcSessionTime` を実装して export する**

`BASIC_GENRES` のインポートを追加し、`usePracticeLogStore` 定義の前に関数を追加する:

```ts
import { type PracticeLogInput, BASIC_GENRES } from '@/forms/practice-log';

// PracticeSession 型定義の直後に追加
export function calcSessionTime(session: PracticeSession): { basic: number; textbook: number } {
  const basicTextbook = session.textbookEntries
    .filter((e) => (BASIC_GENRES as readonly string[]).includes(e.genre))
    .reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);
  const textbookOnly = session.textbookEntries
    .filter((e) => !(BASIC_GENRES as readonly string[]).includes(e.genre))
    .reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);
  return {
    basic: (session.durationMinutes ?? 0) + basicTextbook,
    textbook: textbookOnly,
  };
}
```

- [ ] **Step 5: テストが全件パスすることを確認する**

```bash
npx jest store/__tests__/practice-log.test.ts
```

期待出力: `Tests: X passed`

- [ ] **Step 6: コミット**

```bash
git add forms/practice-log.ts store/practice-log.ts store/__tests__/practice-log.test.ts
git commit -m "feat: BASIC_GENRES と calcSessionTime ヘルパーを追加"
```

---

## Task 3: update アクションを実装（TDD）

**Files:**

- Modify: `store/practice-log.ts`
- Modify: `store/__tests__/practice-log.test.ts`

- [ ] **Step 1: `PracticeLogState` 型に `update` を追加する**

```ts
type PracticeLogState = {
  sessions: PracticeSession[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  add: (input: PracticeLogInput) => Promise<void>;
  update: (id: string, input: PracticeLogInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
};
```

- [ ] **Step 2: `update` のテストを書く**

`store/__tests__/practice-log.test.ts` の `usePracticeLogStore` describe ブロック内に追加する:

```ts
describe('update', () => {
  const existingSession: PracticeSession = {
    id: 'session-1',
    practicedAt: '2026-05-10',
    durationMinutes: 20,
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
```

- [ ] **Step 3: テストが失敗することを確認する（update 未実装のため）**

```bash
npx jest store/__tests__/practice-log.test.ts -t 'update'
```

期待出力: FAIL

- [ ] **Step 4: `store/practice-log.ts` に `update` アクションを実装する**

`remove` アクションの前に追加する:

```ts
update: async (id: string, input: PracticeLogInput) => {
  const totalDuration = (input.longToneMinutes ?? 0) + (input.tonguingMinutes ?? 0);

  const { error: sessionError } = await supabase
    .from('practice_sessions')
    .update({
      practiced_at: input.practicedAt,
      duration_minutes: totalDuration > 0 ? totalDuration : null,
      memo: input.memo || null,
    })
    .eq('id', id);
  if (sessionError) return;

  await supabase.from('practice_session_textbooks').delete().eq('session_id', id);
  if (input.textbookEntries.length > 0) {
    const { error: entriesError } = await supabase.from('practice_session_textbooks').insert(
      input.textbookEntries.map((entry) => ({
        session_id: id,
        textbook_id: entry.textbookId,
        current_page: entry.currentPage,
        duration_minutes: entry.durationMinutes ?? null,
      })),
    );
    if (entriesError) return;
    for (const entry of input.textbookEntries) {
      await useTextbookProgressStore.getState().upsert(entry.textbookId, entry.currentPage);
    }
  }

  await supabase.from('practice_session_basic_menus').delete().eq('session_id', id);
  const basicMenuRows = [
    ...(input.longToneMinutes != null
      ? [
          {
            session_id: id,
            menu_type: 'long_tone' as const,
            duration_minutes: input.longToneMinutes,
            tempo_bpms: null as number[] | null,
          },
        ]
      : []),
    ...(input.tonguingMinutes != null
      ? [
          {
            session_id: id,
            menu_type: 'tonguing' as const,
            duration_minutes: input.tonguingMinutes,
            tempo_bpms: input.tonguingTempoBpms?.length
              ? input.tonguingTempoBpms.map((e) => e.bpm)
              : null,
          },
        ]
      : []),
  ];
  if (basicMenuRows.length > 0) {
    const { error: basicError } = await supabase
      .from('practice_session_basic_menus')
      .insert(basicMenuRows);
    if (basicError) return;
  }

  const catalogTextbooks = useTextbookCatalogStore.getState().textbooks;
  const updatedSession: PracticeSession = {
    id,
    practicedAt: input.practicedAt,
    durationMinutes: totalDuration > 0 ? totalDuration : null,
    memo: input.memo || null,
    textbookEntries: input.textbookEntries.map((entry) => {
      const tb = catalogTextbooks.find((t) => t.id === entry.textbookId);
      return {
        textbookId: entry.textbookId,
        textbookTitle: tb?.title ?? '',
        currentPage: entry.currentPage,
        totalPages: tb?.totalPages ?? null,
        genre: tb?.genre ?? 'その他',
        durationMinutes: entry.durationMinutes ?? null,
      };
    }),
    basicMenuEntries: basicMenuRows.map((r) => ({
      menuType: r.menu_type,
      durationMinutes: r.duration_minutes,
      tempoBpms: r.tempo_bpms ?? [],
    })),
  };
  set({ sessions: get().sessions.map((s) => (s.id === id ? updatedSession : s)) });
},
```

- [ ] **Step 5: テストが全件パスすることを確認する**

```bash
npx jest store/__tests__/practice-log.test.ts
```

期待出力: `Tests: X passed`

- [ ] **Step 6: コミット**

```bash
git add store/practice-log.ts store/__tests__/practice-log.test.ts
git commit -m "feat: practice-log ストアに update アクションを追加"
```

---

## Task 4: 一覧画面の時間表示を基礎/教本分類に更新

**Files:**

- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: `calcSessionTime` を import に追加する**

`app/(tabs)/index.tsx` の import を更新する:

```ts
import { calcSessionTime } from '@/store/practice-log';
```

- [ ] **Step 2: 月次合計の計算を置き換える**

```ts
// 削除
const totalMinutes = monthSessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

// 追加
const totalBasic = monthSessions.reduce((sum, s) => sum + calcSessionTime(s).basic, 0);
const totalTextbook = monthSessions.reduce((sum, s) => sum + calcSessionTime(s).textbook, 0);
```

- [ ] **Step 3: 月次ヘッダーの表示を更新する**

```tsx
// 変更前
<Paragraph fontSize="$2" color="$color10">
  {`${monthSessions.length}回 / 計${totalMinutes}分`}
</Paragraph>

// 変更後
<Paragraph fontSize="$2" color="$color10">
  {totalBasic === 0 && totalTextbook === 0
    ? `${monthSessions.length}回 / 練習時間未記録`
    : [
        `${monthSessions.length}回`,
        totalBasic > 0 && `基礎練習: ${totalBasic}分`,
        totalTextbook > 0 && `教本: ${totalTextbook}分`,
      ]
        .filter(Boolean)
        .join(' / ')}
</Paragraph>
```

- [ ] **Step 4: セッションカードの時間表示を更新する**

`renderItem` を以下のように変更する（`onLongPress` は次の Task で削除するので今は残す）:

```tsx
renderItem={({ item }) => {
  const { basic, textbook } = calcSessionTime(item);
  const timeLabel = [
    basic > 0 && `基礎練習: ${basic}分`,
    textbook > 0 && `教本: ${textbook}分`,
  ]
    .filter(Boolean)
    .join(' / ');

  return (
    <Pressable onLongPress={() => handleLongPress(item.id)}>
      <YStack
        mx="$3"
        mb="$2"
        p="$3"
        bg="$color1"
        rounded="$3"
        borderWidth={1}
        borderColor="$borderColor"
      >
        <XStack justify="space-between" items="baseline" mb="$1">
          <Paragraph fontWeight="bold">
            {`${item.practicedAt}（${dayOfWeek(item.practicedAt)}）`}
          </Paragraph>
          {timeLabel ? (
            <Paragraph fontSize="$2" color="$color10">
              {timeLabel}
            </Paragraph>
          ) : null}
        </XStack>
        {/* 残りの JSX はそのまま */}
        {item.memo ? (
          <Paragraph fontSize="$2" color="$color11" numberOfLines={1} mb="$1">
            {item.memo}
          </Paragraph>
        ) : null}
        {item.textbookEntries.map((entry) => (
          <XStack key={entry.textbookId} gap="$2" items="center">
            <Paragraph fontSize="$2">{entry.textbookTitle}</Paragraph>
            {entry.durationMinutes != null && (
              <Paragraph fontSize="$2" color="$color10">
                {`${entry.durationMinutes}分`}
              </Paragraph>
            )}
            <Paragraph fontSize="$2" color="$blue9" ml="auto">
              {`p.${entry.currentPage}`}
            </Paragraph>
          </XStack>
        ))}
        {item.basicMenuEntries.length > 0 && (
          <XStack gap="$3" mt="$1" flexWrap="wrap">
            {item.basicMenuEntries.map((entry) => {
              const label =
                BASIC_MENUS.find((m) => m.type === entry.menuType)?.label ?? entry.menuType;
              const suffix =
                entry.menuType === 'tonguing' && entry.tempoBpms.length > 0
                  ? ` ♩=${entry.tempoBpms.join(', ')}`
                  : '';
              return (
                <Paragraph key={entry.menuType} fontSize="$2" color="$color10">
                  {`${label}: ${entry.durationMinutes}分${suffix}`}
                </Paragraph>
              );
            })}
          </XStack>
        )}
      </YStack>
    </Pressable>
  );
}}
```

- [ ] **Step 5: lint / format / tsc を確認する**

```bash
npm run lint && npm run format:check && npx tsc --noEmit
```

期待出力: エラー 0 件

- [ ] **Step 6: コミット**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat: 練習一覧の時間表示を基礎/教本分類に変更"
```

---

## Task 5: フォーム内リアルタイム合計を基礎/教本分類に更新

**Files:**

- Modify: `components/practice-log-form.tsx`

- [ ] **Step 1: `BASIC_GENRES` を import に追加する**

```ts
import {
  BASIC_MENUS,
  BASIC_GENRES,
  formatDate,
  type PracticeLogInput,
  practiceLogSchema,
  today,
} from '@/forms/practice-log';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';
```

- [ ] **Step 2: リアルタイム合計の計算を差し替える**

既存の `const totalMinutes = ...` を削除し、以下に置き換える:

```ts
const formBasicMinutes =
  (watchedLongTone ?? 0) +
  (watchedTonguing ?? 0) +
  watchedEntries.reduce((acc, e) => {
    const tb = textbooks.find((t) => t.id === e.textbookId);
    return tb && (BASIC_GENRES as readonly string[]).includes(tb.genre)
      ? acc + (e.durationMinutes ?? 0)
      : acc;
  }, 0);

const formTextbookMinutes = watchedEntries.reduce((acc, e) => {
  const tb = textbooks.find((t) => t.id === e.textbookId);
  return tb && !(BASIC_GENRES as readonly string[]).includes(tb.genre)
    ? acc + (e.durationMinutes ?? 0)
    : acc;
}, 0);
```

- [ ] **Step 3: JSX の合計表示を更新する**

```tsx
// 変更前
{
  totalMinutes > 0 && (
    <Paragraph fontSize="$2" color="$color10">
      合計: {totalMinutes}分
    </Paragraph>
  );
}

// 変更後
{
  (formBasicMinutes > 0 || formTextbookMinutes > 0) && (
    <Paragraph fontSize="$2" color="$color10">
      {[
        formBasicMinutes > 0 && `基礎: ${formBasicMinutes}分`,
        formTextbookMinutes > 0 && `教本: ${formTextbookMinutes}分`,
      ]
        .filter(Boolean)
        .join(' / ')}
    </Paragraph>
  );
}
```

- [ ] **Step 4: lint / format / tsc を確認する**

```bash
npm run lint && npm run format:check && npx tsc --noEmit
```

期待出力: エラー 0 件

- [ ] **Step 5: コミット**

```bash
git add components/practice-log-form.tsx
git commit -m "feat: フォーム内合計表示を基礎/教本分類に変更"
```

---

## Task 6: PracticeLogForm に initialValues prop を追加

**Files:**

- Modify: `components/practice-log-form.tsx`

- [ ] **Step 1: `Props` 型に `initialValues` を追加する**

```ts
type Props = {
  onSubmit: (data: PracticeLogInput) => void | Promise<void>;
  initialValues?: PracticeLogInput;
};

export const PracticeLogForm = forwardRef<PracticeLogFormRef, Props>(function PracticeLogForm(
  { onSubmit, initialValues },
  ref,
) {
```

- [ ] **Step 2: `defaultValues` を `initialValues` で上書きするよう変更する**

```ts
defaultValues: initialValues ?? {
  practicedAt: today(),
  longToneMinutes: undefined,
  tonguingMinutes: undefined,
  tonguingTempoBpms: [],
  memo: '',
  textbookEntries: lastTextbookEntries,
},
```

- [ ] **Step 3: lint / format / tsc を確認する**

```bash
npm run lint && npm run format:check && npx tsc --noEmit
```

期待出力: エラー 0 件

- [ ] **Step 4: コミット**

```bash
git add components/practice-log-form.tsx
git commit -m "feat: PracticeLogForm に initialValues prop を追加"
```

---

## Task 7: app/practice-log-form.tsx に編集モードを追加

**Files:**

- Modify: `app/practice-log-form.tsx`

- [ ] **Step 1: ファイル全体を以下の内容に置き換える**

```tsx
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Alert, Pressable } from 'react-native';
import { Button, Paragraph, YStack } from 'tamagui';

import { PracticeLogForm, type PracticeLogFormRef } from '@/components/practice-log-form';
import { type PracticeLogInput } from '@/forms/practice-log';
import { usePracticeLogStore } from '@/store/practice-log';

export default function PracticeLogFormScreen() {
  const formRef = useRef<PracticeLogFormRef>(null);
  const { id } = useLocalSearchParams<{ id?: string }>();

  const sessions = usePracticeLogStore((s) => s.sessions);
  const add = usePracticeLogStore((s) => s.add);
  const update = usePracticeLogStore((s) => s.update);
  const remove = usePracticeLogStore((s) => s.remove);

  const editingSession = id ? sessions.find((s) => s.id === id) : undefined;

  const initialValues: PracticeLogInput | undefined = editingSession
    ? {
        practicedAt: editingSession.practicedAt,
        longToneMinutes: editingSession.basicMenuEntries.find((m) => m.menuType === 'long_tone')
          ?.durationMinutes,
        tonguingMinutes: editingSession.basicMenuEntries.find((m) => m.menuType === 'tonguing')
          ?.durationMinutes,
        tonguingTempoBpms:
          editingSession.basicMenuEntries
            .find((m) => m.menuType === 'tonguing')
            ?.tempoBpms.map((bpm) => ({ bpm })) ?? [],
        memo: editingSession.memo ?? '',
        textbookEntries: editingSession.textbookEntries.map((e) => ({
          textbookId: e.textbookId,
          currentPage: e.currentPage,
          durationMinutes: e.durationMinutes ?? undefined,
        })),
      }
    : undefined;

  const handleSubmit = async (data: PracticeLogInput) => {
    if (id) {
      await update(id, data);
    } else {
      await add(data);
    }
    router.back();
  };

  const handleDelete = () => {
    Alert.alert('練習記録を削除', 'この記録を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await remove(id!);
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: id ? '練習記録を編集' : '練習を記録',
          headerShown: true,
          headerRight: () => (
            <Pressable onPress={() => formRef.current?.submit()}>
              <Paragraph color="$blue9" mr="$2">
                保存
              </Paragraph>
            </Pressable>
          ),
        }}
      />
      <PracticeLogForm ref={formRef} onSubmit={handleSubmit} initialValues={initialValues} />
      {id && (
        <YStack px="$4" pb="$6">
          <Button theme="red" onPress={handleDelete} aria-label="練習記録を削除">
            この練習記録を削除
          </Button>
        </YStack>
      )}
    </>
  );
}
```

- [ ] **Step 2: lint / format / tsc を確認する**

```bash
npm run lint && npm run format:check && npx tsc --noEmit
```

期待出力: エラー 0 件

- [ ] **Step 3: コミット**

```bash
git add app/practice-log-form.tsx
git commit -m "feat: 練習記録フォームに編集モードを追加（id パラメータ）"
```

---

## Task 8: 一覧画面のタップ遷移追加・ロングプレス削除廃止

**Files:**

- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: `router` を import に追加する（未追加の場合）**

`expo-router` の import に `router` が含まれていることを確認する（すでに含まれている）。

- [ ] **Step 2: `handleLongPress` 関数を削除する**

以下の関数を削除する:

```ts
// 削除する
const handleLongPress = (id: string) => {
  Alert.alert('練習記録を削除', 'この記録を削除しますか？', [
    { text: 'キャンセル', style: 'cancel' },
    { text: '削除', style: 'destructive', onPress: () => remove(id) },
  ]);
};
```

- [ ] **Step 3: `remove` セレクタと `Alert` import を削除する**

不要になった行を削除する:

```ts
// 削除
const remove = usePracticeLogStore((s) => s.remove);

// Alert も他で使っていなければ import から削除
import { Alert, FlatList, Pressable } from 'react-native';
// → import { FlatList, Pressable } from 'react-native';
```

- [ ] **Step 4: `renderItem` の `Pressable` を編集遷移に変更する**

```tsx
// 変更前
<Pressable onLongPress={() => handleLongPress(item.id)}>

// 変更後
<Pressable onPress={() => router.push(`/practice-log-form?id=${item.id}`)}>
```

- [ ] **Step 5: lint / format / tsc / test を全て通す**

```bash
npm run lint && npm run format:check && npx tsc --noEmit && npm test
```

期待出力: エラー 0 件、全テストパス

- [ ] **Step 6: コミット**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat: 練習記録一覧にタップで編集遷移を追加しロングプレス削除を廃止"
```

---

## Task 9: 楽器写真 — パッケージ・スキーマ・ユニットテスト

**Files:**

- Modify: `forms/equipment.ts`
- Modify: `forms/__tests__/equipment.test.ts`

- [ ] **Step 1: パッケージをインストールする**

```bash
npx expo install expo-image-picker expo-file-system
```

期待出力: `node_modules` に追加される、`package.json` の dependencies が更新される

- [ ] **Step 2: `forms/equipment.ts` の `instrumentItemSchema` に `photoUri` を追加する**

```ts
export const instrumentItemSchema = z.object({
  makerId: z.string().min(1, 'メーカーを選択してください'),
  makerName: z.string().min(1),
  modelId: z.string().min(1, '機種名を選択してください'),
  modelName: z.string().min(1),
  purchasePrice: z.number().optional(),
  startDate: startDateSchema,
  photoUri: z.string().optional(),
});
```

- [ ] **Step 3: `forms/__tests__/equipment.test.ts` に `photoUri` のテストを追加する**

```ts
describe('clarinetEquipmentSchema / instrument.photoUri', () => {
  it('photoUri が省略されてもバリデーションが通る', () => {
    const result = clarinetEquipmentSchema.safeParse(validEquipment);
    expect(result.success).toBe(true);
  });

  it('photoUri が文字列であればバリデーションが通る', () => {
    const result = clarinetEquipmentSchema.safeParse({
      ...validEquipment,
      instrument: { ...validEquipment.instrument, photoUri: '/path/to/photo.jpg' },
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 4: テストが全件パスすることを確認する**

```bash
npx jest forms/__tests__/equipment.test.ts
```

期待出力: `Tests: X passed`

- [ ] **Step 5: lint / format / tsc を確認する**

```bash
npm run lint && npm run format:check && npx tsc --noEmit
```

期待出力: エラー 0 件

- [ ] **Step 6: コミット**

```bash
git add forms/equipment.ts forms/__tests__/equipment.test.ts package.json package-lock.json
git commit -m "feat: 楽器スキーマに photoUri を追加し expo-image-picker / expo-file-system を導入"
```

---

## Task 10: 楽器写真フォーム UI

**Files:**

- Modify: `components/equipment-form.tsx`

- [ ] **Step 1: import に必要なモジュールを追加する**

```ts
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { ActionSheetIOS, Alert, Image, Platform, ScrollView } from 'react-native';
```

既存の `import { Alert, Platform, ScrollView } from 'react-native'` を上記に置き換える。

- [ ] **Step 2: `EquipmentForm` コンポーネント内に写真ハンドラを追加する**

`showInstrumentPicker` state の定義の直後に追加する:

```ts
const photoUri = watch('instrument.photoUri');

const savePhoto = async (tempUri: string) => {
  const filename = tempUri.split('/').pop() ?? `clarinet-photo-${Date.now()}.jpg`;
  const destUri = `${FileSystem.documentDirectory}${filename}`;
  await FileSystem.copyAsync({ from: tempUri, to: destUri });
  setValue('instrument.photoUri', destUri, { shouldValidate: true });
};

const handleCamera = async () => {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('カメラへのアクセスが必要です', 'システム設定で許可してください');
    return;
  }
  const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
  if (!result.canceled) {
    await savePhoto(result.assets[0].uri);
  }
};

const handleLibrary = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('写真ライブラリへのアクセスが必要です', 'システム設定で許可してください');
    return;
  }
  const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
  if (!result.canceled) {
    await savePhoto(result.assets[0].uri);
  }
};

const showPhotoOptions = () => {
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['キャンセル', 'カメラで撮影', 'ライブラリから選択'],
        cancelButtonIndex: 0,
      },
      (index) => {
        if (index === 1) handleCamera();
        if (index === 2) handleLibrary();
      },
    );
  } else {
    Alert.alert('写真を選択', undefined, [
      { text: 'キャンセル', style: 'cancel' },
      { text: 'カメラで撮影', onPress: handleCamera },
      { text: 'ライブラリから選択', onPress: handleLibrary },
    ]);
  }
};
```

- [ ] **Step 3: 楽器カードの使用開始日フィールド直後に写真セクションを追加する**

`<FieldError message={errors.instrument?.startDate?.message} />` と `{instrumentUsagePeriod && ...}` の末尾 `</YStack>` の後、楽器カード `</Card>` の閉じタグ前に追加する:

```tsx
{
  Platform.OS !== 'web' && (
    <YStack gap="$2">
      <Paragraph color="$color12">楽器の写真（任意）</Paragraph>
      {photoUri ? (
        <XStack gap="$3" items="center" p="$3" bg="$color2" rounded="$3">
          <Image
            source={{ uri: photoUri }}
            style={{ width: 72, height: 72, borderRadius: 8 }}
            accessibilityLabel="楽器の写真"
          />
          <YStack flex={1} gap="$2">
            <Button size="$2" onPress={showPhotoOptions} aria-label="写真を変更">
              写真を変更
            </Button>
            <Button
              size="$2"
              theme="red"
              variant="outlined"
              onPress={() => setValue('instrument.photoUri', undefined, { shouldValidate: true })}
              aria-label="写真を削除"
            >
              ✕ 削除
            </Button>
          </YStack>
        </XStack>
      ) : (
        <Pressable onPress={showPhotoOptions} aria-label="楽器の写真を追加">
          <XStack
            gap="$3"
            items="center"
            p="$3"
            bg="$color2"
            rounded="$3"
            borderWidth={1}
            borderColor="$borderColor"
          >
            <Paragraph fontSize="$6">📷</Paragraph>
            <YStack>
              <Paragraph fontWeight="bold">楽器の写真を追加</Paragraph>
              <Paragraph fontSize="$2" color="$color10">
                タップして撮影またはライブラリから選択
              </Paragraph>
            </YStack>
          </XStack>
        </Pressable>
      )}
    </YStack>
  );
}
```

`Pressable` は既存のファイルで使われていないため、React Native の import に追加済みであることを確認する（Step 1 で追加済み）。

- [ ] **Step 4: lint / format / tsc / test を全て通す**

```bash
npm run lint && npm run format:check && npx tsc --noEmit && npm test
```

期待出力: エラー 0 件、全テストパス

- [ ] **Step 5: コミット**

```bash
git add components/equipment-form.tsx
git commit -m "feat: 楽器登録フォームに写真撮影・ライブラリ選択機能を追加"
```
