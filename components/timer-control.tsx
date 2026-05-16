import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Button, Input, Paragraph, XStack, YStack } from 'tamagui';

import { getElapsedMs, useTimerStore } from '@/store/timer';

type Props = {
  timerKey: string;
  label: string;
  onStop: (minutes: number) => void;
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function parseHHMM(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function TimerControl({ timerKey, label, onStop }: Props) {
  const timers = useTimerStore((s) => s.timers);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const stop = useTimerStore((s) => s.stop);
  const reset = useTimerStore((s) => s.reset);

  const entry = timers[timerKey] ?? { status: 'idle' as const, accumulatedMs: 0, startedAt: null };
  const [displayMs, setDisplayMs] = useState(() => getElapsedMs(entry));
  const [showManual, setShowManual] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [manualError, setManualError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startInterval() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const e = useTimerStore.getState().timers[timerKey];
      if (e) setDisplayMs(getElapsedMs(e));
    }, 1000);
  }

  useEffect(() => {
    if (entry.status === 'running') {
      startInterval();
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDisplayMs(getElapsedMs(entry));
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.status]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const e = useTimerStore.getState().timers[timerKey];
        if (e?.status === 'running') {
          setDisplayMs(getElapsedMs(e));
          startInterval();
        }
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerKey]);

  function handleStop() {
    const minutes = stop(timerKey);
    onStop(minutes);
  }

  function handleManualApply() {
    const startMin = parseHHMM(startTime);
    const endMin = parseHHMM(endTime);
    if (startMin === null || endMin === null) {
      setManualError('HH:MM 形式で入力してください');
      return;
    }
    let diff = endMin - startMin;
    if (diff < 0) diff += 24 * 60;
    if (diff === 0) {
      setManualError('開始時刻と終了時刻が同じです');
      return;
    }
    setManualError('');
    reset(timerKey);
    setShowManual(false);
    setStartTime('');
    setEndTime('');
    onStop(Math.ceil(diff));
  }

  if (entry.status === 'idle') {
    return (
      <YStack gap="$1">
        <XStack gap="$2" items="center">
          <Button
            size="$2"
            onPress={() => {
              start(timerKey);
              setShowManual(false);
            }}
            aria-label={`${label}の計測開始`}
          >
            計測開始
          </Button>
          <Button
            size="$2"
            onPress={() => setShowManual((v) => !v)}
            aria-label={`${label}の時刻で入力`}
          >
            時刻で入力
          </Button>
        </XStack>
        {showManual && (
          <YStack gap="$1">
            <XStack gap="$2" items="center">
              <Input
                flex={1}
                placeholder="開始 HH:MM"
                value={startTime}
                onChangeText={setStartTime}
                keyboardType="numbers-and-punctuation"
                aria-label={`${label}の開始時刻`}
              />
              <Paragraph>〜</Paragraph>
              <Input
                flex={1}
                placeholder="終了 HH:MM"
                value={endTime}
                onChangeText={setEndTime}
                keyboardType="numbers-and-punctuation"
                aria-label={`${label}の終了時刻`}
              />
              <Button size="$2" onPress={handleManualApply} aria-label={`${label}の適用`}>
                適用
              </Button>
            </XStack>
            {manualError ? (
              <Paragraph color="$red10" fontSize="$2">
                {manualError}
              </Paragraph>
            ) : null}
          </YStack>
        )}
      </YStack>
    );
  }

  if (entry.status === 'running' || entry.status === 'paused') {
    return (
      <XStack gap="$2" items="center">
        <Paragraph>{formatElapsed(displayMs)}</Paragraph>
        {entry.status === 'running' ? (
          <Button size="$2" onPress={() => pause(timerKey)} aria-label={`${label}の一時停止`}>
            一時停止
          </Button>
        ) : (
          <Button size="$2" onPress={() => start(timerKey)} aria-label={`${label}の再開`}>
            再開
          </Button>
        )}
        <Button size="$2" onPress={handleStop} aria-label={`${label}の停止`}>
          停止
        </Button>
      </XStack>
    );
  }

  const stoppedMinutes = Math.max(1, Math.ceil(entry.accumulatedMs / 60000));
  return (
    <XStack gap="$2" items="center">
      <Paragraph fontSize="$2" color="$color10">
        {stoppedMinutes}分計測済
      </Paragraph>
      <Button size="$2" onPress={() => reset(timerKey)} aria-label={`${label}のリセット`}>
        リセット
      </Button>
    </XStack>
  );
}
