# 練習記録 総練習時間・その他内容・楽器使用期間・ブルーデザイン 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 練習記録に「その他練習内容」テキストと「総練習時間」を追加し、楽器情報の使用期間を拡張し、アクセントカラーをブルーに変更する。

**Architecture:** DB に `other_memo` / `total_minutes` カラムを追加し、Zustand ストアと Zod スキーマを更新する。フォームコンポーネント・一覧画面・楽器フォームはそれぞれ独立して変更し、最後に Tamagui の `<Theme name="blue">` でブルーアクセントを適用する。

**Tech Stack:** Expo / React Native, React Hook Form + Zod, Tamagui, Zustand v5, Supabase

---

### Task 1: DBマイグレーションを作成・適用する

**Files:**

- Create: `supabase/migrations/20260517000001_add_other_memo_and_total_minutes.sql`

- [ ] **Step 1: マイグレーションファイルを作成する**

```sql
-- supabase/migrations/20260517000001_add_other_memo_and_total_minutes.sql
ALTER TABLE practice_sessions ADD COLUMN other_memo text;
ALTER TABLE practice_sessions ADD COLUMN total_minutes integer;
```

- [ ] **Step 2: Supabase に適用する**

```bash
npx supabase db push
```

Expected: `Finished supabase db push.`（エラーなし）

- [ ] **Step 3: コミットする**

```bash
git add supabase/migrations/20260517000001_add_other_memo_and_total_minutes.sql
git commit -m "feat: practice_sessions に other_memo / total_minutes カラムを追加"
```

---

### Task 2: フォームスキーマを更新する

**Files:**

- Modify: `forms/practice-log.ts`

- [ ] **Step 1: `otherMemo` フィールドをスキーマに追加する**

`practiceLogSchema` に `otherMemo` を追加する。`memo` フィールドの直下に追加する。

```ts
export const practiceLogSchema = z.object({
  practicedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付を入力してください'),
  longToneMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
  tonguingMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
  tonguingTempoBpms: z.array(tonguingBpmEntrySchema).optional(),
  otherMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
  otherMemo: z.string().optional(),
  memo: z.string().optional(),
  textbookEntries: z.array(textbookEntrySchema),
});
```

- [ ] **Step 2: 型チェックを通す**

```bash
npx tsc --noEmit
```

Expected: エラー 0 件

- [ ] **Step 3: コミットする**

```bash
git add forms/practice-log.ts
git commit -m "feat: practiceLogSchema に otherMemo フィールドを追加"
```

---

### Task 3: ストアを更新する（型・fetchAll・add・update）

**Files:**

- Modify: `store/practice-log.ts`
- Modify: `store/__tests__/practice-log.test.ts`
- Modify: `__tests__/integration/practice-log-form.integration.test.tsx` （型エラー修正のみ）
- Modify: `__tests__/integration/practice-log-screen.integration.test.tsx` （型エラー修正のみ）
- Modify: `components/__tests__/practice-chart.test.ts` （型エラー修正のみ）

- [ ] **Step 1: `add` の `total_minutes` 保存を確認する失敗テストを書く**

`store/__tests__/practice-log.test.ts` に以下のテストを追加する（既存テストの末尾に）。

```ts
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
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest store/__tests__/practice-log -t "total_minutes"
```

Expected: FAIL（`totalMinutes` は `PracticeSession` に存在しない型エラー）

- [ ] **Step 3: `store/practice-log.ts` の型を更新する**

`SessionRow` 型に追加する：

```ts
type SessionRow = {
  id: string;
  practiced_at: string;
  duration_minutes: number | null;
  other_minutes: number | null;
  other_memo: string | null; // 追加
  total_minutes: number | null; // 追加
  memo: string | null;
  practice_session_textbooks: {
    textbook_id: string;
    current_page: number;
    duration_minutes: number | null;
    tempo_bpm: number | null;
    textbooks: { title: string; total_pages: number | null; genre: string } | null;
  }[];
  practice_session_basic_menus: {
    menu_type: string;
    duration_minutes: number;
    tempo_bpms: number[] | null;
  }[];
};
```

`PracticeSession` 型に追加する：

```ts
export type PracticeSession = {
  id: string;
  practicedAt: string;
  durationMinutes: number | null;
  otherMinutes: number | null;
  otherMemo: string | null; // 追加
  totalMinutes: number | null; // 追加
  memo: string | null;
  textbookEntries: TextbookEntry[];
  basicMenuEntries: BasicMenuEntry[];
};
```

- [ ] **Step 4: `fetchAll` の select クエリとマッピングを更新する**

select 文字列を更新する（`other_memo, total_minutes` を追加）：

```ts
const { data, error } = await supabase
  .from('practice_sessions')
  .select(
    'id, practiced_at, duration_minutes, other_minutes, other_memo, total_minutes, memo, ' +
      'practice_session_textbooks ( textbook_id, current_page, duration_minutes, tempo_bpm, textbooks ( title, total_pages, genre ) ), ' +
      'practice_session_basic_menus ( menu_type, duration_minutes, tempo_bpms )',
  )
  .order('practiced_at', { ascending: false });
```

マッピング部分に追加する：

```ts
sessions: rows.map((row) => ({
  id: row.id,
  practicedAt: row.practiced_at,
  durationMinutes: row.duration_minutes ?? null,
  otherMinutes: row.other_minutes ?? null,
  otherMemo: row.other_memo ?? null,       // 追加
  totalMinutes: row.total_minutes ?? null, // 追加
  memo: row.memo ?? null,
  textbookEntries: (row.practice_session_textbooks ?? []).map((entry) => ({
    textbookId: entry.textbook_id,
    textbookTitle: entry.textbooks?.title ?? '',
    currentPage: entry.current_page,
    totalPages: entry.textbooks?.total_pages ?? null,
    genre: entry.textbooks?.genre ?? 'その他',
    durationMinutes: entry.duration_minutes ?? null,
    tempoBpm: entry.tempo_bpm ?? null,
  })),
  basicMenuEntries: (row.practice_session_basic_menus ?? []).map((m) => ({
    menuType: m.menu_type,
    durationMinutes: m.duration_minutes,
    tempoBpms: m.tempo_bpms ?? [],
  })),
})),
```

- [ ] **Step 5: `add` 関数を更新する**

`add` 関数の冒頭（`totalDuration` 計算の直後）に `catalogTextbooks` の取得と `total_minutes` 計算を追加し、既存の `catalogTextbooks` 取得（関数末尾）を削除する：

```ts
add: async (input: PracticeLogInput) => {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) return;

  const totalDuration = (input.longToneMinutes ?? 0) + (input.tonguingMinutes ?? 0);

  // total_minutes 計算のため先に取得（関数末尾の取得を削除）
  const catalogTextbooks = useTextbookCatalogStore.getState().textbooks;
  const basicTextbookMinutes = input.textbookEntries
    .filter((e) => {
      const tb = catalogTextbooks.find((t) => t.id === e.textbookId);
      return tb != null && (BASIC_GENRES as readonly string[]).includes(tb.genre);
    })
    .reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);
  const nonBasicMinutes =
    input.textbookEntries
      .filter((e) => {
        const tb = catalogTextbooks.find((t) => t.id === e.textbookId);
        return tb == null || !(BASIC_GENRES as readonly string[]).includes(tb.genre);
      })
      .reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0) +
    (input.otherMinutes ?? 0);
  const totalMinutesValue =
    totalDuration + basicTextbookMinutes + nonBasicMinutes || null;

  const { data: session, error: sessionError } = await supabase
    .from('practice_sessions')
    .insert({
      user_id: userData.user.id,
      practiced_at: input.practicedAt,
      duration_minutes: totalDuration > 0 ? totalDuration : null,
      other_minutes: input.otherMinutes ?? null,
      other_memo: input.otherMemo || null,   // 追加
      total_minutes: totalMinutesValue,       // 追加
      memo: input.memo || null,
    })
    .select()
    .single();
  if (sessionError || !session) return;
  // ...（以降は既存コードと同じ）
```

`newSession` の構築部分にも追加する：

```ts
const newSession: PracticeSession = {
  id: sessionId,
  practicedAt: input.practicedAt,
  durationMinutes: totalDuration > 0 ? totalDuration : null,
  otherMinutes: input.otherMinutes ?? null,
  otherMemo: input.otherMemo || null, // 追加
  totalMinutes: totalMinutesValue, // 追加
  memo: input.memo || null,
  textbookEntries: input.textbookEntries.map((entry) => {
    const tb = catalogTextbooks.find((t) => t.id === entry.textbookId);
    const maxTempo = computeMaxTempo(entry.tempoBpms);
    return {
      textbookId: entry.textbookId,
      textbookTitle: tb?.title ?? '',
      currentPage: entry.currentPage,
      totalPages: tb?.totalPages ?? null,
      genre: tb?.genre ?? 'その他',
      durationMinutes: entry.durationMinutes ?? null,
      tempoBpm: maxTempo,
    };
  }),
  basicMenuEntries: basicMenuRows.map((r) => ({
    menuType: r.menu_type,
    durationMinutes: r.duration_minutes,
    tempoBpms: r.tempo_bpms ?? [],
  })),
};
```

既存の `const catalogTextbooks = useTextbookCatalogStore.getState().textbooks;`（関数末尾の行）を削除する。

- [ ] **Step 6: `update` 関数を更新する**

`update` 関数の冒頭に `catalogTextbooks` の取得と `totalMinutesValue` 計算を追加し、既存の取得行（末尾）を削除する：

```ts
update: async (id: string, input: PracticeLogInput) => {
  const totalDuration = (input.longToneMinutes ?? 0) + (input.tonguingMinutes ?? 0);

  // total_minutes 計算のため先に取得
  const catalogTextbooks = useTextbookCatalogStore.getState().textbooks;
  const basicTextbookMinutes = input.textbookEntries
    .filter((e) => {
      const tb = catalogTextbooks.find((t) => t.id === e.textbookId);
      return tb != null && (BASIC_GENRES as readonly string[]).includes(tb.genre);
    })
    .reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0);
  const nonBasicMinutes =
    input.textbookEntries
      .filter((e) => {
        const tb = catalogTextbooks.find((t) => t.id === e.textbookId);
        return tb == null || !(BASIC_GENRES as readonly string[]).includes(tb.genre);
      })
      .reduce((acc, e) => acc + (e.durationMinutes ?? 0), 0) +
    (input.otherMinutes ?? 0);
  const totalMinutesValue =
    totalDuration + basicTextbookMinutes + nonBasicMinutes || null;

  const { error: sessionError } = await supabase
    .from('practice_sessions')
    .update({
      practiced_at: input.practicedAt,
      duration_minutes: totalDuration > 0 ? totalDuration : null,
      other_minutes: input.otherMinutes ?? null,
      other_memo: input.otherMemo || null,   // 追加
      total_minutes: totalMinutesValue,       // 追加
      memo: input.memo || null,
    })
    .eq('id', id);
  if (sessionError) return;
  // ...（以降は既存コードと同じ）
```

`updatedSession` の構築部分にも追加する：

```ts
const updatedSession: PracticeSession = {
  id,
  practicedAt: input.practicedAt,
  durationMinutes: totalDuration > 0 ? totalDuration : null,
  otherMinutes: input.otherMinutes ?? null,
  otherMemo: input.otherMemo || null, // 追加
  totalMinutes: totalMinutesValue, // 追加
  memo: input.memo || null,
  textbookEntries: input.textbookEntries.map((entry) => {
    const tb = catalogTextbooks.find((t) => t.id === entry.textbookId);
    const maxTempo = computeMaxTempo(entry.tempoBpms);
    return {
      textbookId: entry.textbookId,
      textbookTitle: tb?.title ?? '',
      currentPage: entry.currentPage,
      totalPages: tb?.totalPages ?? null,
      genre: tb?.genre ?? 'その他',
      durationMinutes: entry.durationMinutes ?? null,
      tempoBpm: maxTempo,
    };
  }),
  basicMenuEntries: basicMenuRows.map((r) => ({
    menuType: r.menu_type,
    durationMinutes: r.duration_minutes,
    tempoBpms: r.tempo_bpms ?? [],
  })),
};
```

既存の `const catalogTextbooks = useTextbookCatalogStore.getState().textbooks;`（update 関数末尾）を削除する。

- [ ] **Step 7: 既存テストの型エラーを修正する**

`PracticeSession` 型に `otherMemo` と `totalMinutes` が必須になったため、直接オブジェクトを作っているテストを修正する。

`store/__tests__/practice-log.test.ts` 内の `const existing = { ... }` オブジェクト（`id: 'old'` を持つ）に追加：

```ts
const existing = {
  id: 'old',
  practicedAt: '2026-05-11',
  durationMinutes: null,
  otherMinutes: null,
  otherMemo: null, // 追加
  totalMinutes: null, // 追加
  memo: null,
  textbookEntries: [],
  basicMenuEntries: [],
};
```

`__tests__/integration/practice-log-screen.integration.test.tsx` の `makeSession` ヘルパーに追加：

```ts
// makeSession の戻り値オブジェクトに追加
otherMemo: null,
totalMinutes: null,
```

`components/__tests__/practice-chart.test.ts` の `PracticeSession` オブジェクトすべてに追加：

```ts
otherMemo: null,
totalMinutes: null,
```

`__tests__/integration/practice-log-form.integration.test.tsx` の `PracticeSession` オブジェクトすべてに追加：

```ts
otherMemo: null,
totalMinutes: null,
```

- [ ] **Step 8: テストを実行して通過を確認する**

```bash
npx jest store/__tests__/practice-log
```

Expected: PASS（新規2件を含む全テスト通過）

- [ ] **Step 9: コミットする**

```bash
git add store/practice-log.ts store/__tests__/practice-log.test.ts
git add __tests__/integration/practice-log-form.integration.test.tsx
git add __tests__/integration/practice-log-screen.integration.test.tsx
git add components/__tests__/practice-chart.test.ts
git commit -m "feat: ストアに otherMemo / totalMinutes を追加し add・update・fetchAll を更新"
```

---

### Task 4: フォームコンポーネントを更新する

**Files:**

- Modify: `components/practice-log-form.tsx`
- Modify: `__tests__/integration/practice-log-form.integration.test.tsx`

- [ ] **Step 1: 結合テストを追加する（失敗）**

`__tests__/integration/practice-log-form.integration.test.tsx` に以下のテストを追加する。既存の `describe` ブロックの末尾に追加する。

```tsx
describe('その他練習内容', () => {
  beforeEach(() => {
    usePracticeLogStore.setState({ sessions: [], loading: false });
    AsyncStorage.clear();
  });

  it('その他練習内容を入力して送信すると otherMemo が渡る', async () => {
    const handleSubmit = jest.fn();
    renderWithProviders(<PracticeLogForm onSubmit={handleSubmit} />);

    fireEvent.changeText(screen.getByLabelText('日付'), '2026-05-17');
    fireEvent.changeText(screen.getByLabelText('その他練習内容'), '曲の通し練習');
    fireEvent.press(screen.getByLabelText('保存'));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ otherMemo: '曲の通し練習' }),
      );
    });
  });
});

describe('フォームサマリー 合計表示', () => {
  beforeEach(() => {
    usePracticeLogStore.setState({ sessions: [], loading: false });
    AsyncStorage.clear();
  });

  it('longToneMinutes と otherMinutes を入力すると合計が表示される', async () => {
    renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);

    fireEvent.changeText(screen.getByLabelText('ロングトーン'), '20');
    fireEvent.changeText(screen.getByLabelText('その他'), '10');

    await waitFor(() => {
      expect(screen.getByText('合計: 30分')).toBeTruthy();
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest __tests__/integration/practice-log-form -t "その他練習内容|合計"
```

Expected: FAIL（`その他練習内容` の aria-label が存在しない）

- [ ] **Step 3: その他セクションに `otherMemo` 入力を追加する**

`components/practice-log-form.tsx` の `{/* その他 */}` セクションに Input を追加する。`<FieldError message={errors.otherMinutes?.message} />` の直後に追加する：

```tsx
{
  /* その他 */
}
<YStack gap="$2">
  <Paragraph color="$color12">その他</Paragraph>
  <Paragraph color="$color11" fontSize="$3">
    練習時間（分）任意
  </Paragraph>
  <TimerControl
    timerKey="other"
    label="その他"
    onStop={(minutes) => setValue('otherMinutes', minutes)}
  />
  <Controller
    control={control}
    name="otherMinutes"
    render={({ field: { onChange, onBlur, value } }) => (
      <Input
        value={value !== undefined ? String(value) : ''}
        onChangeText={(t) => {
          const n = Number(t);
          onChange(t === '' || isNaN(n) ? undefined : n);
        }}
        onBlur={onBlur}
        placeholder="例: 20"
        keyboardType="numeric"
        aria-label="その他"
      />
    )}
  />
  <FieldError message={errors.otherMinutes?.message} />
  <Paragraph color="$color11" fontSize="$3">
    練習内容（任意）
  </Paragraph>
  <Controller
    control={control}
    name="otherMemo"
    render={({ field: { onChange, onBlur, value } }) => (
      <Input
        value={value ?? ''}
        onChangeText={onChange}
        onBlur={onBlur}
        placeholder="例: 曲の通し練習、アンサンブルなど"
        aria-label="その他練習内容"
      />
    )}
  />
</YStack>;
```

- [ ] **Step 4: `defaultValues` に `otherMemo` を追加する**

`useForm` の `defaultValues` に追加する：

```ts
defaultValues: initialValues ?? {
  practicedAt: today(),
  longToneMinutes: undefined,
  tonguingMinutes: undefined,
  tonguingTempoBpms: [],
  otherMinutes: undefined,
  otherMemo: '',   // 追加
  memo: '',
  textbookEntries: lastTextbookEntries,
},
```

- [ ] **Step 5: サマリー行に合計を追加する**

既存のサマリー表示部分（`formBasicMinutes > 0 || formNonBasicMinutes > 0` の条件分岐）を以下に置き換える：

```tsx
{
  (formBasicMinutes > 0 || formNonBasicMinutes > 0) && (
    <YStack gap="$1">
      <Paragraph fontSize="$2" color="$color10">
        {[
          formBasicMinutes > 0 && `基礎: ${formBasicMinutes}分`,
          formNonBasicMinutes > 0 && `基礎練習以外: ${formNonBasicMinutes}分`,
        ]
          .filter(Boolean)
          .join(' / ')}
      </Paragraph>
      <Paragraph fontSize="$2" color="$blue9" fontWeight="bold">
        {`合計: ${formBasicMinutes + formNonBasicMinutes}分`}
      </Paragraph>
    </YStack>
  );
}
```

- [ ] **Step 6: テストを実行して通過を確認する**

```bash
npx jest __tests__/integration/practice-log-form
```

Expected: PASS（全テスト通過）

- [ ] **Step 7: コミットする**

```bash
git add components/practice-log-form.tsx __tests__/integration/practice-log-form.integration.test.tsx
git commit -m "feat: フォームに otherMemo 入力と合計サマリーを追加"
```

---

### Task 5: 編集画面の initialValues を更新する

**Files:**

- Modify: `app/practice-log-form.tsx`

- [ ] **Step 1: `initialValues` に `otherMemo` を追加する**

`editingSession` がある場合の `initialValues` オブジェクトに追加する：

```ts
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
      otherMinutes: editingSession.otherMinutes ?? undefined,
      otherMemo: editingSession.otherMemo ?? '', // 追加
      memo: editingSession.memo ?? '',
      textbookEntries: editingSession.textbookEntries.map((e) => ({
        textbookId: e.textbookId,
        currentPage: e.currentPage,
        durationMinutes: e.durationMinutes ?? undefined,
        tempoBpms: e.tempoBpm != null ? [{ bpm: e.tempoBpm }] : [],
      })),
    }
  : undefined;
```

- [ ] **Step 2: 型チェックを通す**

```bash
npx tsc --noEmit
```

Expected: エラー 0 件

- [ ] **Step 3: コミットする**

```bash
git add app/practice-log-form.tsx
git commit -m "feat: 編集画面の initialValues に otherMemo を追加"
```

---

### Task 6: 一覧画面を更新する

**Files:**

- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: 月ヘッダーの表示を変更する**

`formatTimeLabel` 関数の呼び出し部分（月ヘッダーの `Paragraph`）を `monthTotals.basic + monthTotals.nonBasic` の合計表示に置き換える。

変更前：

```tsx
<Paragraph fontSize="$2" color="$color10">
  {(() => {
    const label = formatTimeLabel(monthTotals.basic, monthTotals.nonBasic);
    return label
      ? `${monthSessions.length}回 / ${label}`
      : `${monthSessions.length}回 / 練習時間未記録`;
  })()}
</Paragraph>
```

変更後：

```tsx
<Paragraph fontSize="$2" color="$color10">
  {(() => {
    const total = monthTotals.basic + monthTotals.nonBasic;
    return total > 0
      ? `${monthSessions.length}回 / 合計: ${total}分`
      : `${monthSessions.length}回 / 練習時間未記録`;
  })()}
</Paragraph>
```

- [ ] **Step 2: 個別カードに合計と内訳を表示する**

カードの XStack（日付と時間ラベルの行）を変更する。

変更前：

```tsx
<XStack justify="space-between" items="baseline" mb="$1">
  <Paragraph fontWeight="bold">{`${item.practicedAt}（${dayOfWeek(item.practicedAt)}）`}</Paragraph>
  {(() => {
    const { basic, nonBasic } = calcSessionTime(item);
    const label = formatTimeLabel(basic, nonBasic);
    return label ? (
      <Paragraph fontSize="$2" color="$color10">
        {label}
      </Paragraph>
    ) : null;
  })()}
</XStack>
```

変更後：

```tsx
<XStack justify="space-between" items="baseline" mb="$1">
  <Paragraph fontWeight="bold">{`${item.practicedAt}（${dayOfWeek(item.practicedAt)}）`}</Paragraph>
  {(() => {
    const total = item.totalMinutes ?? calcSessionTime(item).basic + calcSessionTime(item).nonBasic;
    return total > 0 ? (
      <Paragraph fontSize="$2" color="$blue9" fontWeight="bold">
        {`合計: ${total}分`}
      </Paragraph>
    ) : null;
  })()}
</XStack>;
{
  (() => {
    const { basic, nonBasic } = calcSessionTime(item);
    const label = formatTimeLabel(basic, nonBasic);
    return label ? (
      <Paragraph fontSize="$2" color="$color10" mb="$1">
        {label}
      </Paragraph>
    ) : null;
  })();
}
```

- [ ] **Step 3: `otherMemo` 表示を追加する**

個別カードの `item.otherMinutes` 表示の直後に `otherMemo` 表示を追加する：

```tsx
{
  item.otherMinutes != null && (
    <Paragraph fontSize="$2" color="$color10">
      {`その他: ${item.otherMinutes}分`}
    </Paragraph>
  );
}
{
  item.otherMemo ? (
    <Paragraph fontSize="$2" color="$color11" numberOfLines={1}>
      {item.otherMemo}
    </Paragraph>
  ) : null;
}
```

- [ ] **Step 4: 型チェックを通す**

```bash
npx tsc --noEmit
```

Expected: エラー 0 件

- [ ] **Step 5: コミットする**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat: 一覧画面に総練習時間・内訳・その他練習内容を表示"
```

---

### Task 7: 楽器フォームにリード/リガチャー/マウスピースの使用期間を追加する

**Files:**

- Modify: `components/equipment-form.tsx`

- [ ] **Step 1: `watch` でセクションの `startDate` を取得する**

`OTHER_SECTIONS.map` のループが `watch` の結果にアクセスできるよう、`watch` を利用する。現在 `OTHER_SECTIONS.map` は各セクションの startDate を watch していない。ループ内の `Controller` の `render` prop 内で直接取得できるが、`calcUsagePeriod` を呼ぶために値が必要になる。

`EquipmentForm` コンポーネント内（`watch` が呼ばれている付近）で各セクションの値を取得する：

```ts
const reedStartDate = watch('reed.startDate');
const ligatureStartDate = watch('ligature.startDate');
const mouthpieceStartDate = watch('mouthpiece.startDate');

const sectionUsagePeriods: Record<string, string | null> = {
  reed: calcUsagePeriod(reedStartDate ?? ''),
  ligature: calcUsagePeriod(ligatureStartDate ?? ''),
  mouthpiece: calcUsagePeriod(mouthpieceStartDate ?? ''),
};
```

- [ ] **Step 2: ループ内で使用期間を表示する**

`OTHER_SECTIONS.map` ループの中で、`FieldError` の後に使用期間を表示する。startDate の `Controller` の `render` 内、`FieldError` の直後に追加する：

変更前（各セクションの startDate Controller の末尾部分）：

```tsx
<FieldError message={errors[section.key]?.startDate?.message} />
```

変更後：

```tsx
<FieldError message={errors[section.key]?.startDate?.message} />;
{
  sectionUsagePeriods[section.key] && (
    <Paragraph color="$color11" size="$2">
      使用期間: {sectionUsagePeriods[section.key]}
    </Paragraph>
  );
}
```

- [ ] **Step 3: 型チェックを通す**

```bash
npx tsc --noEmit
```

Expected: エラー 0 件

- [ ] **Step 4: コミットする**

```bash
git add components/equipment-form.tsx
git commit -m "feat: 楽器フォームのリード・リガチャー・マウスピースに使用期間を表示"
```

---

### Task 8: ブルーアクセントデザインを適用し品質チェックを行う

**Files:**

- Modify: `app/_layout.tsx`

- [ ] **Step 1: `Theme` をインポートして Stack をラップする**

`app/_layout.tsx` を以下に変更する：

```tsx
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { Theme, TamaguiProvider } from 'tamagui';

import { supabase } from '@/lib/supabase';
import { tamaguiConfig } from '@/tamagui.config';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/(auth)/sign-in');
      else router.replace('/(tabs)/');
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={colorScheme ?? 'light'}>
      <Theme name="blue">
        <Stack screenOptions={{ headerShown: false }} />
      </Theme>
    </TamaguiProvider>
  );
}
```

- [ ] **Step 2: 品質チェック 4 ステップをすべて通す**

```bash
npm run lint
```

Expected: エラー 0 件

```bash
npm run format:check
```

Expected: 差分 0 件（差分がある場合は `npm run format` で修正してから再実行）

```bash
npx tsc --noEmit
```

Expected: エラー 0 件

```bash
npm test
```

Expected: 全テスト PASS

- [ ] **Step 3: コミットする**

```bash
git add app/_layout.tsx
git commit -m "feat: ブルーアクセントデザインを適用"
```
