import { parseBlocks } from '@/components/Markdown';
import { createApiService, type ApiResponse, type Transport } from '@/content/api';
import { ContentError } from '@/content/ContentService';
import { createHttpTransport } from '@/content/httpTransport';
import { storageUrl } from '@/content/media';
import { createMockTransport } from '@/content/mockTransport';

describe('mock mode (backend/fixtures/mock_responses)', () => {
  const service = createApiService(createMockTransport());

  it('returns the published topics', async () => {
    expect(await service.getTopics()).toEqual([
      { id: 'dx', name: 'Understanding diagnosis', icon: null, sortOrder: 2 },
    ]);
  });

  it('builds the learning path in reading order', async () => {
    const path = await service.getLearningPath('dx');
    expect(path.lessonIds).toEqual(['psa-dx-01', 'psa-dx-02']);
  });

  it('returns a lesson with ordered pages and page-tagged images', async () => {
    const lesson = await service.getLesson('psa-dx-01');
    expect(lesson?.pages.map((p) => p.order)).toEqual([1, 2]);
    expect(lesson?.images).toEqual([
      expect.objectContaining({ mediaId: 'mock-joints', page: 1, path: 'mock-joints.png' }),
    ]);
    expect(lesson?.keyTakeaways.length).toBeGreaterThan(0);
  });

  it('returns quiz items with a 0-based answer', async () => {
    const [q] = await service.getQuiz('psa-dx-02');
    expect(q.options[q.answer]).toBe('Dactylitis');
  });

  it('treats unknown or unpublished ids as empty, not as errors', async () => {
    expect(await service.getLesson('psa-dx-03')).toBeNull();
    expect((await service.getLearningPath('nope')).subtopics).toEqual([]);
    expect(await service.getQuiz('nope')).toEqual([]);
  });

  it.each([
    ['network', 'NETWORK'],
    ['400', 'BAD_REQUEST'],
    ['401', 'CONFIG'],
  ] as const)('can simulate %s failures', async (fail, code) => {
    const failing = createApiService(createMockTransport({ fail }));
    await expect(failing.getTopics()).rejects.toMatchObject({ code });
  });
});

describe('api service', () => {
  const reply = (...responses: (ApiResponse | Error)[]) => {
    const transport = jest.fn<ReturnType<Transport>, Parameters<Transport>>();
    for (const r of responses) {
      if (r instanceof Error) transport.mockRejectedValueOnce(r);
      else transport.mockResolvedValueOnce(r);
    }
    return transport;
  };

  it('sorts by sort_order, not arrival order', async () => {
    const transport = reply({
      status: 200,
      body: [
        { id: 'b', name: 'B', sort_order: 2, lessons: [{ id: 'b2', title: '', est_minutes: 1, sort_order: 2 }, { id: 'b1', title: '', est_minutes: 1, sort_order: 1 }] },
        { id: 'a', name: 'A', sort_order: 1, lessons: [{ id: 'a1', title: '', est_minutes: 1, sort_order: 1 }] },
        { id: 'empty', name: 'E', sort_order: 0, lessons: [] },
      ],
    });
    const path = await createApiService(transport).getLearningPath('t');
    expect(path.lessonIds).toEqual(['a1', 'b1', 'b2']);
    expect(path.subtopics.map((s) => s.id)).toEqual(['a', 'b']);
    expect(transport).toHaveBeenCalledWith({ method: 'POST', path: 'rpc/get_learning_path', body: { p_topic_id: 't' } });
  });

  it('retries a network failure once', async () => {
    const transport = reply(new TypeError('offline'), { status: 200, body: [] });
    expect(await createApiService(transport).getTopics()).toEqual([]);
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('gives up after the retry', async () => {
    const transport = reply(new TypeError('offline'), new TypeError('offline'));
    await expect(createApiService(transport).getTopics()).rejects.toMatchObject({ code: 'NETWORK' });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('does not retry HTTP errors and maps them by status', async () => {
    const transport = reply({ status: 503, body: null });
    await expect(createApiService(transport).getTopics()).rejects.toMatchObject({ code: 'NETWORK' });
    expect(transport).toHaveBeenCalledTimes(1);
  });
});

describe('http transport', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('rejects missing config', () => {
    expect(() => createHttpTransport({ url: '', anonKey: '' })).toThrow(ContentError);
  });

  it('sends the anon key and a JSON body for rpc calls', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ status: 200, json: async () => [] }) as never;
    const transport = createHttpTransport({ url: 'https://x.supabase.co', anonKey: 'anon' });
    await transport({ method: 'POST', path: 'rpc/get_learning_path', body: { p_topic_id: 'dx' } });
    const [url, init] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://x.supabase.co/rest/v1/rpc/get_learning_path');
    expect(init.headers).toMatchObject({ apikey: 'anon', Authorization: 'Bearer anon', 'Content-Type': 'application/json' });
    expect(init.body).toBe('{"p_topic_id":"dx"}');
  });
});

describe('media', () => {
  it('builds public Storage URLs', () => {
    expect(storageUrl('https://x.supabase.co', 'psa/a b.png')).toBe(
      'https://x.supabase.co/storage/v1/object/public/media/psa/a%20b.png',
    );
  });
});

describe('lesson markdown', () => {
  it('splits paragraphs and lists', () => {
    expect(parseBlocks('One\nline.\n\n- a\n- b\n\n1. x\n2. y')).toEqual([
      { kind: 'p', text: 'One line.' },
      { kind: 'ul', items: ['a', 'b'] },
      { kind: 'ol', items: ['x', 'y'] },
    ]);
  });
});
