// Render whiteboard lesson videos to MP4.
// Usage: node render.mjs <jobs.json>
// jobs.json: {"ffmpeg": "...", "chrome": "...", "fps": 24, "workers": 3,
//             "jobs": [{"id": "psa-dx-01", "durs": [[3.1, ...], ...], "audio": "a.m4a", "vtt": "a.vtt", "out": "x.mp4"}]}
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const fps = cfg.fps || 24;

async function renderJob(browser, job) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(here, 'render.html')).href, { waitUntil: 'networkidle0' });
  await page.evaluate(() => window.READY);
  const info = await page.evaluate((id, durs) => window.RENDER.load(id, durs), job.id, job.durs);
  const frames = Math.ceil(info.total * fps);
  const ff = spawn(cfg.ffmpeg, ['-y', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-i', job.audio, '-i', job.vtt,
    '-map', '0:v', '-map', '1:a', '-map', '2:s',
    '-vf', 'scale=out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '27', '-tune', 'animation', '-color_range', 'tv',
    '-c:a', 'aac', '-b:a', '64k', '-c:s', 'mov_text', '-metadata:s:s:0', 'language=eng',
    '-t', info.total.toFixed(3), '-movflags', '+faststart', job.out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c === 0 ? res() : rej(new Error(`ffmpeg exited ${c} for ${job.id}`)))));
  const write = buf => new Promise(res => (ff.stdin.write(buf) ? res() : ff.stdin.once('drain', res)));
  let last = null;
  for (let f = 0; f < frames; f++) {
    const r = await page.evaluate(t => window.RENDER.frame(t), f / fps);
    if (r.changed || !last) last = await page.screenshot({ type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width: 1280, height: 720 } });
    await write(last);
    if (f % (fps * 30) === 0) console.log(`${job.id}: ${Math.round((f / frames) * 100)}%`);
  }
  ff.stdin.end();
  await done;
  await page.close();
  console.log(`${job.id}: done (${info.total.toFixed(1)} s) -> ${job.out}`);
}

const browser = await puppeteer.launch({ executablePath: cfg.chrome, headless: true,
  args: ['--allow-file-access-from-files', '--hide-scrollbars', '--force-color-profile=srgb'] });
const queue = [...cfg.jobs];
const workers = Array.from({ length: Math.min(cfg.workers || 3, queue.length) }, async () => {
  while (queue.length) await renderJob(browser, queue.shift());
});
try { await Promise.all(workers); } finally { await browser.close(); }
