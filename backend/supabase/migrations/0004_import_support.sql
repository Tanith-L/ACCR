-- 0004_import_support.sql
-- Support for import_content.py: remember the evidence fingerprint of each lesson
-- version, and make sure the public Storage bucket for images exists.

-- sha256 of claims + checks + imported status. Lets a re-import notice that a
-- draft/checked lesson gained evidence even when the patient-facing text is unchanged.
-- Null on rows imported before this column existed (treated as "differs").
alter table lessons add column evidence_hash text;

-- Images are served from {SUPABASE_URL}/storage/v1/object/public/media/<media_id>.<ext>.
-- Uploads use the service key, which bypasses Storage policies; no policies are added.
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public)
    values ('media', 'media', true)
    on conflict (id) do nothing;
  end if;
end
$$;
