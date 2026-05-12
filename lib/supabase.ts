import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

function buildStorage() {
  if (Platform.OS !== 'web') return AsyncStorage;
  if (typeof window === 'undefined') {
    return {
      getItem: (_key: string) => Promise.resolve(null as string | null),
      setItem: (_key: string, _value: string) => Promise.resolve(),
      removeItem: (_key: string) => Promise.resolve(),
    };
  }
  return {
    getItem: (key: string) => Promise.resolve(localStorage.getItem(key)),
    setItem: (key: string, value: string) => {
      localStorage.setItem(key, value);
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      localStorage.removeItem(key);
      return Promise.resolve();
    },
  };
}

const isSSR = Platform.OS === 'web' && typeof window === 'undefined';

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: buildStorage(),
      autoRefreshToken: !isSSR,
      persistSession: !isSSR,
      detectSessionInUrl: false,
    },
  },
);
