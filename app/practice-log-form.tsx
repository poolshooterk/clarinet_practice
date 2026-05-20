import * as FileSystem from 'expo-file-system/legacy';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { Button, Paragraph, YStack } from 'tamagui';

import { PracticeLogForm, type PracticeLogFormRef } from '@/components/practice-log-form';
import { type PracticeLogInput, today } from '@/forms/practice-log';
import { deleteRecording, getRecordingUri } from '@/lib/recording';
import { usePracticeLogStore } from '@/store/practice-log';

export default function PracticeLogFormScreen() {
  const formRef = useRef<PracticeLogFormRef>(null);
  const { id: urlId } = useLocalSearchParams<{ id?: string }>();

  const sessions = usePracticeLogStore((s) => s.sessions);
  const add = usePracticeLogStore((s) => s.add);
  const update = usePracticeLogStore((s) => s.update);
  const remove = usePracticeLogStore((s) => s.remove);

  // urlId: ルーティングで指定された編集対象。effectiveId: 同日既存検出で透過的に切替わる実効 id
  const [effectiveId, setEffectiveId] = useState<string | undefined>(urlId);

  // mount 時 / sessions rehydrate 後 / urlId 変更時に「未指定なら今日に同日既存があるか」を判定
  useEffect(() => {
    if (urlId) {
      setEffectiveId(urlId);
      return;
    }
    const match = sessions.find((s) => s.practicedAt === today());
    if (match) setEffectiveId(match.id);
  }, [urlId, sessions]);

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

  // フォーム内の日付欄が変わったら、その日付の既存セッションを探し透過的に編集モードへ切替
  const handlePracticedAtChange = useCallback(
    (date: string) => {
      const match = sessions.find((s) => s.practicedAt === date && s.id !== effectiveId);
      if (match) {
        setEffectiveId(match.id);
      } else if (!urlId && effectiveId) {
        // 新規モードで開いた後、空き日付に戻したら新規モードへ復帰
        const stillMatches = sessions.some((s) => s.id === effectiveId && s.practicedAt === date);
        if (!stillMatches) setEffectiveId(undefined);
      }
    },
    [sessions, effectiveId, urlId],
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
        onPracticedAtChange={handlePracticedAtChange}
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
