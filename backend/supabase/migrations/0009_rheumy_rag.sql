-- Rheumy chatbot: the passages it answers from (docs/rheumy-chatbot.md).
--
-- Each row is a short passage of a lesson page or of a source document, with a
-- gte-small embedding (384 numbers, made by the rheumy-ingest Edge Function so it
-- matches the embeddings rheumy-chat makes for questions) and a keyword index.
-- Like the other base tables: RLS on, no policies, no grants to anon/authenticated.
-- Only the Edge Functions (secret key) read or write it; the app never does.
-- Nothing a user types is stored: there is no chat or message table.

create extension if not exists vector with schema extensions;

create table public.rheumy_chunks (
  id             text primary key,               -- '<source_id>#<n>', stable across re-imports
  kind           text not null check (kind in ('lesson', 'source')),
  source_id      text not null,                  -- lesson id (psa-dx-01) or source id (src-...)
  title          text not null,                  -- lesson or document title, shown as the citation
  locator        text,                           -- where in it: 'Page 2', 'Part 3 of 12'
  lesson_status  text,                           -- lessons: draft/checked/reviewed/published at import
  content        text not null,
  content_sha256 text not null,                  -- unchanged passages are not re-embedded
  embedding      extensions.vector(384) not null,
  fts            tsvector generated always as (to_tsvector('english', title || ' ' || content)) stored,
  updated_at     timestamptz not null default now()
);

create index rheumy_chunks_embedding_idx on public.rheumy_chunks
  using hnsw (embedding extensions.vector_cosine_ops);
create index rheumy_chunks_fts_idx on public.rheumy_chunks using gin (fts);

alter table public.rheumy_chunks enable row level security;
revoke all on public.rheumy_chunks from anon, authenticated;

-- Hybrid search: the closest passages by meaning and the best keyword matches,
-- merged by reciprocal rank fusion. Lesson passages (written for patients) get a
-- small boost over source documents. `keywords` is an OR query such as
-- 'heel | pain | swollen', built from the question by the Edge Function.
create function public.rheumy_search(
  query_embedding extensions.vector(384),
  keywords text,
  match_count int default 6
)
returns table (
  id text, kind text, source_id text, title text, locator text,
  lesson_status text, content text, score double precision
)
language sql stable
set search_path = public, extensions
as $$
  with by_meaning as (
    select c.id, row_number() over (order by c.embedding <=> query_embedding) as r
    from public.rheumy_chunks c
    order by c.embedding <=> query_embedding
    limit 24
  ),
  q as (
    select case when coalesce(keywords, '') = '' then null
                else to_tsquery('english', keywords) end as tsq
  ),
  by_keyword as (
    select c.id, row_number() over (order by ts_rank_cd(c.fts, q.tsq) desc) as r
    from public.rheumy_chunks c, q
    where q.tsq is not null and c.fts @@ q.tsq
    order by ts_rank_cd(c.fts, q.tsq) desc
    limit 24
  )
  select c.id, c.kind, c.source_id, c.title, c.locator, c.lesson_status, c.content,
         coalesce(1.0 / (60 + m.r), 0) + coalesce(1.0 / (60 + k.r), 0)
           + case when c.kind = 'lesson' then 0.004 else 0 end as score
  from public.rheumy_chunks c
  left join by_meaning m on m.id = c.id
  left join by_keyword k on k.id = c.id
  where m.id is not null or k.id is not null
  order by score desc
  limit least(greatest(match_count, 1), 12);
$$;

revoke execute on function public.rheumy_search(extensions.vector, text, int) from public, anon, authenticated;
grant execute on function public.rheumy_search(extensions.vector, text, int) to service_role;
