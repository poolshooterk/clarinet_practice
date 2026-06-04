import { usePreventRemove } from '@react-navigation/native';
import { router, Stack, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, ScrollView } from 'react-native';

import type { RecordingChange } from '@/components/form/recording-section';
import { LessonRecordForm } from '@/components/lesson-record-form';
import { RecordingMoveSheet } from '@/components/recording-move-sheet';
import { type LessonRecordInput, splitHeldAt } from '@/forms/lesson-record';
import { useLessonRecordStore } from '@/store/lesson-record';
import type { SessionRecording } from '@/store/practice-log';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';

export default function LessonRecordFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();
  const records = useLessonRecordStore((s) => s.records);
  const add = useLessonRecordStore((s) => s.add);
  const update = useLessonRecordStore((s) => s.update);
  const remove = useLessonRecordStore((s) => s.remove);

  const savedRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [movingRec, setMovingRec] = useState<SessionRecording | null>(null);

  // 未保存の入力・録音がある状態で戻ろうとしたら確認する。保存・削除済みは savedRef でバイパス。
  usePreventRemove(dirty, ({ data }) => {
    if (savedRef.current) {
      navigation.dispatch(data.action);
      return;
    }
    Alert.alert('変更を破棄しますか？', '保存していない入力や録音があります。', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '破棄', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

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
    savedRef.current = true;
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
          savedRef.current = true;
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
          onDirtyChange={setDirty}
          onMoveExisting={setMovingRec}
        />
      </ScrollView>
      {id && (
        <RecordingMoveSheet
          recording={movingRec}
          sourceType="lesson"
          sourceRecordId={id}
          onClose={() => setMovingRec(null)}
        />
      )}
    </>
  );
}
