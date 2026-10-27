// Runs the migrations in an in-memory Postgres (PGlite) and checks the status
// lifecycle and what the `anon` role (the app's key) can and cannot read.
// No Supabase project or Docker needed: `npm install && npm run test:sql`.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const MIGRATIONS = path.resolve(import.meta.dirname, '../../supabase/migrations');
let db;

const asAnon = async (sql) => {
  await db.exec('set role anon');
  try { return (await db.query(sql)).rows; } finally { await db.exec('reset role'); }
};

before(async () => {
  db = new PGlite();
  // Roles Supabase creates for you.
  await db.exec('create role anon nologin; create role authenticated nologin;');
  for (const f of fs.readdirSync(MIGRATIONS).sort()) {
    await db.exec(fs.readFileSync(path.join(MIGRATIONS, f), 'utf8'));
  }
  await db.exec(`
    insert into diseases values ('test', 'Test');
    insert into sources (id, title) values ('s1', 'Source one');
    insert into topics (id, disease_id, name, order_index) values ('t1', 'test', 'Topic', 1), ('t2', 'test', 'Unpublished topic', 2);
    insert into subtopics values ('st1', 't1', 'Sub', 1), ('st2', 't2', 'Sub 2', 1);
    insert into lessons values ('l1', 't1', 'st1', 1), ('l2', 't1', 'st1', 2), ('l3', 't2', 'st2', 1);
    insert into lesson_versions (lesson_id, version, status, title, summary, body_markdown, est_minutes, origin, source_refs, claims) values
      ('l1', 1, 'checked', 'L1', 's', 'body', 2, 'ai_generated', '[{"source_id":"s1","pages":[1]}]', '[{"text":"c"}]'),
      ('l2', 1, 'draft',   'L2', 's', 'SECRET', 2, 'ai_generated', '[]', '[]'),
      ('l3', 1, 'checked', 'L3', 's', 'SECRET', 2, 'ai_generated', '[]', '[]');
    update lesson_versions set status = 'reviewed' where lesson_id = 'l1';
    update lesson_versions set status = 'published' where lesson_id = 'l1';
  `);
});

test('new versions can only be draft or checked', async () => {
  await assert.rejects(db.query(`insert into lesson_versions (lesson_id, version, status, title, summary, body_markdown, est_minutes, origin)
                                 values ('l2', 2, 'published', 'x', 's', 'b', 1, 'x')`), /draft or checked/);
});

test('draft cannot skip to reviewed or published', async () => {
  await assert.rejects(db.query(`update lesson_versions set status = 'reviewed' where lesson_id = 'l2'`), /illegal status change/);
  await assert.rejects(db.query(`update lesson_versions set status = 'published' where lesson_id = 'l2'`), /illegal status change/);
});

test('published content is frozen', async () => {
  await assert.rejects(db.query(`update lesson_versions set body_markdown = 'x' where lesson_id = 'l1'`), /new version/);
});

test('publishing stamps published_at', async () => {
  const [row] = (await db.query(`select published_at is not null as stamped from lesson_versions where lesson_id = 'l1'`)).rows;
  assert.equal(row.stamped, true);
});

test('anon sees only published lessons and topics that have them', async () => {
  assert.deepEqual((await asAnon('select id from v_lessons')).map(r => r.id), ['l1']);
  assert.deepEqual((await asAnon('select id from v_topics')).map(r => r.id), ['t1']);
  assert.deepEqual((await asAnon('select lesson_id from lesson_versions')).map(r => r.lesson_id), ['l1']);
});

test('v_lessons resolves source titles', async () => {
  const [l] = await asAnon('select "references" from v_lessons');
  assert.deepEqual(l.references, [{ source_id: 's1', title: 'Source one', url: null, pages: [1] }]);
});

test('anon cannot read internal columns or tables', async () => {
  await assert.rejects(asAnon('select claims from lesson_versions'), /permission denied/);
  await assert.rejects(asAnon('select check_results from lesson_versions'), /permission denied/);
  await assert.rejects(asAnon('select * from pipeline_runs'), /permission denied/);
  await assert.rejects(asAnon('select * from content_events'), /permission denied/);
});

test('anon cannot write', async () => {
  await assert.rejects(asAnon(`insert into topics (id, disease_id, name, order_index) values ('x', 'test', 'x', 9)`), /permission denied/);
  await assert.rejects(asAnon(`update lesson_versions set title = 'hacked'`), /permission denied/);
});
