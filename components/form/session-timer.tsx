import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Button, Paragraph, XStack } from 'tamagui';

import { formatClock } from '@/forms/practice-log';
import { getElapsedMs, useTimerStore } from '@/store/timer';

export const PRACTICE_SESSION_TIMER_KEY = 'practice-session';

type Props = {
  onTimesChange: (times: { startTime: string | null; endTime: string | null }) => void;
  /** 未計測 (idle) から計測を始めたときだけ呼ばれる。一時停止からの再開では呼ばれない */
  onFirstStart?: () => void;
};

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function SessionTimer({ onTimesChange, onFirstStart }: Props) {
  const timers = useTimerStore((s) => s.timers);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const stop = useTimerStore((s) => s.stop);
  const reset = useTimerStore((s) => s.reset);

  const key = PRACTICE_SESSION_TIMER_KEY;
  const entry = timers[key] ?? {
    status: 'idle' as const,
    accumulatedMs: 0,
    startedAt: null,
    firstStartedAt: null,
  };
  const [displayMs, setDisplayMs] = useState(() => getElapsedMs(entry));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function startInterval() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const e = useTimerStore.getState().timers[key];
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
        const e = useTimerStore.getState().timers[key];
        if (e?.status === 'running') {
          setDisplayMs(getElapsedMs(e));
          startInterval();
        }
      }
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reportTimes(finalize: boolean) {
    const e = useTimerStore.getState().timers[key];
    if (!e || e.firstStartedAt == null) {
      onTimesChange({ startTime: null, endTime: null });
      return;
    }
    onTimesChange({
      startTime: formatClock(e.firstStartedAt),
      endTime: finalize ? formatClock(e.firstStartedAt + getElapsedMs(e)) : null,
    });
  }

  function handleStart() {
    const wasIdle = (useTimerStore.getState().timers[key]?.status ?? 'idle') === 'idle';
    start(key);
    reportTimes(false);
    if (wasIdle) onFirstStart?.();
  }
  function handlePause() {
    pause(key);
    reportTimes(true);
  }
  function handleStop() {
    stop(key);
    reportTimes(true);
  }
  function handleReset() {
    reset(key);
    onTimesChange({ startTime: null, endTime: null });
  }

  if (entry.status === 'idle') {
    return (
      <Button size="$2" onPress={handleStart} aria-label="練習の計測開始">
        練習開始
      </Button>
    );
  }

  if (entry.status === 'running' || entry.status === 'paused') {
    return (
      <XStack gap="$2" items="center">
        <Paragraph>{formatElapsed(displayMs)}</Paragraph>
        {entry.status === 'running' ? (
          <Button size="$2" onPress={handlePause} aria-label="練習の一時停止">
            一時停止
          </Button>
        ) : (
          <Button size="$2" onPress={handleStart} aria-label="練習の再開">
            再開
          </Button>
        )}
        <Button size="$2" onPress={handleStop} aria-label="練習の停止">
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
      <Button size="$2" onPress={handleReset} aria-label="練習タイマーのリセット">
        リセット
      </Button>
    </XStack>
  );
}
