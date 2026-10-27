-- RheumNotes content schema (Week 9).
--
-- Base tables hold everything, including drafts and review metadata.
-- The app (anon key) can only read the v_* views, and RLS + column grants make
-- sure even a hand-written request can't see unpublished rows or internal fields.
-- Import / review / publish scripts use the service key, which bypasses RLS.

create type content_status as enum ('draft', 'checked', 'reviewed', 'published');

-- ---------- structure ----------

create table diseases (
  id   text primary key,
  name text not null
);

create table sources (
  id         text primary key,
  title      text not null,
  file       text,
  url        text,
  media_type text,
  credit     text
);

create table topics (
  id          text primary key,
  disease_id  text not null references diseases(id),
  name        text not null,
  order_index int  not null check (order_index >= 1),
  icon        text,
  description text,
  updated_at  timestamptz not null default now()
);

create table subtopics (
  id          text primary key,
  topic_id    text not null references topics(id) on delete cascade,
  name        text not null,
  order_index int  not null check (order_index >= 1)
);

-- A lesson's identity and place in the learning path. Content lives in lesson_versions.
create table lessons (
  id          text primary key,
  topic_id    text not null references topics(id),
  subtopic_id text not null references subtopics(id),
  order_index int  not null check (order_index >= 1)
);

create table pipeline_runs (
  run_id              text primary key,
  mode                text not null,
  model               text,
  prompt_version      text,
  started_at          timestamptz,
  finished_at         timestamptz,
  duration_seconds    numeric,
  source_document_ids text[] not null default '{}',
  usage               jsonb,
  imported_at         timestamptz not null default now()
);

-- ---------- content ----------

create table lesson_versions (
  id             bigint generated always as identity primary key,
  lesson_id      text not null references lessons(id) on delete cascade,
  version        int  not null check (version >= 1),
  status         content_status not null default 'draft',

  -- patient-facing
  title          text not null,
  summary        text not null,
  body_markdown  text not null,
  est_minutes    int  not null,
  key_takeaways  jsonb not null default '[]',
  images         jsonb not null default '[]',
  source_refs    jsonb not null default '[]',
  quiz           jsonb not null default '[]',
  published_at   timestamptz,

  -- internal: never exposed to the app
  origin         text not null,
  claims         jsonb not null default '[]',
  check_results  jsonb not null default '[]',
  run_id         text references pipeline_runs(run_id),
  review_scores  jsonb,
  reviewer       text,
  review_comment text,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),

  unique (lesson_id, version)
);

create index lesson_versions_status_idx on lesson_versions (status, lesson_id, version desc);

-- Audit trail for import / review / publish (the "logging" requirement).
create table content_events (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      text,
  action     text not null,          -- import | review | publish | reject
  lesson_id  text,
  version    int,
  outcome    text not null,          -- ok | rejected | error
  message    text
);

-- ---------- status lifecycle ----------
-- draft -> checked happens by re-export (a new version), never by editing a row.
-- checked -> reviewed (Rubric B pass), reviewed -> published. Nothing else.

create function enforce_status_transition() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.status not in ('draft', 'checked') then
      raise exception 'new lesson versions must be draft or checked, got %', new.status;
    end if;
    return new;
  end if;

  if new.status is distinct from old.status then
    if not (old.status = 'checked'  and new.status = 'reviewed')
       and not (old.status = 'reviewed' and new.status = 'published') then
      raise exception 'illegal status change % -> % for % v%',
        old.status, new.status, old.lesson_id, old.version;
    end if;
    if new.status = 'reviewed' then new.reviewed_at := coalesce(new.reviewed_at, now()); end if;
    if new.status = 'published' then new.published_at := coalesce(new.published_at, now()); end if;
  end if;

  -- Content of a reviewed or published version is frozen; fix it with a new version.
  if old.status in ('reviewed', 'published') and (
       new.title, new.summary, new.body_markdown, new.key_takeaways, new.source_refs, new.quiz
     ) is distinct from (
       old.title, old.summary, old.body_markdown, old.key_takeaways, old.source_refs, old.quiz
     ) then
    raise exception 'content of % v% is %, create a new version instead',
      old.lesson_id, old.version, old.status;
  end if;
  return new;
end $$;

create trigger lesson_versions_status
  before insert or update on lesson_versions
  for each row execute function enforce_status_transition();

-- ---------- patient-facing views ----------
-- security_invoker: the view runs with the caller's permissions, so RLS below applies.

create view v_lessons with (security_invoker = true) as
select distinct on (lv.lesson_id)
  l.id,
  l.topic_id,
  l.subtopic_id,
  l.order_index,
  lv.version,
  lv.title,
  lv.summary,
  lv.body_markdown,
  lv.est_minutes,
  lv.key_takeaways,
  lv.images,
  (select coalesce(jsonb_agg(jsonb_build_object(
            'source_id', r->>'source_id',
            'title', s.title,
            'url', s.url,
            'pages', r->'pages') order by ord), '[]'::jsonb)
     from jsonb_array_elements(lv.source_refs) with ordinality as x(r, ord)
     left join sources s on s.id = r->>'source_id') as "references",
  lv.quiz,
  lv.published_at
from lesson_versions lv
join lessons l on l.id = lv.lesson_id
where lv.status = 'published'
order by lv.lesson_id, lv.version desc;

create view v_subtopics with (security_invoker = true) as
select st.id, st.topic_id, st.name, st.order_index, count(v.id)::int as lesson_count
from subtopics st
join v_lessons v on v.subtopic_id = st.id
group by st.id;

create view v_topics with (security_invoker = true) as
select t.id, t.disease_id, t.name, t.description, t.icon, t.order_index, t.updated_at,
       count(v.id)::int as lesson_count,
       coalesce(sum(v.est_minutes), 0)::int as total_minutes
from topics t
join v_lessons v on v.topic_id = t.id
group by t.id;

-- ---------- access control ----------

alter table diseases        enable row level security;
alter table sources         enable row level security;
alter table topics          enable row level security;
alter table subtopics       enable row level security;
alter table lessons         enable row level security;
alter table lesson_versions enable row level security;
alter table pipeline_runs   enable row level security;
alter table content_events  enable row level security;

-- Supabase grants everything to anon/authenticated by default; start from nothing.
revoke all on all tables in schema public from anon, authenticated;

-- Structure is not clinical content, so it is readable.
grant select on diseases, sources, topics, subtopics, lessons to anon, authenticated;
create policy read_all on diseases  for select to anon, authenticated using (true);
create policy read_all on sources   for select to anon, authenticated using (true);
create policy read_all on topics    for select to anon, authenticated using (true);
create policy read_all on subtopics for select to anon, authenticated using (true);
create policy read_all on lessons   for select to anon, authenticated using (true);

-- Lesson content: published rows only, patient-facing columns only.
grant select (id, lesson_id, version, status, title, summary, body_markdown, est_minutes,
              key_takeaways, images, source_refs, quiz, published_at)
  on lesson_versions to anon, authenticated;
create policy read_published on lesson_versions for select to anon, authenticated
  using (status = 'published');

grant select on v_lessons, v_subtopics, v_topics to anon, authenticated;

-- pipeline_runs and content_events: no grants, no policies -> service key only.
