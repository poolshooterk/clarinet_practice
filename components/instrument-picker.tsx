import { useState } from 'react';
import { Button, Input, Paragraph, XStack, YStack } from 'tamagui';

import { useInstrumentCatalogStore } from '@/store/instrument-catalog';

export type InstrumentPickerValue = {
  makerId: string;
  makerName: string;
  modelId: string;
  modelName: string;
};

type Props = {
  value: InstrumentPickerValue | null;
  onChange: (value: InstrumentPickerValue) => void;
};

export function InstrumentPicker({ value, onChange }: Props) {
  const makers = useInstrumentCatalogStore((s) => s.makers);
  const models = useInstrumentCatalogStore((s) => s.models);
  const addMaker = useInstrumentCatalogStore((s) => s.addMaker);
  const addModel = useInstrumentCatalogStore((s) => s.addModel);

  const [selectedMakerId, setSelectedMakerId] = useState<string | null>(value?.makerId ?? null);
  const [addingMaker, setAddingMaker] = useState(false);
  const [addingModel, setAddingModel] = useState(false);
  const [newMakerName, setNewMakerName] = useState('');
  const [newModelName, setNewModelName] = useState('');

  const filteredModels = models.filter((m) => m.makerId === selectedMakerId);

  const handleMakerSelect = (makerId: string) => {
    setSelectedMakerId(makerId);
    setAddingModel(false);
    setNewModelName('');
  };

  const handleModelSelect = (modelId: string, modelName: string) => {
    if (!selectedMakerId) return;
    const maker = makers.find((m) => m.id === selectedMakerId);
    if (!maker) return;
    onChange({ makerId: selectedMakerId, makerName: maker.name, modelId, modelName });
  };

  const handleAddMaker = async () => {
    const name = newMakerName.trim();
    if (!name) return;
    await addMaker(name);
    setAddingMaker(false);
    setNewMakerName('');
  };

  const handleAddModel = async () => {
    if (!selectedMakerId) return;
    const name = newModelName.trim();
    if (!name) return;
    await addModel(selectedMakerId, name);
    setAddingModel(false);
    setNewModelName('');
  };

  return (
    <YStack gap="$2">
      <Paragraph color="$color11" size="$2">
        メーカーを選択
      </Paragraph>
      <XStack flexWrap="wrap" gap="$2">
        {makers.map((maker) => (
          <Button
            key={maker.id}
            size="$2"
            theme={selectedMakerId === maker.id ? 'blue' : undefined}
            variant={selectedMakerId === maker.id ? undefined : 'outlined'}
            onPress={() => handleMakerSelect(maker.id)}
            aria-label={`メーカー ${maker.name}`}
          >
            {maker.name}
            {selectedMakerId === maker.id ? ' ✓' : ''}
          </Button>
        ))}
        {addingMaker ? (
          <XStack gap="$1" items="center">
            <Input
              size="$2"
              value={newMakerName}
              onChangeText={setNewMakerName}
              placeholder="メーカー名"
              aria-label="新しいメーカー名"
              autoFocus
            />
            <Button size="$2" theme="blue" onPress={handleAddMaker} aria-label="メーカー追加を確定">
              追加
            </Button>
            <Button
              size="$2"
              variant="outlined"
              onPress={() => {
                setAddingMaker(false);
                setNewMakerName('');
              }}
            >
              キャンセル
            </Button>
          </XStack>
        ) : (
          <Button
            size="$2"
            variant="outlined"
            onPress={() => setAddingMaker(true)}
            aria-label="メーカーを追加"
          >
            ＋追加
          </Button>
        )}
      </XStack>

      {selectedMakerId && (
        <>
          <Paragraph color="$color11" size="$2">
            機種名を選択
          </Paragraph>
          <XStack flexWrap="wrap" gap="$2">
            {filteredModels.map((model) => (
              <Button
                key={model.id}
                size="$2"
                theme={value?.modelId === model.id ? 'blue' : undefined}
                variant={value?.modelId === model.id ? undefined : 'outlined'}
                onPress={() => handleModelSelect(model.id, model.name)}
                aria-label={`機種名 ${model.name}`}
              >
                {model.name}
                {value?.modelId === model.id ? ' ✓' : ''}
              </Button>
            ))}
            {addingModel ? (
              <XStack gap="$1" items="center">
                <Input
                  size="$2"
                  value={newModelName}
                  onChangeText={setNewModelName}
                  placeholder="機種名"
                  aria-label="新しい機種名"
                  autoFocus
                />
                <Button
                  size="$2"
                  theme="blue"
                  onPress={handleAddModel}
                  aria-label="機種名追加を確定"
                >
                  追加
                </Button>
                <Button
                  size="$2"
                  variant="outlined"
                  onPress={() => {
                    setAddingModel(false);
                    setNewModelName('');
                  }}
                >
                  キャンセル
                </Button>
              </XStack>
            ) : (
              <Button
                size="$2"
                variant="outlined"
                onPress={() => setAddingModel(true)}
                aria-label="機種名を追加"
              >
                ＋追加
              </Button>
            )}
          </XStack>
        </>
      )}
    </YStack>
  );
}
