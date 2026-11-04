-- 0007_mind_map.sql
-- Topic map: the published hierarchy (disease -> topics -> subtopics -> lessons) as one flat
-- list of nodes. The backend decides the nodes and the parent links; the app only draws them.
-- Built from published rows only, so it follows the same review and publish flow as lessons.
-- No new tables. Apply after 0001..0006 (0005 and 0006 are not required by this function).

create or replace function get_mind_map(p_disease_id text default 'psa')
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with pl as (
    -- One row per published lesson whose subtopic and topic are published too.
    select t.id as topic_id, t.name as topic_name, t.sort_order as topic_sort,
           s.id as sub_id, s.name as sub_name, s.sort_order as sub_sort,
           l.id as lesson_id, l.title as lesson_title, l.sort_order as lesson_sort
    from lessons l
    join subtopics s on s.id = l.subtopic_id and s.status = 'published'
    join topics t on t.id = s.topic_id and t.status = 'published' and t.disease_id = p_disease_id
    where l.status = 'published'
  ),
  nodes as (
    select 0 as depth, 'root'::text as id, null::text as parent_id, 'root'::text as kind,
           d.name::text as label, 0 as sort_order, null::text as lesson_id
    from diseases d
    where d.id = p_disease_id and exists (select 1 from pl)
    union all
    select distinct 1, 'topic:' || topic_id, 'root'::text, 'topic'::text, topic_name::text, topic_sort, null::text
    from pl
    union all
    select distinct 2, 'subtopic:' || sub_id, 'topic:' || topic_id, 'subtopic'::text, sub_name::text, sub_sort, null::text
    from pl
    union all
    select 3, 'lesson:' || lesson_id, 'subtopic:' || sub_id, 'lesson'::text, lesson_title::text, lesson_sort, lesson_id::text
    from pl
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'parent_id', parent_id, 'kind', kind, 'label', label,
           'sort_order', sort_order, 'lesson_id', lesson_id)
         order by depth, sort_order, id), '[]'::jsonb)
  from nodes;
$$;

revoke all on function get_mind_map(text) from public;
grant execute on function get_mind_map(text) to anon, authenticated;
