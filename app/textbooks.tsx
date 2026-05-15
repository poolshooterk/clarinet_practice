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
