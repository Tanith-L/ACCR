import iconNames from '@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json';

import { branchPath, BRANCH_COLORS, NODE_ICONS } from '@/components/knowledgeMapStyle';
import { parseBlocks } from '@/components/Markdown';
import { MAN_POSTER, WOMAN_BODY_PARTS, WOMAN_SHA256, type PixelBox } from '@/components/posterRegions';
import { createApiService, type ApiResponse, type Transport } from '@/content/api';
import { ContentError } from '@/content/ContentService';
import { getCourse, hasQuiz } from '@/content/course';
import { createHttpTransport } from '@/content/httpTransport';
import { buildKnowledgeMap, KNOWLEDGE_MAP, type KnowledgeNodeSource } from '@/content/knowledgeMap';
import { toTopicImageMap } from '@/content/mappers';
import { LOCAL_MEDIA, LOCAL_VIDEOS, storageUrl } from '@/content/media';
import { createMockTransport } from '@/content/mockTransport';
import { createPreviewTransport, EXPORTS } from '@/content/previewTransport';
import { branchColors, colors } from '@/theme';
import { numberWord, percent, plural } from '@/utils/format';
import { estimateLines, layoutMindMap, type Box } from '@/utils/mindMapLayout';

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

describe('preview mode (data/psa pipeline exports)', () => {
  const service = createApiService(createPreviewTransport());

  it('serves all exported topics and their lessons in subtopic order', async () => {
    const topics = await service.getTopics();
    expect(topics.map((t) => t.id)).toEqual(['dx', 'overview', 'symptoms', 'treatment', 'education', 'contact']);
    const paths = await Promise.all(topics.map((t) => service.getLearningPath(t.id)));
    expect(paths.flatMap((p) => p.lessonIds)).toHaveLength(24);
    const path = await service.getLearningPath('symptoms');
    expect(path.lessonIds).toEqual(Array.from({ length: 12 }, (_, i) => `psa-symptoms-${String(i + 1).padStart(2, '0')}`));
  });

  it('serves draft lessons shaped like v_lessons', async () => {
    const lesson = await service.getLesson('psa-symptoms-01');
    expect(lesson?.title).toBe("Skin and psoriasis");
    expect(lesson?.pages.length).toBeGreaterThan(0);
    expect(lesson?.sortOrder).toBe(1);
  });

  it('returns an empty quiz for the text-only draft library', async () => {
    const quiz = await service.getQuiz('psa-symptoms-01');
    expect(quiz).toEqual([]);
  });

  it('answers unknown ids with empty results', async () => {
    expect(await service.getLesson('nope')).toBeNull();
    expect((await service.getLearningPath('nope')).subtopics).toEqual([]);
  });
});

describe('body map, mind map and course helpers', () => {
  const overlaps = (a: PixelBox, b: PixelBox) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  const service = createApiService(createPreviewTransport());

  it('serves the Symptoms image map with one lesson per hotspot, and null elsewhere', async () => {
    const map = await service.getTopicImageMap('symptoms');
    expect(map?.image.path).toBe('psa-symptoms-body-map.jpg');
    expect(map?.hotspots).toHaveLength(12);
    expect(new Set(map?.hotspots.map((h) => h.lessonId)).size).toBe(12);
    expect(await service.getTopicImageMap('dx')).toBeNull();
    expect(await createApiService(createMockTransport()).getTopicImageMap('dx')).toBeNull();
  });

  it('reduces a polygon hotspot to its bounding box', () => {
    const map = toTopicImageMap({
      topic_id: 't',
      media: { id: 'm', path: 'm.jpg', alt_text: '', credit: null },
      image_width: 1,
      image_height: 1,
      image_sha256: '',
      hotspots: [{ id: 'h', label: '', lesson_id: 'l', shape: 'polygon', points: [{ x: 0.1, y: 0.2 }, { x: 0.5, y: 0.2 }, { x: 0.3, y: 0.6 }] }],
    });
    expect(map.hotspots[0].bounds.width).toBeCloseTo(0.4);
    expect(map.hotspots[0].bounds.height).toBeCloseTo(0.4);
  });

  describe.each([
    ['woman', () => WOMAN_BODY_PARTS],
    ['man', () => MAN_POSTER.bodyParts],
  ] as const)('%s poster body parts', (_, parts) => {
    it('all match a hotspot from the content', async () => {
      const ids = (await service.getTopicImageMap('symptoms'))!.hotspots.map((h) => h.id);
      expect(ids).toEqual(expect.arrayContaining(Object.keys(parts())));
    });

    it('stay on the figure, so a tap cannot land on two', () => {
      const boxes = Object.values(parts()).flat();
      boxes.forEach((a, i) => {
        expect(a[0]).toBeLessThan(a[2]);
        expect(a[1]).toBeLessThan(a[3]);
        boxes.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false));
      });
    });
  });

  it('keeps the woman poster body parts clear of its cards, on the measured image', async () => {
    const map = (await service.getTopicImageMap('symptoms'))!;
    expect(map.imageSha256).toBe(WOMAN_SHA256);
    const cards = map.hotspots.map(({ bounds: b }): PixelBox => [
      b.x * map.imageWidth,
      b.y * map.imageHeight,
      (b.x + b.width) * map.imageWidth,
      (b.y + b.height) * map.imageHeight,
    ]);
    for (const part of Object.values(WOMAN_BODY_PARTS).flat()) {
      for (const card of cards) expect(overlaps(part, card)).toBe(false);
    }
  });

  it('keeps the man poster in step with the export and the image file', async () => {
    const media = EXPORTS.flatMap((e) => e.media).find((m) => m.file.endsWith('overview-grappa-domains.jpg'))!;
    expect(`${media.id}.jpg`).toBe(MAN_POSTER.path);
    expect(media.alt_text).toBe(MAN_POSTER.altText);
    expect(media.credit).toBe(MAN_POSTER.credit);
    expect(Object.keys(LOCAL_MEDIA)).toContain(MAN_POSTER.path);
    // Jest runs from frontend/. Node's modules aren't typed in this app, hence require.
    /* eslint-disable @typescript-eslint/no-require-imports */
    const file = require('fs').readFileSync('../data/psa/chapter/media/overview-grappa-domains.jpg');
    expect(require('crypto').createHash('sha256').update(file).digest('hex')).toBe(MAN_POSTER.sha256);
    /* eslint-enable @typescript-eslint/no-require-imports */

    const ids = (await service.getTopicImageMap('symptoms'))!.hotspots.map((h) => h.id);
    for (const card of MAN_POSTER.cards) {
      expect(ids).toContain(card.hotspot);
      for (const part of Object.values(MAN_POSTER.bodyParts).flat()) expect(overlaps(part, card.box)).toBe(false);
    }
  });

  it('bundles every image the export uses', async () => {
    const course = await getCourse(service);
    const lessons = await Promise.all(course.flatMap((c) => c.path.lessonIds).map((id) => service.getLesson(id)));
    const paths = lessons.flatMap((l) => l?.images.map((i) => i.path) ?? []);
    expect(paths).toHaveLength(6);
    expect(Object.keys(LOCAL_MEDIA)).toEqual(expect.arrayContaining(paths));
    expect(Object.keys(LOCAL_MEDIA)).toContain('psa-symptoms-body-map.jpg');
  });

  it('has a bundled video and cover for every lesson', async () => {
    const course = await getCourse(service);
    const ids = course.flatMap((c) => c.path.lessonIds);
    expect(ids).toHaveLength(24);
    for (const id of ids) {
      expect(LOCAL_VIDEOS[id]?.minutes).toBeGreaterThan(0);
      expect(LOCAL_VIDEOS[id]?.cover).toBeTruthy();
    }
  });

  it('keeps every radial mind map node inside the canvas with no overlaps, even with 12 lessons on a small phone', () => {
    const overlap = (a: Box, b: Box) =>
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    for (const [width, height] of [[343, 500], [361, 620], [398, 700]]) {
      for (const [count, open] of [[5, false], [6, false], [2, true], [3, true], [5, true], [6, true], [9, true], [12, true]] as const) {
        const { hub, center, ring } = layoutMindMap(count, open, width, height);
        expect(ring).toHaveLength(count);
        const boxes = [hub, ...(center ? [center] : []), ...ring];
        boxes.forEach((box, i) => {
          expect(box.x).toBeGreaterThanOrEqual(-0.5);
          expect(box.y).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width + 0.5);
          expect(box.y + box.height).toBeLessThanOrEqual(height + 0.5);
          expect(box.height).toBeGreaterThanOrEqual(30);
          boxes.slice(i + 1).forEach((other) => expect(overlap(box, other)).toBe(false));
        });
      }
    }
  });

  describe('knowledge map', () => {
    const leaves = (n: KnowledgeNodeSource): KnowledgeNodeSource[] => (n.lesson ? [n] : (n.children ?? []).flatMap(leaves));
    const all = (n: KnowledgeNodeSource): KnowledgeNodeSource[] => [n, ...(n.children ?? []).flatMap(all)];

    it('backs every end point with wording from the page of the lesson it opens', () => {
      const lessons = EXPORTS.flatMap((e) => e.lessons);
      for (const { label, lesson } of leaves(KNOWLEDGE_MAP)) {
        const found = lessons.find((l) => l.id === lesson!.id);
        expect(found).toBeDefined();
        const pages = lesson!.page ? found!.pages.filter((p) => p.order === lesson!.page) : found!.pages;
        expect(pages.length).toBeGreaterThan(0);
        const text = `${found!.title} ${pages.map((p) => p.body).join(' ')}`;
        if (!text.includes(lesson!.evidence)) throw new Error(`"${label}": "${lesson!.evidence}" not in ${lesson!.id}`);
      }
    });

    it('keeps out brand names, drug classes by target, and scoring from the source maps', () => {
      const banned = /otezla|rinvoq|xeljanz|sotyktu|mtx|ssz|tnf|il-\d|jak|tyk|pde4|points|score|≤|≥|\d%/i;
      for (const { label } of all(KNOWLEDGE_MAP)) expect(label).not.toMatch(banned);
    });

    it('gives every node an icon that exists, and every top-level branch its own color', () => {
      for (const { id } of all(KNOWLEDGE_MAP)) {
        const icon = NODE_ICONS[id];
        if (!icon || !(icon in iconNames)) throw new Error(`No valid icon for ${id}: ${icon}`);
      }
      const palettes = KNOWLEDGE_MAP.children!.map((c) => BRANCH_COLORS[c.id]);
      expect(palettes.every(Boolean)).toBe(true);
      expect(new Set(palettes).size).toBe(palettes.length);
    });

    it('draws a closed, finite branch shape', () => {
      const d = branchPath(10, 20, 100, 200, -1);
      expect(d).toMatch(/^M.*Q.*L.*Q.*Z$/);
      expect(d).not.toMatch(/NaN|Infinity/);
      expect(branchPath(5, 5, 5, 5, 1)).not.toMatch(/NaN|Infinity/);
    });

    it('has unique ids, and rings small enough to fit the layout', () => {
      const nodes = all(KNOWLEDGE_MAP);
      expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length);
      for (const n of nodes) expect((n.children ?? []).length).toBeLessThanOrEqual(12);
    });

    it('shows the five branches when everything is published, each with its progress lessons', async () => {
      const root = buildKnowledgeMap(await getCourse(service))!;
      expect(root.children.map((c) => c.id)).toEqual(['what', 'dx', 'where', 'treatment', 'tracking']);
      expect(root.children.find((c) => c.id === 'where')!.lessonIds).toHaveLength(12);
      const caspar = root.children.find((c) => c.id === 'dx')!.children.find((c) => c.id === 'dx-caspar')!;
      expect(caspar.lessonIds).toEqual(['psa-dx-02']);
      expect(caspar.children[0].lesson).toMatchObject({ id: 'psa-dx-02', page: 1, topicId: 'dx' });
    });

    it('drops branches with nothing published', async () => {
      const root = buildKnowledgeMap(await getCourse(createApiService(createMockTransport())))!;
      expect(root.children.map((c) => c.id)).toEqual(['dx']);
      expect(buildKnowledgeMap([])).toBeNull();
    });
  });

  it('leaves the Peripheral Arthritis card without a link, because no lesson covers it', () => {
    expect(MAN_POSTER.cards.map((c) => c.label)).not.toContain('Peripheral arthritis');
  });

  it('estimates label wrapping by whole words', () => {
    expect(estimateLines('Skin', 130, 16)).toBe(1);
    expect(estimateLines('Joints away from the spine', 130, 16)).toBe(2);
    expect(estimateLines('Medicines that ease pain and swelling', 130, 16)).toBe(3);
  });

  it('knows whether a topic has a quiz', async () => {
    expect(await hasQuiz(service, ['psa-symptoms-01'])).toBe(false);
    expect(await hasQuiz(createApiService(createMockTransport()), ['psa-dx-01', 'psa-dx-02'])).toBe(true);
  });
});

describe('design tokens', () => {
  const luminance = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a: string, b: string) => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };

  it.each(Object.entries(branchColors))('%s branch color is readable, for icons on its soft color and white on it', (_, c) => {
    expect(contrast(c.strong, c.soft)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.primaryText, c.strong)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['text', 'background'],
    ['text', 'surface'],
    ['text', 'primarySoft'],
    ['textMuted', 'background'],
    ['textMuted', 'surface'],
    ['primary', 'background'],
    ['primary', 'surface'],
    ['primary', 'primarySoft'],
    ['primaryText', 'primary'],
    ['accentText', 'accentSoft'],
    ['accentText', 'background'],
    ['success', 'background'],
    ['success', 'surface'],
    ['danger', 'surface'],
  ] as const)('%s on %s meets WCAG AA for text', (fg, bg) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(4.5);
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

describe('format helpers', () => {
  it('spells out small counts and pluralizes', () => {
    expect(numberWord(2)).toBe('two');
    expect(numberWord(12)).toBe('12');
    expect(plural(1, 'question')).toBe('1 question');
    expect(plural(3, 'topic', '2 of 3')).toBe('2 of 3 topics');
  });

  it('rounds percentages and handles empty topics', () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(0, 0)).toBe(0);
  });
});
