# 教本管理画面 UI 改修 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 教本管理画面から進捗入力モーダルを取り除き、カードタップで編集フォームへ遷移するシンプルな画面にする。

**Architecture:** `app/textbooks.tsx` のモーダル関連コードを全削除し、カード Pressable の `onPress` を編集フォーム遷移に変更する。`›` ボタンは不要になるため削除。進捗バー表示（読み取り）は維持。

**Tech Stack:** React Native / Expo Router / Tamagui / Zustand / @testing-library/react-native

---

## 変更ファイル

- Modify: `app/textbooks.tsx` — モーダル削除・カードタップ動作変更
- Modify: `__tests__/integration/textbook-progress-modal.integration.test.tsx` — テスト更新

---

### Task 1: 結合テストを新仕様に更新する

**Files:**

- Modify: `__tests__/integration/textbook-progress-modal.integration.test.tsx`

- [ ] **Step 1: テストファイルを新仕様に書き換える**

ファイル全体を以下に差し替える:

```tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent } from '@testing-library/react-native';

import TextbooksScreen from '@/app/textbooks';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';
import { useTextbookProgressStore } from '@/store/textbook-progress';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('expo-router', () => ({
  Link: ({ children }: any) => children,
  Stack: { Screen: () => null },
  router: { push: jest.fn() },
  useFocusEffect: () => {},
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: jest.fn() },
    from: jest.fn(),
  },
}));

describe('TextbooksScreen 教本管理 (integration)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    useTextbookCatalogStore.setState({
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
      loading: false,
    });
    useTextbookProgressStore.setState({ progress: {} });
    jest.clearAllMocks();
  });

  it('totalPages がある教本に進捗テキストが表示される', () => {
    renderWithProviders(<TextbooksScreen />);
    expect(screen.getByText('0 / 32')).toBeTruthy();
  });

  it('進捗がある教本には現在ページが表示される', () => {
    useTextbookProgressStore.setState({ progress: { 'tb-1': 10 } });
    renderWithProviders(<TextbooksScreen />);
    expect(screen.getByText('10 / 32')).toBeTruthy();
  });

  it('カードをタップすると編集フォームへ遷移する', () => {
    renderWithProviders(<TextbooksScreen />);
    fireEvent.press(screen.getByLabelText('ローズ 32のエチュードを編集'));
    expect(require('expo-router').router.push).toHaveBeenCalledWith('/textbook-form?id=tb-1');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npx jest __tests__/integration/textbook-progress-modal.integration.test.tsx
```

期待: `カードをタップすると編集フォームへ遷移する` が FAIL（現状は `aria-label="ローズ 32のエチュードを編集"` が存在しない）。

---

### Task 2: `app/textbooks.tsx` を新仕様に書き換える

**Files:**

- Modify: `app/textbooks.tsx`

- [ ] **Step 1: ファイル全体を新仕様に書き換える**

```tsx
import { Link, router, Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Alert, Pressable, SectionList, View } from 'react-native';
import { Paragraph, Spinner, Text, XStack, YStack } from 'tamagui';

import { GENRE_OPTIONS } from '@/forms/textbook';
import { type Textbook, useTextbookCatalogStore } from '@/store/textbook-catalog';
import { useTextbookProgressStore } from '@/store/textbook-progress';

const DIFFICULTY_COLORS: Record<string, string> = {
  初心者: '#a6e3a1',
  初中級: '#fab387',
  中級: '#f9e2af',
  上級: '#f38ba8',
};

export default function TextbooksScreen() {
  const textbooks = useTextbookCatalogStore((s) => s.textbooks);
  const loading = useTextbookCatalogStore((s) => s.loading);
  const fetchAll = useTextbookCatalogStore((s) => s.fetchAll);
  const remove = useTextbookCatalogStore((s) => s.remove);
  const progress = useTextbookProgressStore((s) => s.progress);
  const fetchAllProgress = useTextbookProgressStore((s) => s.fetchAll);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
      fetchAllProgress();
    }, [fetchAll, fetchAllProgress]),
  );

  const sections = GENRE_OPTIONS.map((genre) => ({
    title: genre,
    data: textbooks.filter((t) => t.genre === genre),
  })).filter((s) => s.data.length > 0);

  const handleLongPress = (textbook: Textbook) => {
    Alert.alert('教本を削除', `「${textbook.title}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => remove(textbook.id) },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: '教本管理',
          headerRight: () => (
            <Link href="/textbook-form" style={{ marginRight: 12 }}>
              <Text color="$blue10">＋ 追加</Text>
            </Link>
          ),
        }}
      />
      {loading ? (
        <YStack flex={1} items="center" justify="center">
          <Spinner />
        </YStack>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <YStack items="center" justify="center" mt="$8">
              <Paragraph color="$color10">教本が登録されていません</Paragraph>
            </YStack>
          }
          renderSectionHeader={({ section: { title } }) => (
            <Paragraph fontWeight="bold" color="$color10" mb="$1" mt="$2">
              {title}
            </Paragraph>
          )}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/textbook-form?id=${item.id}`)}
              onLongPress={() => handleLongPress(item)}
              style={{ marginBottom: 8 }}
              aria-label={`${item.title}を編集`}
            >
              <XStack
                bg="$color2"
                borderWidth={1}
                borderColor="$borderColor"
                rounded="$4"
                overflow="hidden"
                items="center"
                p="$3"
              >
                <YStack flex={1} gap="$1">
                  <XStack items="center" justify="space-between">
                    <Paragraph fontWeight="bold" flex={1}>
                      {item.title}
                    </Paragraph>
                    {item.difficulty && (
                      <Text
                        fontSize={11}
                        px="$2"
                        py="$1"
                        rounded="$2"
                        style={{
                          backgroundColor: DIFFICULTY_COLORS[item.difficulty] ?? '#ccc',
                        }}
                        color="$color1"
                      >
                        {item.difficulty}
                      </Text>
                    )}
                  </XStack>
                  {item.publisher && (
                    <Paragraph size="$2" color="$color10">
                      {item.publisher}
                    </Paragraph>
                  )}
                  {item.totalPages && (
                    <XStack items="center" gap="$2" mt="$1">
                      <View
                        style={{
                          flex: 1,
                          height: 6,
                          backgroundColor: '#e0e0e0',
                          borderRadius: 3,
                        }}
                      >
                        <View
                          style={{
                            width: `${Math.min(100, Math.round(((progress[item.id] ?? 0) / item.totalPages) * 100))}%`,
                            height: 6,
                            backgroundColor: '#4a9eff',
                            borderRadius: 3,
                          }}
                        />
                      </View>
                      <Text fontSize={11} color="$color10">
                        {progress[item.id] ?? 0} / {item.totalPages}
                      </Text>
                    </XStack>
                  )}
                </YStack>
              </XStack>
            </Pressable>
          )}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: テストがパスすることを確認する**

```bash
npx jest __tests__/integration/textbook-progress-modal.integration.test.tsx
```

期待: 3 tests PASS

- [ ] **Step 3: 品質チェック 4 ステップを通す**

```bash
npm run lint && npm run format:check && npx tsc --noEmit && npm test
```

期待: エラー 0件、全テスト PASS

- [ ] **Step 4: コミット**

```bash
git add app/textbooks.tsx __tests__/integration/textbook-progress-modal.integration.test.tsx
git commit -m "feat: 教本管理画面のカードタップを編集フォーム遷移に変更、進捗入力モーダルを削除"
```
