import { Audio } from 'expo-av';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable } from 'react-native';
import { Paragraph, XStack, YStack } from 'tamagui';

import { createSound, startRecording, stopRecording } from '@/lib/recording';

type RecordingState = 'idle' | 'recording' | 'recorded';

type Props = {
  existingRecordingUri?: string | null;
  onChange: (state: { tempUri: string | null; reRecordTriggered: boolean }) => void;
};

function RecordingSectionNative({ existingRecordingUri, onChange }: Props) {
  const [recState, setRecState] = useState<RecordingState>(() =>
    existingRecordingUri ? 'recorded' : 'idle',
  );
  const [tempUri, setTempUri] = useState<string | null>(existingRecordingUri ?? null);
  const activeRecordingRef = useRef<Audio.Recording | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [reRecordTriggered, setReRecordTriggered] = useState(false);
  // stale closure を避けるため onChange を ref に保持する
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const appliedExistingRef = useRef<string | null>(null);
  useEffect(() => {
    if (existingRecordingUri && appliedExistingRef.current !== existingRecordingUri) {
      appliedExistingRef.current = existingRecordingUri;
      setTempUri(existingRecordingUri);
      setRecState('recorded');
    }
  }, [existingRecordingUri]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (soundRef.current) soundRef.current.unloadAsync().catch(() => {});
    };
  }, []);

  async function handleStartRecording() {
    try {
      const recording = await startRecording();
      activeRecordingRef.current = recording;
      setElapsed(0);
      setRecState('recording');
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch {
      // パーミッション拒否など無視
    }
  }

  async function handleStopRecording() {
    if (!activeRecordingRef.current) return;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    try {
      const uri = await stopRecording(activeRecordingRef.current);
      activeRecordingRef.current = null;
      setTempUri(uri);
      setRecState('recorded');
      onChangeRef.current({ tempUri: uri, reRecordTriggered });
    } catch {
      activeRecordingRef.current = null;
      setRecState('idle');
    }
  }

  async function handlePlayPause() {
    if (!tempUri) return;
    if (soundRef.current && isPlaying) {
      await soundRef.current.pauseAsync();
      setIsPlaying(false);
      return;
    }
    if (!soundRef.current) {
      const sound = await createSound(tempUri);
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

  async function handleReRecord() {
    if (soundRef.current) {
      await soundRef.current.unloadAsync().catch(() => {});
      soundRef.current = null;
    }
    setIsPlaying(false);
    setPosition(0);
    setDuration(0);
    setTempUri(null);
    setRecState('idle');
    setReRecordTriggered(true);
    onChangeRef.current({ tempUri: null, reRecordTriggered: true });
  }

  function formatSeconds(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  }

  function formatMs(ms: number): string {
    return formatSeconds(Math.floor(ms / 1000));
  }

  return (
    <YStack
      gap="$2"
      p="$3"
      bg="$color1"
      rounded="$3"
      borderWidth={1}
      borderColor={recState === 'recording' ? '$red8' : '$borderColor'}
    >
      <Paragraph fontSize="$2" color="$color10">
        録音
      </Paragraph>

      {recState === 'idle' && (
        <Pressable onPress={handleStartRecording} aria-label="録音を開始">
          <XStack gap="$3" items="center">
            <YStack
              width={44}
              height={44}
              rounded="$10"
              bg="$color2"
              borderWidth={2}
              borderColor="$red9"
              items="center"
              justify="center"
            >
              <YStack width={16} height={16} rounded="$10" bg="$red9" />
            </YStack>
            <YStack>
              <Paragraph fontWeight="500">録音を開始</Paragraph>
              <Paragraph fontSize="$2" color="$color10">
                タップして練習を録音する
              </Paragraph>
            </YStack>
          </XStack>
        </Pressable>
      )}

      {recState === 'recording' && (
        <YStack gap="$3">
          <XStack gap="$3" items="center">
            <YStack
              width={44}
              height={44}
              rounded="$10"
              bg="$red2"
              borderWidth={2}
              borderColor="$red9"
              items="center"
              justify="center"
            >
              <YStack width={14} height={14} rounded="$10" bg="$red9" />
            </YStack>
            <YStack>
              <Paragraph color="$red9" fontWeight="600">
                録音中…
              </Paragraph>
              <Paragraph fontSize="$5" fontWeight="700">
                {formatSeconds(elapsed)}
              </Paragraph>
            </YStack>
          </XStack>
          <Pressable onPress={handleStopRecording} aria-label="録音を停止">
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
        </YStack>
      )}

      {recState === 'recorded' && (
        <YStack gap="$2">
          <XStack gap="$3" items="center">
            <Pressable onPress={handlePlayPause} aria-label={isPlaying ? '一時停止' : '再生'}>
              <YStack
                width={40}
                height={40}
                rounded="$10"
                bg="$blue2"
                borderWidth={2}
                borderColor="$blue9"
                items="center"
                justify="center"
              >
                <Paragraph color="$blue9" fontSize="$3">
                  {isPlaying ? '⏸' : '▶'}
                </Paragraph>
              </YStack>
            </Pressable>
            <YStack flex={1} gap="$1">
              <YStack height={4} bg="$color3" rounded="$1" overflow="hidden">
                <YStack
                  height={4}
                  bg="$blue9"
                  rounded="$1"
                  style={{
                    width: duration > 0 ? `${Math.round((position / duration) * 100)}%` : '0%',
                  }}
                />
              </YStack>
              <XStack justify="space-between">
                <Paragraph fontSize="$1" color="$color10">
                  {formatMs(position)}
                </Paragraph>
                <Paragraph fontSize="$1" color="$color11" fontWeight="600">
                  {formatMs(duration)}
                </Paragraph>
              </XStack>
            </YStack>
          </XStack>
          <YStack borderTopWidth={1} borderTopColor="$borderColor" pt="$2">
            <Pressable onPress={handleReRecord} aria-label="再録音">
              <XStack gap="$2" items="center">
                <YStack width={10} height={10} rounded="$10" bg="$red7" />
                <Paragraph fontSize="$2" color="$color10">
                  再録音
                </Paragraph>
              </XStack>
            </Pressable>
          </YStack>
        </YStack>
      )}
    </YStack>
  );
}

export function RecordingSection(props: Props) {
  if (Platform.OS === 'web') return null;
  return <RecordingSectionNative {...props} />;
}
