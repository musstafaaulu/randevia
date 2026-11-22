import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ButtonLabel } from './ButtonLabel';

describe('ButtonLabel', () => {
  it('renders just the idle text when not busy', () => {
    render(<ButtonLabel busy={false} busyText="Kaydediliyor…" idleText="Kaydet" />);
    expect(screen.getByText('Kaydet')).toBeInTheDocument();
    expect(screen.queryByText('Kaydediliyor…')).not.toBeInTheDocument();
  });

  it('renders the busy text next to a spinner when busy', () => {
    const { container } = render(
      <ButtonLabel busy busyText="Kaydediliyor…" idleText="Kaydet" />,
    );
    expect(screen.getByText('Kaydediliyor…')).toBeInTheDocument();
    expect(container.querySelector('.button-spinner')).toBeInTheDocument();
  });
});
