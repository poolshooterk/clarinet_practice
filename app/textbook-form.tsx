import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView } from 'react-native';

import { TextbookForm } from '@/components/textbook-form';
import { type TextbookInput } from '@/forms/textbook';
import { useTextbookCatalogStore } from '@/store/textbook-catalog';

export default function TextbookFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const textbooks = useTextbookCatalogStore((s) => s.textbooks);
  const add = useTextbookCatalogStore((s) => s.add);
  const update = useTextbookCatalogStore((s) => s.update);
  const remove = useTextbookCatalogStore((s) => s.remove);

  const existing = id ? textbooks.find((t) => t.id === id) : undefined;

  const defaultValues: TextbookInput | undefined = existing
    ? {
        title: existing.title,
        publisher: existing.publisher ?? undefined,
        difficulty: existing.difficulty ?? undefined,
        totalPages: existing.totalPages ?? undefined,
      }
    : undefined;

  const handleSave = async (values: TextbookInput) => {
    if (id) {
      await update(id, values);
    } else {
      await add(values);
    }
    router.back();
  };

  const handleDelete = () => {
    if (!id || !existing) return;
    Alert.alert('教本を削除', `「${existing.title}」を削除しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除',
        style: 'destructive',
        onPress: async () => {
          await remove(id);
          router.back();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: id ? '教本を編集' : '教本を追加',
        }}
      />
      <ScrollView>
        <TextbookForm
          defaultValues={defaultValues}
          onSubmit={handleSave}
          onDelete={id ? handleDelete : undefined}
        />
      </ScrollView>
    </>
  );
}
