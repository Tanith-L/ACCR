import { askRheumy, readRheumyConfig, RheumyError, speechUrl, type RheumyConfig } from '@/rheumy/client';

const ok = readRheumyConfig('https://abc.supabase.co/', 'sb_publishable_123') as Extract<RheumyConfig, { ok: true }>;

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe('Rheumy config', () => {
  it('names the missing settings without exposing values', () => {
    expect(readRheumyConfig(undefined, '')).toEqual({ ok: false, missing: ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY'] });
    expect(readRheumyConfig('https://YOUR-PROJECT.supabase.co', 'k')).toMatchObject({ ok: false, missing: ['EXPO_PUBLIC_SUPABASE_URL'] });
  });
  it('rejects plain http (except localhost) and secret keys', () => {
    expect(readRheumyConfig('http://abc.supabase.co', 'k')).toMatchObject({ ok: false, problem: expect.stringContaining('https') });
    expect(readRheumyConfig('http://localhost:54321', 'k')).toMatchObject({ ok: true });
    expect(readRheumyConfig('https://abc.supabase.co', 'sb_secret_x')).toMatchObject({ ok: false, problem: expect.stringContaining('secret') });
  });
  it('builds the functions URL', () => {
    expect(ok).toEqual({ ok: true, functionsUrl: 'https://abc.supabase.co/functions/v1', key: 'sb_publishable_123' });
  });
});

describe('askRheumy', () => {
  const turns = [{ role: 'user' as const, content: 'What is PsA?' }];

  it('posts the conversation with the publishable key and returns the cited answer', async () => {
    const { impl, calls } = fakeFetch(200, {
      answer: 'PsA is a long-term condition [1].',
      citations: [{ n: 1, kind: 'lesson', sourceId: 'psa-overview-01', title: 'What PsA is', locator: 'Page 1' }],
      urgency: null,
      notice: null,
      reviewed: false,
    });
    const answer = await askRheumy(turns, ok, impl);
    expect(calls[0].url).toBe('https://abc.supabase.co/functions/v1/rheumy-chat');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.apikey).toBe('sb_publishable_123');
    expect(headers.Authorization).toBeUndefined(); // new-format keys aren't JWTs
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ messages: turns });
    expect(answer.citations[0].sourceId).toBe('psa-overview-01');
    expect(answer.reviewed).toBe(false);
  });

  it('also sends a legacy JWT anon key as a bearer token', async () => {
    const { impl, calls } = fakeFetch(200, { answer: 'x', citations: [] });
    await askRheumy(turns, readRheumyConfig('https://abc.supabase.co', 'aaa.bbb.ccc'), impl);
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe('Bearer aaa.bbb.ccc');
  });

  it.each([
    [503, { error: 'not_configured', message: 'missing settings: GROQ_API_KEY' }, 'setup'],
    [401, { error: 'unauthorized' }, 'setup'],
    [503, { error: 'busy', message: 'busy' }, 'busy'],
    [429, { error: 'rate_limited' }, 'busy'],
    [400, { error: 'bad_request', message: 'too long' }, 'bad_request'],
    [500, { error: 'server_error' }, 'server'],
  ])('maps HTTP %i %j to a %s error', async (status, body, kind) => {
    const { impl } = fakeFetch(status, body);
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(askRheumy(turns, ok, impl)).rejects.toMatchObject({ kind });
  });

  it('reports network failures and missing setup', async () => {
    const failing = (async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(askRheumy(turns, ok, failing)).rejects.toMatchObject({ kind: 'network' });
    await expect(askRheumy(turns, readRheumyConfig('', ''))).rejects.toBeInstanceOf(RheumyError);
  });
});

describe('speechUrl', () => {
  it('builds an audio URL without citation marks, using only the public key', () => {
    const url = new URL(speechUrl('PsA can affect skin [1] and nails [2].', 'jenny', ok)!);
    expect(url.origin + url.pathname).toBe('https://abc.supabase.co/functions/v1/rheumy-tts');
    expect(url.searchParams.get('voice')).toBe('jenny');
    expect(url.searchParams.get('text')).toBe('PsA can affect skin and nails .');
    expect(url.searchParams.get('apikey')).toBe('sb_publishable_123');
    expect(speechUrl('x', 'ava', readRheumyConfig('', ''))).toBeNull();
  });
});
