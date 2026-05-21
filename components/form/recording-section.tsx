import { Audio } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable } from 'react-native';
import { Input, Paragraph, XStack, YStack } from 'tamagui';

import {
  createSound,
  pauseRecording,
  resumeRecording,
  startRecording,
  stopRecording,
} from '@/lib/recording';
import type { SessionRecording } from '@/store/practice-log';

export type TempRecording = { tempUri: string; memo: string };
export type RecordingChange = { toAdd: TempRecording[]; toDelete: string[] };

type ActiveStatus = 'recording' | 'paused';

type Props = {
  existingRecordings: SessionRecording[];
  onChange: (change: RecordingChange) => void;
};

type RecordingCardProps = {
  label: string;
  uri: string;
  memo?: string;
  memoEditable?: boolean;
  onMemoChange?: (memo: string) => void;
  onDelete: () => void;
};

function RecordingCard({
  label,
  uri,
  memo,
  memoEditable,
  onMemoChange,
  onDelete,
}: RecordingCardProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  async function handlePlayPause() {
    if (soundRef.current && isPlaying) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
      return;
    }
    if (!soundRef.current) {
      const sound = await createSound(uri);
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (!status.isLoaded) return;
        setPosition(status.positionMillis);
        setDuration(status.durationMillis ?? 0);
        if (status.didJustFinish) {
          setIsPlaying(false);
          setPosition(0);
          sound.setPositionAsync(0).catch(() => {});
        }
      });
    }
    await soundRef.current.playAsync();
    setIsPlaying(true);
  }

  function formatMs(ms: number): string {
    const s = Math.floor(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  return (
    <YStack bg="$color1" rounded="$3" p="$3" gap="$2" borderWidth={1} borderColor="$borderColor">
      <XStack items="center" gap="$2">
        <Paragraph color="$blue10" fontSize="$2" fontWeight="bold" style={{ minWidth: 52 }}>
          {label}
        </Paragraph>
        <YStack flex={1} gap="$1">
          <YStack height={4} bg="$color3" rounded="$1" overflow="hidden">
            <YStack
              height={4}
              bg="$blue9"
              rounded="$1"
              style={{ width: duration > 0 ? `${Math.round((position / duration) * 100)}%` : '0%' }}
            />
          </YStack>
          <XStack justify="space-between">
            <Paragraph fontSize="$1" color="$color10">
              {formatMs(position)}
            </Paragraph>
            <Paragraph fontSize="$1" color="$color11">
              {formatMs(duration)}
            </Paragraph>
          </XStack>
        </YStack>
        <Pressable onPress={handlePlayPause} aria-label={isPlaying ? '一時停止' : '再生'}>
          <YStack
            width={32}
            height={32}
            rounded="$10"
            bg="$blue2"
            borderWidth={2}
            borderColor="$blue9"
            items="center"
            justify="center"
          >
            <Paragraph color="$blue9" fontSize="$2">
              {isPlaying ? '⏸' : '▶'}
            </Paragraph>
          </YStack>
        </Pressable>
        <Pressable onPress={onDelete} aria-label={`${label}を削除`}>
          <Paragraph color="$red9" fontSize="$4">
            ✕
          </Paragraph>
        </Pressable>
      </XStack>
      {memoEditable ? (
        <Input
          size="$3"
          placeholder="メモ（省略可）"
          value={memo ?? ''}
          onChangeText={onMemoChange}
        />
      ) : memo ? (
        <Paragraph fontSize="$2" color="$color10">
          {memo}
        </Paragraph>
      ) : null}
    </YStack>
  );
}

function RecordingSectionNative({ existingRecordings, onChange }: Props) {
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState<TempRecording[]>([]);
  const [activeStatus, setActiveStatus] = useState<ActiveStatus | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const remaining = existingRecordings.filter((r) => !deletedIds.includes(r.id));
  const totalCount = remaining.length + confirmed.length;
  const canAdd = totalCount < 3 && activeStatus === null;

  function notify(nextConfirmed: TempRecording[], nextDeletedIds: string[]) {
    onChangeRef.current({ toAdd: nextConfirmed, toDelete: nextDeletedIds });
  }

  async function handleStart() {
    try {
      const rec = await startRecording();
      recordingRef.current = rec;
      setElapsed(0);
      setActiveStatus('recording');
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      // パーミッション拒否など
    }
  }

  async function handlePause() {
    if (!recordingRef.current) return;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    await pauseRecording(recordingRef.current);
    setActiveStatus('paused');
  }

  async function handleResume() {
    if (!recordingRef.current) return;
    await resumeRecording(recordingRef.current);
    setActiveStatus('recording');
    intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }

  async function handleStop() {
    if (!recordingRef.current) return;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    try {
      const uri = await stopRecording(recordingRef.current);
      recordingRef.current = null;
      setActiveStatus(null);
      const next = [...confirmed, { tempUri: uri, memo: '' }];
      setConfirmed(next);
      notify(next, deletedIds);
    } catch {
      recordingRef.current = null;
      setActiveStatus(null);
    }
  }

  function handleDeleteExisting(id: string) {
    const next = [...deletedIds, id];
    setDeletedIds(next);
    notify(confirmed, next);
  }

  function handleDeleteConfirmed(idx: number) {
    const next = confirmed.filter((_, i) => i !== idx);
    setConfirmed(next);
    notify(next, deletedIds);
  }

  function handleMemoChange(idx: number, memo: string) {
    const next = confirmed.map((c, i) => (i === idx ? { ...c, memo } : c));
    setConfirmed(next);
    notify(next, deletedIds);
  }

  function formatSeconds(s: number): string {
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  return (
    <YStack gap="$2" p="$3" bg="$color1" rounded="$3" borderWidth={1} borderColor="$borderColor">
      <Paragraph fontSize="$2" color="$color10">
        録音 ({totalCount}/3)
      </Paragraph>

      {remaining.map((rec, i) => (
        <RecordingCard
          key={rec.id}
          label={`録音 ${i + 1}`}
          uri={rec.localUri}
          memo={rec.memo ?? undefined}
          onDelete={() => handleDeleteExisting(rec.id)}
        />
      ))}

      {confirmed.map((item, i) => (
        <RecordingCard
          key={item.tempUri}
          label={`録音 ${remaining.length + i + 1}`}
          uri={item.tempUri}
          memo={item.memo}
          memoEditable
          onMemoChange={(memo) => handleMemoChange(i, memo)}
          onDelete={() => handleDeleteConfirmed(i)}
        />
      ))}

      {activeStatus !== null && (
        <YStack
          bg="$color1"
          rounded="$3"
          p="$3"
          gap="$3"
          borderWidth={1.5}
          borderColor={activeStatus === 'recording' ? '$red8' : '$yellow8'}
        >
          <XStack items="center" gap="$2">
            <YStack
              width={10}
              height={10}
              rounded="$10"
              bg={activeStatus === 'recording' ? '$red9' : '$yellow9'}
            />
            <Paragraph
              fontSize="$2"
              fontWeight="600"
              color={activeStatus === 'recording' ? '$red9' : '$yellow9'}
            >
              {activeStatus === 'recording'
                ? `REC ${formatSeconds(elapsed)}`
                : `PAUSE ${formatSeconds(elapsed)}`}
            </Paragraph>
          </XStack>
          <XStack gap="$2">
            {activeStatus === 'recording' ? (
              <Pressable style={{ flex: 1 }} onPress={handlePause} aria-label="一時停止">
                <YStack
                  p="$2"
                  rounded="$2"
                  bg="$color2"
                  borderWidth={1}
                  borderColor="$borderColor"
                  items="center"
                >
                  <Paragraph fontWeight="600">⏸ 一時停止</Paragraph>
                </YStack>
              </Pressable>
            ) : (
              <Pressable style={{ flex: 1 }} onPress={handleResume} aria-label="録音を再開">
                <YStack
                  p="$2"
                  rounded="$2"
                  bg="$blue2"
                  borderWidth={1}
                  borderColor="$blue8"
                  items="center"
                >
                  <Paragraph color="$blue9" fontWeight="600">
                    ▶ 再開
                  </Paragraph>
                </YStack>
              </Pressable>
            )}
            <Pressable style={{ flex: 1 }} onPress={handleStop} aria-label="録音を停止">
              <YStack
                p="$2"
                rounded="$2"
                bg="$red2"
                borderWidth={1}
                borderColor="$red8"
                items="center"
              >
                <Paragraph color="$red9" fontWeight="600">
                  ■ 停止
                </Paragraph>
              </YStack>
            </Pressable>
          </XStack>
        </YStack>
      )}

      {canAdd && (
        <Pressable onPress={handleStart} aria-label="録音を追加">
          <YStack
            p="$3"
            rounded="$3"
            items="center"
            borderWidth={1.5}
            borderStyle="dashed"
            borderColor="$blue8"
          >
            <Paragraph color="$blue9" fontWeight="500">
              ＋ 録音を追加 (残り {3 - totalCount})
            </Paragraph>
          </YStack>
        </Pressable>
      )}
    </YStack>
  );
}

export function RecordingSection(props: Props) {
  if (Platform.OS === 'web') return null;
  return <RecordingSectionNative {...props} />;
}
