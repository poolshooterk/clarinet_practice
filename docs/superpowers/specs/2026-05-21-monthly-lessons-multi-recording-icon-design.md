# 設計仕様: 月別レッスン記録・複数録音・アプリアイコン

作成日: 2026-05-21

---

## 背景と目的

3つの独立した改善を1つの開発サイクルで実装する。

1. **月別レッスン記録一覧**: 練習記録と同様に月単位で確認できるようにし、月内の教本進捗を可視化する
2. **複数録音対応**: 練習記録・レッスン記録それぞれで録音を最大3本まで登録・個別削除できるようにする（現在は1セッション1本の上書き）
3. **アプリアイコン刷新**: デフォルトのEASアイコンからクラリネット練習帳をイメージしたオシャレなアイコンに変更する

---

## 機能1: 月別レッスン記録一覧

### 変更対象ファイル

- `app/(tabs)/lesson.tsx` のみ（ストア変更なし）

### UIレイアウト

```
┌─────────────────────────────┐
│  レッスン記録                │  ← タブヘッダー
├─────────────────────────────┤
│  ‹   2026年5月   ›          │  ← 月ナビゲーション
├─────────────────────────────┤
│  今月のレッスン: 2回         │  ← 月間サマリー（折り畳みなし）
│  ● ローゼンタール p.45→p.62 (+17) │
│  ● クローゼ エチュード p.12→p.18 (+6) │
├─────────────────────────────┤
│  05/18 (月) 14:30           │  ← 各レッスン行
│  ♪ アドバイス: スタッカートは...    │
│  ローゼンタール p.62 / クローゼ p.18 │
├─────────────────────────────┤
│  05/04 (日) 14:30           │
│  アドバイス: 息のスピードを...     │
│  ローゼンタール p.45 / クローゼ p.12 │
└─────────────────────────────┘
```

### データフロー

- 月ナビ: `useState(today().slice(0, 7))` → `selectedMonth: string ("YYYY-MM")`
- 月フィルタ: `records.filter(r => r.heldAt.startsWith(selectedMonth))`
- 月間教本進捗の計算（`useMemo`）:
  - 月内レコードを `heldAt` 昇順でソート
  - 教本IDでグルーピング
  - 各教本の「最初のセッションの `currentPage`」→「最後のセッションの `currentPage`」と差分を算出
- 各行サブテキスト: そのセッションの `textbookEntries` を `textbookTitle + currentPage` で結合表示

### 月ナビの実装パターン

`app/(tabs)/index.tsx` の `prevMonth` / `nextMonth` と同一パターンを踏襲する。

```typescript
function prevMonth() {
  const [y, m] = selectedMonth.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
}
```

---

## 機能2: 複数録音（最大3本・番号+メモ・一時停止対応）

### DBマイグレーション（新テーブル×2）

```sql
-- 練習記録の録音
CREATE TABLE practice_session_recordings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  index       INTEGER NOT NULL CHECK (index BETWEEN 1 AND 3),
  local_uri   TEXT NOT NULL,
  memo        TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(session_id, index)
);
ALTER TABLE practice_session_recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_manage_own_practice_recordings"
  ON practice_session_recordings FOR ALL
  USING (session_id IN (SELECT id FROM practice_sessions WHERE user_id = auth.uid()));

-- レッスン記録の録音
CREATE TABLE lesson_record_recordings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_record_id UUID NOT NULL REFERENCES lesson_records(id) ON DELETE CASCADE,
  index            INTEGER NOT NULL CHECK (index BETWEEN 1 AND 3),
  local_uri        TEXT NOT NULL,
  memo             TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lesson_record_id, index)
);
ALTER TABLE lesson_record_recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_manage_own_lesson_recordings"
  ON lesson_record_recordings FOR ALL
  USING (lesson_record_id IN (SELECT id FROM lesson_records WHERE user_id = auth.uid()));
```

将来のクラウド対応時は `cloud_uri TEXT` カラムを追加するだけで拡張できる。

### ファイル命名規則

- 一時ファイル（録音中〜フォーム保存前）: `tmp-{n}.m4a`（n=1,2,3）
- 確定ファイル（フォーム保存後）: `{sessionId}-{index}.m4a`

### lib/recording.ts の変更

| 関数                                  | 変更内容                                                  |
| ------------------------------------- | --------------------------------------------------------- |
| `startRecording()`                    | 変更なし                                                  |
| `stopRecording(n)`                    | 停止後の一時ファイルを `tmp-{n}.m4a` に保存（引数追加）   |
| `pauseRecording()`                    | 新規追加: `recording.pauseAsync()`                        |
| `resumeRecording()`                   | 新規追加: `recording.resumeAsync()`                       |
| `finalizeRecording(sessionId, index)` | `index` 引数を追加し `{sessionId}-{index}.m4a` にリネーム |
| `deleteRecording(sessionId, index?)`  | `index` 省略時は全ファイル削除（セッション削除時用）      |
| `getRecordingUri(sessionId, index)`   | `index` 引数を追加                                        |

### ストア型変更

```typescript
// 両ストア共通の録音型
type SessionRecording = {
  id: string;
  index: 1 | 2 | 3;
  localUri: string;
  memo: string | null;
};

// PracticeSession に追加
recordings: SessionRecording[];

// LessonRecord に追加
recordings: SessionRecording[]; // 同一構造を流用
```

### ストアのアクション変更

```typescript
// 練習記録ストア（lesson-record も同様）
add(input, tempRecordings?: Array<{ index: 1|2|3; localUri: string; memo?: string }>): Promise<void>
update(id, input, tempRecordings?: Array<...>, deletedRecordingIds?: string[]): Promise<void>
remove(id): Promise<void>  // 全録音ファイルも削除
```

`fetchAll` 時は `practice_session_recordings` を JOIN して各セッションの `recordings` を設定する。

### UIコンポーネント変更

**`components/form/recording-section.tsx` を複数録音対応に刷新**

録音セクションの状態機械:

```
idle
 ↓ 「＋録音を追加」タップ
recording (REC 赤表示)
 ↓ 「⏸」タップ          ↓ 「■」タップ
paused (PAUSE 黄表示)    confirmed (プレーヤー表示)
 ↓ 「▶」タップ
recording
 ↓ 「■」タップ
confirmed
```

- 確定済み録音はプレーヤー（再生/停止・シークバー）＋メモ入力欄＋✕削除ボタンで表示
- 録音数が3未満なら「＋録音を追加 (残り N)」ボタンを表示
- `onChange` コールバックで親フォームに `{ recordings: TempRecording[], deletedIds: string[] }` を通知

**`app/practice-log-form.tsx` / `app/lesson-record-form.tsx`**

- `tempRecordingUri` / `shouldDeleteExistingRecording` の単数管理を配列管理に変更
- 保存時に `tempRecordings` と `deletedRecordingIds` をストアアクションに渡す

**一覧画面（`app/(tabs)/index.tsx` / `app/(tabs)/lesson.tsx`）**

- 録音インジケーター: `recordings.length > 0` なら `♪` 表示（件数は表示しない）

---

## 機能3: アプリアイコン刷新

### デザイン仕様（B-1: ネイビー×ゴールド）

| 要素           | 仕様                                       |
| -------------- | ------------------------------------------ |
| 背景           | ネイビーグラデーション (#1E3A8A → #1E1B4B) |
| ノート本体     | #1E40AF、丸角10px                          |
| 背表紙（綴じ） | #2563EB、ドット5個                         |
| クラリネット   | ゴールド (#FBBF24)、-40°傾き、キー穴5個    |
| マウスピース   | #FDE68A                                    |
| 「練習帳」文字 | #FDE68A、serif、letter-spacing: 2          |
| 五線譜装飾     | 白12%透過、3本                             |

### 生成スクリプト

`scripts/generate-icon.py` を新規作成。`cairosvg` または `pip install cairosvg` で変換。

生成物:
| ファイル | サイズ |
|---------|--------|
| `assets/images/icon.png` | 1024×1024 |
| `assets/images/android-icon-foreground.png` | 512×512（透過PNG） |
| `assets/images/android-icon-background.png` | 512×512（#1E3A8A単色） |
| `assets/images/android-icon-monochrome.png` | 432×432（白単色） |
| `assets/images/splash-icon.png` | 1024×1024 |
| `assets/images/favicon.png` | 48×48 |

`app.json` の `backgroundColor` を `#1E3A8A` に更新する。

---

## テスト方針

### 月別レッスン記録

- 単体: なし（純粋なUIフィルタリングロジックはシンプルすぎる）
- 結合: `__tests__/integration/lesson-monthly-view.integration.test.tsx`
  - 月をまたぐレコードがある状態で正しく月フィルタされること
  - 教本進捗の計算が正しいこと（月内の最初/最後のページと差分）
  - 月ナビの前月/次月が正しく動作すること

### 複数録音

- 単体: `lib/__tests__/recording.test.ts` に pause/resume/multi-index のテストを追加
- 単体: `store/__tests__/practice-log.test.ts` / `store/__tests__/lesson-record.test.ts` に複数録音のCRUDテストを追加
- 結合: `__tests__/integration/practice-log-form.integration.test.tsx` に以下を追加
  - 録音2本追加→保存でDBに2件INSERTされること
  - 既存録音の個別削除が動作すること

### アプリアイコン

- `npm run android` / `npm run ios` で実機/エミュレータ上の外観を目視確認

---

## 実装順序

1. **DBマイグレーション作成**（`supabase/migrations/`）
2. **`lib/recording.ts` 変更**（pause/resume/multi-index対応）
3. **ストア型・アクション変更**（practice-log / lesson-record）
4. **`recording-section.tsx` 刷新**（複数録音UI）
5. **フォーム画面変更**（practice-log-form / lesson-record-form）
6. **`app/(tabs)/lesson.tsx` 月別対応**
7. **アイコン生成スクリプト作成・実行**
8. **品質チェック4ステップ**（lint / format / tsc / test）
