# 認証 + Supabase 基盤 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supabase 認証（メール＋パスワード）と DB スキーマを導入し、expo-router のグループベース認証でサインイン/サインアップ/パスワードリセット画面と 3 タブスケルトン画面を実装する。

**Architecture:** `app/_layout.tsx` が `supabase.auth.onAuthStateChange` でセッション状態を監視し、未認証は `(auth)` グループ、認証済みは `(tabs)` グループに自動リダイレクトする。expo-router のファイルベースルーティングで各グループが独立した Stack/Tabs レイアウトを持つ。

**Tech Stack:** Expo + expo-router v6, Tamagui (`onlyAllowShorthands: true`), React Hook Form + zod + @hookform/resolvers/zod, @supabase/supabase-js, Supabase MCP

---

## ファイル構成

### 新規作成

| ファイル                                             | 責務                                                                                           |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `lib/supabase.ts`                                    | Supabase クライアント初期化（AsyncStorage でセッション永続化）                                 |
| `lib/auth-errors.ts`                                 | Supabase 英語エラーメッセージ → 日本語マッピング                                               |
| `forms/sign-in.ts`                                   | `signInSchema`（email + password）+ `SignInValues` 型                                          |
| `forms/sign-up.ts`                                   | `signUpSchema`（email + password + confirmPassword、パスワード一致 refine）+ `SignUpValues` 型 |
| `forms/forgot-password.ts`                           | `forgotPasswordSchema`（email）+ `ForgotPasswordValues` 型                                     |
| `forms/__tests__/sign-in.test.ts`                    | `signInSchema` 単体テスト                                                                      |
| `forms/__tests__/sign-up.test.ts`                    | `signUpSchema` 単体テスト                                                                      |
| `app/(auth)/_layout.tsx`                             | 認証グループの Stack レイアウト（header 非表示）                                               |
| `app/(auth)/sign-in.tsx`                             | サインイン画面（RHF + zod + Supabase auth）                                                    |
| `app/(auth)/sign-up.tsx`                             | サインアップ画面                                                                               |
| `app/(auth)/forgot-password.tsx`                     | パスワードリセット申請画面                                                                     |
| `app/(tabs)/_layout.tsx`                             | 3 タブナビゲーション（練習記録 / 楽器情報 / 設定）                                             |
| `app/(tabs)/index.tsx`                               | 練習記録タブ（スケルトン）                                                                     |
| `app/(tabs)/equipment.tsx`                           | 楽器情報タブ（スケルトン）                                                                     |
| `app/(tabs)/settings.tsx`                            | 設定タブ（スケルトン）                                                                         |
| `__tests__/integration/sign-in.integration.test.tsx` | サインイン画面結合テスト（空送信 / 正常 / Supabase エラー）                                    |
| `.env.local`                                         | `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`                                   |

### 変更

| ファイル          | 変更内容                                                                  |
| ----------------- | ------------------------------------------------------------------------- |
| `app/_layout.tsx` | `useEffect` で `onAuthStateChange` を購読し auth 状態に応じてリダイレクト |
| `jest.setup.ts`   | `@/lib/supabase` のグローバルモック追加                                   |

### 削除

| ファイル        | 理由                              |
| --------------- | --------------------------------- |
| `app/index.tsx` | `app/(tabs)/index.tsx` に置き換え |

---

### Task 1: Supabase マイグレーション適用

**Files:**

- (Supabase MCP ツールのみ、ローカルファイル変更なし)

- [ ] **Step 1: マイグレーション SQL を適用する**

`mcp__supabase__apply_migration` ツールで以下の SQL を適用する（migration_name: `create_presets_and_user_equipment`）：

```sql
-- presets テーブル（プリセットマスタ）
create table presets (
  id         uuid primary key default gen_random_uuid(),
  category   text not null
             check (category in ('instrument', 'reed', 'ligature', 'mouthpiece')),
  name       text not null,
  sort_order int  not null default 0
);

-- user_equipment テーブル（1ユーザー1行固定）
create table user_equipment (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  instrument_name       text not null,
  instrument_start_date date not null,
  reed_name             text not null,
  reed_start_date       date not null,
  ligature_name         text not null,
  ligature_start_date   date not null,
  mouthpiece_name       text not null,
  mouthpiece_start_date date not null,
  updated_at            timestamptz not null default now()
);

-- RLS 有効化
alter table presets enable row level security;
create policy "presets are publicly readable"
  on presets for select using (true);

alter table user_equipment enable row level security;
create policy "users manage own equipment"
  on user_equipment for all using (auth.uid() = user_id);

-- seed: プリセットデータ
insert into presets (category, name, sort_order) values
  ('instrument', 'B♭クラリネット',     1),
  ('instrument', 'Aクラリネット',       2),
  ('instrument', 'バスクラリネット',    3),
  ('instrument', 'Eクラリネット',       4),
  ('reed', 'Vandoren V12',              1),
  ('reed', 'Vandoren Traditional（青箱）', 2),
  ('reed', 'Vandoren V21',              3),
  ('reed', 'D''Addario Select Jazz',    4),
  ('reed', 'Rico Royal',                5),
  ('reed', 'Legere Signature',          6),
  ('ligature', 'Vandoren M/O',          1),
  ('ligature', 'BG Franck Superior',    2),
  ('ligature', 'Bonade',                3),
  ('ligature', 'Rovner Dark',           4),
  ('ligature', 'Harrison',              5),
  ('mouthpiece', 'Vandoren B45',        1),
  ('mouthpiece', 'Vandoren M30',        2),
  ('mouthpiece', 'Vandoren BD5',        3),
  ('mouthpiece', 'Clark W. Fobes Debut', 4),
  ('mouthpiece', 'Selmer C85',          5);
```

- [ ] **Step 2: テーブル一覧で確認**

`mcp__supabase__list_tables` ツールを呼び出し、`presets` と `user_equipment` が一覧に存在することを確認する。

---

### Task 2: パッケージインストール + 環境変数設定

**Files:**

- Create: `.env.local`
- Modify: `package.json`, `package-lock.json`（npm が自動更新）

- [ ] **Step 1: @supabase/supabase-js をインストール**

```bash
npx expo install @supabase/supabase-js
```

Expected: `package.json` の `dependencies` に `"@supabase/supabase-js": "..."` が追加される。

- [ ] **Step 2: Supabase 接続情報を取得**

MCP ツールで以下を取得する:

- `mcp__supabase__get_project_url` → `SUPABASE_URL`
- `mcp__supabase__get_publishable_keys` → `ANON_KEY`（publishable/anon key）

- [ ] **Step 3: .env.local を作成**

取得した値を使って作成する（`.gitignore` に `.env*.local` が登録済みのため git には含まれない）:

```
EXPO_PUBLIC_SUPABASE_URL=<Step 2 で取得した URL>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<Step 2 で取得した anon key>
```

---

### Task 3: Supabase クライアント + エラーマッピング

**Files:**

- Create: `lib/supabase.ts`
- Create: `lib/auth-errors.ts`

- [ ] **Step 1: lib/supabase.ts を作成**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
```

- [ ] **Step 2: lib/auth-errors.ts を作成**

```ts
const ERROR_MAP: Record<string, string> = {
  'Invalid login credentials': 'メールアドレスまたはパスワードが正しくありません',
  'Email not confirmed': 'メールアドレスの確認が完了していません',
  'User already registered': 'このメールアドレスはすでに登録されています',
};

export const toJaError = (msg: string): string => ERROR_MAP[msg] ?? 'エラーが発生しました';
```

- [ ] **Step 3: コミット**

```bash
git add lib/supabase.ts lib/auth-errors.ts package.json package-lock.json
git commit -m "feat: Supabase クライアントとエラーマッピングを追加"
```

---

### Task 4: サインインスキーマ + 単体テスト (TDD)

**Files:**

- Create: `forms/__tests__/sign-in.test.ts`
- Create: `forms/sign-in.ts`

- [ ] **Step 1: 失敗するテストを書く**

`forms/__tests__/sign-in.test.ts` を作成する:

```ts
import { signInSchema } from '@/forms/sign-in';

const valid = { email: 'test@example.com', password: 'pass1234' };

describe('signInSchema', () => {
  it('有効な値を通す', () => {
    expect(signInSchema.safeParse(valid).success).toBe(true);
  });

  describe('email', () => {
    it('空文字 → エラー', () => {
      const r = signInSchema.safeParse({ ...valid, email: '' });
      expect(r.success).toBe(false);
      if (!r.success)
        expect(r.error.issues[0].message).toBe('メールアドレスの形式が正しくありません');
    });

    it('無効な形式 → エラー', () => {
      const r = signInSchema.safeParse({ ...valid, email: 'not-an-email' });
      expect(r.success).toBe(false);
      if (!r.success)
        expect(r.error.issues[0].message).toBe('メールアドレスの形式が正しくありません');
    });

    it.each(['a@b.co', 'user+tag@example.co.jp'])('有効なメール %p を通す', (email) => {
      expect(signInSchema.safeParse({ ...valid, email }).success).toBe(true);
    });
  });

  describe('password', () => {
    it('空文字 → エラー', () => {
      const r = signInSchema.safeParse({ ...valid, password: '' });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toBe('パスワードを入力してください');
    });

    it('1文字以上なら通す', () => {
      expect(signInSchema.safeParse({ ...valid, password: 'x' }).success).toBe(true);
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest forms/__tests__/sign-in.test.ts
```

Expected: FAIL（`Cannot find module '@/forms/sign-in'`）

- [ ] **Step 3: forms/sign-in.ts を作成**

```ts
import { z } from 'zod';

export const signInSchema = z.object({
  email: z.email('メールアドレスの形式が正しくありません'),
  password: z.string().min(1, 'パスワードを入力してください'),
});

export type SignInValues = z.infer<typeof signInSchema>;
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest forms/__tests__/sign-in.test.ts
```

Expected: PASS（7 tests）

- [ ] **Step 5: コミット**

```bash
git add forms/sign-in.ts forms/__tests__/sign-in.test.ts
git commit -m "feat: signInSchema を追加"
```

---

### Task 5: サインアップスキーマ + 単体テスト (TDD)

**Files:**

- Create: `forms/__tests__/sign-up.test.ts`
- Create: `forms/sign-up.ts`

- [ ] **Step 1: 失敗するテストを書く**

`forms/__tests__/sign-up.test.ts` を作成する:

```ts
import { signUpSchema } from '@/forms/sign-up';

const valid = {
  email: 'test@example.com',
  password: 'password1',
  confirmPassword: 'password1',
};

describe('signUpSchema', () => {
  it('有効な値を通す', () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  describe('email', () => {
    it('無効な形式 → エラー', () => {
      const r = signUpSchema.safeParse({ ...valid, email: 'bad' });
      expect(r.success).toBe(false);
      if (!r.success)
        expect(r.error.issues[0].message).toBe('メールアドレスの形式が正しくありません');
    });
  });

  describe('password', () => {
    it('7文字 → エラー', () => {
      const r = signUpSchema.safeParse({
        ...valid,
        password: 'short12',
        confirmPassword: 'short12',
      });
      expect(r.success).toBe(false);
      if (!r.success)
        expect(r.error.issues[0].message).toBe('パスワードは8文字以上で入力してください');
    });

    it('8文字（境界値）→ 通す', () => {
      const p = 'exactly8';
      expect(signUpSchema.safeParse({ ...valid, password: p, confirmPassword: p }).success).toBe(
        true,
      );
    });
  });

  describe('confirmPassword', () => {
    it('パスワード不一致 → エラー', () => {
      const r = signUpSchema.safeParse({ ...valid, confirmPassword: 'different' });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toBe('パスワードが一致しません');
    });

    it('空文字 → エラー', () => {
      const r = signUpSchema.safeParse({ ...valid, confirmPassword: '' });
      expect(r.success).toBe(false);
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest forms/__tests__/sign-up.test.ts
```

Expected: FAIL（`Cannot find module '@/forms/sign-up'`）

- [ ] **Step 3: forms/sign-up.ts を作成**

```ts
import { z } from 'zod';

export const signUpSchema = z
  .object({
    email: z.email('メールアドレスの形式が正しくありません'),
    password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
    confirmPassword: z.string().min(1, 'パスワード（確認）を入力してください'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
  });

export type SignUpValues = z.infer<typeof signUpSchema>;
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest forms/__tests__/sign-up.test.ts
```

Expected: PASS（6 tests）

- [ ] **Step 5: コミット**

```bash
git add forms/sign-up.ts forms/__tests__/sign-up.test.ts
git commit -m "feat: signUpSchema を追加"
```

---

### Task 6: jest.setup.ts に Supabase グローバルモック追加

**Files:**

- Modify: `jest.setup.ts`

- [ ] **Step 1: jest.setup.ts を編集してモックを追加**

既存の AsyncStorage モックの後に追記する。最終的なファイル全体:

```ts
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  },
}));
```

- [ ] **Step 2: 既存テストが引き続き通ることを確認**

```bash
npm test
```

Expected: 全テスト PASS

- [ ] **Step 3: コミット**

```bash
git add jest.setup.ts
git commit -m "test: jest.setup に Supabase グローバルモックを追加"
```

---

### Task 7: サインイン結合テスト + 画面実装 (TDD)

**Files:**

- Create: `__tests__/integration/sign-in.integration.test.tsx`
- Create: `app/(auth)/sign-in.tsx`

- [ ] **Step 1: 失敗する結合テストを書く**

`__tests__/integration/sign-in.integration.test.tsx` を作成する:

```tsx
import { Alert } from 'react-native';
import { fireEvent, waitFor } from '@testing-library/react-native';

import SignIn from '@/app/(auth)/sign-in';
import { supabase } from '@/lib/supabase';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  Link: ({ children }: any) => children,
}));

describe('サインイン画面 (integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('空送信でフォームエラーが表示される', async () => {
    renderWithProviders(<SignIn />);
    fireEvent.press(screen.getByText('サインイン'));

    await waitFor(() => {
      expect(screen.getByText('メールアドレスの形式が正しくありません')).toBeOnTheScreen();
    });
    expect(screen.getByText('パスワードを入力してください')).toBeOnTheScreen();
  });

  it('有効な入力で signInWithPassword が呼ばれる', async () => {
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: {},
      error: null,
    });

    renderWithProviders(<SignIn />);
    fireEvent.changeText(screen.getByPlaceholderText('メールアドレス'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('パスワード'), 'password123');
    fireEvent.press(screen.getByText('サインイン'));

    await waitFor(() => {
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('Supabase エラー時に Alert が表示される', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    (supabase.auth.signInWithPassword as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid login credentials' },
    });

    renderWithProviders(<SignIn />);
    fireEvent.changeText(screen.getByPlaceholderText('メールアドレス'), 'test@example.com');
    fireEvent.changeText(screen.getByPlaceholderText('パスワード'), 'wrongpass');
    fireEvent.press(screen.getByText('サインイン'));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'エラー',
        'メールアドレスまたはパスワードが正しくありません',
      );
    });
  });
});
```

- [ ] **Step 2: テストが失敗することを確認**

```bash
npx jest sign-in.integration
```

Expected: FAIL（`Cannot find module '@/app/(auth)/sign-in'`）

- [ ] **Step 3: app/(auth)/sign-in.tsx を作成**

ディレクトリを先に作成:

```bash
mkdir -p app/\(auth\)
```

`app/(auth)/sign-in.tsx` を作成する:

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'expo-router';
import { Alert } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { Button, Input, Paragraph, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { signInSchema, type SignInValues } from '@/forms/sign-in';
import { toJaError } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';

export default function SignIn() {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  const onSubmit = async (values: SignInValues) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) Alert.alert('エラー', toJaError(error.message));
  };

  return (
    <YStack flex={1} items="center" justify="center" p="$6" gap="$3" bg="$background">
      <Paragraph size="$6" fontWeight="bold" color="$color12">
        クラリネット練習帳
      </Paragraph>

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            placeholder="メールアドレス"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType="email-address"
            autoCapitalize="none"
            width="100%"
          />
        )}
      />
      <FieldError message={errors.email?.message} />

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            placeholder="パスワード"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry
            width="100%"
          />
        )}
      />
      <FieldError message={errors.password?.message} />

      <Button theme="blue" width="100%" onPress={handleSubmit(onSubmit)}>
        サインイン
      </Button>

      <Link href="/(auth)/forgot-password">
        <Paragraph color="$blue10">パスワードを忘れた方はこちら</Paragraph>
      </Link>

      <Paragraph color="$color11">
        アカウントをお持ちでない方は{' '}
        <Link href="/(auth)/sign-up">
          <Paragraph color="$blue10">サインアップ</Paragraph>
        </Link>
      </Paragraph>
    </YStack>
  );
}
```

- [ ] **Step 4: テストが通ることを確認**

```bash
npx jest sign-in.integration
```

Expected: PASS（3 tests）

- [ ] **Step 5: コミット**

```bash
git add "app/(auth)/sign-in.tsx" __tests__/integration/sign-in.integration.test.tsx
git commit -m "feat: サインイン画面を追加"
```

---

### Task 8: サインアップ画面

**Files:**

- Create: `app/(auth)/sign-up.tsx`

- [ ] **Step 1: app/(auth)/sign-up.tsx を作成**

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { Alert } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { Button, Input, Paragraph, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { signUpSchema, type SignUpValues } from '@/forms/sign-up';
import { toJaError } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
    mode: 'onTouched',
  });

  const onSubmit = async (values: SignUpValues) => {
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
    });
    if (error) {
      Alert.alert('エラー', toJaError(error.message));
    } else {
      Alert.alert(
        '確認メールを送信しました',
        'メール内のリンクをクリックしてサインインしてください',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/sign-in') }],
      );
    }
  };

  return (
    <YStack flex={1} items="center" justify="center" p="$6" gap="$3" bg="$background">
      <Paragraph size="$5" fontWeight="bold" color="$color12">
        アカウント作成
      </Paragraph>

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            placeholder="メールアドレス"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType="email-address"
            autoCapitalize="none"
            width="100%"
          />
        )}
      />
      <FieldError message={errors.email?.message} />

      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            placeholder="パスワード"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry
            width="100%"
          />
        )}
      />
      <FieldError message={errors.password?.message} />

      <Controller
        control={control}
        name="confirmPassword"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            placeholder="パスワード（確認）"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry
            width="100%"
          />
        )}
      />
      <FieldError message={errors.confirmPassword?.message} />

      <Button theme="blue" width="100%" onPress={handleSubmit(onSubmit)}>
        アカウントを作成
      </Button>

      <Paragraph color="$color10" size="$2">
        登録後、確認メールが届きます
      </Paragraph>

      <Paragraph color="$color11">
        アカウントをお持ちの方は{' '}
        <Link href="/(auth)/sign-in">
          <Paragraph color="$blue10">サインイン</Paragraph>
        </Link>
      </Paragraph>
    </YStack>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add "app/(auth)/sign-up.tsx"
git commit -m "feat: サインアップ画面を追加"
```

---

### Task 9: パスワードリセット申請画面

**Files:**

- Create: `forms/forgot-password.ts`
- Create: `app/(auth)/forgot-password.tsx`

- [ ] **Step 1: forms/forgot-password.ts を作成**

```ts
import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z.email('メールアドレスの形式が正しくありません'),
});

export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
```

- [ ] **Step 2: app/(auth)/forgot-password.tsx を作成**

```tsx
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, router } from 'expo-router';
import { Alert } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { Button, Input, Paragraph, YStack } from 'tamagui';

import { FieldError } from '@/components/form/field-error';
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/forms/forgot-password';
import { toJaError } from '@/lib/auth-errors';
import { supabase } from '@/lib/supabase';

export default function ForgotPassword() {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
    mode: 'onTouched',
  });

  const onSubmit = async (values: ForgotPasswordValues) => {
    const { error } = await supabase.auth.resetPasswordForEmail(values.email);
    if (error) {
      Alert.alert('エラー', toJaError(error.message));
    } else {
      Alert.alert('メールを送信しました', '届いたリンクからパスワードを再設定してください', [
        { text: 'OK', onPress: () => router.replace('/(auth)/sign-in') },
      ]);
    }
  };

  return (
    <YStack flex={1} items="center" justify="center" p="$6" gap="$3" bg="$background">
      <Paragraph size="$5" fontWeight="bold" color="$color12">
        パスワードリセット
      </Paragraph>
      <Paragraph color="$color11" text="center">
        登録済みメールアドレスにリセット用のリンクを送ります
      </Paragraph>

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            placeholder="メールアドレス"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType="email-address"
            autoCapitalize="none"
            width="100%"
          />
        )}
      />
      <FieldError message={errors.email?.message} />

      <Button theme="blue" width="100%" onPress={handleSubmit(onSubmit)}>
        リセットメールを送る
      </Button>

      <Link href="/(auth)/sign-in">
        <Paragraph color="$blue10">← サインインに戻る</Paragraph>
      </Link>
    </YStack>
  );
}
```

- [ ] **Step 3: コミット**

```bash
git add forms/forgot-password.ts "app/(auth)/forgot-password.tsx"
git commit -m "feat: パスワードリセット申請画面を追加"
```

---

### Task 10: 認証グループレイアウト

**Files:**

- Create: `app/(auth)/_layout.tsx`

- [ ] **Step 1: app/(auth)/\_layout.tsx を作成**

```tsx
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

- [ ] **Step 2: コミット**

```bash
git add "app/(auth)/_layout.tsx"
git commit -m "feat: 認証グループ Stack レイアウトを追加"
```

---

### Task 11: タブグループ（レイアウト + スケルトン画面）

**Files:**

- Create: `app/(tabs)/_layout.tsx`
- Create: `app/(tabs)/index.tsx`
- Create: `app/(tabs)/equipment.tsx`
- Create: `app/(tabs)/settings.tsx`

- [ ] **Step 1: ディレクトリを作成**

```bash
mkdir -p app/\(tabs\)
```

- [ ] **Step 2: app/(tabs)/\_layout.tsx を作成**

```tsx
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen
        name="index"
        options={{
          title: '練習記録',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="musical-notes-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="equipment"
        options={{
          title: '楽器情報',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="musical-note-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 3: app/(tabs)/index.tsx を作成**

```tsx
import { Paragraph, YStack } from 'tamagui';

export default function PracticeLog() {
  return (
    <YStack flex={1} items="center" justify="center">
      <Paragraph>練習記録</Paragraph>
    </YStack>
  );
}
```

- [ ] **Step 4: app/(tabs)/equipment.tsx を作成**

```tsx
import { Paragraph, YStack } from 'tamagui';

export default function Equipment() {
  return (
    <YStack flex={1} items="center" justify="center">
      <Paragraph>楽器情報</Paragraph>
    </YStack>
  );
}
```

- [ ] **Step 5: app/(tabs)/settings.tsx を作成**

```tsx
import { Paragraph, YStack } from 'tamagui';

export default function Settings() {
  return (
    <YStack flex={1} items="center" justify="center">
      <Paragraph>設定</Paragraph>
    </YStack>
  );
}
```

- [ ] **Step 6: コミット**

```bash
git add "app/(tabs)/_layout.tsx" "app/(tabs)/index.tsx" "app/(tabs)/equipment.tsx" "app/(tabs)/settings.tsx"
git commit -m "feat: タブグループとスケルトン画面を追加"
```

---

### Task 12: ルートレイアウト改修（セッション監視・リダイレクト）

**Files:**

- Modify: `app/_layout.tsx`

- [ ] **Step 1: app/\_layout.tsx を書き換える**

変更前は `<Stack />` を返すのみ。変更後は `useEffect` で `onAuthStateChange` を購読してリダイレクトする:

```tsx
import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { TamaguiProvider } from 'tamagui';

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
      <Stack screenOptions={{ headerShown: false }} />
    </TamaguiProvider>
  );
}
```

- [ ] **Step 2: コミット**

```bash
git add app/_layout.tsx
git commit -m "feat: ルートレイアウトに認証セッション監視を追加"
```

---

### Task 13: app/index.tsx 削除

**Files:**

- Delete: `app/index.tsx`

- [ ] **Step 1: app/index.tsx を削除する**

`app/(tabs)/index.tsx` が存在するため、ルートの `app/index.tsx` は不要になる:

```bash
git rm app/index.tsx
```

- [ ] **Step 2: テストが通ることを確認**

```bash
npm test
```

Expected: 全テスト PASS

- [ ] **Step 3: コミット**

```bash
git commit -m "chore: app/index.tsx を削除（(tabs)/index.tsx に置き換え済み）"
```

---

### Task 14: 品質チェック

**Files:**

- (変更なし — チェックのみ)

- [ ] **Step 1: ESLint**

```bash
npm run lint
```

Expected: エラー 0 件。エラーがあれば `npm run lint:fix` で自動修正して再実行。

- [ ] **Step 2: Prettier**

```bash
npm run format:check
```

Expected: 差分 0 件。差分があれば `npm run format` で修正して再実行。

- [ ] **Step 3: TypeScript 型チェック**

```bash
npx tsc --noEmit
```

Expected: エラー 0 件。

- [ ] **Step 4: Jest**

```bash
npm test
```

Expected: 全テスト PASS。

- [ ] **Step 5: 品質エラーがあった場合の対応**

lint/format は自動修正コマンドで解決する。型エラーは該当ファイルを修正して再実行する。テスト失敗は実装とテスト両方を疑い根本原因を修正する（テストを消して解決しない）。

品質チェック 4 ステップが全て通ったら実装完了。
