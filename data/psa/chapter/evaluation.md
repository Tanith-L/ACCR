# Draft-library validation

| Check | Result |
|---|---|
| Schema and references | All six topics and 24 lessons validate |
| Lesson illustrations | 24/24 lessons; 28 media assets |
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
| psa-dx-01 | 5.44 |
| psa-dx-02 | 5.44 |
| psa-overview-01 | 6.01 |
| psa-overview-02 | 5.34 |
| psa-symptoms-01 | 4.13 |
| psa-symptoms-02 | 6.13 |
| psa-symptoms-03 | 5.63 |
| psa-symptoms-04 | 5.56 |
| psa-symptoms-05 | 3.88 |
| psa-symptoms-06 | 5.62 |
| psa-symptoms-07 | 4.19 |
| psa-symptoms-08 | 3.65 |
| psa-symptoms-09 | 3.97 |
| psa-symptoms-10 | 3.89 |
| psa-symptoms-11 | 5.59 |
| psa-symptoms-12 | 3.97 |
| psa-treatment-01 | 6.49 |
| psa-treatment-02 | 4.55 |
| psa-treatment-03 | 6.30 |
| psa-education-01 | 4.97 |
| psa-education-02 | 5.35 |
| psa-education-03 | 4.64 |
| psa-contact-01 | 6.06 |
| psa-contact-02 | 7.78 |

Reading scores are short-sample estimates, not proof of comprehension. The builder rejects page/takeaway scores at or above grade 8. Source-poster wording is preserved and is not included in these text scores; plain-language captions and surrounding lesson text explain the images.

Home and five topics have no navigation image. The unchanged Symptoms image has 12 regions linking to 12 distinct lessons. GRAPPA remains a lesson illustration.
The mixed PsA/AS photo is labeled and used for symptom reporting. Uncited comorbidity percentages are omitted. See source-review.md for all file dispositions and lesson locators.
The preview uses normalized coordinates and preserves image aspect ratio. Native mobile device verification and clinical approval remain pending.

Draft input SHA-256: `ef98b3a364e1556c06c20cc3539209b6ce7c5eb62eecacaa2448fd9d5d5ecab8`
Hotspot input SHA-256: `9acf0fb8dead430e32b70bafd040154edbcf151d2a9c2fd38d4f4e61f596a9ca`

Image `psa-overview-grappa-domains` SHA-256: `b9a2917f7da29f60c824a2f44712218a5bfcf1ad722e5b71011f0764944f6137`
Image `psa-symptoms-body-map` SHA-256: `5a0a924d379e433351ee5126e698c095d09afae688609acdf7736e4a2c43b510`
Image `psa-skin-psoriasis` SHA-256: `62268b5cdd634545e3abb60df12ad9cbefb596c781bed37d0dbf1a460e4885a6`
Image `psa-nail-psoriasis` SHA-256: `afbb7f3172ec8740b8dd1e005095d16de686e4e7761f8e4a21a51c7a9f6353e2`
Image `psa-achilles-enthesitis` SHA-256: `0b0e5b633dece1f8156abdf173e46378d4f5e3716be32b0ce9022757bbc98790`
Image `psa-plantar-fasciitis` SHA-256: `29fad40d627a800b023eb85e074d0576703e84ec6cade5ba17b54ecfacd33651`
Image `psa-rheumnotes-shoulder` SHA-256: `043bf494d6ba6b4e2a171817bcd32a5b9e987e7edfaf4445f1452194971399c2`
Image `psa-rheumnotes-hand` SHA-256: `b8345f8f067b04c50d7754b8cca487bc132e84001ed87eacc02893069e55208c`
Image `psa-rheumnotes-foot` SHA-256: `86142528850c2f18a860df5a5355da106c1144b38ed83f1fce93cf104c4b3138`
Image `psa-rheumnotes-spine` SHA-256: `7d1c18eca04cb4dd4bdfd8f70ed74034dd1f435518636f0b259de90cb5ae980c`
Image `psa-rheumnotes-elbow` SHA-256: `5a3508c3a7418246b806ab1006245649c13c8a06b589bc8fea84092edc04f504`
Image `psa-rheumnotes-hip` SHA-256: `086dff75d09b08ba1fa0106c17524285a45d9f0ddc5da496393e2ed953c3fc9a`
Image `psa-rheumnotes-knee` SHA-256: `3d2c4ea9e819658bf7896515ab0986dcba5d6d2a064a750147334c68a21c2f1d`
Image `psa-rheumnotes-ankle` SHA-256: `42e724359de89e1b2ec3193c5eb072e0b434446c1e90022af348916ebd5e9df3`
Image `psa-rheumnotes-quiet-pause` SHA-256: `9b18f5f2495f3e4cf70ef969414514066fa69383332f6822b41a4e46ceceb07c`
Image `psa-rheumnotes-fruit` SHA-256: `9b380ebe5e1161a7853dcb21ba4d9e36079593cbcec0ac4886aa92bd429fdb93`
Image `psa-rheumnotes-sleep-routine` SHA-256: `ee36db0a59ae23f6e08eb1b8630db3ff56cdc6de11afb1eb5c340241c277bff9`
Image `supp-doctor-patient` SHA-256: `11eac03fc4101b392f71779b70e054355af50022207dc872bf532978a7934163`
Image `supp-mri-scan` SHA-256: `fd96f46f480d3956f621edadf3f2771f70b56af0c82363784a49bb9a2eb9a4a7`
Image `supp-eye-uveitis` SHA-256: `85925d895e9e59135bdc1e1245cf0e4afe7cfac074e1e9e80262d469622b5399`
Image `supp-digestive-system` SHA-256: `4f88c4b1e63d0473bb4b16e46dd9bf43a563db38907a347be0114745fd52af7a`
Image `psa-diagram-caspar-framework` SHA-256: `9e0f6641fcdda1bd97f4a877ad789a85417b74261b6b2b03bc927496fcd8f852`
Image `psa-diagram-whole-health` SHA-256: `261b4893975f9decf678e1a03effa25d338fafab33d1eec4a112dc506f6f64c8`
Image `psa-diagram-treatment-groups` SHA-256: `56356497e4c7275ea631a1aeb1b2b4be2ebc23f3755e0297c1e88897a369312a`
Image `psa-diagram-flare-record` SHA-256: `67bea9a8689b90b2f6252824e0a9e2831b14b2a0a66fdf48c6b4f3a9af917627`
Image `psa-diagram-four-pillars` SHA-256: `07fe737e4db60d028d26fcc88951d9bbda1f534ca2fcfdfba2b877c4a625c0d2`
Image `psa-diagram-shared-treatment-goals` SHA-256: `6f095acb16b5603aa592bde39f30fe532a023b7b0d7ab857a4d820908f6807fe`
Image `psa-diagram-eye-gut-reporting` SHA-256: `bb0ad574562e6bd4663a28140db7b1d5dc5c362282c278a5152a2f29ad93f5bb`
