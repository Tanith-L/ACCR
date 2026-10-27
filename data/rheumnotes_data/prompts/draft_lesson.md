Write the lesson "{title}" using these concepts and the source documents above:
{concepts}

Return:
- title: keep the given title unless it is misleading.
- summary: one sentence a patient sees on the learning path.
- est_minutes: realistic reading time, usually 2 to 4.
- body_markdown: 120 to 250 words in plain paragraphs (Markdown; "- " bullets allowed, no headings, no images).
- key_takeaways: two or three short sentences.
- claims: every clinical statement the body makes, one per item, each with the source_id and page that supports it. A reviewer will check each claim against that page, so split compound statements.
- quiz: up to three multiple-choice questions answerable from the body, with 3 options, the 0-based index of the correct answer, and one sentence of feedback.
