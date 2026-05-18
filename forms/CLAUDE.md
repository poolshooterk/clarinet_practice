# フォームの実装方針

フォームを **React Hook Form + zod + Tamagui** の組み合わせで実装する。

- バリデーションは zod スキーマで宣言 (`z.email()` などのトップレベル v4 構文)
- `useForm({ resolver: zodResolver(schema) })` がエントリポイント (resolver の import は `@hookform/resolvers/zod`)
- React Native では `register` は使えない。**必ず `Controller` で Tamagui の `Input` / `Switch` をラップ**する
- `mode: 'onTouched'` を初期値として推奨 (タッチ後はリアルタイム再検証)
- 数値入力は Input が string を返すため、Controller の `onChange` 側で `Number(t)` 化 (空文字 / NaN は `undefined` に正規化)。スキーマ側は `z.number().optional()` のままにする (`z.preprocess` を使うと `z.infer` の入力型が `unknown` になり `defaultValues` と型衝突するため避ける)
- 範囲チェックは zod の `.min()` / `.max()` を直接使う (`z.number().min(0).max(100)`)。連動する UI には Tamagui `Slider` を Controller でラップして value/onChange を配列で扱う
- 日付フィールドは **Tamagui `Input` を主体**として `YYYY-MM-DD` 文字列を保持する。スキーマは `z.string()` + `regex(/^\d{4}-\d{2}-\d{2}$/)` + `refine` で範囲チェック (`z.date()` を使うと Input の text と Date オブジェクトの二重管理になり煩雑)。範囲チェックの refine 内で文字列を Date に変換するヘルパー (`parseYmd`) を定義して再利用する
- 入力補助として `@react-native-community/datetimepicker` の `DateTimePicker` を使用。`showPicker` state を `Controller` の外で持ち、ボタン押下で表示。ピッカー結果は `formatDate(d)` で `YYYY-MM-DD` 文字列に整形してから `onChange` に渡す (タイムゾーン依存を避けるため `Date` 文字列の直接結合は使わない)
- `Platform.OS === 'web'` ではピッカー起動ボタンと `<DateTimePicker>` を描画しない (ライブラリが Web 非対応のため)
- 「true 必須」のチェックは `z.boolean().refine((v) => v === true, ...)` を使う (`z.literal(true)` だと推論型が `true` 固定になり `defaultValues` で `false` を渡せなくなる)
- **zod スキーマと date ヘルパー (`parseYmd` / `formatDate` / `today`) は `forms/` 配下にモジュールとして切り出す** (例: `forms/profile.ts`)。UI 非依存にして単体テスト可能にする。route ファイルからは `import { profileSchema, parseYmd, formatDate } from '@/forms/profile'`
- フォーム共通コンポーネント (例: 必須エラー表示) は **`components/form/` に配置**。シンプルなものはテスト容易性と再利用のために早めに切り出して構わない (`FieldError` がその例)
- 参照実装: `components/profile-form.tsx` + `forms/profile.ts` + `components/form/field-error.tsx`。route ファイル (例: `app/practice-log-form.tsx`) からは対応するフォームコンポーネントを貼るだけにする (page と form の責務分離)
