import { fireEvent, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { RecordingSection } from '@/components/form/recording-section';
import { renderWithProviders, screen } from '@/test-utils/render';

jest.mock('@/lib/recording', () => ({
  startRecording: jest.fn().mockResolvedValue({}),
  stopRecording: jest.fn().mockResolvedValue('file:///recordings/tmp.m4a'),
  createSound: jest.fn(),
}));

describe('RecordingSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('idle 状態: 録音を開始ボタンが表示される', () => {
    renderWithProviders(<RecordingSection onChange={jest.fn()} />);
    expect(screen.getByLabelText('録音を開始')).toBeTruthy();
  });

  it('web では何もレンダリングされない', () => {
    const originalOS = Platform.OS;
    (Platform as { OS: string }).OS = 'web';
    const { toJSON } = renderWithProviders(<RecordingSection onChange={jest.fn()} />);
    expect(toJSON()).toBeNull();
    (Platform as { OS: string }).OS = originalOS;
  });

  it('録音停止後に onChange が { tempUri, reRecordTriggered: false } で呼ばれる', async () => {
    const onChange = jest.fn();
    renderWithProviders(<RecordingSection onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('録音を開始'));
    await waitFor(() => {
      expect(screen.getByLabelText('録音を停止')).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText('録音を停止'));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        tempUri: 'file:///recordings/tmp.m4a',
        reRecordTriggered: false,
      });
    });
  });

  it('再録音ボタン押下後に onChange が { tempUri: null, reRecordTriggered: true } で呼ばれる', async () => {
    const onChange = jest.fn();
    renderWithProviders(
      <RecordingSection onChange={onChange} existingRecordingUri="file:///recordings/lr-1.m4a" />,
    );

    fireEvent.press(screen.getByLabelText('再録音'));
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        tempUri: null,
        reRecordTriggered: true,
      });
    });
  });

  it('existingRecordingUri が渡されると recorded 状態で初期化される', () => {
    renderWithProviders(
      <RecordingSection onChange={jest.fn()} existingRecordingUri="file:///recordings/lr-1.m4a" />,
    );
    expect(screen.getByLabelText('再録音')).toBeTruthy();
  });
});
