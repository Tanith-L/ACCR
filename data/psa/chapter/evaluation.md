# Draft-library validation

| Check | Result |
|---|---|
| Schema and references | All six topics and 24 lessons validate |
| IDs and membership | Exactly the lessons in topics.yaml, in order |
| Course overview | Six text links derived from topics; optional course_map omitted |
| Maps | symptoms: 12 regions; every topic lesson reachable |
| Source originals | SHA-256 checked against source-inventory.json and authored supplemental_sources |
| Original-to-lesson correspondence | Every original has a disposition; every lesson source has a locator, page, contribution and limits; image uses match media references |
| Per-claim support / citation accuracy | Not assessed in this drafting pass; claims arrays intentionally empty |
| Clinical review | Pending; all lessons remain draft |
| Quizzes | Not generated in this text-and-map task |

| Lesson | Maximum FK grade (pages and takeaways) |
|---|---|
| psa-dx-01 | 5.44 |
| psa-dx-02 | 5.19 |
| psa-overview-01 | 7.52 |
| psa-overview-02 | 5.34 |
| psa-symptoms-01 | 4.13 |
| psa-symptoms-02 | 6.13 |
| psa-symptoms-03 | 5.63 |
| psa-symptoms-04 | 6.08 |
| psa-symptoms-05 | 3.55 |
| psa-symptoms-06 | 5.62 |
| psa-symptoms-07 | 4.81 |
| psa-symptoms-08 | 4.47 |
| psa-symptoms-09 | 4.79 |
| psa-symptoms-10 | 4.12 |
| psa-symptoms-11 | 5.59 |
| psa-symptoms-12 | 5.08 |
| psa-treatment-01 | 6.80 |
| psa-treatment-02 | 4.55 |
| psa-treatment-03 | 6.30 |
| psa-education-01 | 5.59 |
| psa-education-02 | 5.98 |
| psa-education-03 | 4.93 |
| psa-contact-01 | 6.59 |
| psa-contact-02 | 7.78 |

Reading scores are short-sample estimates, not proof of comprehension. The builder rejects page/takeaway scores at or above grade 8. Source-poster wording is preserved and is not included in these text scores; plain-language captions and surrounding lesson text explain the images.

Home and five topics have no navigation image. The unchanged Symptoms image has 12 regions linking to 12 distinct lessons. GRAPPA remains a lesson illustration.
The mixed PsA/AS photo is labeled and used for symptom reporting. Uncited comorbidity percentages are omitted. See source-review.md for all file dispositions and lesson locators.
The preview uses normalized coordinates and preserves image aspect ratio. Native mobile device verification and clinical approval remain pending.

Draft input SHA-256: `2a3d0598cff2d4411a3396714a5a7fd66f6112e77af9e61f64ef1003ccea20f0`
Hotspot input SHA-256: `9acf0fb8dead430e32b70bafd040154edbcf151d2a9c2fd38d4f4e61f596a9ca`

Image `psa-overview-grappa-domains` SHA-256: `b9a2917f7da29f60c824a2f44712218a5bfcf1ad722e5b71011f0764944f6137`
Image `psa-symptoms-body-map` SHA-256: `5a0a924d379e433351ee5126e698c095d09afae688609acdf7736e4a2c43b510`
Image `psa-skin-psoriasis` SHA-256: `62268b5cdd634545e3abb60df12ad9cbefb596c781bed37d0dbf1a460e4885a6`
Image `psa-nail-psoriasis` SHA-256: `afbb7f3172ec8740b8dd1e005095d16de686e4e7761f8e4a21a51c7a9f6353e2`
Image `psa-achilles-enthesitis` SHA-256: `0b0e5b633dece1f8156abdf173e46378d4f5e3716be32b0ce9022757bbc98790`
Image `psa-plantar-fasciitis` SHA-256: `29fad40d627a800b023eb85e074d0576703e84ec6cade5ba17b54ecfacd33651`
Image `psa-heel-spur` SHA-256: `530b0d81c43118cf355e8d0b0bfda41c3240058814bf4ca3a2e26e66b3c397d6`
Image `psa-reporting-body-map` SHA-256: `4a55a384d8e4a7b355ce06a000d399428d870095699143451a511fe78702cf5d`
