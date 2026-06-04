import { usePreventRemove } from '@react-navigation/native';
import { router, Stack, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { Button, Paragraph, YStack } from 'tamagui';

import { PracticeLogForm, type PracticeLogFormRef } from '@/components/practice-log-form';
import { RecordingMoveSheet } from '@/components/recording-move-sheet';
import { type PracticeLogInput } from '@/forms/practice-log';
import { type SessionRecording, usePracticeLogStore } from '@/store/practice-log';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';

export default function PracticeLogFormScreen() {
  const formRef = useRef<PracticeLogFormRef>(null);
  const navigation = useNavigation();
  const savedRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [movingRec, setMovingRec] = useState<SessionRecording | null>(null);
  const { id: urlId } = useLocalSearchParams<{ id?: string }>();

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

  const sessions = usePracticeLogStore((s) => s.sessions);
  const add = usePracticeLogStore((s) => s.add);
  const update = usePracticeLogStore((s) => s.update);
  const remove = usePracticeLogStore((s) => s.remove);

  const effectiveId = urlId;

  useFocusEffect(
    useCallback(() => {
      useTextbookCatalogStore.getState().fetchAll();
      usePracticeLogStore.getState().fetchAll();
    }, []),
  );

  const editingSession = useMemo(
    () => (effectiveId ? sessions.find((s) => s.id === effectiveId) : undefined),
    [effectiveId, sessions],
  );

  const initialValues = useMemo<PracticeLogInput | undefined>(
    () =>
      editingSession
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
            otherMemo: editingSession.otherMemo ?? '',
            memo: editingSession.memo ?? '',
            reedNumber: editingSession.reedNumber ?? '',
            textbookEntries: editingSession.textbookEntries.map((e) => ({
              textbookId: e.textbookId,
              currentPage: e.currentPage,
              durationMinutes: e.durationMinutes ?? undefined,
              tempoBpms: e.tempoBpm != null ? [{ bpm: e.tempoBpm }] : [],
            })),
          }
        : undefined,
    [editingSession],
  );

  const handleSubmit = async (data: PracticeLogInput) => {
    const recChange = formRef.current?.getRecordingChange() ?? { toAdd: [], toDelete: [] };
    const result = effectiveId
      ? await update(effectiveId, data, recChange.toAdd, recChange.toDelete)
      : await add(data, recChange.toAdd);
    if (!result.ok) {
      Alert.alert(
        '保存できません',
        result.reason === 'duplicate'
          ? '同じ日付の練習記録が既に存在します。一覧から該当の記録を選んで編集してください。'
          : '保存中にエラーが発生しました。時間を置いて再度お試しください。',
      );
      return;
    }
    savedRef.current = true;
    router.back();
  };

  const handleDelete = () => {
    if (!effectiveId) return;
    Alert.alert('練習記録を削除', 'この記録を削除しますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await remove(effectiveId);
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
          title: effectiveId ? '練習記録を編集' : '練習を記録',
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
      <PracticeLogForm
        ref={formRef}
        onSubmit={handleSubmit}
        initialValues={initialValues}
        existingRecordings={editingSession?.recordings ?? []}
        onDirtyChange={setDirty}
        onMoveExisting={setMovingRec}
      />
      {effectiveId && (
        <YStack px="$4" pb="$6">
          <Button theme="red" onPress={handleDelete} aria-label="練習記録を削除">
            この練習記録を削除
          </Button>
        </YStack>
      )}
      {effectiveId && (
        <RecordingMoveSheet
          recording={movingRec}
          sourceType="practice"
          sourceRecordId={effectiveId}
          onClose={() => setMovingRec(null)}
        />
      )}
    </>
  );
}
