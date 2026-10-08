-- VEYRMARCH realms: player profiles, characters, and persistent worlds.
--
-- Clients never touch these tables. Row level security is on with no policies, and table
-- privileges are revoked from the public roles. Every client action is a vm_* function that
-- checks the caller's identity and the game rules, then changes state. The functions are the
-- authority for: identity, world membership, zones and doors, inventory, crafting, gathering,
-- loot, experience and levels, shops, quests, unique rewards, world progression, and every
-- boss's shared health pool.
--
-- Identity is a device secret: the client generates 32 random bytes, registers once, and keeps
-- (player id, secret) in local storage. Only the SHA-256 of the secret is stored.
--
-- Positions: every zone is built in local coordinates and placed at a world x origin (ox, see
-- src/game/data/zones.ts). Every table here stores WORLD coordinates (ox + local x, z).
--
-- This file is applied again and again (the hosted project, the local realm, and the browser's
-- solo realm re-apply it when it changes), so every statement is idempotent and an older
-- database is migrated in place, never broken.

-- ------------------------------------------------------------------ content (seeded from src/game/data by gen-seed.mjs)
create table if not exists vm_item_defs (
  id text primary key, name text not null, kind text not null, stack int not null, damage int not null,
  tier int not null, slot text not null, moveset text not null, heal int not null, soulbound boolean not null
);
create table if not exists vm_recipes (id text primary key, out_item text not null references vm_item_defs, station text not null);
create table if not exists vm_recipe_inputs (recipe text not null references vm_recipes on delete cascade, item text not null references vm_item_defs, n int not null, primary key (recipe, item));
create table if not exists vm_trades (id text primary key, get_item text not null references vm_item_defs, get_n int not null);
create table if not exists vm_trade_inputs (trade text not null references vm_trades on delete cascade, item text not null references vm_item_defs, n int not null, primary key (trade, item));
create table if not exists vm_loot (kind text not null, item text not null references vm_item_defs, n int not null, chance real not null, primary key (kind, item));
create table if not exists vm_mob_spawns (key text primary key, kind text not null, dungeon boolean not null, respawns boolean not null);
create table if not exists vm_nodes (id text primary key, item text not null references vm_item_defs, tier int not null, seal text, max_left int not null);
create table if not exists vm_caches (cache text not null, item text not null references vm_item_defs, n int not null, primary key (cache, item));
create table if not exists vm_config (key text primary key, value jsonb not null);

-- ------------------------------------------------------------------ players, characters, worlds
create table if not exists vm_players (
  id uuid primary key default gen_random_uuid(),
  secret_hash text not null,
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create table if not exists vm_characters (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references vm_players on delete cascade,
  name text not null,
  look jsonb not null,
  hp real not null default 100,
  max_hp int not null default 100,
  mana_max int not null default 0,
  flags jsonb not null default '{}'::jsonb,
  kills int not null default 0,
  deaths int not null default 0,
  play_seconds int not null default 0,
  seq int not null default 1,
  last_world uuid,
  deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vm_characters_player on vm_characters (player_id);
create table if not exists vm_items (
  character_id uuid not null references vm_characters on delete cascade,
  uid text not null,
  def text not null references vm_item_defs,
  count int not null check (count > 0),
  equipped boolean not null default false,
  soulbound boolean not null default false,
  primary key (character_id, uid)
);
-- a character can never hold two copies of a unique item
create unique index if not exists vm_items_one_unique on vm_items (character_id, def) where soulbound;
create table if not exists vm_worlds (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  owner uuid not null references vm_players on delete cascade,
  seed int not null default 1234,
  max_players int not null default 4,
  flags jsonb not null default '{}'::jsonb,
  hour real not null default 7.3,
  day int not null default 1,
  boss jsonb not null default '{}'::jsonb,
  nodes jsonb not null default '{}'::jsonb,
  dead_mobs jsonb not null default '{}'::jsonb,
  clock_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists vm_members (
  world_id uuid not null references vm_worlds on delete cascade,
  character_id uuid not null references vm_characters on delete cascade,
  player_id uuid not null references vm_players on delete cascade,
  x real,
  z real,
  yaw real not null default 0,
  dungeon boolean not null default false,
  flags jsonb not null default '{}'::jsonb,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  pos_at timestamptz not null default now(),
  primary key (world_id, character_id)
);
create index if not exists vm_members_player on vm_members (player_id);
create table if not exists vm_boss_hits (
  world_id uuid not null references vm_worlds on delete cascade,
  boss text not null,
  character_id uuid not null references vm_characters on delete cascade,
  fight int not null,
  dmg int not null,
  at timestamptz not null default now()
);
create index if not exists vm_boss_hits_fight on vm_boss_hits (world_id, boss, fight);
create index if not exists vm_boss_hits_char on vm_boss_hits (character_id, at);
create table if not exists vm_grants (
  world_id uuid not null references vm_worlds on delete cascade,
  boss text not null,
  character_id uuid not null references vm_characters on delete cascade,
  at timestamptz not null default now(),
  primary key (world_id, boss, character_id)
);

-- ------------------------------------------------------------------ migrations for existing databases (idempotent)
-- a member who left (or was removed) keeps their history but frees the seat
alter table vm_members add column if not exists left_at timestamptz;
alter table vm_players add column if not exists imports int not null default 0;
alter table vm_boss_hits add column if not exists fire boolean not null default false;
-- a deleted world keeps its rows (members' history) but is gone from every list and code lookup
alter table vm_worlds add column if not exists deleted boolean not null default false;

-- Phase B: items carry armour, rarity, price and weapon family; recipes can make several
alter table vm_item_defs add column if not exists defence int not null default 0;
alter table vm_item_defs add column if not exists rarity text not null default 'common';
alter table vm_item_defs add column if not exists value int not null default 0;
alter table vm_item_defs add column if not exists family text not null default '';
alter table vm_recipes add column if not exists n int not null default 1;
alter table vm_mob_spawns add column if not exists zone text;
-- where a foe stands (world coordinates): a kill is paid only to someone near it
alter table vm_mob_spawns add column if not exists x real;
alter table vm_mob_spawns add column if not exists z real;
alter table vm_nodes add column if not exists zone text;
alter table vm_nodes add column if not exists x real;
alter table vm_nodes add column if not exists z real;

-- Phase B: a member stands in a zone. Older rows only knew "in the castle or not".
alter table vm_members add column if not exists zone text;
update vm_members set zone = case when dungeon then 'castle' else 'over' end where zone is null;
alter table vm_members alter column zone set default 'over';
alter table vm_members alter column zone set not null;

-- Phase B: experience, kills by kind, and quest progress live on the character
alter table vm_characters add column if not exists kill_counts jsonb not null default '{}'::jsonb;
alter table vm_characters add column if not exists quests jsonb not null default '{}'::jsonb;
do $$
begin
  if not exists (select 1 from pg_attribute where attrelid = to_regclass('vm_characters') and attname = 'xp' and not attisdropped) then
    alter table vm_characters add column xp int not null default 0;
    -- one time, as the column appears: experience for what was done before experience existed
    update vm_characters c set xp = least(greatest(c.kills, 0), 100) * 12
                                    + 400 * (select count(*)::int from vm_grants g where g.character_id = c.id)
      where c.xp = 0;
  end if;
end $$;

-- Phase B content: zones, doors, shrines, stations, foes' worth, bosses, shops, quests, caches, flag rules
create table if not exists vm_zones (
  id text primary key, ox real not null, indoor boolean not null,
  min_x real not null, max_x real not null, min_z real not null, max_z real not null
);
create table if not exists vm_stations (id text primary key, kind text not null, zone text not null, x real not null, z real not null, r real not null);
create table if not exists vm_portals (
  id text primary key, from_zone text not null, x real not null, z real not null, r real not null,
  to_zone text not null, tx real not null, tz real not null, flag text
);
create table if not exists vm_shrines (id text primary key, zone text not null, x real not null, z real not null);
create table if not exists vm_mob_kinds (kind text primary key, xp int not null);
create table if not exists vm_bosses (
  id text primary key, name text not null, zone text not null, x real not null, z real not null, r real not null, reach real not null,
  hp int not null, scale double precision not null, xp int not null, crowns int not null, rewards jsonb not null default '[]'::jsonb, flag text not null
);
create table if not exists vm_shops (id text primary key, zone text not null, x real not null, z real not null, keeper text not null, buys boolean not null);
create table if not exists vm_shop_stock (
  shop text not null references vm_shops on delete cascade, item text not null references vm_item_defs, price int not null,
  primary key (shop, item)
);
create table if not exists vm_quests (id text primary key, def jsonb not null);
create table if not exists vm_cache_spots (cache text primary key, zone text not null, x real not null, z real not null);
create table if not exists vm_world_flag_rules (flag text primary key, needs_mob text, needs_flag text);

do $$
declare t text;
begin
  foreach t in array array['vm_item_defs','vm_recipes','vm_recipe_inputs','vm_trades','vm_trade_inputs','vm_loot','vm_mob_spawns','vm_nodes','vm_caches','vm_config',
                           'vm_players','vm_characters','vm_items','vm_worlds','vm_members','vm_boss_hits','vm_grants',
                           'vm_zones','vm_stations','vm_portals','vm_shrines','vm_mob_kinds','vm_bosses','vm_shops','vm_shop_stock','vm_quests',
                           'vm_cache_spots','vm_world_flag_rules'] loop
    execute format('alter table %I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on table %I from anon', t); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on table %I from authenticated', t); end if;
  end loop;
end $$;

-- Functions whose parameters grew. A new parameter makes a new signature, so the old one is
-- dropped first (otherwise a call by name would match both). Callers that leave the new
-- parameter out keep working through its default.
drop function if exists vm_heartbeat(uuid, text, uuid, uuid, real, real, real, boolean, real, int);
drop function if exists vm_boss_hit(uuid, text, uuid, uuid, boolean, boolean, boolean, boolean, boolean);
drop function if exists vm_boss_reset(uuid, text, uuid, uuid);
drop function if exists vm_take_item(uuid, text, int);

-- ------------------------------------------------------------------ internal helpers (not callable by clients)
create or replace function vm_hash(p text) returns text language sql immutable set search_path = pg_catalog as $$
  select encode(sha256(convert_to(p, 'UTF8')), 'hex')
$$;

create or replace function vm_auth(p_player uuid, p_secret text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from vm_players where id = p_player and secret_hash = vm_hash(p_secret);
  if not found then
    raise exception 'Not signed in on this device' using errcode = '28000';
  end if;
end $$;

create or replace function vm_own_char(p_player uuid, p_secret text, p_char uuid) returns vm_characters
language plpgsql security definer set search_path = public as $$
declare v_c vm_characters;
begin
  perform vm_auth(p_player, p_secret);
  select * into v_c from vm_characters where id = p_char and player_id = p_player and not deleted;
  if not found then raise exception 'That character is not yours'; end if;
  return v_c;
end $$;

-- Every function that changes a character's items or flags locks its row first, so two calls
-- from the same player (a double tap, a script) run one after the other. Lock order is always
-- world, then member, then character, so concurrent calls never deadlock.
create or replace function vm_lock_char(p_char uuid) returns void
language sql security definer set search_path = public as $$
  select 1 from vm_characters where id = p_char for update
$$;

create or replace function vm_member(p_world uuid, p_char uuid) returns vm_members
language plpgsql security definer set search_path = public as $$
declare v_m vm_members;
begin
  select * into v_m from vm_members where world_id = p_world and character_id = p_char and left_at is null;
  if not found then raise exception 'Not in this world'; end if;
  return v_m;
end $$;

create or replace function vm_cfg(p_key text) returns jsonb language sql stable security definer set search_path = public as $$
  select value from vm_config where key = p_key
$$;

create or replace function vm_items_json(p_char uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('uid', uid, 'def', def, 'count', count, 'equipped', equipped) order by length(uid), uid), '[]'::jsonb)
  from vm_items where character_id = p_char
$$;

create or replace function vm_count(p_char uuid, p_def text) returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(count), 0)::int from vm_items where character_id = p_char and def = p_def
$$;

-- the most a character carries of any ONE of the '|'-separated item ids (quest 'have' and 'give'
-- steps: "any edge" means one edge, not a knife and half a sword; src/game/systems/quests.ts agrees)
create or replace function vm_count_any(p_char uuid, p_defs text) returns int language sql stable security definer set search_path = public as $$
  select coalesce(max(n), 0)::int from (
    select sum(count) as n from vm_items where character_id = p_char and def = any (string_to_array(coalesce(p_defs, ''), '|')) group by def
  ) t
$$;

-- distance on the ground between two world positions
create or replace function vm_dist(p_x1 double precision, p_z1 double precision, p_x2 double precision, p_z2 double precision) returns double precision
language sql immutable set search_path = pg_catalog as $$
  select sqrt((p_x1 - p_x2) ^ 2 + (p_z1 - p_z2) ^ 2)
$$;

-- The old level rule (kills and bosses). Kept for anything that still calls it; levels now come from experience.
create or replace function vm_level(p_kills int, p_bosses int) returns int language sql immutable set search_path = pg_catalog as $$
  select 1 + floor(sqrt(greatest(0, p_kills * 10 + p_bosses * 120) / 40.0))::int
$$;

-- Level from experience: LEVEL_XP (seeded into vm_config 'level_xp') holds the total experience
-- at the start of each level, so the level is how many of those thresholds you have passed.
create or replace function vm_level_of(p_xp int) returns int
language sql stable security definer set search_path = public as $$
  select greatest(1, (select count(*)::int from jsonb_array_elements_text(coalesce(vm_cfg('level_xp'), '[0]'::jsonb)) t(v)
                      where t.v::numeric <= coalesce(p_xp, 0)))
$$;

-- What a level is worth (data/progression.ts statsFor): health always, breath once Ember is learned.
create or replace function vm_sync_stats(p_char uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_l int;
begin
  select vm_level_of(xp) into v_l from vm_characters where id = p_char;
  if v_l is null then return null; end if;
  update vm_characters set max_hp = 100 + 9 * (v_l - 1),
                           mana_max = case when mana_max > 0 then 30 + 2 * (v_l - 1) else 0 end
    where id = p_char and (max_hp <> 100 + 9 * (v_l - 1) or (mana_max > 0 and mana_max <> 30 + 2 * (v_l - 1)));
  return v_l;
end $$;

-- Experience goes up (never down); returns the new level.
create or replace function vm_add_xp(p_char uuid, p_n int) returns int
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(p_n, 0) > 0 then
    update vm_characters set xp = xp + p_n, updated_at = now() where id = p_char;
  end if;
  return vm_sync_stats(p_char);
end $$;

create or replace function vm_char_json(p_char uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_c vm_characters; v_w text; v_place text; v_l int; v_lx jsonb := coalesce(vm_cfg('level_xp'), '[0]'::jsonb); v_lo int;
begin
  select * into v_c from vm_characters where id = p_char;
  select d.name into v_w from vm_items i join vm_item_defs d on d.id = i.def
    where i.character_id = p_char and i.equipped and d.slot = 'main' limit 1;
  select name into v_place from vm_worlds where id = v_c.last_world;
  v_l := vm_level_of(v_c.xp);
  v_lo := coalesce((v_lx->>(v_l - 1))::int, 0);
  return jsonb_build_object(
    'id', v_c.id, 'name', v_c.name, 'look', v_c.look, 'hp', v_c.hp, 'max_hp', v_c.max_hp, 'mana_max', v_c.mana_max,
    'flags', v_c.flags - 'gather_at', 'kills', v_c.kills, 'deaths', v_c.deaths, 'play_seconds', v_c.play_seconds,
    'level', v_l, 'xp', v_c.xp, 'xp_lo', v_lo, 'xp_hi', coalesce((v_lx->>v_l)::int, v_lo),
    'crowns', vm_count(p_char, 'coin_crown'), 'kill_counts', v_c.kill_counts, 'quests', v_c.quests,
    'weapon', coalesce(v_w, 'Fists'), 'items', vm_items_json(p_char),
    'last_world', v_c.last_world, 'place', v_place);
end $$;

-- Seats in use: players (other than the owner) with a current, undeleted character in the world.
create or replace function vm_seats(p_world uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(distinct m.player_id)::int from vm_members m join vm_characters c on c.id = m.character_id
  where m.world_id = p_world and m.left_at is null and not c.deleted
$$;

create or replace function vm_world_card(p_world uuid, p_player uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', w.id, 'code', w.code, 'name', w.name, 'mine', w.owner = p_player, 'day', w.day, 'hour', w.hour,
    'max', w.max_players, 'cookie', coalesce((w.flags->>'cookie')::boolean, false), 'gate', coalesce((w.flags->>'gate')::boolean, false),
    'players', vm_seats(w.id),
    'online', (select count(*) from vm_members m where m.world_id = w.id and m.left_at is null and m.last_seen > now() - interval '40 seconds'),
    'members', coalesce((select jsonb_agg(jsonb_build_object('name', c.name, 'online', m.last_seen > now() - interval '40 seconds') order by m.joined_at)
                         from vm_members m join vm_characters c on c.id = m.character_id where m.world_id = w.id and m.left_at is null and not c.deleted), '[]'::jsonb))
  from vm_worlds w where w.id = p_world
$$;

create or replace function vm_world_json(p_world uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', w.id, 'code', w.code, 'name', w.name, 'flags', w.flags, 'hour', w.hour, 'day', w.day, 'boss', w.boss,
    'nodes', w.nodes, 'dead_mobs', w.dead_mobs, 'max', w.max_players, 'now', now(),
    'members', coalesce((select jsonb_agg(jsonb_build_object('character_id', c.id, 'name', c.name, 'look', c.look,
                                                             'online', m.last_seen > now() - interval '40 seconds') order by m.joined_at)
                         from vm_members m join vm_characters c on c.id = m.character_id where m.world_id = w.id and m.left_at is null and not c.deleted), '[]'::jsonb))
  from vm_worlds w where w.id = p_world
$$;

create or replace function vm_clean_look(p_look jsonb) returns jsonb language sql immutable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'body', least(2, greatest(0, coalesce((p_look->>'body')::int, 1))),
    'skin', least(4, greatest(0, coalesce((p_look->>'skin')::int, 1))),
    'hair', least(3, greatest(0, coalesce((p_look->>'hair')::int, 0))),
    'hairColor', least(5, greatest(0, coalesce((p_look->>'hairColor')::int, 1))),
    'coat', least(5, greatest(0, coalesce((p_look->>'coat')::int, 0))))
$$;

create or replace function vm_clean_name(p_name text) returns text language sql immutable set search_path = pg_catalog as $$
  select coalesce(nullif(left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]<>]', '', 'g')), 18), ''), 'Walker')
$$;

create or replace function vm_add_item(p_char uuid, p_def text, p_n int) returns int
language plpgsql security definer set search_path = public as $$
declare v_d vm_item_defs; v_left int := p_n; v_r record; v_take int; v_seq int;
begin
  select * into v_d from vm_item_defs where id = p_def;
  if not found or p_n is null or p_n <= 0 then return 0; end if;
  if v_d.soulbound then
    if exists (select 1 from vm_items where character_id = p_char and def = p_def) then return 0; end if;
    update vm_characters set seq = seq + 1 where id = p_char returning seq into v_seq;
    insert into vm_items (character_id, uid, def, count, soulbound) values (p_char, 'i' || v_seq, p_def, 1, true)
      on conflict do nothing;
    return 1;
  end if;
  if v_d.stack > 1 then
    for v_r in select uid, count from vm_items where character_id = p_char and def = p_def and count < v_d.stack order by length(uid), uid loop
      exit when v_left <= 0;
      v_take := least(v_d.stack - v_r.count, v_left);
      update vm_items set count = count + v_take where character_id = p_char and uid = v_r.uid;
      v_left := v_left - v_take;
    end loop;
  end if;
  while v_left > 0 loop
    v_take := least(v_left, greatest(1, v_d.stack));
    update vm_characters set seq = seq + 1 where id = p_char returning seq into v_seq;
    insert into vm_items (character_id, uid, def, count) values (p_char, 'i' || v_seq, p_def, v_take);
    v_left := v_left - v_take;
  end loop;
  return p_n;
end $$;

-- Removes p_n of an item or raises: callers hold the character lock, and nothing is taken unless
-- all of it is there. With p_uid, only from that one stack (an emptied stack is gone, and with it
-- whatever it had equipped).
create or replace function vm_take_item(p_char uuid, p_def text, p_n int, p_uid text default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_have int; v_left int := p_n; v_r record; v_rows int;
begin
  select coalesce(sum(count), 0) into v_have from vm_items where character_id = p_char and def = p_def and (p_uid is null or uid = p_uid);
  if v_have < p_n then raise exception 'materials'; end if;
  for v_r in select uid, count from vm_items where character_id = p_char and def = p_def and (p_uid is null or uid = p_uid)
             order by equipped, length(uid), uid for update loop
    exit when v_left <= 0;
    if v_r.count <= v_left then
      delete from vm_items where character_id = p_char and uid = v_r.uid;
      get diagnostics v_rows = row_count;
      if v_rows <> 1 then raise exception 'materials'; end if;
      v_left := v_left - v_r.count;
    else
      update vm_items set count = count - v_left where character_id = p_char and uid = v_r.uid and count > v_left;
      get diagnostics v_rows = row_count;
      if v_rows <> 1 then raise exception 'materials'; end if;
      v_left := 0;
    end if;
  end loop;
  if v_left > 0 then raise exception 'materials'; end if;
  return true;
end $$;

create or replace function vm_pick_tier(p_char uuid) returns int language sql stable security definer set search_path = public as $$
  select coalesce(max(d.tier), 0) from vm_items i join vm_item_defs d on d.id = i.def
  where i.character_id = p_char and d.moveset like '%pick%'
$$;

create or replace function vm_equip_uid(p_char uuid, p_uid text) returns void
language plpgsql security definer set search_path = public as $$
declare v_slot text;
begin
  select d.slot into v_slot from vm_items i join vm_item_defs d on d.id = i.def where i.character_id = p_char and i.uid = p_uid;
  if not found or v_slot = 'none' then return; end if;
  update vm_items i set equipped = false from vm_item_defs d where d.id = i.def and i.character_id = p_char and d.slot = v_slot;
  update vm_items set equipped = true where character_id = p_char and uid = p_uid;
end $$;

create or replace function vm_equip_def(p_char uuid, p_def text) returns void
language plpgsql security definer set search_path = public as $$
declare v_uid text;
begin
  select uid into v_uid from vm_items where character_id = p_char and def = p_def order by length(uid) desc, uid desc limit 1;
  if v_uid is not null then perform vm_equip_uid(p_char, v_uid); end if;
end $$;

create or replace function vm_tick(p_world uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_dt double precision; v_h double precision;
begin
  select least(extract(epoch from now() - clock_at), 30), hour into v_dt, v_h from vm_worlds where id = p_world;
  if v_dt is null or v_dt < 1 then return; end if;
  v_h := v_h + v_dt / 90.0;
  update vm_worlds set
    hour = (v_h - 24 * floor(v_h / 24))::real,
    day = day + floor(v_h / 24)::int,
    clock_at = now()
  where id = p_world;
end $$;

-- A fresh fight for every boss the world does not know yet (worlds made before a boss existed).
create or replace function vm_boss_fill(p_world uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_add jsonb;
begin
  select coalesce(jsonb_object_agg(b.id, jsonb_build_object('hp', b.hp, 'max', b.hp, 'dead', false, 'fight', 1)), '{}'::jsonb) into v_add
    from vm_bosses b join vm_worlds w on w.id = p_world where not (w.boss ? b.id);
  if v_add <> '{}'::jsonb then
    update vm_worlds set boss = v_add || boss where id = p_world;
  end if;
end $$;

-- Shrines a member has found in this world. Everyone knows the Hearthfen bedroll.
create or replace function vm_shrine_known(p_flags jsonb, p_shrine text) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select p_shrine = 'hearthfen' or coalesce(p_flags ? ('sh_' || p_shrine), false)
         -- the forest shrine lit before shrines were data
         or (p_shrine = 'forest' and coalesce(p_flags ? 'shrine', false))
$$;

create or replace function vm_enter_internal(p_world uuid, p_char uuid, p_player uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_online int;
begin
  -- world first: lock order is world, member, character
  perform 1 from vm_worlds where id = p_world for update;
  select count(*) into v_online from vm_members
    where world_id = p_world and character_id <> p_char and player_id <> p_player and left_at is null and last_seen > now() - interval '40 seconds';
  if v_online >= 4 then raise exception 'Four players are already in that world'; end if;
  insert into vm_members (world_id, character_id, player_id, last_seen) values (p_world, p_char, p_player, now())
    on conflict (world_id, character_id) do update set last_seen = now(), left_at = null;
  perform vm_lock_char(p_char);
  update vm_characters set last_world = p_world, updated_at = now() where id = p_char;
  perform vm_sync_stats(p_char);
  perform vm_boss_fill(p_world);
  update vm_worlds set updated_at = now() where id = p_world;
  perform vm_tick(p_world);
  return jsonb_build_object(
    'world', vm_world_json(p_world),
    'character', vm_char_json(p_char),
    'member', (select jsonb_build_object('x', x, 'z', z, 'yaw', yaw, 'zone', zone, 'dungeon', dungeon, 'flags', flags)
               from vm_members where world_id = p_world and character_id = p_char));
end $$;

-- Is a quest step's condition true right now? p_b is the step's baseline (kills of that kind when it began).
create or replace function vm_quest_met(p_world uuid, p_char uuid, p_step jsonb, p_b int) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_k text := p_step->>'k'; v_c vm_characters; v_m vm_members; v_ox real; v_n int := coalesce((p_step->>'n')::int, 1);
begin
  select * into v_c from vm_characters where id = p_char;
  if v_k = 'talk' then
    return true;  -- the client reports the conversation
  elsif v_k = 'cflag' then
    return coalesce((v_c.flags->>(p_step->>'flag'))::boolean, false);
  elsif v_k in ('have', 'give') then
    return vm_count_any(p_char, p_step->>'item') >= v_n;
  elsif v_k = 'kill' then
    return coalesce((v_c.kill_counts->>(p_step->>'kind'))::int, 0) - coalesce(p_b, 0) >= v_n;
  elsif v_k = 'reach' then
    select * into v_m from vm_members where world_id = p_world and character_id = p_char and left_at is null;
    if not found or v_m.zone is distinct from (p_step->>'zone') then return false; end if;
    if p_step->>'x' is null or p_step->>'z' is null then return true; end if;
    -- within r (10 when unset, as the client judges it) plus the age of the last saved position
    select ox into v_ox from vm_zones where id = v_m.zone;
    return coalesce(v_m.x is not null and v_ox is not null
                    and vm_dist(v_m.x, v_m.z, v_ox + (p_step->>'x')::double precision, (p_step->>'z')::double precision)
                        <= coalesce((p_step->>'r')::double precision, 10) + 8, false);
  elsif v_k = 'flag' then
    return coalesce((select (flags->>(p_step->>'flag'))::boolean from vm_worlds where id = p_world), false);
  elsif v_k = 'boss' then
    return exists (select 1 from vm_grants where world_id = p_world and boss = p_step->>'boss' and character_id = p_char);
  elsif v_k = 'level' then
    return vm_level_of(v_c.xp) >= v_n;
  end if;
  return false;
end $$;

-- A step's baseline as it begins: kill steps count from the kills you already have.
create or replace function vm_quest_baseline(p_char uuid, p_step jsonb) returns int
language sql stable security definer set search_path = public as $$
  select case when p_step->>'k' = 'kill'
    then coalesce((select (kill_counts->>(p_step->>'kind'))::int from vm_characters where id = p_char), 0) else 0 end
$$;

-- ------------------------------------------------------------------ client API
create or replace function vm_register(p_secret text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_secret is null or length(p_secret) < 24 then raise exception 'Weak device key'; end if;
  insert into vm_players (secret_hash) values (vm_hash(p_secret)) returning id into v_id;
  return v_id;
end $$;

create or replace function vm_profile(p_player uuid, p_secret text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform vm_auth(p_player, p_secret);
  update vm_players set last_seen = now() where id = p_player;
  return jsonb_build_object(
    'characters', coalesce((select jsonb_agg(vm_char_json(c.id) order by c.updated_at desc) from vm_characters c
                            where c.player_id = p_player and not c.deleted), '[]'::jsonb),
    'worlds', coalesce((select jsonb_agg(vm_world_card(w.id, p_player) order by w.updated_at desc) from vm_worlds w
                        where not w.deleted and (w.owner = p_player or exists (select 1 from vm_members m where m.world_id = w.id and m.player_id = p_player and m.left_at is null))), '[]'::jsonb));
end $$;

create or replace function vm_create_character(p_player uuid, p_secret text, p_name text, p_look jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform vm_auth(p_player, p_secret);
  if (select count(*) from vm_characters where player_id = p_player and not deleted) >= 6 then
    raise exception 'You already have six characters';
  end if;
  insert into vm_characters (player_id, name, look) values (p_player, vm_clean_name(p_name), vm_clean_look(p_look)) returning id into v_id;
  perform vm_add_item(v_id, 'arm_cloth', 1);
  update vm_items set equipped = true where character_id = v_id and def = 'arm_cloth';
  return vm_char_json(v_id);
end $$;

-- One-time import of a character from an older local (single player) save.
create or replace function vm_import_character(p_player uuid, p_secret text, p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_it jsonb; v_src text := left(p_payload->>'source', 80); v_flags jsonb := coalesce(p_payload->'flags', '{}'::jsonb);
        v_cookie boolean := coalesce((v_flags->>'cookie')::boolean, false); v_def vm_item_defs; v_best text; v_shield text;
begin
  perform vm_auth(p_player, p_secret);
  -- a local save is client data: it can bring a character's look, name and early gear, never
  -- uniques, keys, late-tier items, experience or boss progress (those are earned in a world)
  v_cookie := false;
  if v_src is null or v_src !~ '^slot[0-2]:' then raise exception 'That save cannot be imported'; end if;
  select id into v_id from vm_characters where player_id = p_player and flags->>'imported' = v_src and not deleted;
  if found then return vm_char_json(v_id); end if;
  perform 1 from vm_players where id = p_player for update;
  if (select imports from vm_players where id = p_player) >= 3 then raise exception 'This device has already brought in its saves'; end if;
  if (select count(*) from vm_characters where player_id = p_player and not deleted) >= 6 then
    raise exception 'You already have six characters';
  end if;
  update vm_players set imports = imports + 1 where id = p_player;
  insert into vm_characters (player_id, name, look, flags, mana_max, kills, deaths, play_seconds)
  values (p_player, vm_clean_name(p_payload->>'name'), vm_clean_look(p_payload->'look'),
          jsonb_build_object('talked', coalesce((v_flags->>'talked')::boolean, false), 'imported', v_src),
          0,
          least(greatest(coalesce((p_payload->>'kills')::int, 0), 0), 100),
          least(greatest(coalesce((p_payload->>'deaths')::int, 0), 0), 1000),
          least(greatest(coalesce((p_payload->>'time')::int, 0), 0), 360000))
  returning id into v_id;
  -- at most 20 of each kind, however many times the save lists it; never crowns (they buy things)
  for v_it in select jsonb_build_object('def', e->>'def', 'count', sum(least(greatest(coalesce((e->>'count')::int, 1), 1), 20)))
              from jsonb_array_elements(case when jsonb_typeof(p_payload->'items') = 'array' then p_payload->'items' else '[]'::jsonb end) e
              group by e->>'def' loop
    select * into v_def from vm_item_defs where id = v_it->>'def';
    -- only what a first-release save could hold, and one of each piece of gear
    continue when not found or not (v_def.id = any (array['mat_wood','mat_flint','mat_fibre','mat_stone','mat_bone','mat_leather',
      'mat_copper','wpn_stone_knife','wpn_stone_pick','wpn_copper_pick','wpn_copper_sword','arm_stump_shield','cons_bandage']));
    perform vm_add_item(v_id, v_def.id, least((v_it->>'count')::int, case when v_def.stack = 1 then 1 else 20 end));
  end loop;
  perform vm_add_item(v_id, 'arm_cloth', 1);
  update vm_items set equipped = true where character_id = v_id and def = 'arm_cloth';
  select i.def into v_best from vm_items i join vm_item_defs d on d.id = i.def
    where i.character_id = v_id and d.slot = 'main' and d.moveset not like '%pick%' order by d.damage desc limit 1;
  if v_best is not null then perform vm_equip_def(v_id, v_best); end if;
  select i.def into v_shield from vm_items i join vm_item_defs d on d.id = i.def where i.character_id = v_id and d.slot = 'off' limit 1;
  if v_shield is not null then perform vm_equip_def(v_id, v_shield); end if;
  return vm_char_json(v_id);
end $$;

create or replace function vm_delete_character(p_player uuid, p_secret text, p_char uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform vm_own_char(p_player, p_secret, p_char);
  -- soft delete: the row stays so world history (grants, hits) keeps its references.
  -- Members before the character (lock order).
  update vm_members set last_seen = now() - interval '10 minutes', left_at = coalesce(left_at, now()) where character_id = p_char;
  update vm_characters set deleted = true, updated_at = now() where id = p_char;
  return vm_profile(p_player, p_secret);
end $$;

create or replace function vm_character(p_player uuid, p_secret text, p_char uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform vm_own_char(p_player, p_secret, p_char);
  return vm_char_json(p_char);
end $$;

create or replace function vm_create_world(p_player uuid, p_secret text, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_code text; v_id uuid; v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v_i int; v_name text; v_boss jsonb; v_hp int;
begin
  perform vm_auth(p_player, p_secret);
  if (select count(*) from vm_worlds where owner = p_player and not deleted) >= 6 then raise exception 'You already own six worlds'; end if;
  v_name := coalesce(nullif(left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]<>]', '', 'g')), 32), ''), 'A Realm');
  loop
    v_code := '';
    for v_i in 1..6 loop
      v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
    end loop;
    exit when not exists (select 1 from vm_worlds where code = v_code);
  end loop;
  -- a fresh fight for every boss; Cookie falls back to the older 'cookie_hp' setting if the boss table lacks it
  select coalesce(jsonb_object_agg(id, jsonb_build_object('hp', hp, 'max', hp, 'dead', false, 'fight', 1)), '{}'::jsonb) into v_boss from vm_bosses;
  if not (v_boss ? 'cookie') then
    v_hp := coalesce((vm_cfg('cookie_hp') #>> '{}')::int, 280);
    v_boss := v_boss || jsonb_build_object('cookie', jsonb_build_object('hp', v_hp, 'max', v_hp, 'dead', false, 'fight', 1));
  end if;
  insert into vm_worlds (code, name, owner, seed, boss)
  values (v_code, v_name, p_player, floor(random() * 1000000)::int, v_boss)
  returning id into v_id;
  return vm_world_card(v_id, p_player);
end $$;

create or replace function vm_join(p_player uuid, p_secret text, p_code text, p_char uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_w vm_worlds; v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); v_players int;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  -- lock the world so two people joining at once cannot both take the last seat
  select * into v_w from vm_worlds where code = v_code and not deleted for update;
  if not found then raise exception 'No world has that code'; end if;
  if not exists (select 1 from vm_members m join vm_characters c on c.id = m.character_id
                 where m.world_id = v_w.id and m.player_id = p_player and m.left_at is null and not c.deleted) then
    v_players := vm_seats(v_w.id);
    if v_w.owner <> p_player and v_players >= v_w.max_players then raise exception 'That world already has four players'; end if;
  end if;
  return vm_enter_internal(v_w.id, p_char, p_player);
end $$;

create or replace function vm_enter(p_player uuid, p_secret text, p_world uuid, p_char uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform vm_own_char(p_player, p_secret, p_char);
  if exists (select 1 from vm_worlds where id = p_world and deleted) then raise exception 'That world is gone'; end if;
  if not exists (select 1 from vm_worlds where id = p_world and owner = p_player)
     and not exists (select 1 from vm_members where world_id = p_world and player_id = p_player and left_at is null) then
    raise exception 'Join that world with its code first';
  end if;
  return vm_enter_internal(p_world, p_char, p_player);
end $$;

-- Every few seconds: persist the position (if it is physically possible), health and play time,
-- advance the world clock, and return the shared world state.
--
-- Within a zone you can only have walked so far since the last save. Changing zone needs a door:
-- a portal from your old zone to the new one, near where you last stood, and open (its world
-- flag set). After death or on first entry (no saved position) you may wake anywhere. Clients
-- that only know "castle or not" leave p_zone out and send p_dungeon.
create or replace function vm_heartbeat(p_player uuid, p_secret text, p_world uuid, p_char uuid, p_x real, p_z real, p_yaw real,
                                        p_dungeon boolean default null, p_hp real default null, p_play int default 0,
                                        p_zone text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_m vm_members; v_dt double precision; v_ok boolean := true; v_w vm_worlds; v_zone text; v_z vm_zones;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  perform vm_tick(p_world);
  select * into v_w from vm_worlds where id = p_world;
  select * into v_m from vm_members where world_id = p_world and character_id = p_char and left_at is null for update;
  if not found then raise exception 'Not in this world'; end if;
  v_zone := coalesce(p_zone, case when coalesce(p_dungeon, false) then 'castle' else 'over' end);
  v_dt := greatest(0.2, extract(epoch from now() - v_m.pos_at));
  select * into v_z from vm_zones where id = v_zone;
  if not found or p_x is null or p_z is null
     or p_x - v_z.ox < v_z.min_x - 30 or p_x - v_z.ox > v_z.max_x + 30 or p_z < v_z.min_z - 30 or p_z > v_z.max_z + 30 then
    -- an unknown zone, or a position that is not in the zone it claims
    v_ok := false;
  elsif v_m.x is null then
    -- a first entry or a wake after a fall: only at a place you can wake (the bedroll and the
    -- start of the road, a shrine you know, or a doorway of the zone you wake in)
    if not (
         (v_zone = 'over' and least(vm_dist(p_x, p_z, 1.5, -22), vm_dist(p_x, p_z, -7.4, -11.9)) < 25)
      or exists (select 1 from vm_shrines s where s.zone = v_zone and vm_shrine_known(v_m.flags, s.id) and vm_dist(p_x, p_z, s.x, s.z) < 25)
      -- the front door of a dungeon, out in a zone this world has opened the way to
      or (not v_z.indoor and exists (
            with recursive open_zones(z) as (
              select 'over'::text
              union
              select p2.to_zone from vm_portals p2 join open_zones o on p2.from_zone = o.z
                where p2.flag is null or coalesce((v_w.flags->>p2.flag)::boolean, false))
            select 1 from vm_portals p join vm_zones tz on tz.id = p.to_zone
              where p.from_zone = v_zone and tz.indoor and vm_dist(p_x, p_z, p.x, p.z) < p.r + 20
                and v_zone in (select z from open_zones)))) then
      v_ok := false;
    end if;
  elsif v_m.zone = v_zone then
    if vm_dist(p_x, p_z, v_m.x, v_m.z) > 9.5 * v_dt + 8 then v_ok := false; end if;
  elsif not exists (select 1 from vm_portals p
                    where p.from_zone = v_m.zone and p.to_zone = v_zone
                      and vm_dist(v_m.x, v_m.z, p.x, p.z) < p.r + 12 + 9.5 * least(v_dt, 6)
                      and (p.flag is null or coalesce((v_w.flags->>p.flag)::boolean, false))) then
    v_ok := false;
  end if;
  if v_ok then
    update vm_members set x = p_x, z = p_z, yaw = coalesce(p_yaw, yaw), zone = v_zone, dungeon = (v_zone = 'castle'),
                          pos_at = now(), last_seen = now()
      where world_id = p_world and character_id = p_char;
  else
    update vm_members set last_seen = now() where world_id = p_world and character_id = p_char;
  end if;
  update vm_characters set hp = least(greatest(coalesce(p_hp, hp), 0), max_hp),
                           play_seconds = play_seconds + least(greatest(coalesce(p_play, 0), 0), 60), updated_at = now()
    where id = p_char;
  select * into v_w from vm_worlds where id = p_world;
  return jsonb_build_object('ok', v_ok, 'zone', case when v_ok then v_zone else v_m.zone end,
    'hour', v_w.hour, 'day', v_w.day, 'flags', v_w.flags, 'boss', v_w.boss, 'now', now(),
    'online', (select count(*) from vm_members where world_id = p_world and last_seen > now() - interval '40 seconds'));
end $$;

-- The castle's doors before zones were data (vm_portals replaces it). Kept: harmless and internal.
create or replace function vm_at_portal(p_dungeon boolean, p_x real, p_z real, p_dt double precision) returns boolean
language sql immutable set search_path = pg_catalog as $$
  select case when p_dungeon
    then least(sqrt((p_x - 1200) ^ 2 + (p_z - 2.2) ^ 2), sqrt((p_x - 1200) ^ 2 + (p_z - 117.8) ^ 2)) < 12 + 9.5 * least(p_dt, 6)
    else sqrt(p_x ^ 2 + (p_z - 163.5) ^ 2) < 12 + 9.5 * least(p_dt, 6) end
$$;

create or replace function vm_leave(p_player uuid, p_secret text, p_world uuid, p_char uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform vm_own_char(p_player, p_secret, p_char);
  update vm_members set last_seen = now() - interval '10 minutes' where world_id = p_world and character_id = p_char;
end $$;

-- Sleeping on the bedroll moves the clock on (to morning, or by two hours), but only when nobody
-- else is in the world: in a shared world the clock belongs to everyone.
create or replace function vm_rest(p_player uuid, p_secret text, p_world uuid, p_char uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_m vm_members; v_w vm_worlds; v_h real;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  select * into v_w from vm_worlds where id = p_world for update;
  v_m := vm_member(p_world, p_char);
  if v_m.zone <> 'over' or v_m.x is null or vm_dist(v_m.x, v_m.z, -7.4, -11.9) > 16 then raise exception 'Your bedroll is in Hearthfen'; end if;
  perform vm_tick(p_world);
  select * into v_w from vm_worlds where id = p_world;
  if exists (select 1 from vm_members where world_id = p_world and character_id <> p_char and player_id <> p_player
             and left_at is null and last_seen > now() - interval '40 seconds') then
    return jsonb_build_object('hour', v_w.hour, 'day', v_w.day, 'slept', false);
  end if;
  v_h := case when v_w.hour > 18 or v_w.hour < 6 then 6.6 else v_w.hour + 2 end;
  update vm_worlds set hour = v_h, day = day + case when v_w.hour > 18 then 1 else 0 end, clock_at = now(), updated_at = now()
    where id = p_world returning * into v_w;
  return jsonb_build_object('hour', v_w.hour, 'day', v_w.day, 'slept', true);
end $$;

-- Leave a world for good (it disappears from your list and frees your seat). Rejoin with the code.
create or replace function vm_leave_world(p_player uuid, p_secret text, p_world uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform vm_auth(p_player, p_secret);
  if exists (select 1 from vm_worlds where id = p_world and owner = p_player) then raise exception 'You made this world: it stays in your list'; end if;
  update vm_members set left_at = now(), last_seen = now() - interval '10 minutes' where world_id = p_world and player_id = p_player and left_at is null;
  return vm_profile(p_player, p_secret);
end $$;

-- The maker deletes a world: everyone in it leaves, and it frees one of the maker's six.
create or replace function vm_delete_world(p_player uuid, p_secret text, p_world uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform vm_auth(p_player, p_secret);
  perform 1 from vm_worlds where id = p_world and owner = p_player and not deleted for update;
  if not found then raise exception 'Only the world''s maker can do that'; end if;
  update vm_worlds set deleted = true, updated_at = now() where id = p_world;
  update vm_members set left_at = coalesce(left_at, now()), last_seen = now() - interval '10 minutes' where world_id = p_world;
  update vm_characters set last_world = null where last_world = p_world;
  return vm_profile(p_player, p_secret);
end $$;

-- The owner frees a seat (a lost phone, a friend who will not be back).
create or replace function vm_kick(p_player uuid, p_secret text, p_world uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_target uuid;
begin
  perform vm_auth(p_player, p_secret);
  if not exists (select 1 from vm_worlds where id = p_world and owner = p_player) then raise exception 'Only the world''s maker can do that'; end if;
  select m.player_id into v_target from vm_members m join vm_characters c on c.id = m.character_id
    where m.world_id = p_world and m.left_at is null and c.name = p_name and m.player_id <> p_player limit 1;
  if v_target is null then raise exception 'Nobody by that name'; end if;
  update vm_members set left_at = now(), last_seen = now() - interval '10 minutes' where world_id = p_world and player_id = v_target and left_at is null;
  return vm_world_card(p_world, p_player);
end $$;

create or replace function vm_gather(p_player uuid, p_secret text, p_world uuid, p_char uuid, p_node text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_c vm_characters; v_n vm_nodes; v_w vm_worlds; v_st jsonb; v_left int; v_regrow timestamptz; v_m vm_members;
begin
  v_c := vm_own_char(p_player, p_secret, p_char);
  v_m := vm_member(p_world, p_char);
  select * into v_n from vm_nodes where id = p_node;
  if not found then raise exception 'Nothing to gather there'; end if;
  -- Hearthfen's hand-placed nodes have no position in the data: those are checked by zone only
  if v_m.x is null or v_m.zone is distinct from coalesce(v_n.zone, 'over')
     or (v_n.x is not null and vm_dist(v_m.x, v_m.z, v_n.x, v_n.z) > 6 + 9.5 * least(extract(epoch from now() - v_m.pos_at), 2)) then
    raise exception 'Too far away';
  end if;
  select * into v_w from vm_worlds where id = p_world for update;
  perform vm_lock_char(p_char);
  select * into v_c from vm_characters where id = p_char;
  if v_n.seal is not null and not coalesce((v_w.flags->>'cookie')::boolean, false) then raise exception 'sealed'; end if;
  if v_n.tier >= 2 and vm_pick_tier(p_char) < v_n.tier then raise exception 'tier'; end if;
  if (v_c.flags->>'gather_at') is not null and (v_c.flags->>'gather_at')::timestamptz > now() - interval '350 milliseconds' then
    raise exception 'too fast';
  end if;
  v_st := v_w.nodes -> p_node;
  if v_st is null or (v_st->>'regrow_at')::timestamptz <= now() then v_left := v_n.max_left; else v_left := (v_st->>'left')::int; end if;
  if v_left <= 0 then raise exception 'spent'; end if;
  v_left := v_left - 1;
  v_regrow := now() + interval '75 seconds';
  update vm_worlds set nodes = nodes || jsonb_build_object(p_node, jsonb_build_object('left', v_left, 'regrow_at', v_regrow)), updated_at = now()
    where id = p_world;
  perform vm_add_item(p_char, v_n.item, 1);
  update vm_characters set flags = flags || jsonb_build_object('gather_at', now()) where id = p_char;
  return jsonb_build_object('items', vm_items_json(p_char), 'item', v_n.item,
                            'node', jsonb_build_object('id', p_node, 'left', v_left, 'regrow_at', v_regrow), 'now', now());
end $$;

-- Crafting by hand works anywhere. Everything else needs a station of the recipe's kind (any of
-- them: Hearthfen's forge or Holt's), in your zone, within its reach plus a few seconds' walk
-- (the last saved position is a little old). p_station is only the client's hint.
create or replace function vm_craft(p_player uuid, p_secret text, p_world uuid, p_char uuid, p_recipe text, p_station text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_r vm_recipes; v_in record; v_m vm_members; v_d vm_item_defs; v_n int;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  v_m := vm_member(p_world, p_char);
  perform vm_lock_char(p_char);
  select * into v_r from vm_recipes where id = p_recipe;
  if not found then raise exception 'Unknown recipe'; end if;
  if v_r.station <> 'hand' then
    if v_m.x is null or not exists (select 1 from vm_stations s where s.kind = v_r.station and s.zone = v_m.zone
                                     and vm_dist(v_m.x, v_m.z, s.x, s.z) <= s.r + 8) then
      raise exception 'station';
    end if;
  end if;
  select * into v_d from vm_item_defs where id = v_r.out_item;
  if v_d.soulbound and exists (select 1 from vm_items where character_id = p_char and def = v_r.out_item) then
    raise exception 'You already have one';
  end if;
  for v_in in select item, n from vm_recipe_inputs where recipe = p_recipe loop
    if vm_count(p_char, v_in.item) < v_in.n then raise exception 'materials'; end if;
  end loop;
  for v_in in select item, n from vm_recipe_inputs where recipe = p_recipe loop
    if not vm_take_item(p_char, v_in.item, v_in.n) then raise exception 'materials'; end if;
  end loop;
  v_n := greatest(1, coalesce(v_r.n, 1));
  perform vm_add_item(p_char, v_r.out_item, v_n);
  select * into v_d from vm_item_defs where id = v_r.out_item;
  if v_d.slot <> 'none' and v_d.moveset not like '%pick%' then perform vm_equip_def(p_char, v_r.out_item); end if;
  return jsonb_build_object('items', vm_items_json(p_char), 'made', v_r.out_item, 'n', v_n);
end $$;

create or replace function vm_equip(p_player uuid, p_secret text, p_char uuid, p_uid text) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform vm_own_char(p_player, p_secret, p_char);
  perform vm_lock_char(p_char);
  perform vm_equip_uid(p_char, p_uid);
  return jsonb_build_object('items', vm_items_json(p_char));
end $$;

create or replace function vm_use(p_player uuid, p_secret text, p_char uuid, p_uid text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_d vm_item_defs; v_hp real;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  perform vm_lock_char(p_char);
  select d.* into v_d from vm_items i join vm_item_defs d on d.id = i.def where i.character_id = p_char and i.uid = p_uid;
  if not found then raise exception 'You do not have that'; end if;
  if v_d.kind = 'consumable' and v_d.heal > 0 then
    if not vm_take_item(p_char, v_d.id, 1) then raise exception 'You do not have that'; end if;
    update vm_characters set hp = least(max_hp, hp + v_d.heal) where id = p_char returning hp into v_hp;
  elsif v_d.slot <> 'none' then
    perform vm_equip_uid(p_char, p_uid);
  end if;
  return jsonb_build_object('items', vm_items_json(p_char), 'heal', case when v_d.kind = 'consumable' then v_d.heal else 0 end);
end $$;

create or replace function vm_trade(p_player uuid, p_secret text, p_world uuid, p_char uuid, p_trade text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_t vm_trades; v_in record;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  perform vm_member(p_world, p_char);
  perform vm_lock_char(p_char);
  select * into v_t from vm_trades where id = p_trade;
  if not found then raise exception 'Unknown trade'; end if;
  for v_in in select item, n from vm_trade_inputs where trade = p_trade loop
    if vm_count(p_char, v_in.item) < v_in.n then raise exception 'You do not have enough'; end if;
  end loop;
  for v_in in select item, n from vm_trade_inputs where trade = p_trade loop
    if not vm_take_item(p_char, v_in.item, v_in.n) then raise exception 'You do not have enough'; end if;
  end loop;
  perform vm_add_item(p_char, v_t.get_item, v_t.get_n);
  return jsonb_build_object('items', vm_items_json(p_char));
end $$;

-- A foe dies once per spawn. The first claim records the death, rolls the loot (crowns are
-- ordinary drops), and pays the killer the foe's experience; any later claim for the same foe
-- before it respawns gets nothing.
create or replace function vm_loot(p_player uuid, p_secret text, p_world uuid, p_char uuid, p_mob text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_s vm_mob_spawns; v_w vm_worlds; v_dead jsonb; v_r record; v_drops jsonb := '[]'::jsonb; v_until timestamptz; v_xp int; v_level int;
        v_m vm_members;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  v_m := vm_member(p_world, p_char);
  select * into v_s from vm_mob_spawns where key = p_mob;
  if not found then raise exception 'Unknown foe'; end if;
  -- only someone in the foe's zone and near its ground can claim it (foes chase, so the reach is wide)
  if v_m.x is null or v_m.zone is distinct from coalesce(v_s.zone, v_m.zone)
     or (v_s.x is not null and vm_dist(v_m.x, v_m.z, v_s.x, v_s.z) > 70 + 9.5 * least(extract(epoch from now() - v_m.pos_at), 6)) then
    raise exception 'That foe is not near you';
  end if;
  select * into v_w from vm_worlds where id = p_world for update;
  perform vm_lock_char(p_char);
  v_dead := v_w.dead_mobs -> p_mob;
  if v_dead is not null and (jsonb_typeof(v_dead) = 'null' or (v_dead #>> '{}')::timestamptz > now()) then
    return jsonb_build_object('items', vm_items_json(p_char), 'drops', '[]'::jsonb, 'dup', true, 'xp_gained', 0,
                              'level', (select vm_level_of(xp) from vm_characters where id = p_char), 'crowns', vm_count(p_char, 'coin_crown'));
  end if;
  v_until := case when v_s.respawns then now() + interval '150 seconds' else null end;
  update vm_worlds set dead_mobs = dead_mobs || jsonb_build_object(p_mob, v_until), updated_at = now() where id = p_world;
  for v_r in select item, n, chance from vm_loot where kind = v_s.kind loop
    if random() < v_r.chance then
      perform vm_add_item(p_char, v_r.item, v_r.n);
      v_drops := v_drops || jsonb_build_array(jsonb_build_object('item', v_r.item, 'n', v_r.n));
    end if;
  end loop;
  v_xp := coalesce((select xp from vm_mob_kinds where kind = v_s.kind), 0);
  update vm_characters set kills = kills + 1,
                           kill_counts = kill_counts || jsonb_build_object(v_s.kind, coalesce((kill_counts->>v_s.kind)::int, 0) + 1)
    where id = p_char;
  v_level := vm_add_xp(p_char, v_xp);
  return jsonb_build_object('items', vm_items_json(p_char), 'drops', v_drops, 'dup', false, 'xp_gained', v_xp, 'level', v_level,
                            'xp', (select xp from vm_characters where id = p_char), 'crowns', vm_count(p_char, 'coin_crown'));
end $$;

-- World flags a player may set (doors, levers, puzzles): only those with a rule, and only once
-- the rule's foe is dead or its prerequisite flag is set. Boss flags fall with the boss; the
-- causeway opens with the Castellan's quest.
create or replace function vm_world_flag(p_player uuid, p_secret text, p_world uuid, p_char uuid, p_flag text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_w vm_worlds; v_r vm_world_flag_rules;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  perform vm_member(p_world, p_char);
  select * into v_w from vm_worlds where id = p_world for update;
  if p_flag = 'causeway' or exists (select 1 from vm_bosses where flag = p_flag or id = p_flag) then
    raise exception 'That is not yours to open';
  end if;
  select * into v_r from vm_world_flag_rules where flag = p_flag;
  if not found then raise exception 'Unknown flag'; end if;
  if v_r.needs_mob is not null and not (v_w.dead_mobs ? v_r.needs_mob) then
    raise exception 'It will not budge while its keeper still stands';
  end if;
  if v_r.needs_flag is not null and not coalesce((v_w.flags->>v_r.needs_flag)::boolean, false) then
    raise exception 'It does not answer yet';
  end if;
  update vm_worlds set flags = flags || jsonb_build_object(p_flag, true), updated_at = now() where id = p_world returning * into v_w;
  return v_w.flags;
end $$;

create or replace function vm_char_flag(p_player uuid, p_secret text, p_char uuid, p_flag text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_c vm_characters;
begin
  v_c := vm_own_char(p_player, p_secret, p_char);
  perform vm_lock_char(p_char);
  if p_flag = 'ember' then
    if not exists (select 1 from vm_items i join vm_item_defs d on d.id = i.def where i.character_id = p_char and d.kind = 'weapon'
                   and (d.family in ('dagger', 'sword', 'axe', 'mace', 'spear', 'greatsword')
                        or d.id in ('wpn_stone_knife', 'wpn_copper_sword', 'wpn_iron_sword', 'wpn_cookie_blade', 'wpn_smacko'))) then
      raise exception 'Tanic wants to see an edge first';
    end if;
    update vm_characters set mana_max = 30 + 2 * (vm_level_of(xp) - 1) where id = p_char;
  elsif p_flag not in ('talked', 'voss', 'ended') then
    raise exception 'Unknown flag';
  end if;
  update vm_characters set flags = flags || jsonb_build_object(p_flag, true), updated_at = now() where id = p_char;
  return vm_char_json(p_char);
end $$;

-- Per character, per world: one-time caches (stand by them; contents once), shrines found
-- ('sh_' || shrine id; stand by them), and the legacy 'shrine' and 'entered' marks.
create or replace function vm_member_flag(p_player uuid, p_secret text, p_world uuid, p_char uuid, p_flag text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_m vm_members; v_r record; v_drops jsonb := '[]'::jsonb; v_zone text; v_x real; v_z real;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  select * into v_m from vm_members where world_id = p_world and character_id = p_char and left_at is null for update;
  if not found then raise exception 'Not in this world'; end if;
  perform vm_lock_char(p_char);
  if p_flag in ('shrine', 'entered') then
    null;
  else
    if p_flag like 'sh\_%' then
      select zone, x, z into v_zone, v_x, v_z from vm_shrines where id = substr(p_flag, 4);
    else
      select zone, x, z into v_zone, v_x, v_z from vm_cache_spots where cache = p_flag;
    end if;
    if not found then raise exception 'Unknown flag'; end if;
    if v_m.zone <> v_zone or v_m.x is null or vm_dist(v_m.x, v_m.z, v_x, v_z) > 6 + 8 then raise exception 'Too far away'; end if;
  end if;
  if not (v_m.flags ? p_flag) then
    for v_r in select item, n from vm_caches where cache = p_flag loop
      perform vm_add_item(p_char, v_r.item, v_r.n);
      v_drops := v_drops || jsonb_build_array(jsonb_build_object('item', v_r.item, 'n', v_r.n));
    end loop;
    update vm_members set flags = flags || jsonb_build_object(p_flag, true) where world_id = p_world and character_id = p_char;
  end if;
  return jsonb_build_object('items', vm_items_json(p_char), 'drops', v_drops,
                            'flags', (select flags from vm_members where world_id = p_world and character_id = p_char));
end $$;

-- Every boss has one health pool per world. The server checks the hitter stands in the arena,
-- computes the damage from their equipped weapon and level, throttles swings, and on the killing
-- blow marks the world, then pays every character who fought this fight (or stood in the arena)
-- exactly once: the rewards, the experience, the crowns and the boss's character flag.
create or replace function vm_boss_hit(p_player uuid, p_secret text, p_world uuid, p_char uuid, p_heavy boolean, p_fire boolean,
                                       p_behind boolean, p_perched boolean, p_dizzy boolean, p_boss text default 'cookie') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_def vm_bosses; v_w vm_worlds; v_b jsonb; v_hp int; v_max int; v_fight int; v_d vm_item_defs; v_dmg double precision; v_last timestamptz;
        v_rec record; v_it jsonb; v_granted boolean := false; v_m vm_members; v_dead boolean := false; v_c vm_characters; v_power double precision;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  select * into v_def from vm_bosses where id = coalesce(p_boss, 'cookie');
  if not found then raise exception 'Unknown foe'; end if;
  select * into v_w from vm_worlds where id = p_world for update;
  v_m := vm_member(p_world, p_char);
  -- the hitter must be in the arena, by its last save (every few seconds while playing)
  if v_m.zone <> v_def.zone or v_m.last_seen < now() - interval '20 seconds' or v_m.x is null
     or vm_dist(v_m.x, v_m.z, v_def.x, v_def.z) > v_def.reach then
    raise exception '% is not within reach', v_def.name;
  end if;
  select * into v_c from vm_characters where id = p_char;
  v_b := coalesce(v_w.boss -> v_def.id, jsonb_build_object('hp', v_def.hp, 'max', v_def.hp, 'dead', false, 'fight', 1));
  v_hp := (v_b->>'hp')::int;
  v_max := (v_b->>'max')::int;
  v_fight := coalesce((v_b->>'fight')::int, 1);
  if p_fire then
    if v_c.mana_max <= 0 then raise exception 'You do not know Ember'; end if;
    if exists (select 1 from vm_boss_hits where character_id = p_char and world_id = p_world and boss = v_def.id and fire and at > now() - interval '900 milliseconds') then
      return jsonb_build_object('boss', v_def.id, 'hp', v_hp, 'max', v_max, 'dead', coalesce((v_b->>'dead')::boolean, false), 'dealt', 0, 'throttled', true);
    end if;
  end if;
  if coalesce((v_b->>'dead')::boolean, false) then
    return jsonb_build_object('boss', v_def.id, 'hp', 0, 'max', v_max, 'dead', true, 'dealt', 0, 'granted',
                              exists (select 1 from vm_grants where world_id = p_world and boss = v_def.id and character_id = p_char));
  end if;
  select max(at) into v_last from vm_boss_hits where character_id = p_char and world_id = p_world and boss = v_def.id;
  if v_last is not null and v_last > now() - interval '250 milliseconds' then
    return jsonb_build_object('boss', v_def.id, 'hp', v_hp, 'max', v_max, 'dead', false, 'dealt', 0, 'throttled', true);
  end if;
  v_power := 1 + 0.03 * (vm_level_of(v_c.xp) - 1);
  if p_fire then
    v_dmg := 21 * v_power;
  else
    select d.* into v_d from vm_items i join vm_item_defs d on d.id = i.def where i.character_id = p_char and i.equipped and d.slot = 'main' limit 1;
    if not found then select * into v_d from vm_item_defs where id = 'wpn_fists'; end if;
    v_dmg := coalesce(v_d.damage, 4) * v_power * (case when p_heavy then 1.6 else 1 end) * (0.92 + random() * 0.16);
    if p_heavy and p_behind and not p_perched then v_dmg := v_dmg * 1.3; end if;
    if p_perched then v_dmg := v_dmg * 0.5; end if;
  end if;
  if p_dizzy then v_dmg := v_dmg * 1.3; end if;
  -- the Black Knight's Oath: all five pieces worn
  if (select count(distinct i.def) from vm_items i where i.character_id = p_char and i.equipped
        and i.def in ('arm_bk_head', 'arm_bk_chest', 'arm_bk_hands', 'arm_bk_legs', 'arm_bk_feet')) = 5 then
    v_dmg := v_dmg * 1.15;
  end if;
  v_dmg := greatest(1, round(v_dmg));
  v_hp := greatest(0, v_hp - v_dmg::int);
  insert into vm_boss_hits (world_id, boss, character_id, fight, dmg, fire) values (p_world, v_def.id, p_char, v_fight, v_dmg::int, coalesce(p_fire, false));
  v_b := v_b || jsonb_build_object('hp', v_hp);
  if v_hp <= 0 then
    v_dead := true;
    v_b := v_b || jsonb_build_object('dead', true, 'hp', 0);
    update vm_worlds set boss = boss || jsonb_build_object(v_def.id, v_b), flags = flags || jsonb_build_object(v_def.flag, true), updated_at = now()
      where id = p_world;
    for v_rec in
      select character_id from (
        select distinct h.character_id from vm_boss_hits h where h.world_id = p_world and h.boss = v_def.id and h.fight = v_fight
        union
        select m.character_id from vm_members m
          where m.world_id = p_world and m.left_at is null and m.zone = v_def.zone and m.x is not null
            and m.last_seen > now() - interval '60 seconds' and vm_dist(m.x, m.z, v_def.x, v_def.z) <= v_def.reach
      ) f order by character_id
    loop
      insert into vm_grants (world_id, boss, character_id) values (p_world, v_def.id, v_rec.character_id) on conflict do nothing;
      if found then
        for v_it in select * from jsonb_array_elements(v_def.rewards) loop
          perform vm_add_item(v_rec.character_id, v_it->>0, coalesce((v_it->>1)::int, 1));
        end loop;
        perform vm_add_xp(v_rec.character_id, v_def.xp);
        perform vm_add_item(v_rec.character_id, 'coin_crown', v_def.crowns);
        update vm_characters set flags = flags || jsonb_build_object(v_def.id, true), updated_at = now() where id = v_rec.character_id;
      end if;
    end loop;
    v_granted := exists (select 1 from vm_grants where world_id = p_world and boss = v_def.id and character_id = p_char);
  else
    update vm_worlds set boss = boss || jsonb_build_object(v_def.id, v_b), updated_at = now() where id = p_world;
  end if;
  return jsonb_build_object('boss', v_def.id, 'hp', v_hp, 'max', v_max, 'dead', v_dead, 'dealt', v_dmg::int, 'granted', v_granted)
         || case when v_dead then jsonb_build_object('character', vm_char_json(p_char)) else '{}'::jsonb end;
end $$;

-- The fight resets (a new fight number, full health) when everyone has fallen or left. Health
-- grows with the fighters standing in the arena: each one past the first adds `scale` of the base.
create or replace function vm_boss_reset(p_player uuid, p_secret text, p_world uuid, p_char uuid, p_boss text default 'cookie') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_def vm_bosses; v_w vm_worlds; v_b jsonb; v_n int; v_max int;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  select * into v_def from vm_bosses where id = coalesce(p_boss, 'cookie');
  if not found then raise exception 'Unknown foe'; end if;
  select * into v_w from vm_worlds where id = p_world for update;
  perform vm_member(p_world, p_char);
  v_b := coalesce(v_w.boss -> v_def.id, jsonb_build_object('hp', v_def.hp, 'max', v_def.hp, 'dead', false, 'fight', 0));
  if coalesce((v_b->>'dead')::boolean, false) then return v_w.boss; end if;
  -- a fight that is still being fought is not reset (a client with stale state may ask)
  if exists (select 1 from vm_boss_hits where world_id = p_world and boss = v_def.id and at > now() - interval '15 seconds') then return v_w.boss; end if;
  select count(*)::int into v_n from vm_members m
    where m.world_id = p_world and m.left_at is null and m.zone = v_def.zone and m.x is not null
      and m.last_seen > now() - interval '20 seconds' and vm_dist(m.x, m.z, v_def.x, v_def.z) <= v_def.reach;
  v_n := least(4, greatest(1, v_n));
  v_max := round((v_def.hp * (1 + v_def.scale * (v_n - 1)))::numeric)::int;
  v_b := v_b || jsonb_build_object('hp', v_max, 'max', v_max, 'dead', false, 'fight', coalesce((v_b->>'fight')::int, 0) + 1);
  update vm_worlds set boss = boss || jsonb_build_object(v_def.id, v_b), updated_at = now() where id = p_world returning * into v_w;
  return v_w.boss;
end $$;

create or replace function vm_died(p_player uuid, p_secret text, p_world uuid, p_char uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform vm_own_char(p_player, p_secret, p_char);
  perform vm_member(p_world, p_char);
  -- you wake somewhere else: the next heartbeat must be at a wake point (see vm_heartbeat).
  -- Member before character (lock order).
  update vm_members set x = null, z = null where world_id = p_world and character_id = p_char and left_at is null;
  perform vm_lock_char(p_char);
  update vm_characters set deaths = deaths + 1, hp = max_hp, updated_at = now() where id = p_char;
  return vm_char_json(p_char);
end $$;

-- Shops sell their stock for crowns at the counter (you stand within 6 m, plus the age of your
-- last saved position). Nothing is handed over unless every crown is there.
create or replace function vm_buy(p_player uuid, p_secret text, p_world uuid, p_char uuid, p_shop text, p_item text, p_n int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_m vm_members; v_s vm_shops; v_price int; v_d vm_item_defs; v_cost int;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  v_m := vm_member(p_world, p_char);
  select * into v_s from vm_shops where id = p_shop;
  if not found then raise exception 'No such shop'; end if;
  if v_m.zone <> v_s.zone or v_m.x is null or vm_dist(v_m.x, v_m.z, v_s.x, v_s.z) > 6 + 8 then raise exception 'Stand at the counter'; end if;
  select price into v_price from vm_shop_stock where shop = p_shop and item = p_item;
  select * into v_d from vm_item_defs where id = p_item;
  if v_price is null or v_price <= 0 or v_d.id is null or v_d.soulbound or v_d.kind = 'coin' then raise exception 'Not for sale here'; end if;
  if p_n is null or p_n < 1 or p_n > 20 then raise exception 'Buy between 1 and 20'; end if;
  v_cost := v_price * p_n;
  perform vm_lock_char(p_char);
  if vm_count(p_char, 'coin_crown') < v_cost then raise exception 'You cannot afford that'; end if;
  perform vm_take_item(p_char, 'coin_crown', v_cost);
  perform vm_add_item(p_char, p_item, p_n);
  return jsonb_build_object('items', vm_items_json(p_char), 'crowns', vm_count(p_char, 'coin_crown'), 'item', p_item, 'n', p_n, 'cost', v_cost);
end $$;

-- A shop that buys pays 30% of an item's value (rounded down) for anything that is not
-- soulbound, a key or coin, and worth at least a crown that way. It takes from the exact stack you hand over.
create or replace function vm_sell(p_player uuid, p_secret text, p_world uuid, p_char uuid, p_shop text, p_uid text, p_n int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_m vm_members; v_s vm_shops; v_i vm_items; v_d vm_item_defs; v_each int;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  v_m := vm_member(p_world, p_char);
  select * into v_s from vm_shops where id = p_shop;
  if not found then raise exception 'No such shop'; end if;
  if not v_s.buys then raise exception 'They do not buy here'; end if;
  if v_m.zone <> v_s.zone or v_m.x is null or vm_dist(v_m.x, v_m.z, v_s.x, v_s.z) > 6 + 8 then raise exception 'Stand at the counter'; end if;
  perform vm_lock_char(p_char);
  select * into v_i from vm_items where character_id = p_char and uid = p_uid;
  if not found then raise exception 'You do not have that'; end if;
  select * into v_d from vm_item_defs where id = v_i.def;
  if v_i.soulbound or v_d.soulbound or v_d.kind in ('key', 'coin') then raise exception 'They will not buy that'; end if;
  if p_n is null or p_n < 1 or p_n > v_i.count then raise exception 'You do not have that many'; end if;
  v_each := floor(v_d.value * coalesce((vm_cfg('sell_rate') #>> '{}')::numeric, 0.3))::int;
  if v_each < 1 then raise exception 'Not worth a crown'; end if;
  perform vm_take_item(p_char, v_i.def, p_n, p_uid);
  perform vm_add_item(p_char, 'coin_crown', v_each * p_n);
  return jsonb_build_object('items', vm_items_json(p_char), 'crowns', vm_count(p_char, 'coin_crown'), 'item', v_i.def, 'n', p_n, 'paid', v_each * p_n);
end $$;

-- Quests are data (vm_quests, from data/quests.ts). 'start' takes one up; 'step' passes the
-- current step once its condition holds (checked here, not on the client), and the last step
-- pays the reward exactly once. A step also passes when a LATER flag, boss, cflag or level step
-- already holds, so a veteran is not sent back for what they have done.
create or replace function vm_quest(p_player uuid, p_secret text, p_world uuid, p_char uuid, p_quest text, p_op text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_def jsonb; v_steps jsonb; v_c vm_characters; v_st jsonb; v_s int; v_step jsonb; v_skip boolean := false; v_req text; v_i int;
        v_it jsonb; v_gain int := 0; v_left int; v_id text; v_flag text;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  select def into v_def from vm_quests where id = p_quest;
  if v_def is null then raise exception 'Unknown quest'; end if;
  v_steps := coalesce(v_def->'steps', '[]'::jsonb);
  -- world, member, character: the start flag and flag/boss steps read and write the world
  perform 1 from vm_worlds where id = p_world for update;
  perform vm_member(p_world, p_char);
  perform vm_lock_char(p_char);
  select * into v_c from vm_characters where id = p_char;
  v_st := v_c.quests -> p_quest;
  if p_op = 'start' then
    if v_st is not null then raise exception 'You already have that quest'; end if;
    for v_req in select jsonb_array_elements_text(coalesce(v_def->'requires', '[]'::jsonb)) loop
      if not coalesce((v_c.quests->v_req->>'done')::boolean, false) then raise exception 'Not yet: another quest comes first'; end if;
    end loop;
    if vm_level_of(v_c.xp) < coalesce((v_def->>'level')::int, 1) then
      raise exception 'You need to be level % for that', coalesce((v_def->>'level')::int, 1);
    end if;
    v_st := jsonb_build_object('s', 0, 'b', vm_quest_baseline(p_char, v_steps->0), 'done', false);
    update vm_characters set quests = quests || jsonb_build_object(p_quest, v_st), updated_at = now() where id = p_char;
    v_flag := nullif(v_def->>'startFlag', '');
    if v_flag is not null then
      update vm_worlds set flags = flags || jsonb_build_object(v_flag, true), updated_at = now() where id = p_world;
    end if;
  elsif p_op = 'step' then
    if v_st is null then raise exception 'You do not have that quest'; end if;
    if coalesce((v_st->>'done')::boolean, false) then raise exception 'That quest is done'; end if;
    v_s := coalesce((v_st->>'s')::int, 0);
    v_step := v_steps -> v_s;
    if v_step is not null then
      for v_i in v_s + 1 .. jsonb_array_length(v_steps) - 1 loop
        if (v_steps->v_i->>'k') in ('flag', 'boss', 'cflag', 'level') and vm_quest_met(p_world, p_char, v_steps->v_i, 0) then
          v_skip := true;
          exit;
        end if;
      end loop;
      if not v_skip then
        if not vm_quest_met(p_world, p_char, v_step, coalesce((v_st->>'b')::int, 0)) then raise exception 'not yet'; end if;
        if v_step->>'k' = 'give' then
          -- n of the first listed item you carry n of
          v_left := coalesce((v_step->>'n')::int, 1);
          foreach v_id in array string_to_array(v_step->>'item', '|') loop
            if vm_count(p_char, v_id) >= v_left then
              perform vm_take_item(p_char, v_id, v_left);
              v_left := 0;
              exit;
            end if;
          end loop;
          if v_left > 0 then raise exception 'not yet'; end if;
        end if;
      end if;
    end if;
    v_s := v_s + 1;
    if v_s >= jsonb_array_length(v_steps) then
      -- done is written under the character lock in the same transaction as the reward: paid once
      update vm_characters set quests = quests || jsonb_build_object(p_quest, jsonb_build_object('s', v_s, 'b', 0, 'done', true)), updated_at = now()
        where id = p_char;
      v_gain := greatest(0, coalesce((v_def->'rewards'->>'xp')::int, 0));
      perform vm_add_xp(p_char, v_gain);
      perform vm_add_item(p_char, 'coin_crown', coalesce((v_def->'rewards'->>'crowns')::int, 0));
      for v_it in select * from jsonb_array_elements(coalesce(v_def->'rewards'->'items', '[]'::jsonb)) loop
        perform vm_add_item(p_char, v_it->>0, coalesce((v_it->>1)::int, 1));
      end loop;
    else
      update vm_characters set quests = quests || jsonb_build_object(p_quest, jsonb_build_object('s', v_s, 'b', vm_quest_baseline(p_char, v_steps->v_s), 'done', false)),
                               updated_at = now()
        where id = p_char;
    end if;
  else
    raise exception 'Unknown quest action';
  end if;
  select * into v_c from vm_characters where id = p_char;
  return jsonb_build_object('quests', v_c.quests, 'items', vm_items_json(p_char), 'xp', v_c.xp, 'xp_gained', v_gain,
                            'level', vm_level_of(v_c.xp), 'crowns', vm_count(p_char, 'coin_crown'),
                            'done', coalesce((v_c.quests->p_quest->>'done')::boolean, false), 'step', (v_c.quests->p_quest->>'s')::int,
                            'character', vm_char_json(p_char));
end $$;

-- Fast travel: from any shrine you have found (standing by it), to any other you have found.
create or replace function vm_travel(p_player uuid, p_secret text, p_world uuid, p_char uuid, p_shrine text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_m vm_members; v_t vm_shrines;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  select * into v_m from vm_members where world_id = p_world and character_id = p_char and left_at is null for update;
  if not found then raise exception 'Not in this world'; end if;
  select * into v_t from vm_shrines where id = p_shrine;
  if not found then raise exception 'Unknown shrine'; end if;
  if not vm_shrine_known(v_m.flags, v_t.id) then raise exception 'You have not found that shrine'; end if;
  if v_m.x is null or not exists (select 1 from vm_shrines s where s.zone = v_m.zone and vm_shrine_known(v_m.flags, s.id)
                                   and vm_dist(v_m.x, v_m.z, s.x, s.z) <= 6 + 8) then
    raise exception 'Travel from a shrine you have found';
  end if;
  update vm_members set zone = v_t.zone, x = v_t.x, z = v_t.z + 1.5, dungeon = (v_t.zone = 'castle'), pos_at = now(), last_seen = now()
    where world_id = p_world and character_id = p_char
    returning * into v_m;
  return jsonb_build_object('zone', v_m.zone, 'x', v_m.x, 'z', v_m.z);
end $$;

-- ------------------------------------------------------------------ data fixes (idempotent)
-- Health and breath follow the level (once the level table is seeded; entering a world also does this).
update vm_characters set max_hp = 100 + 9 * (vm_level_of(xp) - 1),
                         mana_max = case when mana_max > 0 then 30 + 2 * (vm_level_of(xp) - 1) else 0 end
  where vm_cfg('level_xp') is not null
    and (max_hp <> 100 + 9 * (vm_level_of(xp) - 1) or (mana_max > 0 and mana_max <> 30 + 2 * (vm_level_of(xp) - 1)));

-- ------------------------------------------------------------------ privileges
do $$
declare f record; api text[] := array['vm_register','vm_profile','vm_create_character','vm_import_character','vm_delete_character','vm_character',
  'vm_create_world','vm_join','vm_enter','vm_heartbeat','vm_leave','vm_gather','vm_craft','vm_equip','vm_use','vm_trade','vm_loot',
  'vm_world_flag','vm_char_flag','vm_member_flag','vm_boss_hit','vm_boss_reset','vm_died','vm_leave_world','vm_kick','vm_rest','vm_delete_world',
  'vm_quest','vm_buy','vm_sell','vm_travel'];
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'vm\_%' loop
    execute format('revoke execute on function %s from public', f.sig);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke execute on function %s from anon', f.sig); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke execute on function %s from authenticated', f.sig); end if;
    if f.proname = any (api) then
      if exists (select 1 from pg_roles where rolname = 'anon') then execute format('grant execute on function %s to anon', f.sig); end if;
      if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('grant execute on function %s to authenticated', f.sig); end if;
    end if;
  end loop;
end $$;
