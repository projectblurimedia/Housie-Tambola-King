-- Snakes & Ladders boards v2 (owner, 2026-11-27): every board has one long snake (6+ rows) and one
-- long ladder (5+ rows); ladders upright, no two pieces overlapping. Same as SNL_BOARDS in the app.

create or replace function public._snl_boards()
returns jsonb
language sql immutable set search_path = ''
as $$
  select '[{"ladders":{"4":37,"5":26,"11":69,"13":53,"20":40,"27":47,"35":55},"snakes":{"81":41,"87":66,"92":71,"93":73,"96":44,"98":22}},{"ladders":{"14":54,"15":46,"22":42,"25":85,"57":77,"60":79},"snakes":{"38":4,"41":20,"87":67,"90":28,"95":66,"98":43}},{"ladders":{"4":44,"8":32,"26":74,"30":51,"48":68,"57":77},"snakes":{"56":25,"69":49,"78":2,"81":21,"85":65,"91":73}},{"ladders":{"4":25,"10":30,"18":83,"20":42,"36":76,"44":77},"snakes":{"54":34,"68":29,"75":26,"80":60,"82":59,"91":31,"94":72}},{"ladders":{"3":43,"4":44,"10":30,"16":36,"21":81,"22":59},"snakes":{"26":6,"75":35,"87":29,"91":31,"97":65,"99":63}}]'::jsonb
$$;

revoke execute on function public._snl_boards() from public, anon, authenticated;
