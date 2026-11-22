import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TopLoadingBar } from './TopLoadingBar';

function Navigator({ to }: { to: string }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(to)} type="button">
      go
    </button>
  );
}

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
  );
}

describe('TopLoadingBar', () => {
  beforeEach(() => {
    stubMatchMedia(false);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is not shown on the initial render', () => {
    render(
      <MemoryRouter initialEntries={['/a']}>
        <TopLoadingBar />
      </MemoryRouter>,
    );
    expect(document.querySelector('.top-loading-bar')).not.toBeInTheDocument();
  });

  it('appears on route change and hides itself again', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/a']}>
        <TopLoadingBar />
        <Routes>
          <Route path="/a" element={<Navigator to="/b" />} />
          <Route path="/b" element={<p>sayfa b</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByText('go'));
    expect(document.querySelector('.top-loading-bar')).toBeInTheDocument();

    await waitFor(() => expect(document.querySelector('.top-loading-bar')).not.toBeInTheDocument(), {
      timeout: 2000,
    });
  });

  it('does not appear when prefers-reduced-motion is set', async () => {
    stubMatchMedia(true);
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/a']}>
        <TopLoadingBar />
        <Routes>
          <Route path="/a" element={<Navigator to="/b" />} />
          <Route path="/b" element={<p>sayfa b</p>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.click(screen.getByText('go'));
    expect(document.querySelector('.top-loading-bar')).not.toBeInTheDocument();
  });
});
