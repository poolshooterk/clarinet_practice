# 基礎練習メニュー追加 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 練習記録フォームにロングトーン・タンギングの基礎練習メニューを追加し、各メニューの練習時間（分）を記録できるようにする。

**Architecture:** 専用テーブル `practice_session_basic_menus (session_id, menu_type, duration_minutes)` を新設し、アプリ定数 `BASIC_MENUS` でメニュー種別を管理する。フォームの `durationMinutes` 手動入力を廃止し、基礎練習時間の合計を自動計算して `practice_sessions.duration_minutes` に保存する。

**Tech Stack:** Expo Router v6, Tamagui, React Hook Form + zod, Zustand v5, Supabase (PostgreSQL + RLS)

---

## ファイルマップ

| ファイル                                                                  | 変更種別 | 責務                                                                                                     |
| ------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260514000000_add_practice_session_basic_menus.sql` | 新規     | DBテーブル定義とRLS                                                                                      |
| `forms/practice-log.ts`                                                   | 変更     | スキーマから `durationMinutes` を削除し `longToneMinutes` / `tonguingMinutes` + `BASIC_MENUS` 定数を追加 |
| `forms/__tests__/practice-log.test.ts`                                    | 変更     | `durationMinutes` テストを削除し新フィールドのテストを追加                                               |
| `store/practice-log.ts`                                                   | 変更     | `PracticeSession` 型・`fetchAll`・`add` を更新                                                           |
| `store/__tests__/practice-log.test.ts`                                    | 変更     | `add` / `fetchAll` テストを新スキーマに合わせて更新                                                      |
| `components/practice-log-form.tsx`                                        | 変更     | `durationMinutes` フィールドを削除し基礎練習セクションを追加                                             |
| `__tests__/integration/practice-log-form.integration.test.tsx`            | 変更     | `durationMinutes` テストを削除し新フィールドのテストを追加                                               |
| `app/(tabs)/index.tsx`                                                    | 変更     | セッションカードに基礎練習表示を追加                                                                     |
| `docs/superpowers/specs/2026-05-14-basic-practice-menus-design.md`        | 新規     | 設計ドキュメント                                                                                         |
| `docs/superpowers/plans/2026-05-14-basic-practice-menus.md`               | 新規     | 本計画書のコピー保存                                                                                     |

---

## Task 1: 設計ドキュメントと計画書を保存

**Files:**

- Create: `docs/superpowers/specs/2026-05-14-basic-practice-menus-design.md`
- Create: `docs/superpowers/plans/2026-05-14-basic-practice-menus.md`

- [ ] **Step 1: spec ドキュメントを作成**

```bash
cat > docs/superpowers/specs/2026-05-14-basic-practice-menus-design.md << 'EOF'
# 基礎練習メニュー追加 設計ドキュメント

## 概要

練習記録フォームにロングトーン・タンギングの基礎練習メニューを追加し、
各メニューの練習時間（分）を記録できるようにする。

## 設計決定

- メニューはフォームに常時表示（追加・削除操作なし）
- `durationMinutes` 手動入力を廃止し、基礎練習合計を自動計算
- DB: 専用テーブル `practice_session_basic_menus` (Approach B) で将来の拡張に対応
- アプリ定数 `BASIC_MENUS` でメニュー種別を管理し、追加時はこの配列に追記するだけでよい

## データモデル

```

practice_sessions
id, user_id, practiced_at, duration_minutes (合計), memo, created_at

practice_session_basic_menus
id, session_id (→ practice_sessions), menu_type VARCHAR, duration_minutes INT
UNIQUE (session_id, menu_type)

```

## フォームスキーマ変更

変更前: { practicedAt, durationMinutes?, memo, textbookEntries }
変更後: { practicedAt, longToneMinutes?, tonguingMinutes?, memo, textbookEntries }

## UI 変更

- 「練習時間（分）任意」フィールドを削除
- 「基礎練習」セクションを追加（ロングトーン・タンギングの分数入力）
- 合計 > 0 の場合「合計: X分」を表示
- 一覧画面のセッションカードに基礎練習時間を表示
EOF
```

- [ ] **Step 2: 計画書ファイルを plans ディレクトリにコピー**

```bash
cp /home/kasahara/.claude/plans/dazzling-marinating-hopcroft.md \
   docs/superpowers/plans/2026-05-14-basic-practice-menus.md
```

- [ ] **Step 3: コミット**

```bash
git add docs/superpowers/specs/2026-05-14-basic-practice-menus-design.md \
        docs/superpowers/plans/2026-05-14-basic-practice-menus.md
git commit -m "docs: 基礎練習メニュー追加の設計ドキュメントと計画書を追加"
```

---

## Task 2: Supabase マイグレーション

**Files:**

- Create: `supabase/migrations/20260514000000_add_practice_session_basic_menus.sql`

- [ ] **Step 1: マイグレーションファイルを作成**

```bash
cat > supabase/migrations/20260514000000_add_practice_session_basic_menus.sql << 'EOF'
CREATE TABLE practice_session_basic_menus (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  menu_type        VARCHAR NOT NULL,
  duration_minutes INT NOT NULL CHECK (duration_minutes >= 1),
  UNIQUE (session_id, menu_type)
);

ALTER TABLE practice_session_basic_menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own basic menus"
  ON practice_session_basic_menus FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE practice_sessions.id = practice_session_basic_menus.session_id
        AND practice_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own basic menus"
  ON practice_session_basic_menus FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE practice_sessions.id = practice_session_basic_menus.session_id
        AND practice_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own basic menus"
  ON practice_session_basic_menus FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM practice_sessions
      WHERE practice_sessions.id = practice_session_basic_menus.session_id
        AND practice_sessions.user_id = auth.uid()
    )
  );
EOF
```

- [ ] **Step 2: マイグレーションをリモートに適用**

```bash
supabase db push
```

Expected: `Applying migration 20260514000000_add_practice_session_basic_menus.sql...` が出力され、エラーなし

- [ ] **Step 3: コミット**

```bash
git add supabase/migrations/20260514000000_add_practice_session_basic_menus.sql
git commit -m "feat: practice_session_basic_menus テーブルを追加"
```

---

## Task 3: forms/practice-log.ts を更新 (TDD)

**Files:**

- Modify: `forms/__tests__/practice-log.test.ts`
- Modify: `forms/practice-log.ts`

現在のスキーマ: `{ practicedAt, durationMinutes?, memo, textbookEntries }`
新スキーマ: `{ practicedAt, longToneMinutes?, tonguingMinutes?, memo, textbookEntries }`

- [ ] **Step 1: 失敗するテストを書く**

`forms/__tests__/practice-log.test.ts` を以下の内容に置き換える:

```typescript
import { BASIC_MENUS, practiceLogSchema, today } from '@/forms/practice-log';

describe('practiceLogSchema', () => {
  describe('有効なケース', () => {
    it('最小限: practicedAt と空の textbookEntries のみ', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        textbookEntries: [],
      });
      expect(result.success).toBe(true);
    });

    it('全項目あり', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        longToneMinutes: 15,
        tonguingMinutes: 10,
        memo: 'テスト',
        textbookEntries: [{ textbookId: '123e4567-e89b-12d3-a456-426614174001', currentPage: 5 }],
      });
      expect(result.success).toBe(true);
    });
  });

  describe('practicedAt', () => {
    it('空文字はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '',
        textbookEntries: [],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('日付を入力してください');
    });

    it('YYYY/MM/DD 形式はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026/05/12',
        textbookEntries: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('longToneMinutes', () => {
    it('省略可能', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        textbookEntries: [],
      });
      expect(result.success).toBe(true);
    });

    it('1 は有効', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        longToneMinutes: 1,
        textbookEntries: [],
      });
      expect(result.success).toBe(true);
    });

    it('0 はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        longToneMinutes: 0,
        textbookEntries: [],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('1以上の整数を入力してください');
    });

    it('負数はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        longToneMinutes: -1,
        textbookEntries: [],
      });
      expect(result.success).toBe(false);
    });

    it('小数はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        longToneMinutes: 1.5,
        textbookEntries: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('tonguingMinutes', () => {
    it('省略可能', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        textbookEntries: [],
      });
      expect(result.success).toBe(true);
    });

    it('1 は有効', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        tonguingMinutes: 1,
        textbookEntries: [],
      });
      expect(result.success).toBe(true);
    });

    it('0 はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        tonguingMinutes: 0,
        textbookEntries: [],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('1以上の整数を入力してください');
    });

    it('小数はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        tonguingMinutes: 1.5,
        textbookEntries: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('textbookEntries', () => {
    it('UUID でない textbookId はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        textbookEntries: [{ textbookId: 'not-uuid', currentPage: 0 }],
      });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0].message).toBe('教本を選択してください');
    });

    it('currentPage が負数はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        textbookEntries: [{ textbookId: '123e4567-e89b-12d3-a456-426614174001', currentPage: -1 }],
      });
      expect(result.success).toBe(false);
    });

    it('currentPage が小数はエラー', () => {
      const result = practiceLogSchema.safeParse({
        practicedAt: '2026-05-12',
        textbookEntries: [{ textbookId: '123e4567-e89b-12d3-a456-426614174001', currentPage: 1.5 }],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('BASIC_MENUS', () => {
    it('long_tone と tonguing が含まれる', () => {
      const types = BASIC_MENUS.map((m) => m.type);
      expect(types).toContain('long_tone');
      expect(types).toContain('tonguing');
    });

    it('各メニューに label がある', () => {
      for (const menu of BASIC_MENUS) {
        expect(menu.label).toBeTruthy();
      }
    });
  });
});

describe('today()', () => {
  it('YYYY-MM-DD 形式で返す', () => {
    const result = today();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest forms/__tests__/practice-log.test.ts
```

Expected: `BASIC_MENUS` が存在しないためインポートエラー、または `longToneMinutes` が unknown field でエラー

- [ ] **Step 3: forms/practice-log.ts を更新**

```typescript
import { z } from 'zod';

export const BASIC_MENUS = [
  { type: 'long_tone', label: 'ロングトーン' },
  { type: 'tonguing', label: 'タンギング' },
] as const;

export type BasicMenuType = (typeof BASIC_MENUS)[number]['type'];

const textbookEntrySchema = z.object({
  textbookId: z.string().uuid('教本を選択してください'),
  currentPage: z.number().int().min(0, '0以上の整数を入力してください'),
});

export const practiceLogSchema = z.object({
  practicedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日付を入力してください'),
  longToneMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
  tonguingMinutes: z.number().int().min(1, '1以上の整数を入力してください').optional(),
  memo: z.string().optional(),
  textbookEntries: z.array(textbookEntrySchema),
});

export type PracticeLogInput = z.infer<typeof practiceLogSchema>;

export function today(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest forms/__tests__/practice-log.test.ts
```

Expected: 全件 PASS

- [ ] **Step 5: コミット**

```bash
git add forms/practice-log.ts forms/__tests__/practice-log.test.ts
git commit -m "feat: practiceLogSchema に longToneMinutes / tonguingMinutes を追加し durationMinutes を削除"
```

---

## Task 4: store/practice-log.ts を更新 (TDD)

**Files:**

- Modify: `store/__tests__/practice-log.test.ts`
- Modify: `store/practice-log.ts`

- [ ] **Step 1: 失敗するテストを書く**

`store/__tests__/practice-log.test.ts` を以下の内容に置き換える:

```typescript
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
              duration_minutes: 25,
              memo: 'テスト',
              practice_session_textbooks: [
                {
                  textbook_id: 'tb-1',
                  current_page: 14,
                  textbooks: { title: 'ローズ 32のエチュード', total_pages: 32 },
                },
              ],
              practice_session_basic_menus: [
                { menu_type: 'long_tone', duration_minutes: 15 },
                { menu_type: 'tonguing', duration_minutes: 10 },
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
    });
    expect(sessions[0].basicMenuEntries).toEqual([
      { menuType: 'long_tone', durationMinutes: 15 },
      { menuType: 'tonguing', durationMinutes: 10 },
    ]);
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
      { menuType: 'long_tone', durationMinutes: 15 },
      { menuType: 'tonguing', durationMinutes: 10 },
    ]);
    expect(sessions[0].textbookEntries[0]).toMatchObject({
      textbookId: 'tb-1',
      textbookTitle: 'ローズ 32のエチュード',
      currentPage: 14,
      totalPages: 32,
    });
    expect(sessions[1].id).toBe('old');
    expect(mockProgress().getState().upsert).toHaveBeenCalledWith('tb-1', 14);
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

  it('remove で対象セッションが削除される', async () => {
    usePracticeLogStore.setState({
      sessions: [
        {
          id: 'session-1',
          practicedAt: '2026-05-12',
          durationMinutes: null,
          memo: null,
          textbookEntries: [],
          basicMenuEntries: [],
        },
        {
          id: 'session-2',
          practicedAt: '2026-05-11',
          durationMinutes: null,
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
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest store/__tests__/practice-log.test.ts
```

Expected: `basicMenuEntries` が `PracticeSession` 型に存在しないため型エラーまたはアサーション失敗

- [ ] **Step 3: store/practice-log.ts を更新**

```typescript
import { create } from 'zustand';

import { type PracticeLogInput } from '@/forms/practice-log';
import { supabase } from '@/lib/supabase';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';
import { useTextbookProgressStore } from '@/store/textbook-progress';

type TextbookEntry = {
  textbookId: string;
  textbookTitle: string;
  currentPage: number;
  totalPages: number | null;
};

type BasicMenuEntry = {
  menuType: string;
  durationMinutes: number;
};

export type PracticeSession = {
  id: string;
  practicedAt: string;
  durationMinutes: number | null;
  memo: string | null;
  textbookEntries: TextbookEntry[];
  basicMenuEntries: BasicMenuEntry[];
};

type SessionRow = {
  id: string;
  practiced_at: string;
  duration_minutes: number | null;
  memo: string | null;
  practice_session_textbooks: {
    textbook_id: string;
    current_page: number;
    textbooks: { title: string; total_pages: number | null } | null;
  }[];
  practice_session_basic_menus: {
    menu_type: string;
    duration_minutes: number;
  }[];
};

type PracticeLogState = {
  sessions: PracticeSession[];
  loading: boolean;
  fetchAll: () => Promise<void>;
  add: (input: PracticeLogInput) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

export const usePracticeLogStore = create<PracticeLogState>()((set, get) => ({
  sessions: [],
  loading: false,

  fetchAll: async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    set({ loading: true });
    const { data, error } = await supabase
      .from('practice_sessions')
      .select(
        'id, practiced_at, duration_minutes, memo, ' +
          'practice_session_textbooks ( textbook_id, current_page, textbooks ( title, total_pages ) ), ' +
          'practice_session_basic_menus ( menu_type, duration_minutes )',
      )
      .order('practiced_at', { ascending: false });
    set({ loading: false });

    if (error || !data) return;

    const rows = data as unknown as SessionRow[];
    set({
      sessions: rows.map((row) => ({
        id: row.id,
        practicedAt: row.practiced_at,
        durationMinutes: row.duration_minutes ?? null,
        memo: row.memo ?? null,
        textbookEntries: (row.practice_session_textbooks ?? []).map((entry) => ({
          textbookId: entry.textbook_id,
          textbookTitle: entry.textbooks?.title ?? '',
          currentPage: entry.current_page,
          totalPages: entry.textbooks?.total_pages ?? null,
        })),
        basicMenuEntries: (row.practice_session_basic_menus ?? []).map((m) => ({
          menuType: m.menu_type,
          durationMinutes: m.duration_minutes,
        })),
      })),
    });
  },

  add: async (input: PracticeLogInput) => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const totalDuration = (input.longToneMinutes ?? 0) + (input.tonguingMinutes ?? 0);

    const { data: session, error: sessionError } = await supabase
      .from('practice_sessions')
      .insert({
        user_id: userData.user.id,
        practiced_at: input.practicedAt,
        duration_minutes: totalDuration > 0 ? totalDuration : null,
        memo: input.memo || null,
      })
      .select()
      .single();
    if (sessionError || !session) return;

    const sessionId = (session as { id: string }).id;

    if (input.textbookEntries.length > 0) {
      const { error: entriesError } = await supabase.from('practice_session_textbooks').insert(
        input.textbookEntries.map((entry) => ({
          session_id: sessionId,
          textbook_id: entry.textbookId,
          current_page: entry.currentPage,
        })),
      );
      if (entriesError) {
        await supabase.from('practice_sessions').delete().eq('id', sessionId);
        return;
      }

      for (const entry of input.textbookEntries) {
        await useTextbookProgressStore.getState().upsert(entry.textbookId, entry.currentPage);
      }
    }

    const basicMenuRows = (
      [
        input.longToneMinutes != null
          ? {
              session_id: sessionId,
              menu_type: 'long_tone',
              duration_minutes: input.longToneMinutes,
            }
          : null,
        input.tonguingMinutes != null
          ? {
              session_id: sessionId,
              menu_type: 'tonguing',
              duration_minutes: input.tonguingMinutes,
            }
          : null,
      ] as const
    ).filter((r): r is NonNullable<typeof r> => r !== null);

    if (basicMenuRows.length > 0) {
      const { error: basicError } = await supabase
        .from('practice_session_basic_menus')
        .insert(basicMenuRows);
      if (basicError) {
        await supabase.from('practice_sessions').delete().eq('id', sessionId);
        return;
      }
    }

    const catalogTextbooks = useTextbookCatalogStore.getState().textbooks;
    const newSession: PracticeSession = {
      id: sessionId,
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
        };
      }),
      basicMenuEntries: basicMenuRows.map((r) => ({
        menuType: r.menu_type,
        durationMinutes: r.duration_minutes,
      })),
    };
    set({ sessions: [newSession, ...get().sessions] });
  },

  remove: async (id: string) => {
    const { error } = await supabase.from('practice_sessions').delete().eq('id', id);
    if (error) return;
    set({ sessions: get().sessions.filter((s) => s.id !== id) });
  },
}));
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest store/__tests__/practice-log.test.ts
```

Expected: 全件 PASS

- [ ] **Step 5: コミット**

```bash
git add store/practice-log.ts store/__tests__/practice-log.test.ts
git commit -m "feat: store に basicMenuEntries を追加し add/fetchAll を基礎練習テーブルに対応"
```

---

## Task 5: PracticeLogForm コンポーネントを更新 (TDD)

**Files:**

- Modify: `__tests__/integration/practice-log-form.integration.test.tsx`
- Modify: `components/practice-log-form.tsx`

- [ ] **Step 1: 失敗するテストを書く**

`__tests__/integration/practice-log-form.integration.test.tsx` を以下に置き換える:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, waitFor } from '@testing-library/react-native';

import { PracticeLogForm } from '@/components/practice-log-form';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  router: { back: jest.fn() },
  useFocusEffect: () => {},
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

// Select は Portal を使うため jest 環境では PortalProvider が不足してエラーになる。
// テスト対象は RHF の Controller 配線であり Select の UI 自体ではないため、
// onValueChange を直接受け取れるシンプルなコンポーネントに差し替える。
jest.mock('tamagui', () => {
  const actual = jest.requireActual('tamagui');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const RN = require('react-native');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');

  const MockSelectContext = React.createContext(null);

  function MockSelectTrigger(props: any) {
    const ctx = React.useContext(MockSelectContext);
    return React.createElement(
      RN.View,
      { accessibilityLabel: props['aria-label'], onValueChange: ctx?.onValueChange },
      props.children,
    );
  }

  function MockSelect(props: any) {
    return React.createElement(
      MockSelectContext.Provider,
      { value: { onValueChange: props.onValueChange } },
      React.createElement(RN.View, null, props.children),
    );
  }

  function MockSelectValue() { return null; }
  function MockSelectContent() { return null; }
  function MockSelectScrollUpButton() { return null; }
  function MockSelectViewport() { return null; }
  function MockSelectItem() { return null; }
  function MockSelectItemText() { return null; }
  function MockSelectScrollDownButton() { return null; }

  MockSelect.Trigger = MockSelectTrigger;
  MockSelect.Value = MockSelectValue;
  MockSelect.Content = MockSelectContent;
  MockSelect.ScrollUpButton = MockSelectScrollUpButton;
  MockSelect.Viewport = MockSelectViewport;
  MockSelect.Item = MockSelectItem;
  MockSelect.ItemText = MockSelectItemText;
  MockSelect.ScrollDownButton = MockSelectScrollDownButton;

  return { ...actual, Select: MockSelect };
});

const TB1_ID = '123e4567-e89b-12d3-a456-426614174001';

describe('PracticeLogForm (integration)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useTextbookCatalogStore.setState({
      textbooks: [
        { id: TB1_ID, title: 'ローズ 32のエチュード', publisher: null, difficulty: null, totalPages: 32 },
        { id: '123e4567-e89b-12d3-a456-426614174002', title: 'アルテ教則本 第1巻', publisher: null, difficulty: null, totalPages: 120 },
      ],
      loading: false,
    });
    jest.clearAllMocks();
  });

  it('practicedAt を空にして保存するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('日付'), '');
    fireEvent.press(screen.getByLabelText('保存'));
    await waitFor(() => {
      expect(screen.getByText('日付を入力してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('ロングトーンに 0 を入力して保存するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('ロングトーン'), '0');
    fireEvent.press(screen.getByLabelText('保存'));
    await waitFor(() => {
      expect(screen.getByText('1以上の整数を入力してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('タンギングに 0 を入力して保存するとバリデーションエラーが表示される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);
    fireEvent.changeText(screen.getByLabelText('タンギング'), '0');
    fireEvent.press(screen.getByLabelText('保存'));
    await waitFor(() => {
      expect(screen.getByText('1以上の整数を入力してください')).toBeTruthy();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('教本エントリの追加・削除が動作する', async () => {
    renderWithProviders(<PracticeLogForm onSubmit={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('教本を追加'));
    expect(screen.getByLabelText('エントリ 1 を削除')).toBeTruthy();
    expect(screen.getByLabelText('教本を選択 1')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('エントリ 1 を削除'));
    await waitFor(() => {
      expect(screen.queryByLabelText('エントリ 1 を削除')).toBeNull();
      expect(screen.queryByLabelText('教本を選択 1')).toBeNull();
    });
  });

  it('基礎練習と教本エントリを入力して保存すると onSubmit に正しい値が渡される', async () => {
    const onSubmit = jest.fn();
    renderWithProviders(<PracticeLogForm onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByLabelText('ロングトーン'), '15');
    fireEvent.changeText(screen.getByLabelText('タンギング'), '10');

    fireEvent.press(screen.getByLabelText('教本を追加'));
    await waitFor(() => {
      expect(screen.getByLabelText('教本を選択 1')).toBeTruthy();
    });
    const trigger = screen.getByLabelText('教本を選択 1');
    await act(async () => {
      await trigger.props.onValueChange?.(TB1_ID);
    });
    fireEvent.changeText(screen.getByLabelText('ページ 1'), '14');

    fireEvent.press(screen.getByLabelText('保存'));
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      longToneMinutes: 15,
      tonguingMinutes: 10,
      textbookEntries: [{ textbookId: TB1_ID, currentPage: 14 }],
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest __tests__/integration/practice-log-form.integration.test.tsx
```

Expected: `getByLabelText('ロングトーン')` / `getByLabelText('タンギング')` が見つからずエラー

- [ ] **Step 3: components/practice-log-form.tsx を更新**

```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { Platform, ScrollView } from 'react-native';
import { Button, Input, Paragraph, Select, XStack, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import {
  BASIC_MENUS,
  formatDate,
  type PracticeLogInput,
  practiceLogSchema,
  today,
} from '@/forms/practice-log';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';

type Props = {
  onSubmit: (data: PracticeLogInput) => void | Promise<void>;
};

export type PracticeLogFormRef = {
  submit: () => void;
};

export const PracticeLogForm = forwardRef<PracticeLogFormRef, Props>(function PracticeLogForm(
  { onSubmit },
  ref,
) {
  const textbooks = useTextbookCatalogStore((s) => s.textbooks);
  const [showPicker, setShowPicker] = useState(false);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<PracticeLogInput>({
    resolver: zodResolver(practiceLogSchema),
    mode: 'onTouched',
    defaultValues: {
      practicedAt: today(),
      longToneMinutes: undefined,
      tonguingMinutes: undefined,
      memo: '',
      textbookEntries: [],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'textbookEntries' });
  const watchedEntries = watch('textbookEntries') ?? [];
  const watchedLongTone = watch('longToneMinutes');
  const watchedTonguing = watch('tonguingMinutes');
  const totalMinutes = (watchedLongTone ?? 0) + (watchedTonguing ?? 0);

  const submitForm = handleSubmit(onSubmit);
  useImperativeHandle(ref, () => ({ submit: submitForm }));

  return (
    <ScrollView>
      <YStack gap="$4" p="$4">
        {/* 日付 */}
        <Controller
          control={control}
          name="practicedAt"
          render={({ field: { onChange, onBlur, value } }) => (
            <YStack gap="$1">
              <Paragraph color="$color12">日付 *</Paragraph>
              <XStack gap="$2" items="center">
                <Input
                  flex={1}
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  placeholder="YYYY-MM-DD"
                  aria-label="日付"
                />
                {Platform.OS !== 'web' && (
                  <Button size="$2" onPress={() => setShowPicker(true)} aria-label="カレンダー">
                    カレンダー
                  </Button>
                )}
              </XStack>
              {showPicker && Platform.OS !== 'web' && (
                <DateTimePicker
                  value={(() => {
                    const parts = value.split('-');
                    if (parts.length === 3) {
                      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
                    }
                    return new Date();
                  })()}
                  mode="date"
                  onChange={(_, date) => {
                    setShowPicker(false);
                    if (date) onChange(formatDate(date));
                  }}
                />
              )}
              <FieldError message={errors.practicedAt?.message} />
            </YStack>
          )}
        />

        {/* 基礎練習 */}
        <YStack gap="$2">
          <Paragraph color="$color12">基礎練習</Paragraph>

          {BASIC_MENUS.map(({ type, label }) => {
            const fieldName = type === 'long_tone' ? 'longToneMinutes' : 'tonguingMinutes';
            const ariaLabel = type === 'long_tone' ? 'ロングトーン' : 'タンギング';
            return (
              <Controller
                key={type}
                control={control}
                name={fieldName}
                render={({ field: { onChange, onBlur, value } }) => (
                  <YStack gap="$1">
                    <Paragraph color="$color11" fontSize="$3">
                      {label}（分）任意
                    </Paragraph>
                    <Input
                      value={value !== undefined ? String(value) : ''}
                      onChangeText={(t) => {
                        const n = Number(t);
                        onChange(t === '' || isNaN(n) ? undefined : n);
                      }}
                      onBlur={onBlur}
                      placeholder="例: 10"
                      keyboardType="numeric"
                      aria-label={ariaLabel}
                    />
                    <FieldError message={errors[fieldName]?.message} />
                  </YStack>
                )}
              />
            );
          })}

          {totalMinutes > 0 && (
            <Paragraph fontSize="$2" color="$color10">
              合計: {totalMinutes}分
            </Paragraph>
          )}
        </YStack>

        {/* メモ */}
        <Controller
          control={control}
          name="memo"
          render={({ field: { onChange, onBlur, value } }) => (
            <YStack gap="$1">
              <Paragraph color="$color12">メモ 任意</Paragraph>
              <Input
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="自由記入"
                multiline
                numberOfLines={3}
                aria-label="メモ"
              />
            </YStack>
          )}
        />

        {/* 教本の進捗 */}
        <YStack gap="$2">
          <Paragraph color="$color12">教本の進捗</Paragraph>

          {fields.map((field, index) => {
            const otherSelectedIds = new Set(
              watchedEntries
                .filter((_, i) => i !== index)
                .map((e) => e.textbookId)
                .filter(Boolean),
            );
            const selectedTextbookId = watchedEntries[index]?.textbookId;
            const selectedTextbook = textbooks.find((tb) => tb.id === selectedTextbookId);

            return (
              <YStack key={field.id} gap="$2" p="$3" bg="$color2" rounded="$3">
                <XStack gap="$2" items="center">
                  <Controller
                    control={control}
                    name={`textbookEntries.${index}.textbookId`}
                    render={({ field: { onChange, onBlur, value } }) => (
                      <YStack flex={1} gap="$1">
                        <Select value={value} onValueChange={onChange}>
                          <Select.Trigger
                            flex={1}
                            onBlur={onBlur}
                            aria-label={`教本を選択 ${index + 1}`}
                          >
                            <Select.Value placeholder="教本を選択" />
                          </Select.Trigger>
                          <Select.Content>
                            <Select.ScrollUpButton />
                            <Select.Viewport>
                              {textbooks.map((tb, i) => (
                                <Select.Item
                                  key={tb.id}
                                  index={i}
                                  value={tb.id}
                                  disabled={otherSelectedIds.has(tb.id)}
                                >
                                  <Select.ItemText>{tb.title}</Select.ItemText>
                                </Select.Item>
                              ))}
                            </Select.Viewport>
                            <Select.ScrollDownButton />
                          </Select.Content>
                        </Select>
                        <FieldError
                          message={errors.textbookEntries?.[index]?.textbookId?.message}
                        />
                      </YStack>
                    )}
                  />
                  <Button
                    size="$2"
                    theme="red"
                    onPress={() => remove(index)}
                    aria-label={`エントリ ${index + 1} を削除`}
                  >
                    ✕
                  </Button>
                </XStack>

                <YStack gap="$1">
                  <XStack gap="$2" items="center">
                    <Paragraph fontSize="$2" color="$color10">
                      現在ページ:
                    </Paragraph>
                    <Controller
                      control={control}
                      name={`textbookEntries.${index}.currentPage`}
                      render={({ field: { onChange, onBlur, value } }) => (
                        <XStack gap="$2" items="center">
                          <Input
                            width={64}
                            value={value !== undefined ? String(value) : ''}
                            onChangeText={(t) => {
                              const n = Number(t);
                              onChange(t === '' || isNaN(n) ? undefined : n);
                            }}
                            onBlur={onBlur}
                            keyboardType="numeric"
                            aria-label={`ページ ${index + 1}`}
                          />
                          {selectedTextbook?.totalPages != null && (
                            <Paragraph fontSize="$2" color="$color10">
                              / {selectedTextbook.totalPages}
                            </Paragraph>
                          )}
                        </XStack>
                      )}
                    />
                  </XStack>
                  <FieldError message={errors.textbookEntries?.[index]?.currentPage?.message} />
                </YStack>
              </YStack>
            );
          })}

          <Button
            onPress={() => append({ textbookId: '', currentPage: 0 })}
            aria-label="教本を追加"
          >
            ＋ 教本を追加
          </Button>
        </YStack>

        <Button theme="blue" onPress={submitForm} disabled={isSubmitting} aria-label="保存">
          保存
        </Button>
      </YStack>
    </ScrollView>
  );
});
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest __tests__/integration/practice-log-form.integration.test.tsx
```

Expected: 全件 PASS

- [ ] **Step 5: コミット**

```bash
git add components/practice-log-form.tsx \
        __tests__/integration/practice-log-form.integration.test.tsx
git commit -m "feat: PracticeLogForm に基礎練習セクション（ロングトーン・タンギング）を追加"
```

---

## Task 6: 一覧画面に基礎練習を表示

**Files:**

- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: index.tsx を更新**

`app/(tabs)/index.tsx` の以下の箇所を変更する。

インポートに `BASIC_MENUS` を追加:

```typescript
import { BASIC_MENUS } from '@/forms/practice-log';
```

`renderItem` の `textbookEntries.map(...)` の直後に追加:

```typescript
{item.basicMenuEntries.length > 0 && (
  <XStack gap="$3" mt="$1" flexWrap="wrap">
    {item.basicMenuEntries.map((entry) => (
      <Paragraph key={entry.menuType} fontSize="$2" color="$color10">
        {`${BASIC_MENUS.find((m) => m.type === entry.menuType)?.label ?? entry.menuType}: ${entry.durationMinutes}分`}
      </Paragraph>
    ))}
  </XStack>
)}
```

- [ ] **Step 2: 型チェックとリントを通す**

```bash
npx tsc --noEmit && npm run lint
```

Expected: エラー 0 件

- [ ] **Step 3: コミット**

```bash
git add app/'(tabs)'/index.tsx
git commit -m "feat: 練習記録一覧カードに基礎練習時間を表示"
```

---

## Task 7: 品質チェックと最終確認

**Files:** なし (検証のみ)

- [ ] **Step 1: 全テストを実行**

```bash
npm test
```

Expected: 全件 PASS

- [ ] **Step 2: Lint チェック**

```bash
npm run lint
```

Expected: 0 errors

- [ ] **Step 3: フォーマットチェック**

```bash
npm run format:check
```

Expected: 差分なし。差分がある場合は `npm run format` で修正して再確認

- [ ] **Step 4: TypeScript 型チェック**

```bash
npx tsc --noEmit
```

Expected: 0 errors

- [ ] **Step 5: エミュレーターで動作確認**

`npx expo start` でアプリを起動し、以下を確認:

1. 練習記録フォームに「ロングトーン（分）任意」「タンギング（分）任意」欄が表示される
2. ロングトーン 10分・タンギング 15分 を入力すると「合計: 25分」が表示される
3. 保存後、一覧カードに「ロングトーン: 10分」「タンギング: 15分」が表示される
4. 月合計時間 (ヘッダの「計X分」) に入力した時間が反映される
5. どちらも未入力で保存できる (任意フィールド)

- [ ] **Step 6: 最終コミット（必要な場合のみ）**

フォーマット修正などがあった場合:

```bash
git add -p
git commit -m "style: フォーマット修正"
```
