-- Editorial references/source usage exported in schema 1.3 claims records.
-- These are not verified assertions and do not belong in lesson_claims.
-- The existing lesson RLS and published API column lists keep this private.
alter table lessons add column provenance jsonb not null default '[]'::jsonb
  check (jsonb_typeof(provenance) = 'array');

comment on column lessons.provenance is
  'Schema 1.3 claims entries with kind=provenance: bibliographic references and editorial source usage, not source quotes or clinical approval.';
