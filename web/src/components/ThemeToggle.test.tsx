import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '../theme/ThemeContext';
import { ThemeToggle } from './ThemeToggle';

afterEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('ThemeToggle', () => {
  it('starts in light mode and switches the document to dark on click', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(screen.getByRole('button', { name: 'Koyu temaya geç' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Koyu temaya geç' }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Açık temaya geç' })).toBeInTheDocument();
  });

  it('persists the choice to localStorage', async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Koyu temaya geç' }));
    expect(localStorage.getItem('randevia-theme')).toBe('dark');
  });
});
