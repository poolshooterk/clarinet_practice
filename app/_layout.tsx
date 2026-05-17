import { router, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { TamaguiProvider, Theme } from 'tamagui';

import { supabase } from '@/lib/supabase';
import { tamaguiConfig } from '@/tamagui.config';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/(auth)/sign-in');
      else router.replace('/(tabs)/');
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <TamaguiProvider config={tamaguiConfig} defaultTheme={colorScheme ?? 'light'}>
      <Theme name="blue">
        <Stack screenOptions={{ headerShown: false }} />
      </Theme>
    </TamaguiProvider>
  );
}
