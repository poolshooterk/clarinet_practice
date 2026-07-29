import { Stack } from 'expo-router';
import { ScrollView } from 'tamagui';

import { EmbouchureChecklistView } from '@/components/embouchure-checklist-view';

// アンブシュア確認チェックリスト画面。チェック状態は EmbouchureChecklistView が
// 画面ローカルに持ち永続しない (画面を離れるとリセット)。route ファイルは
// スクロール枠と画面タイトルの供給に徹する (page と view の責務分離)。
export default function EmbouchureChecklistScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'アンブシュア確認' }} />
      <ScrollView>
        <EmbouchureChecklistView />
      </ScrollView>
    </>
  );
}
