import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmDialog
        open={false}
        title="Randevuyu iptal et"
        message="Emin misiniz?"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the title and message when open', () => {
    render(
      <ConfirmDialog
        open
        title="Randevuyu iptal et"
        message="Bu işlemi geri alamazsınız."
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    expect(screen.getByText('Randevuyu iptal et')).toBeInTheDocument();
    expect(screen.getByText('Bu işlemi geri alamazsınız.')).toBeInTheDocument();
  });

  it('calls onConfirm and onCancel from their buttons', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Sil"
        message="Emin misiniz?"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Onayla' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog open title="Sil" message="Emin misiniz?" onConfirm={() => {}} onCancel={onCancel} />,
    );

    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons while busy', () => {
    render(
      <ConfirmDialog
        open
        busy
        title="Sil"
        message="Emin misiniz?"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Vazgeç' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'İşleniyor…' })).toBeDisabled();
  });
});
