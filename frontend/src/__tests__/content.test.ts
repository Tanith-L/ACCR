import { ContentError } from '@/content/ContentService';
import { createMockService } from '@/content/mockService';
import { createSupabaseService } from '@/content/supabaseService';
import { parseBlocks } from '@/components/Markdown';

import fixture from '../../../shared/fixtures/test_bundle.json';

describe('mock content service (real PsA bundle)', () => {
  const service = createMockService();

  it('returns topics in backend order', async () => {
    const topics = await service.getTopics();
    expect(topics.length).toBeGreaterThan(0);
    expect(topics.map((t) => t.order)).toEqual([...topics.map((t) => t.order)].sort((a, b) => a - b));
  });

  it('builds a learning path whose lessonIds follow subtopic and lesson order', async () => {
    const [first] = await service.getTopics();
    const path = await service.getLearningPath(first.id);
    expect(path.lessonIds).toEqual(path.subtopics.flatMap((s) => s.lessons.map((l) => l.id)));
    expect(path.lessonIds.length).toBe(first.lessonCount);
  });

  it('returns a full lesson with resolved source titles', async () => {
    const lesson = await service.getLesson('psa-overview-01');
    expect(lesson.bodyMarkdown.length).toBeGreaterThan(0);
    expect(lesson.references.every((r) => r.title.length > 0)).toBe(true);
  });

  it('throws NOT_FOUND for unknown ids', async () => {
    await expect(service.getLesson('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.getLearningPath('nope')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('can simulate failures for error-state testing', async () => {
    await expect(createMockService({ fail: true }).getTopics()).rejects.toBeInstanceOf(ContentError);
  });
});

describe('mock content service (fixture)', () => {
  it('exposes statuses so the preview banner can show', async () => {
    const service = createMockService({ bundle: fixture as never });
    const path = await service.getLearningPath('test-topic');
    expect(path.subtopics[0].lessons.map((l) => l.status)).toEqual(['checked', 'draft']);
  });
});

describe('supabase content service', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const respond = (body: unknown, status = 200) =>
    jest.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body, text: async () => '' });

  it('rejects missing config', () => {
    expect(() => createSupabaseService({ url: '', anonKey: '' })).toThrow(ContentError);
  });

  it('queries the published views with the anon key', async () => {
    globalThis.fetch = respond([
      { id: 't', disease_id: 'psa', name: 'T', description: null, icon: null, order_index: 1, lesson_count: 1, total_minutes: 2 },
    ]) as never;
    const service = createSupabaseService({ url: 'https://x.supabase.co', anonKey: 'anon' });
    const [topic] = await service.getTopics();
    expect(topic).toMatchObject({ id: 't', diseaseId: 'psa', lessonCount: 1 });
    const [url, init] = (globalThis.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain('/rest/v1/v_topics');
    expect(init.headers.apikey).toBe('anon');
  });

  it('maps an empty lesson result to NOT_FOUND', async () => {
    globalThis.fetch = respond([]) as never;
    const service = createSupabaseService({ url: 'https://x.supabase.co', anonKey: 'anon' });
    await expect(service.getLesson('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('maps network failures and 5xx to NETWORK', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('offline')) as never;
    const service = createSupabaseService({ url: 'https://x.supabase.co', anonKey: 'anon' });
    await expect(service.getTopics()).rejects.toMatchObject({ code: 'NETWORK' });
    globalThis.fetch = respond({}, 503) as never;
    await expect(service.getTopics()).rejects.toMatchObject({ code: 'NETWORK' });
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
