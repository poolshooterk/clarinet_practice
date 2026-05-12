import { Link, router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, View } from 'react-native';
import { Button, Input, Paragraph, Spinner, Text, XStack, YStack } from 'tamagui';

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
  const upsert = useTextbookProgressStore((s) => s.upsert);

  const [modalTextbook, setModalTextbook] = useState<Textbook | null>(null);
  const [modalPage, setModalPage] = useState('');

  useFocusEffect(
    useCallback(() => {
      fetchAll();
      fetchAllProgress();
    }, [fetchAll, fetchAllProgress]),
  );

  const handleLongPress = (textbook: Textbook) => {
    Alert.alert('教本を削除', `「${textbook.title}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => remove(textbook.id) },
    ]);
  };

  const handleRowPress = (textbook: Textbook) => {
    if (!textbook.totalPages) {
      Alert.alert('総ページ数が未設定です', '教本の編集画面で総ページ数を設定してください');
      return;
    }
    setModalPage(String(progress[textbook.id] ?? 0));
    setModalTextbook(textbook);
  };

  const handleModalSave = async () => {
    if (!modalTextbook) return;
    const page = Number(modalPage);
    if (
      isNaN(page) ||
      page < 0 ||
      (modalTextbook.totalPages !== null && page > modalTextbook.totalPages)
    )
      return;
    await upsert(modalTextbook.id, page);
    setModalTextbook(null);
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
            <XStack
              bg="$color2"
              borderWidth={1}
              borderColor="$borderColor"
              rounded="$4"
              mb="$2"
              overflow="hidden"
              items="center"
            >
              <Pressable
                onPress={() => handleRowPress(item)}
                onLongPress={() => handleLongPress(item)}
                style={{ flex: 1, padding: 12 }}
                aria-label={`${item.title}の進捗を更新`}
              >
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
                      style={{ backgroundColor: DIFFICULTY_COLORS[item.difficulty] ?? '#ccc' }}
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
              </Pressable>
              <Pressable
                onPress={() => router.push(`/textbook-form?id=${item.id}`)}
                style={{ paddingHorizontal: 12, paddingVertical: 8 }}
                aria-label={`${item.title}を編集`}
              >
                <Text color="$color10" fontSize={20}>
                  ›
                </Text>
              </Pressable>
            </XStack>
          )}
        />
      )}

      <Modal
        visible={modalTextbook !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setModalTextbook(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.4)',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <YStack bg="$background" rounded="$4" p="$4" gap="$3">
            <Paragraph fontWeight="bold" numberOfLines={1}>
              {modalTextbook?.title}
            </Paragraph>
            <XStack items="center" gap="$2">
              <Input
                value={modalPage}
                onChangeText={setModalPage}
                keyboardType="numeric"
                style={{ width: 80, textAlign: 'center' }}
                aria-label="現在ページ"
              />
              <Paragraph color="$color10">/ {modalTextbook?.totalPages} ページ</Paragraph>
            </XStack>
            <XStack gap="$2">
              <Button flex={1} variant="outlined" onPress={() => setModalTextbook(null)}>
                キャンセル
              </Button>
              <Button flex={1} theme="blue" onPress={handleModalSave}>
                保存
              </Button>
            </XStack>
          </YStack>
        </View>
      </Modal>
    </>
  );
}
