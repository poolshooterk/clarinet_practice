import { useEffect, useState } from 'react';
import { Input } from 'tamagui';

type Props = {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  onBlur: () => void;
  placeholder?: string;
  ariaLabel?: string;
  width?: number;
  flex?: number;
};

// 空値を `undefined` で扱うと RHF の useFieldArray が項目を「未設定」とみなし
// 初期値に巻き戻すため、空文字入力時は `null` を返してフィールドを明示的に
// クリアする。スキーマ側は `.nullable().optional()` で null を許容する必要がある
export function NumericInput({
  value,
  onChange,
  onBlur,
  placeholder,
  ariaLabel,
  width,
  flex,
}: Props) {
  const [text, setText] = useState(value != null ? String(value) : '');

  useEffect(() => {
    setText(value != null ? String(value) : '');
  }, [value]);

  return (
    <Input
      value={text}
      onChangeText={(t) => {
        setText(t);
        const n = Number(t);
        onChange(t === '' || isNaN(n) ? null : n);
      }}
      onBlur={onBlur}
      placeholder={placeholder}
      keyboardType="numeric"
      aria-label={ariaLabel}
      width={width}
      flex={flex}
    />
  );
}
