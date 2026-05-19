import * as FileSystem from 'expo-file-system/legacy';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView } from 'react-native';

import { LessonRecordForm } from '@/components/lesson-record-form';
import { type LessonRecordInput, splitHeldAt } from '@/forms/lesson-record';
import { deleteRecording, getRecordingUri } from '@/lib/recording';
import { useLessonRecordStore } from '@/store/lesson-record';

export default function LessonRecordFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const records = useLessonRecordStore((s) => s.records);
  const add = useLessonRecordStore((s) => s.add);
  const update = useLessonRecordStore((s) => s.update);
  const remove = useLessonRecordStore((s) => s.remove);

  const existing = id ? records.find((r) => r.id === id) : undefined;

  const [existingRecordingUri, setExistingRecordingUri] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const uri = getRecordingUri(id);
    FileSystem.getInfoAsync(uri).then((info) => {
      if (info.exists) setExistingRecordingUri(uri);
    });
  }, [id]);

  let defaultValues: LessonRecordInput | undefined;
  if (existing) {
    const { date, time } = splitHeldAt(existing.heldAt);
    defaultValues = {
      date,
      time,
      advice: existing.advice ?? '',
      notes: existing.notes ?? '',
    };
  }

  const handleSave = async (
    values: LessonRecordInput,
    tempUri: string | null,
    shouldDeleteExisting: boolean,
  ) => {
    if (id) {
      await update(id, values, tempUri);
      if (shouldDeleteExisting) await deleteRecording(id);
    } else {
      await add(values, tempUri);
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
          existingRecordingUri={existingRecordingUri}
          onSubmit={handleSave}
          onDelete={id ? handleDelete : undefined}
        />
      </ScrollView>
    </>
  );
}
