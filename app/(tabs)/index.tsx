import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, View } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

import { PracticeChart } from '@/components/practice-chart';
import { BASIC_MENUS, today } from '@/forms/practice-log';
import { usePracticeLogStore } from '@/store/practice-log';

function dayOfWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return ['日', '月', '火', '水', '木', '金', '土'][new Date(y, m - 1, d).getDay()];
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y}年${Number(m)}月`;
}

export default function PracticeLogScreen() {
  const sessions = usePracticeLogStore((s) => s.sessions);
  const loading = usePracticeLogStore((s) => s.loading);
  const fetchAll = usePracticeLogStore((s) => s.fetchAll);
  const remove = usePracticeLogStore((s) => s.remove);

  const currentMonth = today().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const monthSessions = sessions.filter((s) => s.practicedAt.startsWith(selectedMonth));
  const totalMinutes = monthSessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);

  function prevMonth() {
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  function nextMonth() {
    if (selectedMonth >= currentMonth) return;
    const [y, m] = selectedMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

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
        data={monthSessions}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <YStack>
            <XStack justify="space-between" items="center" px="$4" pt="$3" pb="$1">
              <Pressable onPress={prevMonth} aria-label="前月へ">
                <Paragraph color="$blue9" fontSize="$5">
                  ＜
                </Paragraph>
              </Pressable>
              <YStack items="center" gap="$1">
                <Paragraph fontWeight="bold">{formatMonthLabel(selectedMonth)}</Paragraph>
                <Paragraph fontSize="$2" color="$color10">
                  {`${monthSessions.length}回 / 計${totalMinutes}分`}
                </Paragraph>
              </YStack>
              <Pressable
                onPress={nextMonth}
                disabled={selectedMonth >= currentMonth}
                aria-label="次月へ"
              >
                <Paragraph
                  color={selectedMonth >= currentMonth ? '$color9' : '$blue9'}
                  fontSize="$5"
                >
                  ＞
                </Paragraph>
              </Pressable>
            </XStack>
            {monthSessions.length > 0 && (
              <View accessible={true} aria-label="月別練習グラフ">
                <PracticeChart sessions={monthSessions} month={selectedMonth} />
              </View>
            )}
            <Pressable
              onPress={() => router.push('/practice-log-form')}
              style={{ alignSelf: 'flex-end', paddingHorizontal: 16, paddingVertical: 4 }}
            >
              <Paragraph color="$blue9" fontSize="$2">
                ＋ 記録
              </Paragraph>
            </Pressable>
          </YStack>
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
                      entry.menuType === 'tonguing' && entry.tempoBpms.length > 0
                        ? ` ♩=${entry.tempoBpms.join(', ')}`
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
