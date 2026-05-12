import { Link, router, Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Alert, FlatList, Pressable } from 'react-native';
import { Paragraph, Spinner, Text, XStack, YStack } from 'tamagui';

import { type Textbook, useTextbookCatalogStore } from '@/store/textbook-catalog';

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

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

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
        <FlatList
          data={textbooks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <YStack items="center" justify="center" mt="$8">
              <Paragraph color="$color10">教本が登録されていません</Paragraph>
            </YStack>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/textbook-form?id=${item.id}`)}
              onLongPress={() => handleLongPress(item)}
              style={{ marginBottom: 8 }}
            >
              <XStack
                bg="$color2"
                borderWidth={1}
                borderColor="$borderColor"
                rounded="$4"
                p="$3"
                items="center"
                justify="space-between"
              >
                <YStack flex={1}>
                  <Paragraph fontWeight="bold">{item.title}</Paragraph>
                  {item.publisher && (
                    <Paragraph size="$2" color="$color10">
                      {item.publisher}
                    </Paragraph>
                  )}
                </YStack>
                {item.difficulty && (
                  <Text
                    fontSize={11}
                    px="$2"
                    py="$1"
                    rounded="$2"
                    style={{ backgroundColor: DIFFICULTY_COLORS[item.difficulty] ?? '#ccc' }}
                    color="$color1"
                  >
                    {item.difficulty}
                  </Text>
                )}
              </XStack>
            </Pressable>
          )}
        />
      )}
    </>
  );
}
