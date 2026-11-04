# Supplementary images and videos (candidates)

Extra learning material for the 24 PsA lessons, gathered from professional sources.
**Nothing here is in `chapter/psa-content.json` or shown in the app.** Each item needs selection by the Data Lead and clinical review first.

- `images/`: 13 images (11 anatomy diagrams, an MRI scanner illustration and one photo of a doctor with a patient), resized to JPEG under the importer's 500 KiB limit. Each is public domain or CC BY 3.0, read from its Wikimedia Commons file record on 2026-11-04.
- `manifest.json`: alt text, credit, license, source, checksum and suggested lessons for each item.
- Videos are **links only**. They are copyrighted, so none are downloaded here.

## Before any of this reaches patients

1. **Clinical review.** Nobody has watched the videos: titles, presenters and links were checked, the content was not. They may name drugs or include statistics and advice that differ from the lessons, or be out of date.
2. **Video permission.** The Oxford (OUH) terms permit download for "private research, study or in-house use only" and no statement on linking or embedding was found. The Johns Hopkins terms page could not be read. Ask both before embedding; opening their pages in a browser is the conservative option.
3. **Attribution.** CC BY images must keep their credit and note that they were resized. Show `credit` next to the image.
4. **Schema.** `lessons[].images` can carry the images once they are added to `media`. The schema has no video field, so videos need a schema change, agreed with the Backend Lead.
5. **Public bucket.** The project guide allows only non-clinical images in the public `media` bucket for now. None shows a medical condition on a real patient, but the doctor photo does show people, so confirm this.

## Suggested use by lesson

"Existing" counts images the lesson already has. Suggestions cover topic fit only, not page placement.

| Lesson | Title | Existing | Suggested images | Suggested videos |
|---|---|---|---|---|
| `psa-dx-01` | How doctors assess possible PsA | – | doctor-patient, mri-scan | Diagnosing Psoriatic Arthritis |
| `psa-dx-02` | Understanding the CASPAR framework | 1 | **none** | Diagnosing Psoriatic Arthritis |
| `psa-overview-01` | What PsA is | – | synovial-joint | Psoriatic Arthritis – Disease Overview<br>A Hitchhiker’s Guide to Inflammatory Arthritis |
| `psa-overview-02` | PsA across the body | 1 | **none** | Psoriatic Arthritis – Disease Overview |
| `psa-symptoms-01` | Skin and psoriasis | 1 | **none** | Psoriatic Arthritis – Signs and Symptoms |
| `psa-symptoms-02` | Eyes and symptoms that need prompt care | – | eye-uveitis | Psoriatic Arthritis – Signs and Symptoms |
| `psa-symptoms-03` | Related health and changes over time | – | **none** | Psoriatic Arthritis – Signs and Symptoms<br>Preventing Anxiety and Depression when Living with Psoriasis and Psoriatic Arthritis |
| `psa-symptoms-04` | Gut and bowel changes | – | digestive-system | Psoriatic Arthritis – Signs and Symptoms |
| `psa-symptoms-05` | Shoulders and reaching | – | shoulder-joint | Psoriatic Arthritis – Signs and Symptoms |
| `psa-symptoms-06` | Wrists, hands, fingers, and nails | 1 | hand-bones, finger-nail | Psoriatic Arthritis – Signs and Symptoms |
| `psa-symptoms-07` | Feet, heel pain, and tendon attachments | 2 | foot-anatomy | Psoriatic Arthritis – Signs and Symptoms |
| `psa-symptoms-08` | Spine and SI joints | – | lumbar-spine, si-joint | Psoriatic Arthritis – Signs and Symptoms |
| `psa-symptoms-09` | Elbows and nearby tendons | – | **none** | Psoriatic Arthritis – Signs and Symptoms |
| `psa-symptoms-10` | Hips and daily movement | – | hip-anatomy | Psoriatic Arthritis – Signs and Symptoms |
| `psa-symptoms-11` | Knees, swelling, and stiffness | – | knee-side | Psoriatic Arthritis – Signs and Symptoms |
| `psa-symptoms-12` | Ankles and the middle of the foot | – | foot-anatomy | Psoriatic Arthritis – Signs and Symptoms |
| `psa-treatment-01` | How treatment goals are chosen | 1 | doctor-patient | Treating Psoriatic Arthritis |
| `psa-treatment-02` | Understanding treatment groups | – | **none** | Treating Psoriatic Arthritis<br>Treatments for inflammatory arthritis |
| `psa-treatment-03` | Tracking progress and planning for flares | – | **none** | Rheumatology Specialist Nurses and self management |
| `psa-education-01` | The four pillars of daily care | – | **none** | Living with Psoriatic Arthritis |
| `psa-education-02` | Movement, coping, and support | – | **none** | Using Mind and Body Practices to Improve Day-to-Day Living with Psoriatic Arthritis<br>Preventing Anxiety and Depression when Living with Psoriasis and Psoriatic Arthritis<br>Will Exercise Cause Damage to my Joints or Cause an Arthritis Flare?<br>Physiotherapy for Inflammatory Arthritis<br>Occupational Therapy for Inflammatory Arthritis |
| `psa-education-03` | Food, sleep, and recovery | – | **none** | Tips to Manage Sleep Related Issues in Psoriatic Arthritis |
| `psa-contact-01` | Sharing changes with your care team | 1 | doctor-patient | Rheumatology Specialist Nurses and self management |
| `psa-contact-02` | Eye and gut changes to report | – | eye-uveitis, digestive-system | **none** |

## Image credits

| File | Credit | Source |
|---|---|---|
| `images/synovial-joint.jpg` | OpenStax College, Anatomy & Physiology. CC BY 3.0, via Wikimedia Commons. Resized. | [source](https://commons.wikimedia.org/wiki/File:907_Synovial_Joints.jpg) |
| `images/doctor-patient.jpg` | National Cancer Institute, National Institutes of Health. Public domain, via Wikimedia Commons. Resized. | [source](https://commons.wikimedia.org/wiki/File:Doctor_talking_with_a_patient.jpg) |
| `images/mri-scan.jpg` | Blausen Medical Communications, Inc. CC BY 3.0, via Wikimedia Commons. Resized. | [source](https://commons.wikimedia.org/wiki/File:Blausen_0654_MRI_01.png) |
| `images/eye-uveitis.jpg` | Courtesy: National Eye Institute, National Institutes of Health (NEI/NIH). Public domain, via Wikimedia Commons. Resized. | [source](https://commons.wikimedia.org/wiki/File:EyeDiagramUveitis_0.jpg) |
| `images/digestive-system.jpg` | Blausen.com staff (2014). "Medical gallery of Blausen Medical 2014". WikiJournal of Medicine 1(2). CC BY 3.0, via Wikimedia Commons. Resized. | [source](https://commons.wikimedia.org/wiki/File:Blausen_0316_DigestiveSystem.png) |
| `images/shoulder-joint.jpg` | Blausen.com staff (2014). "Medical gallery of Blausen Medical 2014". WikiJournal of Medicine 1(2). CC BY 3.0, via Wikimedia Commons. Resized. | [source](https://commons.wikimedia.org/wiki/File:Blausen_0797_ShoulderJoint.png) |
| `images/hand-bones.jpg` | Blausen.com staff (2014). "Medical gallery of Blausen Medical 2014". WikiJournal of Medicine 1(2). CC BY 3.0, via Wikimedia Commons. Resized. | [source](https://commons.wikimedia.org/wiki/File:Blausen_0440_HandBones.png) |
| `images/finger-nail.jpg` | Blausen.com staff (2014). "Medical gallery of Blausen Medical 2014". WikiJournal of Medicine 1(2). CC BY 3.0, via Wikimedia Commons. Resized. | [source](https://commons.wikimedia.org/wiki/File:Blausen_0406_FingerNailAnatomy.png) |
| `images/foot-anatomy.jpg` | Blausen.com staff (2014). "Medical gallery of Blausen Medical 2014". WikiJournal of Medicine 1(2). CC BY 3.0, via Wikimedia Commons. Resized. | [source](https://commons.wikimedia.org/wiki/File:Blausen_0411_FootAnatomy.png) |
| `images/lumbar-spine.jpg` | Blausen.com staff (2014). "Medical gallery of Blausen Medical 2014". WikiJournal of Medicine 1(2). CC BY 3.0, via Wikimedia Commons. Resized. | [source](https://commons.wikimedia.org/wiki/File:Blausen_0618_LumbarSpine.png) |
| `images/si-joint.jpg` | Henry Vandyke Carter, Gray’s Anatomy (1918). Public domain, via Wikimedia Commons. Resized. | [source](https://commons.wikimedia.org/wiki/File:SI_joint.png) |
| `images/hip-anatomy.jpg` | BruceBlaus, Blausen Medical. CC BY 3.0, via Wikimedia Commons. Resized. | [source](https://commons.wikimedia.org/wiki/File:Blausen_0488_HipAnatomy.png) |
| `images/knee-side.jpg` | Blausen.com staff (2014). "Medical gallery of Blausen Medical 2014". WikiJournal of Medicine 1(2). CC BY 3.0, via Wikimedia Commons. Resized. | [source](https://commons.wikimedia.org/wiki/File:Blausen_0597_KneeAnatomy_Side.png) |

## Videos

| Video | Producer | Scope and cautions |
|---|---|---|
| [Psoriatic Arthritis – Disease Overview](https://rheum.tv/rheumtv/psoriatic-arthritis-disease-overview/) | Johns Hopkins Arthritis Center (RheumTV) | PsA-specific |
| [Psoriatic Arthritis – Signs and Symptoms](https://rheum.tv/rheumtv/psoriatic-arthritis-signs-and-symptoms/) | Johns Hopkins Arthritis Center (RheumTV) | PsA-specific; general, not one per body area |
| [Diagnosing Psoriatic Arthritis](https://rheum.tv/rheumtv/diagnosing-psoriatic-arthritis/) | Johns Hopkins Arthritis Center (RheumTV) | PsA-specific |
| [Treating Psoriatic Arthritis](https://rheum.tv/rheumtv/treating-psoriatic-arthritis/) | Johns Hopkins Arthritis Center (RheumTV) | PsA-specific; check for drug names and how current it is |
| [Living with Psoriatic Arthritis](https://rheum.tv/rheumtv/living-with-psoriatic-arthritis/) | Johns Hopkins Arthritis Center (RheumTV) | PsA-specific |
| [Using Mind and Body Practices to Improve Day-to-Day Living with Psoriatic Arthritis](https://rheum.tv/rheumtv/psoriatic-arthritis-mind-body-practices-johns-hopkins-rheumatology/) | Johns Hopkins Arthritis Center (RheumTV) | PsA-specific; covers yoga, tai chi, meditation and acupuncture |
| [Preventing Anxiety and Depression when Living with Psoriasis and Psoriatic Arthritis](https://rheum.tv/rheumtv/psoriatic-arthritis-anxiety-depression/) | Johns Hopkins Arthritis Center (RheumTV) | PsA-specific |
| [Tips to Manage Sleep Related Issues in Psoriatic Arthritis](https://rheum.tv/rheumtv/psoriatic-arthritis-sleep-problems/) | Johns Hopkins Arthritis Center (RheumTV) | PsA-specific |
| [Will Exercise Cause Damage to my Joints or Cause an Arthritis Flare?](https://rheum.tv/rheumtv/will-exercise-cause-damage-joints-cause-arthritis-flare/) | Johns Hopkins Arthritis Center (RheumTV) | General arthritis, not PsA-specific |
| [A Hitchhiker’s Guide to Inflammatory Arthritis](https://youtu.be/mZN-juGGcSw) | Oxford University Hospitals NHS Foundation Trust | Inflammatory arthritis in general, including PsA; UK care setting |
| [Rheumatology Specialist Nurses and self management](https://youtu.be/u_dAK50ABbo) | Oxford University Hospitals NHS Foundation Trust | Inflammatory arthritis in general; UK services may differ |
| [Treatments for inflammatory arthritis](https://youtu.be/W5OjhaZZBXE) | Oxford University Hospitals NHS Foundation Trust | Inflammatory arthritis in general; UK setting; check how current it is |
| [Physiotherapy for Inflammatory Arthritis](https://youtu.be/tzjvXyMuaKY) | Oxford University Hospitals NHS Foundation Trust | Inflammatory arthritis in general; UK setting |
| [Occupational Therapy for Inflammatory Arthritis](https://youtu.be/FpE2S3x6YcM) | Oxford University Hospitals NHS Foundation Trust | Inflammatory arthritis in general; UK setting |

## Considered and left out

| What | Why |
|---|---|
| National Psoriasis Foundation content | Its site terms prohibit reuse without written permission. The items checked were podcasts, with pharma-funded programs. |
| RheumTV "How to Inject ..." videos | Brand-specific medicine instructions, which the lessons deliberately avoid. |
| Photos on NIAMS, NHS and MedlinePlus pages | NIAMS says many of its photos are purchased and copyrighted; the NHS PsA photo is Alamy stock; MedlinePlus says images may be copyright protected. |
| Merck/MSD Manual and stock-library images | Not openly licensed. |
| USDA MyPlate portion chart | Public domain, but the table is for children aged 2 to 5. |
| Commons psoriatic arthritis photos and hand X-ray | Uncertain provenance or a share-alike license, and less suitable for patients. |
| Gray’s Anatomy elbow drawings | Public domain, but old engravings with Latin terms are not easy to understand. |
