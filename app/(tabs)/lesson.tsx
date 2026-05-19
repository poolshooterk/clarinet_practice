import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

import { formatHeldAt } from '@/forms/lesson-record';
import { loadRecordedIds } from '@/lib/recording';
import { useLessonRecordStore } from '@/store/lesson-record';

export default function LessonScreen() {
  const records = useLessonRecordStore((s) => s.records);
  const loading = useLessonRecordStore((s) => s.loading);
  const fetchAll = useLessonRecordStore((s) => s.fetchAll);
  const remove = useLessonRecordStore((s) => s.remove);

  const [recordedIds, setRecordedIds] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      fetchAll();
      loadRecordedIds().then(setRecordedIds);
    }, [fetchAll]),
  );

  const handleLongPress = (id: string) => {
    Alert.alert('レッスン記録を削除', 'この記録を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => remove(id) },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: 'レッスン' }} />
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <XStack justify="space-between" items="center" p="$3">
            <Paragraph fontSize="$2" color="$color10">
              {`${records.length}件`}
            </Paragraph>
            <Pressable onPress={() => router.push('/lesson-record-form')}>
              <Paragraph color="$blue9" fontSize="$2">
                ＋ 追加
              </Paragraph>
            </Pressable>
          </XStack>
        }
        ListEmptyComponent={
          !loading ? (
            <Paragraph text="center" color="$color10" mt="$8">
              記録がまだありません
            </Paragraph>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/lesson-record-form?id=${item.id}`)}
            onLongPress={() => handleLongPress(item.id)}
            accessibilityLabel={`${formatHeldAt(item.heldAt)}のレッスン記録を編集`}
          >
            <YStack
              mx="$3"
              mb="$2"
              p="$3"
              bg="$color1"
              rounded="$3"
              borderWidth={1}
              borderColor="$borderColor"
            >
              <XStack items="center" gap="$2">
                <Paragraph fontWeight="bold">{formatHeldAt(item.heldAt)}</Paragraph>
                {recordedIds.has(item.id) && (
                  <Paragraph
                    fontSize="$1"
                    color="$blue9"
                    bg="$blue3"
                    px="$1"
                    rounded="$1"
                    borderWidth={1}
                    borderColor="$blue7"
                  >
                    ♪
                  </Paragraph>
                )}
              </XStack>
              {item.advice ? (
                <Paragraph fontSize="$2" color="$color11" numberOfLines={2} mt="$1">
                  {item.advice}
                </Paragraph>
              ) : null}
              {item.notes ? (
                <Paragraph fontSize="$2" color="$color10" numberOfLines={2} mt="$1">
                  {item.notes}
                </Paragraph>
              ) : null}
            </YStack>
          </Pressable>
        )}
      />
    </>
  );
}
