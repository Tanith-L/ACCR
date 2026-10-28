-- 0002_published_access.sql
-- What the app can see: published rows only, patient-facing columns only.

-- 1. Lock the base tables. RLS on with no policies = no rows for anon/authenticated.
alter table import_runs   enable row level security;
alter table diseases      enable row level security;
alter table sources       enable row level security;
alter table topics        enable row level security;
alter table subtopics     enable row level security;
alter table lessons       enable row level security;
alter table lesson_claims enable row level security;
alter table media         enable row level security;
alter table lesson_media  enable row level security;
alter table quiz_items    enable row level security;
alter table reviews       enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- 2. Published views (owned by postgres, so they read past RLS but filter to published).
create view v_topics as
  select t.id, t.disease_id, t.name, t.sort_order, t.icon
  from topics t
  where t.status = 'published';

create view v_lessons as
  select l.id, l.version, l.subtopic_id, l.sort_order, l.title, l.est_minutes,
         l.pages, l.key_takeaways,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'media_id', m.id, 'page', lm.page, 'path', m.storage_path,
                    'alt_text', m.alt_text, 'credit', m.credit) order by lm.page)
           from lesson_media lm join media m on m.id = lm.media_id
           where lm.lesson_id = l.id and lm.lesson_version = l.version), '[]'::jsonb) as images,
         l.updated_at
  from lessons l
  where l.status = 'published';

create view v_quiz_items as
  select q.id, q.lesson_id, q.question, q.options, q.answer, q.feedback
  from quiz_items q
  join lessons l on l.id = q.lesson_id and l.version = q.lesson_version
  where q.status = 'published' and l.status = 'published';

-- 3. Learning path for one topic: subtopics with their published lessons, in order.
create or replace function get_learning_path(p_topic_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'name', s.name, 'sort_order', s.sort_order,
           'lessons', coalesce((
              select jsonb_agg(jsonb_build_object(
                       'id', l.id, 'title', l.title, 'est_minutes', l.est_minutes,
                       'sort_order', l.sort_order) order by l.sort_order)
              from lessons l
              where l.subtopic_id = s.id and l.status = 'published'), '[]'::jsonb)
         ) order by s.sort_order), '[]'::jsonb)
  from subtopics s
  where s.topic_id = p_topic_id and s.status = 'published';
$$;

-- 4. Grant the app (anon key, and later signed-in users) read access to these only.
grant usage on schema public to anon, authenticated;
grant select on v_topics, v_lessons, v_quiz_items to anon, authenticated;
revoke all on function get_learning_path(text) from public;
grant execute on function get_learning_path(text) to anon, authenticated;
