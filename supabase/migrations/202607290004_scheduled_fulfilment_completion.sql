-- Complete SENT fulfilments after ten days. The transition function is
-- idempotent and refuses returned, cancelled, or disputed records.
create extension if not exists pg_cron with schema extensions;

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname='chapli-complete-sent-fulfilments';
  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
  perform cron.schedule(
    'chapli-complete-sent-fulfilments',
    '17 * * * *',
    'select public.complete_eligible_fulfilments();'
  );
end
$$;
