import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView } from 'react-native';
import { Button, Paragraph, YStack } from 'tamagui';

import { formatDate } from '@/forms/lesson-record';
import { exportErrorMessage, shareTextFile } from '@/lib/export';
import { buildLessonRecordsCsv, buildPracticeSessionsCsv } from '@/lib/export-format';
import { useLessonRecordStore } from '@/store/lesson-record';
import { usePracticeLogStore } from '@/store/practice-log';

export default function DataExportScreen() {
  const sessions = usePracticeLogStore((s) => s.sessions);
  const records = useLessonRecordStore((s) => s.records);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      usePracticeLogStore.getState().fetchAll();
      useLessonRecordStore.getState().fetchAll();
    }, []),
  );

  async function exportCsv(fileName: string, content: string) {
    setBusy(true);
    const result = await shareTextFile(fileName, content, 'csv');
    setBusy(false);
    if (!result.ok) Alert.alert('書き出せません', exportErrorMessage(result.reason));
  }

  const stamp = formatDate(new Date());

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'データの書き出し' }} />
      <ScrollView>
        <YStack p="$4" gap="$4">
          <Paragraph fontSize="$2" color="$color10">
            共有メニューから Google ドライブ・ファイル・メールなど、保存先のアプリを選べます。
          </Paragraph>
          <YStack gap="$2">
            <Paragraph color="$color12">練習記録 ({sessions.length}件)</Paragraph>
            <Button
              theme="blue"
              disabled={busy || sessions.length === 0}
              opacity={busy || sessions.length === 0 ? 0.5 : 1}
              onPress={() =>
                exportCsv(`clarinet_practice_${stamp}.csv`, buildPracticeSessionsCsv(sessions))
              }
              aria-label="練習記録を CSV で書き出す"
            >
              CSV で書き出す
            </Button>
          </YStack>
          <YStack gap="$2">
            <Paragraph color="$color12">レッスン記録 ({records.length}件)</Paragraph>
            <Button
              theme="blue"
              disabled={busy || records.length === 0}
              opacity={busy || records.length === 0 ? 0.5 : 1}
              onPress={() =>
                exportCsv(`clarinet_lesson_${stamp}.csv`, buildLessonRecordsCsv(records))
              }
              aria-label="レッスン記録を CSV で書き出す"
            >
              CSV で書き出す
            </Button>
          </YStack>
          <Paragraph fontSize="$2" color="$color10">
            録音と 1 件ごとの記録 (テキスト) は、各記録の編集画面から書き出せます。
          </Paragraph>
        </YStack>
      </ScrollView>
    </>
  );
}
