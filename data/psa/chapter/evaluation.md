# Draft-library validation

| Check | Result |
|---|---|
| Schema and references | All six topics and 24 lessons validate |
| IDs and membership | Exactly the lessons in topics.yaml, in order |
| Course overview | Six text links derived from topics; optional course_map omitted |
| Maps | symptoms: 12 regions; every topic lesson reachable |
| Source originals | SHA-256 checked against source-inventory.json and authored supplemental_sources |
| Original-to-lesson correspondence | Every original has a disposition; every lesson source has a locator, page, contribution and limits; image uses match media references |
| Exported provenance | Every lesson has a claims record with kind=provenance, resolved references and complete source_usage |
| Per-claim support / citation accuracy | Not assessed; provenance records do not supply source quotes or verified assertions |
| Clinical review | Pending; all lessons remain draft |
| Quizzes | Not generated in this text-and-map task |

| Lesson | Maximum FK grade (pages and takeaways) |
|---|---|
| psa-dx-01 | 5.33 |
| psa-dx-02 | 5.36 |
| psa-overview-01 | 7.52 |
| psa-overview-02 | 5.34 |
| psa-symptoms-01 | 4.86 |
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

Draft input SHA-256: `9ed164a944d5f8365bf35fa5a66333ff722863f92838a637f56ad37c1596eed0`
Hotspot input SHA-256: `0b0b2daf57de5c27ec4fc2ff2df7a57530bfd2c9ea9cd6e446e6665b8ac2dba9`

Image `psa-overview-grappa-domains` SHA-256: `b9a2917f7da29f60c824a2f44712218a5bfcf1ad722e5b71011f0764944f6137`
Image `psa-symptoms-body-map` SHA-256: `5a0a924d379e433351ee5126e698c095d09afae688609acdf7736e4a2c43b510`
Image `psa-dactylitis` SHA-256: `c9d251f98c315f0dff6345462bc80dcf2a0cd84093ff49dcb6ec05647f3fe955`
Image `psa-nail-changes` SHA-256: `00e9213b93cc58c388a1776fe0e1a482593d732bcce8e4df81b740a9ac41be02`
Image `psa-spine-xray` SHA-256: `648e70616f72c3b8d76f78cdf31d2a384d74b13e485f6bd941465e6978621766`
