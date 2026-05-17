import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Alert, Pressable } from 'react-native';
import { Button, Paragraph, YStack } from 'tamagui';

import { PracticeLogForm, type PracticeLogFormRef } from '@/components/practice-log-form';
import { type PracticeLogInput } from '@/forms/practice-log';
import { usePracticeLogStore } from '@/store/practice-log';

export default function PracticeLogFormScreen() {
  const formRef = useRef<PracticeLogFormRef>(null);
  const { id } = useLocalSearchParams<{ id?: string }>();

  const sessions = usePracticeLogStore((s) => s.sessions);
  const add = usePracticeLogStore((s) => s.add);
  const update = usePracticeLogStore((s) => s.update);
  const remove = usePracticeLogStore((s) => s.remove);

  const editingSession = id ? sessions.find((s) => s.id === id) : undefined;

  const initialValues: PracticeLogInput | undefined = editingSession
    ? {
        practicedAt: editingSession.practicedAt,
        longToneMinutes: editingSession.basicMenuEntries.find((m) => m.menuType === 'long_tone')
          ?.durationMinutes,
        tonguingMinutes: editingSession.basicMenuEntries.find((m) => m.menuType === 'tonguing')
          ?.durationMinutes,
        tonguingTempoBpms:
          editingSession.basicMenuEntries
            .find((m) => m.menuType === 'tonguing')
            ?.tempoBpms.map((bpm) => ({ bpm })) ?? [],
        otherMinutes: editingSession.otherMinutes ?? undefined,
        memo: editingSession.memo ?? '',
        textbookEntries: editingSession.textbookEntries.map((e) => ({
          textbookId: e.textbookId,
          currentPage: e.currentPage,
          durationMinutes: e.durationMinutes ?? undefined,
          tempoBpms: e.tempoBpm != null ? [{ bpm: e.tempoBpm }] : [],
        })),
      }
    : undefined;

  const handleSubmit = async (data: PracticeLogInput) => {
    if (id) {
      await update(id, data);
    } else {
      await add(data);
    }
    router.back();
  };

  const handleDelete = () => {
    Alert.alert('練習記録を削除', 'この記録を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await remove(id!);
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: id ? '練習記録を編集' : '練習を記録',
          headerShown: true,
          headerRight: () => (
            <Pressable onPress={() => formRef.current?.submit()}>
              <Paragraph color="$blue9" mr="$2">
                保存
              </Paragraph>
            </Pressable>
          ),
        }}
      />
      <PracticeLogForm ref={formRef} onSubmit={handleSubmit} initialValues={initialValues} />
      {id && (
        <YStack px="$4" pb="$6">
          <Button theme="red" onPress={handleDelete} aria-label="練習記録を削除">
            この練習記録を削除
          </Button>
        </YStack>
      )}
    </>
  );
}
