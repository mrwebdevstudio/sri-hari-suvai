-- Sprint 4: correct the demonstrated audit entity-type constraint defect.
-- Sprint 3 accidentally checked event_type for non-emptiness in this column constraint.

alter table public.audit_logs
  drop constraint if exists audit_logs_entity_type_check;

alter table public.audit_logs
  add constraint audit_logs_entity_type_check
  check (char_length(entity_type) between 1 and 80);
