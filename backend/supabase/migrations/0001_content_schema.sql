-- 0001_content_schema.sql
-- RheumNotes PsA: content plane (Week 9)
-- Run in Supabase SQL editor or via `supabase db push`.

create type content_status as enum ('draft', 'checked', 'reviewed', 'published', 'archived');

create table import_runs (
  run_id          text primary key,
  file_name       text not null,
  schema_version  text not null,
  model           text,
  prompt_version  text,
  rows_inserted   int  not null default 0,
  rows_updated    int  not null default 0,
  rows_skipped    int  not null default 0,
  notes           jsonb not null default '[]',
  imported_at     timestamptz not null default now()
);

create table diseases (
  id    text primary key,
  name  text not null
);

create table sources (
  id           text primary key,
  title        text not null,
  type         text not null check (type in ('pdf', 'docx', 'image', 'web')),
  provided_by  text not null,
  file_hash    text not null
);

create table topics (
  id          text primary key check (id ~ '^[a-z0-9-]+$'),
  disease_id  text not null references diseases(id),
  name        text not null,
  sort_order  int  not null,
  icon        text,
  status      content_status not null default 'draft',
  updated_at  timestamptz not null default now(),
  unique (disease_id, sort_order)
);

create table subtopics (
  id          text primary key check (id ~ '^[a-z0-9-]+$'),
  topic_id    text not null references topics(id),
  name        text not null,
  sort_order  int  not null,
  status      content_status not null default 'draft',
  updated_at  timestamptz not null default now(),
  unique (topic_id, sort_order)
);

-- One row per lesson VERSION. A published lesson is never edited in place:
-- a changed lesson is inserted as version + 1 and goes back through review.
create table lessons (
  id             text not null check (id ~ '^[a-z0-9-]+$'),
  version        int  not null default 1 check (version >= 1),
  subtopic_id    text not null references subtopics(id),
  sort_order     int  not null,
  title          text not null,
  est_minutes    int  not null check (est_minutes between 1 and 5),
  pages          jsonb not null check (jsonb_typeof(pages) = 'array' and jsonb_array_length(pages) between 1 and 4),
  key_takeaways  jsonb not null check (jsonb_typeof(key_takeaways) = 'array' and jsonb_array_length(key_takeaways) between 1 and 3),
  generated_by   text not null check (generated_by in ('llm', 'human', 'llm+edited')),
  checks         jsonb not null,
  content_hash   text not null,          -- sha256 of patient-facing fields; detects real changes on re-import
  status         content_status not null default 'draft',
  run_id         text references import_runs(run_id),
  updated_at     timestamptz not null default now(),
  primary key (id, version)
);
-- At most one live (published) version per lesson.
create unique index lessons_one_published on lessons (id) where status = 'published';

create table lesson_claims (
  id              text not null,
  lesson_id       text not null,
  lesson_version  int  not null,
  text            text not null,
  page            int  not null,
  source_id       text not null references sources(id),
  source_page     int  not null,
  source_quote    text not null,
  support         text not null check (support in ('supported', 'unsupported', 'contradicted')),
  quote_match     numeric not null check (quote_match between 0 and 1),
  primary key (id, lesson_version),
  foreign key (lesson_id, lesson_version) references lessons(id, version) on delete cascade
);

create table media (
  id            text primary key,
  storage_path  text not null,           -- path in the Storage bucket "media"
  alt_text      text not null,
  credit        text not null,
  source_id     text not null references sources(id)
);

create table lesson_media (
  lesson_id       text not null,
  lesson_version  int  not null,
  media_id        text not null references media(id),
  page            int  not null,
  primary key (lesson_id, lesson_version, media_id),
  foreign key (lesson_id, lesson_version) references lessons(id, version) on delete cascade
);

create table quiz_items (
  id              text not null,
  lesson_id       text not null,
  lesson_version  int  not null,
  question        text not null,
  options         jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 4),
  answer          int  not null check (answer >= 0),
  feedback        text not null,
  source_id       text not null references sources(id),
  source_page     int  not null,
  source_quote    text not null,
  status          content_status not null default 'draft',
  primary key (id, lesson_version),
  foreign key (lesson_id, lesson_version) references lessons(id, version) on delete cascade,
  check (answer < jsonb_array_length(options))
);

create table reviews (
  review_id       bigint generated always as identity primary key,
  lesson_id       text not null,
  lesson_version  int  not null,
  reviewer        text not null,
  accuracy        int  not null check (accuracy between 1 and 5),
  completeness    int  not null check (completeness between 1 and 5),
  readability     int  not null check (readability between 1 and 5),
  safety          int  not null check (safety between 1 and 5),
  terminology     int  not null check (terminology between 1 and 5),
  decision        text not null check (decision in ('pass', 'revise')),
  comment         text,
  reviewed_at     timestamptz not null default now(),
  foreign key (lesson_id, lesson_version) references lessons(id, version)
);

create index on subtopics (topic_id);
create index on lessons (subtopic_id);
create index on quiz_items (lesson_id, lesson_version);
