// Where the body parts are on the figures in the two supplied posters, in each
// poster's own pixels. The figures have no hotspots from the Data pipeline: their
// dots are decorative and several of their lines point to the wrong place, so these
// follow the anatomy instead. Each body part matches a hotspot of the topic's image
// map by id, which supplies the lesson link and keeps unpublished lessons out. They
// only fit the exact image they were measured on, hence the checksums.

export type PixelBox = [x1: number, y1: number, x2: number, y2: number];

/** SHA-256 of data/psa/chapter/media/symptoms-body-map.jpg. */
export const WOMAN_SHA256 = '5a0a924d379e433351ee5126e698c095d09afae688609acdf7736e4a2c43b510';

export const WOMAN_BODY_PARTS: Record<string, PixelBox[]> = {
  eyes: [[520, 450, 625, 530]],
  shoulders: [
    [445, 590, 515, 660],
    [640, 590, 715, 660],
  ],
  spine: [[525, 640, 625, 790]],
  elbows: [
    [428, 780, 490, 855],
    [668, 770, 730, 845],
  ],
  hands: [
    [402, 945, 460, 1075],
    [686, 935, 740, 1065],
  ],
  gut: [[505, 800, 645, 925]],
  hips: [
    [462, 925, 565, 1030],
    [565, 925, 684, 1030],
  ],
  knees: [
    [468, 1140, 560, 1260],
    [575, 1140, 668, 1260],
  ],
  ankles: [
    [530, 1460, 585, 1530],
    [585, 1420, 635, 1490],
  ],
  feet: [
    [500, 1530, 585, 1630],
    [585, 1490, 640, 1540],
  ],
};

/**
 * The man's poster (the GRAPPA domains poster the lessons also use). It isn't part
 * of the topic's image map, so its details live here and follow the export; a test
 * keeps them in step. It should become a second map from the pipeline.
 */
export const MAN_POSTER = {
  /** SHA-256 of data/psa/chapter/media/overview-grappa-domains.jpg. */
  sha256: 'b9a2917f7da29f60c824a2f44712218a5bfcf1ad722e5b71011f0764944f6137',
  path: 'psa-overview-grappa-domains.jpg',
  altText: 'Six areas of PsA: skin, nails, joints, back, swollen fingers or toes, and tendon sites.',
  credit: 'Source: supplied RHEUMNOTES poster.',
  width: 1152,
  height: 1712,
  bodyParts: {
    eyes: [[525, 425, 620, 495]],
    shoulders: [
      [425, 585, 495, 655],
      [670, 585, 745, 655],
    ],
    spine: [[525, 650, 640, 790]],
    elbows: [
      [395, 785, 460, 860],
      [695, 785, 765, 860],
    ],
    hands: [
      [392, 955, 455, 1115],
      [690, 955, 750, 1090],
    ],
    gut: [[505, 795, 655, 925]],
    hips: [
      [455, 925, 575, 1030],
      [575, 925, 690, 1030],
    ],
    knees: [
      [462, 1150, 565, 1270],
      [575, 1150, 690, 1270],
    ],
    ankles: [
      [505, 1480, 570, 1550],
      [585, 1410, 635, 1480],
    ],
    feet: [
      [490, 1550, 582, 1660],
      [582, 1480, 642, 1565],
    ],
  } as Record<string, PixelBox[]>,
  // Links follow the lesson correspondence in data/psa/chapter/source-review.md. The
  // Peripheral Arthritis card has no matching lesson, so it isn't a link.
  cards: [
    { hotspot: 'skin', label: 'Skin psoriasis', box: [35, 400, 370, 757] },
    { hotspot: 'hands', label: 'Nail psoriasis', box: [35, 825, 370, 1182] },
    { hotspot: 'hands', label: 'Dactylitis', box: [35, 1245, 370, 1612] },
    { hotspot: 'spine', label: 'Axial disease', box: [775, 825, 1112, 1183] },
    { hotspot: 'feet', label: 'Enthesitis', box: [775, 1247, 1112, 1613] },
  ] as { hotspot: string; label: string; box: PixelBox }[],
};
