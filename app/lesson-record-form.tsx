import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { Alert, ScrollView } from 'react-native';

import { LessonRecordForm } from '@/components/lesson-record-form';
import type { RecordingChange } from '@/components/form/recording-section';
import { type LessonRecordInput, splitHeldAt } from '@/forms/lesson-record';
import { useLessonRecordStore } from '@/store/lesson-record';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';

export default function LessonRecordFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const records = useLessonRecordStore((s) => s.records);
  const add = useLessonRecordStore((s) => s.add);
  const update = useLessonRecordStore((s) => s.update);
  const remove = useLessonRecordStore((s) => s.remove);

  const existing = id ? records.find((r) => r.id === id) : undefined;

  useFocusEffect(
    useCallback(() => {
      useTextbookCatalogStore.getState().fetchAll();
      useLessonRecordStore.getState().fetchAll();
    }, []),
  );

  let defaultValues: LessonRecordInput | undefined;
  if (existing) {
    const { date, time } = splitHeldAt(existing.heldAt);
    defaultValues = {
      date,
      time,
      advice: existing.advice ?? '',
      notes: existing.notes ?? '',
      textbookEntries: existing.textbookEntries.map((e) => ({
        textbookId: e.textbookId,
        currentPage: e.currentPage,
        durationMinutes: e.durationMinutes ?? undefined,
        tempoBpm: e.tempoBpm ?? undefined,
      })),
    };
  }

  const handleSave = async (values: LessonRecordInput, recChange: RecordingChange) => {
    if (id) {
      await update(id, values, recChange.toAdd, recChange.toDelete);
    } else {
      await add(values, recChange.toAdd);
    }
    router.back();
  };

  const handleDelete = () => {
    if (!id || !existing) return;
    Alert.alert('レッスン記録を削除', 'この記録を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await remove(id);
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: id ? 'レッスン記録を編集' : 'レッスン記録を追加',
        }}
      />
      <ScrollView>
        <LessonRecordForm
          defaultValues={defaultValues}
          existingRecordings={existing?.recordings ?? []}
          onSubmit={handleSave}
          onDelete={id ? handleDelete : undefined}
        />
      </ScrollView>
    </>
  );
}
