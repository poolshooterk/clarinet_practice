import { Paragraph } from 'tamagui';

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Paragraph color="$red10" size="$2">
      {message}
    </Paragraph>
  );
}
