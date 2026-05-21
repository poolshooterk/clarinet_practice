import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

const RECORDINGS_DIR = `${FileSystem.documentDirectory}recordings/`;
const TMP_PATH = `${RECORDINGS_DIR}tmp.m4a`;

async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(RECORDINGS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(RECORDINGS_DIR, { intermediates: true });
  }
}

export async function startRecording(): Promise<Audio.Recording> {
  await Audio.requestPermissionsAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
  await ensureDir();
  const { recording } = await Audio.Recording.createAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY,
  );
  return recording;
}

export async function stopRecording(recording: Audio.Recording): Promise<string> {
  const uri = recording.getURI();
  await recording.stopAndUnloadAsync();
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
  if (!uri) throw new Error('録音ファイルURIが取得できませんでした');
  await FileSystem.moveAsync({ from: uri, to: TMP_PATH });
  return TMP_PATH;
}

export async function finalizeRecording(sessionId: string): Promise<void> {
  await FileSystem.moveAsync({
    from: TMP_PATH,
    to: `${RECORDINGS_DIR}${sessionId}.m4a`,
  });
}

export async function deleteRecording(sessionId: string): Promise<void> {
  const uri = `${RECORDINGS_DIR}${sessionId}.m4a`;
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) {
    await FileSystem.deleteAsync(uri);
  }
}

export function getRecordingUri(sessionId: string): string {
  return `${RECORDINGS_DIR}${sessionId}.m4a`;
}

export async function createSound(uri: string): Promise<Audio.Sound> {
  await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
  const { sound } = await Audio.Sound.createAsync({ uri });
  return sound;
}

export async function loadRecordedIds(): Promise<Set<string>> {
  const info = await FileSystem.getInfoAsync(RECORDINGS_DIR);
  if (!info.exists) return new Set();
  const files = await FileSystem.readDirectoryAsync(RECORDINGS_DIR);
  return new Set(
    files.filter((f) => f.endsWith('.m4a') && f !== 'tmp.m4a').map((f) => f.slice(0, -4)),
  );
}
