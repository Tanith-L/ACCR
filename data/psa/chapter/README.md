# Complete PsA lesson drafts

Six topics, 24 lessons. Home and five topics use text navigation; Symptoms has 12 image links to separate lessons.

All lessons are drafts. Clinical approval and per-claim source-quote verification are pending.
Bibliographic references and source locators below support editorial review; no independent judge or clinical approval is claimed.

| Topic | Lesson | Text |
|---|---|---|
| dx | `psa-dx-01` | [How doctors assess possible PsA](01-understanding-diagnosis/lessons/psa-dx-01.md) |
| dx | `psa-dx-02` | [Understanding the CASPAR framework](01-understanding-diagnosis/lessons/psa-dx-02.md) |
| overview | `psa-overview-01` | [What PsA is](02-understanding-psoriatic-arthritis/lessons/psa-overview-01.md) |
| overview | `psa-overview-02` | [PsA across the body](02-understanding-psoriatic-arthritis/lessons/psa-overview-02.md) |
| symptoms | `psa-symptoms-01` | [Skin and psoriasis](03-symptoms-and-disease-progression/lessons/psa-symptoms-01.md) |
| symptoms | `psa-symptoms-02` | [Eyes and symptoms that need prompt care](03-symptoms-and-disease-progression/lessons/psa-symptoms-02.md) |
| symptoms | `psa-symptoms-03` | [Related health and changes over time](03-symptoms-and-disease-progression/lessons/psa-symptoms-03.md) |
| symptoms | `psa-symptoms-04` | [Gut and bowel changes](03-symptoms-and-disease-progression/lessons/psa-symptoms-04.md) |
| symptoms | `psa-symptoms-05` | [Shoulders and reaching](03-symptoms-and-disease-progression/lessons/psa-symptoms-05.md) |
| symptoms | `psa-symptoms-06` | [Wrists, hands, fingers, and nails](03-symptoms-and-disease-progression/lessons/psa-symptoms-06.md) |
| symptoms | `psa-symptoms-07` | [Feet, heel pain, and tendon attachments](03-symptoms-and-disease-progression/lessons/psa-symptoms-07.md) |
| symptoms | `psa-symptoms-08` | [Spine and SI joints](03-symptoms-and-disease-progression/lessons/psa-symptoms-08.md) |
| symptoms | `psa-symptoms-09` | [Elbows and nearby tendons](03-symptoms-and-disease-progression/lessons/psa-symptoms-09.md) |
| symptoms | `psa-symptoms-10` | [Hips and daily movement](03-symptoms-and-disease-progression/lessons/psa-symptoms-10.md) |
| symptoms | `psa-symptoms-11` | [Knees, swelling, and stiffness](03-symptoms-and-disease-progression/lessons/psa-symptoms-11.md) |
| symptoms | `psa-symptoms-12` | [Ankles and the middle of the foot](03-symptoms-and-disease-progression/lessons/psa-symptoms-12.md) |
| treatment | `psa-treatment-01` | [How treatment goals are chosen](04-treatment-options-and-flare-management/lessons/psa-treatment-01.md) |
| treatment | `psa-treatment-02` | [Understanding treatment groups](04-treatment-options-and-flare-management/lessons/psa-treatment-02.md) |
| treatment | `psa-treatment-03` | [Tracking progress and planning for flares](04-treatment-options-and-flare-management/lessons/psa-treatment-03.md) |
| education | `psa-education-01` | [The four pillars of daily care](05-patient-education/lessons/psa-education-01.md) |
| education | `psa-education-02` | [Movement, coping, and support](05-patient-education/lessons/psa-education-02.md) |
| education | `psa-education-03` | [Food, sleep, and recovery](05-patient-education/lessons/psa-education-03.md) |
| contact | `psa-contact-01` | [Sharing changes with your care team](06-when-to-contact-the-care-team/lessons/psa-contact-01.md) |
| contact | `psa-contact-02` | [Eye and gut changes to report](06-when-to-contact-the-care-team/lessons/psa-contact-02.md) |

## Files and rebuild

- `psa-content.json`: schema 1.3 export for backend import. Each lesson's claims includes a provenance record with resolved references and complete source_usage; these are not verified factual assertions.
- `media/`: Symptoms navigation and original-derived lesson illustrations. No active home navigation image.
- `image-selection.md`: navigation and lesson-image choices. `source-review.md` / `source-review.html`: every original file and its lesson-level use, location and limits.
- `overview.html`: full course preview (course overview -> topic -> lesson); `hotspot-preview.html` redirects here. Local visual preview with real lesson navigation and a hotspot debug toggle.
- `evaluation.md`: measured checks and remaining review.

From the repository root:

```powershell
.venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/build_psa_library.py
.venv/content-pipeline/Scripts/python.exe -X utf8 pipeline/build_psa_library.py --validate
```

Canonical drafts: ../assisted-input/all-topics.json. Hotspots: ../assisted-input/image-maps.json.
Supplied originals remain unchanged in ../originals/. Earlier generated navigation images are retained there as superseded history; the current home uses topic data only.
No database migrations, imports, or publication are run by this builder. Source originals and extracted text are now eligible for Git tracking.

The existing importer media limit is under 500 KiB; all JPGs meet it. Replacing or cropping an image requires rechecking its hotspots.
The new topic-map database migration is supplied for later deployment. Imports leave maps at draft; public retrieval requires map publication and published target lessons.
