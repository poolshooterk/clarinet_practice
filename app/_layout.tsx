import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { Linking, useColorScheme } from 'react-native';
import { TamaguiProvider } from 'tamagui';

import { supabase } from '@/lib/supabase';
import { tamaguiConfig } from '@/tamagui.config';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !session)) {
        router.replace('/(auth)/sign-in');
      } else if (event === 'PASSWORD_RECOVERY') {
        router.replace('/(auth)/reset-password');
      } else if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        router.replace('/(tabs)/');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function handleDeepLink(url: string) {
      const fragment = url.split('#')[1];
      if (!fragment) return;
      const params = new URLSearchParams(fragment);
      if (params.get('type') !== 'recovery') return;
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      if (accessToken && refreshToken) {
        await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      }
    }

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, []);

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={colorScheme ?? 'light'}>
      <Stack screenOptions={{ headerShown: false }} />
    </TamaguiProvider>
  );
}
