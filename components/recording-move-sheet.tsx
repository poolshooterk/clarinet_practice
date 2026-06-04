import { Alert, Modal, Pressable } from 'react-native';
import { Paragraph, ScrollView, XStack, YStack } from 'tamagui';

import { useLessonRecordStore } from '@/store/lesson-record';
import type { SessionRecording } from '@/store/practice-log';
import { usePracticeLogStore } from '@/store/practice-log';
import {
  buildMoveCandidates,
  type MoveCandidate,
  moveRecording,
  type RecordKind,
} from '@/store/recording-transfer';

type Props = {
  recording: SessionRecording | null;
  sourceType: RecordKind;
  sourceRecordId: string;
  onClose: () => void;
};

// 保存済み録音を別の記録 (練習/レッスン) へ移動する先を選ぶシート。
// recording が非 null の時に開く。候補は空きスロットのある他記録のみ。
export function RecordingMoveSheet({ recording, sourceType, sourceRecordId, onClose }: Props) {
  const sessions = usePracticeLogStore((s) => s.sessions);
  const records = useLessonRecordStore((s) => s.records);

  const candidates = recording
    ? buildMoveCandidates(sessions, records, sourceType, sourceRecordId)
    : [];

  function handleSelect(candidate: MoveCandidate) {
    if (!recording) return;
    Alert.alert('録音を移動', `「${candidate.label}」へ移動しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '移動',
        onPress: async () => {
          const result = await moveRecording({
            sourceType,
            sourceRecordId,
            recording,
            targetType: candidate.kind,
            targetRecordId: candidate.id,
          });
          if (!result.ok) {
            Alert.alert(
              '移動に失敗しました',
              '移動先の空きが無いか、保存中にエラーが発生しました。',
            );
            return;
          }
          onClose();
        },
      },
    ]);
  }

  return (
    <Modal visible={recording != null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose} />
      <YStack
        bg="$background"
        borderTopLeftRadius="$4"
        borderTopRightRadius="$4"
        p="$4"
        gap="$3"
        style={{ maxHeight: '70%' }}
      >
        <XStack justify="space-between" items="center">
          <Paragraph fontSize="$5" fontWeight="bold">
            移動先を選択
          </Paragraph>
          <Pressable onPress={onClose} aria-label="閉じる">
            <Paragraph color="$color10" fontSize="$5">
              ✕
            </Paragraph>
          </Pressable>
        </XStack>

        {candidates.length === 0 ? (
          <Paragraph color="$color10" py="$4">
            移動先がありません（空きのある他の記録が必要です）。
          </Paragraph>
        ) : (
          <ScrollView>
            <YStack gap="$2">
              {candidates.map((c) => (
                <Pressable
                  key={`${c.kind}-${c.id}`}
                  onPress={() => handleSelect(c)}
                  aria-label={`${c.label} へ移動`}
                >
                  <YStack
                    p="$3"
                    rounded="$3"
                    bg="$color2"
                    borderWidth={1}
                    borderColor="$borderColor"
                  >
                    <Paragraph>{c.label}</Paragraph>
                  </YStack>
                </Pressable>
              ))}
            </YStack>
          </ScrollView>
        )}
      </YStack>
    </Modal>
  );
}
