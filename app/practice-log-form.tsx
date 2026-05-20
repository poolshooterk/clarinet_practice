import * as FileSystem from 'expo-file-system/legacy';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { Button, Paragraph, YStack } from 'tamagui';

import { PracticeLogForm, type PracticeLogFormRef } from '@/components/practice-log-form';
import { type PracticeLogInput } from '@/forms/practice-log';
import { deleteRecording, getRecordingUri } from '@/lib/recording';
import { usePracticeLogStore } from '@/store/practice-log';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';

export default function PracticeLogFormScreen() {
  const formRef = useRef<PracticeLogFormRef>(null);
  const { id: urlId } = useLocalSearchParams<{ id?: string }>();

  const sessions = usePracticeLogStore((s) => s.sessions);
  const add = usePracticeLogStore((s) => s.add);
  const update = usePracticeLogStore((s) => s.update);
  const remove = usePracticeLogStore((s) => s.remove);

  // 新規 vs 編集モードは urlId の有無で 1:1 に確定する。フォーム内での日付変更による
  // 自動切替は行わない (重複時は DB の UNIQUE 制約 + duplicate Alert で誘導する)
  const effectiveId = urlId;

  // フォーカス時に教本カタログと練習記録を再フェッチ。教本カタログが空のまま
  // Select.Value が render されると、選択中の textbookId (UUID) がそのまま
  // トリガーに露出するため、画面表示のたびに必ず最新化する。
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

  const [existingRecordingUri, setExistingRecordingUri] = useState<string | null>(null);

  useEffect(() => {
    if (!effectiveId) {
      setExistingRecordingUri(null);
      return;
    }
    const uri = getRecordingUri(effectiveId);
    FileSystem.getInfoAsync(uri).then((info) => {
      setExistingRecordingUri(info.exists ? uri : null);
    });
  }, [effectiveId]);

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
    const tempUri = formRef.current?.getTempRecordingUri() ?? null;
    const result = effectiveId
      ? await update(effectiveId, data, tempUri)
      : await add(data, tempUri);
    if (!result.ok) {
      Alert.alert(
        '保存できません',
        result.reason === 'duplicate'
          ? '同じ日付の練習記録が既に存在します。一覧から該当の記録を選んで編集してください。'
          : '保存中にエラーが発生しました。時間を置いて再度お試しください。',
      );
      return;
    }
    if (effectiveId && !tempUri && (formRef.current?.shouldDeleteExistingRecording() ?? false)) {
      await deleteRecording(effectiveId);
    }
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
        existingRecordingUri={existingRecordingUri}
      />
      {effectiveId && (
        <YStack px="$4" pb="$6">
          <Button theme="red" onPress={handleDelete} aria-label="練習記録を削除">
            この練習記録を削除
          </Button>
        </YStack>
      )}
    </>
  );
}
