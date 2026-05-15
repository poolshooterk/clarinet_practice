import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { Alert, FlatList, Pressable } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

import { BASIC_MENUS } from '@/forms/practice-log';
import { usePracticeLogStore } from '@/store/practice-log';

function dayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return ['日', '月', '火', '水', '木', '金', '土'][new Date(y, m - 1, d).getDay()];
}

export default function PracticeLogScreen() {
  const sessions = usePracticeLogStore((s) => s.sessions);
  const loading = usePracticeLogStore((s) => s.loading);
  const fetchAll = usePracticeLogStore((s) => s.fetchAll);
  const remove = usePracticeLogStore((s) => s.remove);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthSessions = sessions.filter((s) => s.practicedAt.startsWith(currentMonth));
  const totalMinutes = monthSessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

  const handleLongPress = (id: string) => {
    Alert.alert('練習記録を削除', 'この記録を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除', style: 'destructive', onPress: () => remove(id) },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: '練習記録' }} />
      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <XStack justify="space-between" items="center" p="$3">
            <Paragraph fontSize="$2" color="$color10">
              {`${currentMonth.slice(5)}月: ${monthSessions.length}回 / 計${totalMinutes}分`}
            </Paragraph>
            <Pressable onPress={() => router.push('/practice-log-form')}>
              <Paragraph color="$blue9" fontSize="$2">
                ＋ 記録
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
          <Pressable onLongPress={() => handleLongPress(item.id)}>
            <YStack
              mx="$3"
              mb="$2"
              p="$3"
              bg="$color1"
              rounded="$3"
              borderWidth={1}
              borderColor="$borderColor"
            >
              <XStack justify="space-between" items="baseline" mb="$1">
                <Paragraph fontWeight="bold">
                  {`${item.practicedAt}（${dayOfWeek(item.practicedAt)}）`}
                </Paragraph>
                {item.durationMinutes != null && (
                  <Paragraph fontSize="$2" color="$color10">
                    {`${item.durationMinutes}分`}
                  </Paragraph>
                )}
              </XStack>
              {item.memo ? (
                <Paragraph fontSize="$2" color="$color11" numberOfLines={1} mb="$1">
                  {item.memo}
                </Paragraph>
              ) : null}
              {item.textbookEntries.map((entry) => (
                <XStack key={entry.textbookId} gap="$2" items="center">
                  <Paragraph fontSize="$2">{entry.textbookTitle}</Paragraph>
                  <Paragraph fontSize="$2" color="$blue9" ml="auto">
                    {`p.${entry.currentPage}`}
                  </Paragraph>
                </XStack>
              ))}
              {item.basicMenuEntries.length > 0 && (
                <XStack gap="$3" mt="$1" flexWrap="wrap">
                  {item.basicMenuEntries.map((entry) => {
                    const label =
                      BASIC_MENUS.find((m) => m.type === entry.menuType)?.label ?? entry.menuType;
                    const suffix =
                      entry.menuType === 'tonguing' && entry.tempoBpm != null
                        ? ` ♩=${entry.tempoBpm}`
                        : '';
                    return (
                      <Paragraph key={entry.menuType} fontSize="$2" color="$color10">
                        {`${label}: ${entry.durationMinutes}分${suffix}`}
                      </Paragraph>
                    );
                  })}
                </XStack>
              )}
            </YStack>
          </Pressable>
        )}
      />
    </>
  );
}
