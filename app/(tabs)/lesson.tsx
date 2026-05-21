import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

import { formatHeldAt, today } from '@/forms/lesson-record';
import { useLessonRecordStore } from '@/store/lesson-record';

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-');
  return `${y}年${Number(m)}月`;
}

export default function LessonScreen() {
  const records = useLessonRecordStore((s) => s.records);
  const loading = useLessonRecordStore((s) => s.loading);
  const fetchAll = useLessonRecordStore((s) => s.fetchAll);
  const remove = useLessonRecordStore((s) => s.remove);

  const currentMonth = today().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

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

  const monthRecords = records.filter((r) => r.heldAt.startsWith(selectedMonth));

  const monthlySummary = useMemo(() => {
    const sorted = [...monthRecords].sort((a, b) => a.heldAt.localeCompare(b.heldAt));
    const byTextbook = new Map<string, { title: string; pages: number[] }>();
    for (const record of sorted) {
      for (const entry of record.textbookEntries) {
        if (!byTextbook.has(entry.textbookId)) {
          byTextbook.set(entry.textbookId, { title: entry.textbookTitle, pages: [] });
        }
        byTextbook.get(entry.textbookId)!.pages.push(entry.currentPage);
      }
    }
    const progress = Array.from(byTextbook.values())
      .map(({ title, pages }) => ({
        title,
        first: pages[0],
        last: pages[pages.length - 1],
        delta: pages[pages.length - 1] - pages[0],
      }))
      .filter((p) => p.delta > 0);
    return { count: monthRecords.length, progress };
  }, [monthRecords]);

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
        data={monthRecords}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <YStack>
            <XStack justify="space-between" items="center" px="$4" pt="$3" pb="$1">
              <Pressable onPress={prevMonth} aria-label="前月へ">
                <Paragraph color="$blue9" fontSize="$5">
                  ＜
                </Paragraph>
              </Pressable>
              <Paragraph fontWeight="bold" fontSize="$4">
                {formatMonthLabel(selectedMonth)}
              </Paragraph>
              <Pressable
                onPress={nextMonth}
                aria-label="次月へ"
                disabled={selectedMonth >= currentMonth}
              >
                <Paragraph
                  color={selectedMonth >= currentMonth ? '$color8' : '$blue9'}
                  fontSize="$5"
                >
                  ＞
                </Paragraph>
              </Pressable>
            </XStack>

            {monthlySummary.count > 0 && (
              <YStack
                mx="$3"
                mb="$2"
                p="$3"
                bg="$color1"
                rounded="$3"
                borderWidth={1}
                borderColor="$borderColor"
                gap="$1"
              >
                <Paragraph fontSize="$3" fontWeight="600">
                  今月のレッスン: {monthlySummary.count}回
                </Paragraph>
                {monthlySummary.progress.map((p) => (
                  <Paragraph key={p.title} fontSize="$2" color="$color11">
                    {`● ${p.title} p.${p.first}→p.${p.last} (+${p.delta})`}
                  </Paragraph>
                ))}
              </YStack>
            )}

            <XStack justify="space-between" items="center" px="$3" pb="$1">
              <Paragraph fontSize="$2" color="$color10">{`${monthlySummary.count}件`}</Paragraph>
              <Pressable onPress={() => router.push('/lesson-record-form')}>
                <Paragraph color="$blue9" fontSize="$2">
                  ＋ 追加
                </Paragraph>
              </Pressable>
            </XStack>
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
                {item.recordings.length > 0 && (
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
              {item.textbookEntries.length > 0 && (
                <Paragraph fontSize="$2" color="$color10" mt="$1">
                  {item.textbookEntries
                    .map((e) => `${e.textbookTitle} p.${e.currentPage}`)
                    .join(' / ')}
                </Paragraph>
              )}
            </YStack>
          </Pressable>
        )}
      />
    </>
  );
}
