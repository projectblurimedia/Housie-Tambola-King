-- The game clock. pg_cron supports sub-minute schedules ('N seconds') on Supabase.
-- Clients additionally call nudge_game() if a number is overdue, so a late cron run
-- never freezes a game.

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

select cron.schedule('housie-game-tick', '1 seconds', $$select public.advance_due_games()$$);
select cron.schedule('housie-cleanup-stale', '7 * * * *', $$select public.cleanup_stale_rooms()$$);
-- A 1-second job writes ~86k rows/day to cron.job_run_details; keep only the last day.
select cron.schedule(
  'housie-cron-history-prune', '17 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '1 day'$$
);
