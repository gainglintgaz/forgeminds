-- Prevent duplicate provider sends per brief per channel (hostile-architect review 2026-06-11,
-- docs/architecture/email-delivery.md §5). Partial unique: only 'sent' rows conflict; failed
-- retries may accumulate freely. Code treats 23505 on the sent-row insert as already-sent (VIBE 37).
create unique index if not exists delivery_log_sent_once
  on public.delivery_log (brief_id, delivery_type)
  where status = 'sent';
