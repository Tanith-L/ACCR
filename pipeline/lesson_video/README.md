# Lesson videos

Narrated whiteboard animations for every PsA lesson. The lesson text stays brief; the video goes into more detail. Every spoken line is tagged with the reference it comes from.

## Output

For each lesson, `build_videos.py` writes:

- `data/psa/chapter/<chapter>/videos/<lesson-id>.mp4`: 1280×720, 24 fps, H.264 + AAC, with an English caption track.
- `data/psa/chapter/<chapter>/videos/<lesson-id>.vtt`: the same captions as a WebVTT file for the app.
- A `video` block in the lesson's draft in `data/psa/assisted-input/all-topics.json`: the script, the source of every line, the voice details and the file paths. `pipeline/build_psa_library.py` prints it as the "Video script" section of the lesson Markdown.

## Files

| File | What it holds |
|---|---|
| `kit.js` | Drawing helpers, the icon set and the scene layouts (cards, body map, comparison, alert, steps, review…) |
| `scenes_ch1.js` | Chapter 1 scenes, drawn one by one, and their narration |
| `scenes_ch2_6.js` | Chapters 2–6: narration and scene layouts |
| `render.html` | Draws a lesson at any moment in time (used by the renderer) |
| `render.mjs` | Steps through the frames in headless Chrome and pipes them to ffmpeg |
| `build_videos.py` | Voice clips, timing, narration track, captions, render, script export |

## Writing a script

Each scene is `S(name, lines, layout)`. Each line is `[source, text]`. The source is a reference ID from `all-topics.json` (`niams-care`, `nhs-psa`…), a source-file ID (`src-mindmap`…), or `lesson-text`, `key-takeaway` or `framing` (framing lines add no medical facts). In a layout, the cue number on an element is the line that makes it appear.

Rules agreed with the team:

- Every medical statement comes from the lesson's references.
- Videos use drawn animation. Images placed in a lesson itself must be real images saved in the project.
- No named people in the videos (narration or on screen). Keep attribution in the reference list.
- No percentages from the posters, no drug names or doses, no self-scoring rules.

## Build

From the repository root, once:

```
python -m pip install -r pipeline/lesson_video/requirements.txt
cd pipeline/lesson_video && npm install && cd ../..
```

Then:

```
python pipeline/lesson_video/build_videos.py                # every lesson
python pipeline/lesson_video/build_videos.py psa-dx-01      # one lesson
python pipeline/lesson_video/build_videos.py --no-render    # script, audio, captions only
python pipeline/lesson_video/build_videos.py --covers-only  # cover images (title frame) from the existing MP4s
python pipeline/build_psa_library.py                        # refresh the lesson Markdown
```

Needs Node 18+, Google Chrome (set `CHROME_PATH` if it is not in the default macOS location) and internet access for the voice service and Google Fonts. ffmpeg comes from `imageio-ffmpeg` if it is not installed. Voice clips are cached in `.cache/` (git-ignored) by their text, so only changed lines are re-voiced.

The voice is Microsoft's neural "Ava" voice through the open-source `edge-tts` package. Sending the script to that service is the one external step.
