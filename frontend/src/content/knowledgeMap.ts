// The PsA knowledge map: how the condition fits together, rather than a list of
// topics. The branches follow Dr. Murphy's handwritten mind map and One-Pager
// (data/psa/originals/mindmap.jpeg, PsA One-Pager Intro.jpeg); "What PsA is" is added
// as the starting point. Labels use the lessons' plain wording. Brand names, doses,
// scoring cutoffs and CASPAR points from those sources stay out on purpose.
// `evidence` is never shown: it is the wording in the lesson that backs the node, and
// a test fails if it stops being there. Only published lessons reach the map.
// TODO(data): move this into the pipeline's map tables (backend-architecture.md).
import type { CourseTopic } from './course';

interface LessonLink {
  id: string;
  /** The lesson page to open on; the first when omitted. */
  page?: number;
  evidence: string;
}

export interface KnowledgeNodeSource {
  id: string;
  label: string;
  lesson?: LessonLink;
  children?: KnowledgeNodeSource[];
}

const leaf = (id: string, label: string, lessonId: string, evidence: string, page?: number): KnowledgeNodeSource => ({
  id,
  label,
  lesson: { id: lessonId, page, evidence },
});

export const KNOWLEDGE_MAP: KnowledgeNodeSource = {
  id: 'psa',
  label: 'Psoriatic arthritis',
  children: [
    {
      id: 'what',
      label: 'What PsA is',
      children: [
        leaf('what-inflammation', 'A long-term condition with inflammation', 'psa-overview-01', 'a long-term condition linked to inflammation', 1),
        leaf('what-psoriasis', 'How it relates to psoriasis', 'psa-overview-01', 'Psoriasis and PsA are linked, but they are not the same condition.', 1),
        leaf('what-six', 'Six areas it can affect', 'psa-overview-01', 'groups PsA into six areas, called domains', 2),
        leaf('what-terms', 'What the medical terms mean', 'psa-overview-02', 'Dactylitis means swelling of a whole finger or toe.', 2),
      ],
    },
    {
      id: 'dx',
      label: 'How it’s diagnosed',
      children: [
        leaf('dx-story', 'Your story and an exam', 'psa-dx-01', 'A diagnosis starts with your story and an exam.', 1),
        leaf('dx-tests', 'Blood tests and images', 'psa-dx-01', 'Images, such as X-rays, ultrasound, or MRI', 2),
        {
          id: 'dx-caspar',
          label: 'The CASPAR framework',
          children: [
            leaf('caspar-inflammation', 'Signs of inflammation come first', 'psa-dx-02', 'First, there must be signs of inflammation.', 1),
            leaf('caspar-psoriasis', 'Psoriasis, now, past or in family', 'psa-dx-02', 'psoriasis now or in the past, or psoriasis in the family', 1),
            leaf('caspar-nails', 'Nail changes', 'psa-dx-02', 'Nail changes', 1),
            leaf('caspar-swelling', 'Swelling of a whole finger or toe', 'psa-dx-02', 'swelling of a whole finger or toe', 1),
            leaf('caspar-rf', 'Rheumatoid factor blood test', 'psa-dx-02', 'A blood test called rheumatoid factor', 2),
            leaf('caspar-bone', 'New bone near a joint on X-ray', 'psa-dx-02', 'new bone near a joint on an X-ray', 2),
          ],
        },
      ],
    },
    {
      id: 'where',
      label: 'Where it can appear',
      children: [
        leaf('where-skin', 'Skin', 'psa-symptoms-01', 'Skin and psoriasis'),
        leaf('where-nails', 'Nails', 'psa-symptoms-06', 'Wrists, hands, fingers, and nails'),
        {
          id: 'where-joints',
          label: 'Joints away from the spine',
          children: [
            leaf('joints-shoulders', 'Shoulders', 'psa-symptoms-05', 'Shoulders and reaching'),
            leaf('joints-elbows', 'Elbows', 'psa-symptoms-09', 'Elbows and nearby tendons'),
            leaf('joints-hands', 'Wrists and hands', 'psa-symptoms-06', 'Wrists, hands, fingers, and nails'),
            leaf('joints-hips', 'Hips', 'psa-symptoms-10', 'Hips and daily movement'),
            leaf('joints-knees', 'Knees', 'psa-symptoms-11', 'Knees, swelling, and stiffness'),
            leaf('joints-ankles', 'Ankles and mid-foot', 'psa-symptoms-12', 'Ankles and the middle of the foot'),
          ],
        },
        leaf('where-spine', 'Spine and SI joints', 'psa-symptoms-08', 'Spine and SI joints'),
        leaf('where-digits', 'Swollen fingers or toes', 'psa-symptoms-06', 'dactylitis'),
        leaf('where-tendons', 'Where tendons attach to bone', 'psa-symptoms-07', 'Enthesitis means inflammation where a tendon or ligament joins bone.'),
        leaf('where-eyes', 'Eyes', 'psa-symptoms-02', 'Eyes and symptoms that need prompt care'),
        leaf('where-gut', 'Gut', 'psa-symptoms-04', 'Gut and bowel changes'),
        leaf('where-related', 'Related health', 'psa-symptoms-03', 'Related health and changes over time'),
      ],
    },
    {
      id: 'treatment',
      label: 'Treatment groups',
      children: [
        leaf('tx-goals', 'How goals are chosen', 'psa-treatment-01', 'Treatment discussions start with what is active and what matters to you.', 1),
        leaf('tx-ease', 'Medicines that ease pain and swelling', 'psa-treatment-02', 'Some help ease pain and swelling.', 1),
        leaf('tx-conventional', 'Conventional DMARDs', 'psa-treatment-02', 'Conventional DMARDs act broadly on the immune system.', 1),
        leaf('tx-biologic', 'Biologic drugs', 'psa-treatment-02', 'Biologic drugs target selected immune signals.', 1),
        leaf('tx-targeted', 'Targeted synthetic drugs', 'psa-treatment-02', 'Targeted synthetic drugs act on pathways inside cells.', 1),
        leaf('tx-questions', 'Questions for your team', 'psa-treatment-02', 'Ask the prescribing team what your drug is for.', 2),
      ],
    },
    {
      id: 'tracking',
      label: 'Tracking progress',
      children: [
        leaf('track-mda', 'Minimal disease activity (MDA)', 'psa-treatment-03', 'Minimal disease activity, or MDA, uses several measures together.', 1),
        leaf('track-signs', 'Joints, skin and tendon sites', 'psa-treatment-03', 'sore or swollen joints, skin, and tendon sites', 1),
        leaf('track-daily', 'Your view and daily tasks', 'psa-treatment-03', 'Your view of pain and health matters, too.', 1),
        leaf('track-flares', 'Planning for flares', 'psa-treatment-03', 'discuss a flare plan with the care team', 2),
        leaf('track-record', 'Keeping a short record', 'psa-treatment-03', 'A short record can note what changed', 2),
      ],
    },
  ],
};

export interface KnowledgeNode {
  id: string;
  label: string;
  /** Set on end points, which open a lesson. */
  lesson: { id: string; page?: number; topicId: string; topicName: string } | null;
  children: KnowledgeNode[];
  /** Every lesson under this node, once each, for its progress. */
  lessonIds: string[];
}

/** The map for what is published: a branch with nothing left under it disappears. */
export function buildKnowledgeMap(course: CourseTopic[], source: KnowledgeNodeSource = KNOWLEDGE_MAP): KnowledgeNode | null {
  const topicOf = new Map(course.flatMap(({ topic, path }) => path.lessonIds.map((id) => [id, topic] as const)));

  if (source.lesson) {
    const topic = topicOf.get(source.lesson.id);
    if (!topic) return null;
    const lesson = { id: source.lesson.id, page: source.lesson.page, topicId: topic.id, topicName: topic.name };
    return { id: source.id, label: source.label, lesson, children: [], lessonIds: [lesson.id] };
  }

  const children = (source.children ?? []).flatMap((child) => buildKnowledgeMap(course, child) ?? []);
  if (children.length === 0) return null;
  return {
    id: source.id,
    label: source.label,
    lesson: null,
    children,
    lessonIds: [...new Set(children.flatMap((c) => c.lessonIds))],
  };
}
