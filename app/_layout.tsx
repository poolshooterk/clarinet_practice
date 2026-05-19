import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
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

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={colorScheme ?? 'light'}>
      <Stack screenOptions={{ headerShown: false }} />
    </TamaguiProvider>
  );
}
