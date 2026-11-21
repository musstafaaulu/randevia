import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders the given text', () => {
    render(<EmptyState text="Henüz kayıtlı doktor yok." />);
    expect(screen.getByText('Henüz kayıtlı doktor yok.')).toBeInTheDocument();
  });

  it('falls back to a default icon', () => {
    render(<EmptyState text="Boş" />);
    expect(screen.getByText('📭')).toBeInTheDocument();
  });

  it('uses a custom icon when given one', () => {
    render(<EmptyState icon="🔎" text="Sonuç yok" />);
    expect(screen.getByText('🔎')).toBeInTheDocument();
  });
});
