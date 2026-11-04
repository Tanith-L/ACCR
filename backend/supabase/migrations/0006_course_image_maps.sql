-- Schema 1.2 course overview -> topic navigation. Apply after 0005.
create table course_image_maps (
  disease_id text primary key references diseases(id) on delete cascade,
  media_id text not null references media(id),
  image_width int not null check (image_width > 0),
  image_height int not null check (image_height > 0),
  image_sha256 text not null check (image_sha256 ~ '^[0-9a-f]{64}$'),
  hotspots jsonb not null check (jsonb_typeof(hotspots) = 'array' and jsonb_array_length(hotspots) > 0),
  content_hash text not null,
  status content_status not null default 'draft',
  updated_at timestamptz not null default now()
);
alter table course_image_maps enable row level security;
revoke all on course_image_maps from anon, authenticated;

create or replace function get_course_image_map(p_disease_id text)
returns jsonb language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'disease_id', im.disease_id,
    'media', jsonb_build_object('id', m.id, 'path', m.storage_path, 'alt_text', m.alt_text, 'credit', m.credit),
    'image_width', im.image_width, 'image_height', im.image_height, 'image_sha256', im.image_sha256,
    'hotspots', active.hotspots, 'updated_at', im.updated_at)
  from course_image_maps im join media m on m.id = im.media_id
  cross join lateral (
    select jsonb_agg(h.value order by h.ordinality) as hotspots
    from jsonb_array_elements(im.hotspots) with ordinality as h(value, ordinality)
    where exists (
      select 1 from topics t join subtopics s on s.topic_id = t.id join lessons l on l.subtopic_id = s.id
      where t.id = h.value->>'topic_id' and t.disease_id = im.disease_id
        and t.status = 'published' and s.status = 'published' and l.status = 'published'
    )
  ) active
  where im.disease_id = p_disease_id and im.status = 'published' and active.hotspots is not null;
$$;
revoke all on function get_course_image_map(text) from public;
grant execute on function get_course_image_map(text) to anon, authenticated;
