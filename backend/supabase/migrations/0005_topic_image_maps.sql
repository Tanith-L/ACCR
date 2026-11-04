-- Optional schema 1.1 image-based navigation. Apply manually after 0001..0004.
-- Map approval is separate from lesson approval. Imports never publish maps.
create table topic_image_maps (
  topic_id text primary key references topics(id) on delete cascade,
  media_id text not null references media(id),
  image_width int not null check (image_width > 0),
  image_height int not null check (image_height > 0),
  image_sha256 text not null check (image_sha256 ~ '^[0-9a-f]{64}$'),
  hotspots jsonb not null check (jsonb_typeof(hotspots) = 'array' and jsonb_array_length(hotspots) > 0),
  content_hash text not null,
  status content_status not null default 'draft',
  updated_at timestamptz not null default now()
);

alter table topic_image_maps enable row level security;
revoke all on topic_image_maps from anon, authenticated;

-- Patient clients see only an approved map and targets in its own topic whose
-- lessons are currently published. A map without active targets returns null.
create or replace function get_topic_image_map(p_topic_id text)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'topic_id', im.topic_id,
    'media', jsonb_build_object('id', m.id, 'path', m.storage_path,
                              'alt_text', m.alt_text, 'credit', m.credit),
    'image_width', im.image_width, 'image_height', im.image_height, 'image_sha256', im.image_sha256,
    'hotspots', active.hotspots, 'updated_at', im.updated_at)
  from topic_image_maps im
  join topics t on t.id = im.topic_id
  join media m on m.id = im.media_id
  cross join lateral (
    select jsonb_agg(h.value order by h.ordinality) as hotspots
    from jsonb_array_elements(im.hotspots) with ordinality as h(value, ordinality)
    where exists (
      select 1 from lessons l join subtopics s on s.id = l.subtopic_id
      where l.id = h.value->>'lesson_id' and l.status = 'published'
        and s.topic_id = im.topic_id and s.status = 'published'
    )
  ) active
  where im.topic_id = p_topic_id and im.status = 'published'
    and t.status = 'published' and active.hotspots is not null;
$$;

revoke all on function get_topic_image_map(text) from public;
grant execute on function get_topic_image_map(text) to anon, authenticated;
