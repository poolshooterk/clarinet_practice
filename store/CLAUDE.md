# 状態管理 (Zustand)

グローバル状態は **Zustand v5** で管理。Redux 系の boilerplate を避け、selector ベースで必要な値だけを購読する方針。

- ストアはプロジェクトルートの `store/` に **1 ストア = 1 ファイル**で配置 (`store/counter.ts`, `store/settings.ts` など)。import は `@/store/<name>`
- 型は curried 形 `create<State>()((set, get) => ({...}))` を使う (公式 v5 の TypeScript 推奨形)。型注釈ファースト
- 利用側は **selector を 1 つずつ呼ぶ** (`const x = useFooStore((s) => s.x)`)。オブジェクト分割代入は不要な再レンダーを生むため避ける
- アクションは状態と同じストア内に同梱する (`set` / `get` を閉じ込める)。コンポーネント側からはセレクタ経由で関数を取り出して呼ぶ
- 永続化が必要なストアは `persist` middleware + `createJSONStorage(() => AsyncStorage)` を使う。`name` はプロジェクト固有のプレフィックス付きで重複を避ける (例: `expo-template-settings`)
- middleware は `persist` のみ採用。`devtools` / `immer` / `subscribeWithSelector` 等は必要になった時点で個別検討
- 参照実装: `store/lesson-record.ts` (Supabase 連携 CRUD) / `store/settings.ts` (永続化 + UI 連携) / `store/practice-log.ts` (Supabase 連携、スネークケース → キャメルケース変換、CRUD アクション)
- ストアが小さいうちはスライス分割やラッパーを作らない (過剰抽象化を避ける)
- **カタログストア** (`store/instrument-catalog.ts` / `store/textbook-catalog.ts`): 複数機能が参照するルックアップデータを管理する読み取り中心のストア。`persist` でローカルキャッシュし、`useFocusEffect` 経由で `fetchAll` して最新化する。CRUD ストアと区別し、ユーザデータは持たない
- 単体テストは `store/__tests__/` に配置し、`useFooStore.getState()` を直接叩いて状態遷移を検証する (UI レンダリング不要のため `renderHook` 不使用)。`persist` を使うストアは `jest.setup.ts` の AsyncStorage 公式モックが自動適用されるため追加設定不要
- **DB 制約違反を呼び出し側に返す CRUD アクション**: 一意制約違反などユーザに通知すべき回復可能エラーは、戻り値を `Promise<{ ok: true } | { ok: false; reason: 'duplicate' | 'unknown' }>` で表現し、画面側で `Alert.alert` 等の UI を出す。Postgres エラーコード `23505` を `'duplicate'` にマップする。参照実装: `store/practice-log.ts` の `MutationResult` 型と `classifyError` ヘルパー (`add` / `update` がこの形を返す)
