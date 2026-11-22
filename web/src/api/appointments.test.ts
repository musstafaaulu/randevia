import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setAccessToken } from './client';
import { downloadAppointmentIcs } from './appointments';

describe('downloadAppointmentIcs', () => {
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setAccessToken('test-token');
    clickSpy = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValue({
      click: clickSpy,
    } as unknown as HTMLAnchorElement);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fake'), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setAccessToken(null);
  });

  it('fetches the .ics file with the access token and triggers a download', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['BEGIN:VCALENDAR'])),
    });
    vi.stubGlobal('fetch', fetchMock);

    await downloadAppointmentIcs('appt-1');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/appointments/appt-1/ics'),
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-token' },
      }),
    );
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('throws when the server responds with an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));

    await expect(downloadAppointmentIcs('missing')).rejects.toThrow('Takvim dosyası indirilemedi');
    expect(clickSpy).not.toHaveBeenCalled();
  });
});
