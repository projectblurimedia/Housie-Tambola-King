-- Standings: "wins" counts Full Housie wins only (owner, 2-27): a game's Fast 5 / lines / columns no
-- longer show as several "wins". Every prize still appears in the list, and won / net are unchanged.

create or replace function public.get_room_standings(p_room uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := public._require_player();
begin
  if not public._can_view_room(p_room, v_uid) then
    raise exception 'NOT_IN_ROOM' using errcode = 'P0001';
  end if;
  return (
    with played as (
      select t.user_id, count(*) as tickets, sum(g.ticket_price) as spent, count(distinct g.id) as games
        from public.tickets t join public.games g on g.id = t.game_id
       where g.room_id = p_room and g.status = 'finished'
       group by t.user_id
    ),
    won as (
      select w.user_id, count(*) filter (where w.prize = 'full_house') as wins, sum(w.amount) as won,
             jsonb_agg(jsonb_build_object('gameNo', g.game_no, 'prize', w.prize, 'amount', w.amount,
                                          'numbers', w.numbers) order by g.game_no, public._prize_order(w.prize)) as list
        from public.prize_winners w join public.games g on g.id = w.game_id
       where w.room_id = p_room and g.status = 'finished'
       group by w.user_id
    ),
    people as (
      select user_id from played
      union select user_id from won
      union select user_id from public.room_members where room_id = p_room
    )
    select coalesce(jsonb_agg(row_data order by (row_data ->> 'net')::numeric desc,
                                              (row_data ->> 'won')::numeric desc), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'userId', pe.user_id, 'name', pr.display_name, 'avatarKey', pr.avatar_key,
          'games', coalesce(pl.games, 0), 'tickets', coalesce(pl.tickets, 0),
          'spent', coalesce(pl.spent, 0), 'wins', coalesce(wo.wins, 0), 'won', coalesce(wo.won, 0),
          'net', coalesce(wo.won, 0) - coalesce(pl.spent, 0),
          'list', coalesce(wo.list, '[]'::jsonb),
          'isMember', exists (select 1 from public.room_members m where m.room_id = p_room and m.user_id = pe.user_id)) as row_data
          from people pe
          join public.profiles pr on pr.id = pe.user_id
          left join played pl on pl.user_id = pe.user_id
          left join won wo on wo.user_id = pe.user_id
      ) s
  );
end;
$$;
