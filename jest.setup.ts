jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// @expo/vector-icons はマウント時に非同期でフォントを読み込み、テスト完了後に
// setState して act() 警告を出す。テストではアイコン名を Text で描画する軽量な
// モックに差し替え、出力をクリーンに保つ (実 UI では本物の Ionicons を使う)。
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return {
    Ionicons: ({ name, ...rest }: { name: string }) =>
      require('react').createElement(Text, rest, name),
  };
});

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      onAuthStateChange: jest.fn(() => ({
        data: { subscription: { unsubscribe: jest.fn() } },
      })),
    },
  },
}));
