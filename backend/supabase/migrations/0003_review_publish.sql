-- 0003_review_publish.sql
-- Status changes used by the review and publish scripts (service role only).

-- Record a Rubric B review. Only a 'checked' lesson can be reviewed.
-- The pass rule is enforced here, not trusted from the sheet.
create or replace function apply_review(
  p_lesson_id text, p_version int, p_reviewer text,
  p_accuracy int, p_completeness int, p_readability int, p_safety int, p_terminology int,
  p_comment text default null)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_status content_status;
  v_grade  numeric;
  v_pass   boolean;
begin
  select status, (checks->>'fk_grade')::numeric into v_status, v_grade
  from lessons where id = p_lesson_id and version = p_version
  for update;

  if not found then
    raise exception 'lesson %.v% not found', p_lesson_id, p_version;
  end if;
  if v_status <> 'checked' then
    raise exception 'lesson %.v% is %, only checked lessons can be reviewed', p_lesson_id, p_version, v_status;
  end if;

  v_pass := p_accuracy = 5 and p_safety = 5
            and p_completeness >= 4 and p_readability >= 4 and p_terminology >= 4
            and coalesce(v_grade, 99) <= 8;

  insert into reviews (lesson_id, lesson_version, reviewer, accuracy, completeness,
                       readability, safety, terminology, decision, comment)
  values (p_lesson_id, p_version, p_reviewer, p_accuracy, p_completeness,
          p_readability, p_safety, p_terminology,
          case when v_pass then 'pass' else 'revise' end, p_comment);

  if v_pass then
    update lessons set status = 'reviewed', updated_at = now()
    where id = p_lesson_id and version = p_version;
    return 'reviewed';
  end if;
  return 'revise';  -- stays 'checked'; comment goes back to the Data Lead
end;
$$;

-- Publish a reviewed lesson version; archive the version it replaces;
-- publish its quiz items and make sure its subtopic and topic are visible.
create or replace function publish_lesson(p_lesson_id text, p_version int)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_status   content_status;
  v_subtopic text;
begin
  select status, subtopic_id into v_status, v_subtopic
  from lessons where id = p_lesson_id and version = p_version
  for update;

  if not found then
    raise exception 'lesson %.v% not found', p_lesson_id, p_version;
  end if;
  if v_status <> 'reviewed' then
    raise exception 'lesson %.v% is %, only reviewed lessons can be published', p_lesson_id, p_version, v_status;
  end if;

  update lessons set status = 'archived', updated_at = now()
  where id = p_lesson_id and status = 'published';

  update lessons set status = 'published', updated_at = now()
  where id = p_lesson_id and version = p_version;

  update quiz_items set status = 'published'
  where lesson_id = p_lesson_id and lesson_version = p_version and status = 'checked';

  update subtopics set status = 'published', updated_at = now()
  where id = v_subtopic and status <> 'published';

  update topics set status = 'published', updated_at = now()
  where id = (select topic_id from subtopics where id = v_subtopic) and status <> 'published';
end;
$$;

-- Roll back: re-publish the most recent archived version.
create or replace function rollback_lesson(p_lesson_id text)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_prev int;
begin
  select max(version) into v_prev from lessons
  where id = p_lesson_id and status = 'archived';
  if v_prev is null then
    raise exception 'no archived version of % to roll back to', p_lesson_id;
  end if;
  update lessons set status = 'archived', updated_at = now()
  where id = p_lesson_id and status = 'published';
  update lessons set status = 'published', updated_at = now()
  where id = p_lesson_id and version = v_prev;
  return v_prev;
end;
$$;

revoke all on function apply_review(text,int,text,int,int,int,int,int,text) from public, anon, authenticated;
revoke all on function publish_lesson(text,int) from public, anon, authenticated;
revoke all on function rollback_lesson(text) from public, anon, authenticated;
