import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { Button, Paragraph, XStack, YStack } from 'tamagui';

import {
  type ChecklistSection,
  EMBOUCHURE_SECTIONS,
  EMBOUCHURE_TIP,
  EMBOUCHURE_WARNING_SIGNS,
} from '@/forms/embouchure';

// アンブシュア確認チェックリストの純粋 UI。チェック状態は画面ローカルの
// useState (id の Set) で保持し、永続しない (画面を離れるとリセットされる)。
// navigation context に依存しないため、結合テストから直接 render できる。
export function EmbouchureChecklistView() {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <YStack gap="$3" p="$3">
      <Paragraph fontSize="$2" color="$color11">
        {EMBOUCHURE_TIP}
      </Paragraph>

      {EMBOUCHURE_SECTIONS.map((section) => (
        <ChecklistSectionCard
          key={section.id}
          section={section}
          checked={checked}
          onToggle={toggle}
        />
      ))}

      <YStack p="$3" bg="$color1" rounded="$3" borderWidth={1} borderColor="$borderColor" gap="$2">
        <Paragraph fontWeight="bold">崩れ・疲れのサイン</Paragraph>
        <Paragraph fontSize="$2" color="$color10">
          出たら一度止めて、鏡や窓の映り込みで形を確認しよう。
        </Paragraph>
        {EMBOUCHURE_WARNING_SIGNS.map((sign) => (
          <Paragraph key={sign} fontSize="$2" color="$color11">
            {`・${sign}`}
          </Paragraph>
        ))}
      </YStack>

      <Button onPress={() => setChecked(new Set())} aria-label="チェックをすべてクリア">
        すべてクリア
      </Button>
    </YStack>
  );
}

function ChecklistSectionCard({
  section,
  checked,
  onToggle,
}: {
  section: ChecklistSection;
  checked: Set<string>;
  onToggle: (id: string) => void;
}) {
  return (
    <YStack p="$3" bg="$color1" rounded="$3" borderWidth={1} borderColor="$borderColor" gap="$2">
      <Paragraph fontWeight="bold">{section.title}</Paragraph>
      {section.items.map((item) => {
        const isChecked = checked.has(item.id);
        return (
          <Pressable
            key={item.id}
            onPress={() => onToggle(item.id)}
            role="checkbox"
            aria-checked={isChecked}
            aria-label={item.label}
          >
            <XStack gap="$2" items="flex-start" p="$2" bg="$color2" rounded="$3">
              <Ionicons
                name={isChecked ? 'checkbox-outline' : 'square-outline'}
                size={22}
                color={isChecked ? '#4a9eff' : '#888'}
                style={{ marginTop: 1 }}
              />
              <YStack flex={1} gap="$1">
                <Paragraph color={isChecked ? '$color10' : '$color12'}>{item.label}</Paragraph>
                <Paragraph fontSize="$1" color="$color10">
                  {item.hint}
                </Paragraph>
              </YStack>
            </XStack>
          </Pressable>
        );
      })}
    </YStack>
  );
}
