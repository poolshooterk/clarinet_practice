import { EmbouchureChecklistView } from '@/components/embouchure-checklist-view';
import { EMBOUCHURE_SECTIONS } from '@/forms/embouchure';
import { fireEvent, renderWithProviders, screen } from '@/test-utils/render';

const firstItem = EMBOUCHURE_SECTIONS[0].items[0];
const secondItem = EMBOUCHURE_SECTIONS[0].items[1];

describe('EmbouchureChecklistView', () => {
  it('行をタップするとチェックが入り、再タップで外れる', () => {
    renderWithProviders(<EmbouchureChecklistView />);

    const row = screen.getByRole('checkbox', { name: firstItem.label });
    expect(row).not.toBeChecked();

    fireEvent.press(row);
    expect(row).toBeChecked();

    fireEvent.press(row);
    expect(row).not.toBeChecked();
  });

  it('「すべてクリア」で全項目のチェックが外れる', () => {
    renderWithProviders(<EmbouchureChecklistView />);

    const row1 = screen.getByRole('checkbox', { name: firstItem.label });
    const row2 = screen.getByRole('checkbox', { name: secondItem.label });
    fireEvent.press(row1);
    fireEvent.press(row2);
    expect(row1).toBeChecked();
    expect(row2).toBeChecked();

    fireEvent.press(screen.getByText('すべてクリア'));
    expect(row1).not.toBeChecked();
    expect(row2).not.toBeChecked();
  });
});
