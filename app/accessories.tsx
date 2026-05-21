import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';

import { AccessoriesForm } from '@/components/accessories-form';

export default function AccessoriesScreen() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: '消耗品管理' }} />
      <ScrollView>
        <AccessoriesForm />
      </ScrollView>
    </>
  );
}
