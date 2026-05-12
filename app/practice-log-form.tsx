import { router, Stack } from 'expo-router';
import { useRef } from 'react';
import { Pressable } from 'react-native';
import { Paragraph } from 'tamagui';

import { PracticeLogForm, type PracticeLogFormRef } from '@/components/practice-log-form';
import { type PracticeLogInput } from '@/forms/practice-log';
import { usePracticeLogStore } from '@/store/practice-log';

export default function PracticeLogFormScreen() {
  const formRef = useRef<PracticeLogFormRef>(null);
  const add = usePracticeLogStore((s) => s.add);

  const handleSubmit = async (data: PracticeLogInput) => {
    await add(data);
    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: '練習を記録',
          headerShown: true,
          headerRight: () => (
            <Pressable onPress={() => formRef.current?.submit()}>
              <Paragraph color="$blue9" mr="$2">
                保存
              </Paragraph>
            </Pressable>
          ),
        }}
      />
      <PracticeLogForm ref={formRef} onSubmit={handleSubmit} />
    </>
  );
}
