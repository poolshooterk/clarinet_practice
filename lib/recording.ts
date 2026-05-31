import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import type { RecordingStatus } from 'expo-av/build/Audio/Recording';
import * as FileSystem from 'expo-file-system/legacy';

const RECORDINGS_DIR = `${FileSystem.documentDirectory}recordings/`;

const RECORDING_AUDIO_MODE = {
  allowsRecordingIOS: true,
  playsInSilentModeIOS: true,
  staysActiveInBackground: true,
  interruptionModeIOS: InterruptionModeIOS.DoNotMix,
  interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
  shouldDuckAndroid: false,
  playThroughEarpieceAndroid: false,
} as const;

const IDLE_AUDIO_MODE = {
  allowsRecordingIOS: false,
  playsInSilentModeIOS: true,
  staysActiveInBackground: false,
  interruptionModeIOS: InterruptionModeIOS.DoNotMix,
  interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
  shouldDuckAndroid: false,
  playThroughEarpieceAndroid: false,
} as const;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(RECORDINGS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
  }
}

export async function startRecording(
  onStatusUpdate?: (status: RecordingStatus) => void,
): Promise<Audio.Recording> {
  await Audio.requestPermissionsAsync();
  await Audio.setAudioModeAsync(RECORDING_AUDIO_MODE);
  await ensureDir();
  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
    onStatusUpdate,
  );
  return recording;
}

export async function stopRecording(recording: Audio.Recording): Promise<string> {
  const uri = recording.getURI();
  await recording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync(IDLE_AUDIO_MODE);
  if (!uri) throw new Error('録音ファイルURIが取得できませんでした');
  const tmpPath = `${RECORDINGS_DIR}tmp-${Date.now()}.m4a`;
  await FileSystem.moveAsync({ from: uri, to: tmpPath });
  return tmpPath;
}

export async function pauseRecording(recording: Audio.Recording): Promise<void> {
  await recording.pauseAsync();
}

export async function resumeRecording(recording: Audio.Recording): Promise<void> {
  await recording.startAsync();
}

export async function finalizeRecording(
  tempUri: string,
  sessionId: string,
  index: 1 | 2 | 3,
): Promise<string> {
  const destPath = `${RECORDINGS_DIR}${sessionId}-${index}.m4a`;
  await FileSystem.moveAsync({ from: tempUri, to: destPath });
  return destPath;
}

export async function deleteRecording(uri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    await FileSystem.deleteAsync(uri);
  }
}

export function getRecordingUri(sessionId: string, index: 1 | 2 | 3): string {
  return `${RECORDINGS_DIR}${sessionId}-${index}.m4a`;
}

export async function createSound(uri: string): Promise<Audio.Sound> {
  await Audio.setAudioModeAsync(IDLE_AUDIO_MODE);
  const { sound } = await Audio.Sound.createAsync({ uri });
  return sound;
}
