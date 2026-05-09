import { FieldError } from '@/components/form/field-error';
import { renderWithProviders, screen } from '@/test-utils/render';

describe('FieldError', () => {
  it('renders the message when provided', () => {
    renderWithProviders(<FieldError message="必須項目です" />);
    expect(screen.getByText('必須項目です')).toBeOnTheScreen();
  });

  it('renders nothing when message is undefined', () => {
    renderWithProviders(<FieldError />);
    expect(screen.queryByText(/./)).toBeNull();
  });

  it('renders nothing when message is empty string', () => {
    renderWithProviders(<FieldError message="" />);
    expect(screen.queryByText(/./)).toBeNull();
  });
});
