import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldError } from './FieldError';

describe('FieldError', () => {
  it('renders nothing when there is no message', () => {
    const { container } = render(<FieldError />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the message as an alert', () => {
    render(<FieldError message="Ad en az 2 karakter olmalı." />);
    expect(screen.getByRole('alert')).toHaveTextContent('Ad en az 2 karakter olmalı.');
  });
});
