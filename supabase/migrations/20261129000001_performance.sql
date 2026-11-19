-- Production hardening (2026-11-19), from the Supabase performance advisor + the game's hot paths.
--   * Covering indexes for every foreign key the advisor flagged (fast deletes / joins at scale),
--     plus prize_winners (game_id, prize): claim_prize and _settle_prizes look winners up by it.
--   * RLS policies evaluate auth.uid() once per query, not once per row.
--   * claim_attempts is only needed for the 10-second claim rate limit: prune it daily.

create index if not exists prize_winners_game_prize_idx on public.prize_winners (game_id, prize);
create index if not exists prize_winners_ticket_idx on public.prize_winners (ticket_id);
create index if not exists prize_winners_user_idx on public.prize_winners (user_id);
create index if not exists check_acks_user_idx on public.check_acks (user_id);
create index if not exists claim_attempts_user_idx on public.claim_attempts (user_id);
create index if not exists game_ready_user_idx on public.game_ready (user_id);
create index if not exists room_join_requests_user_idx on public.room_join_requests (user_id);
create index if not exists rooms_current_game_idx on public.rooms (current_game_id);
create index if not exists tickets_user_idx on public.tickets (user_id);

drop policy if exists "own tickets" on public.tickets;
create policy "own tickets" on public.tickets for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists "own claims" on public.claim_attempts;
create policy "own claims" on public.claim_attempts for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

select cron.schedule(
  'housie-claim-attempts-prune', '27 3 * * *',
  $$delete from public.claim_attempts where created_at < now() - interval '2 days'$$
);
