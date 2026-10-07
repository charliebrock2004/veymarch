-- VEYRMARCH realms: player profiles, characters, and persistent worlds.
--
-- Clients never touch these tables. Row level security is on with no policies, and table
-- privileges are revoked from the public roles. Every client action is a vm_* function that
-- checks the caller's identity and the game rules, then changes state. The functions are the
-- authority for: identity, world membership, inventory, crafting, gathering, loot, unique
-- rewards, world progression, and Cookie's shared health pool.
--
-- Identity is a device secret: the client generates 32 random bytes, registers once, and keeps
-- (player id, secret) in local storage. Only the SHA-256 of the secret is stored.

-- ------------------------------------------------------------------ content (seeded from content.ts)
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

do $$
declare t text;
begin
  foreach t in array array['vm_item_defs','vm_recipes','vm_recipe_inputs','vm_trades','vm_trade_inputs','vm_loot','vm_mob_spawns','vm_nodes','vm_caches','vm_config',
                           'vm_players','vm_characters','vm_items','vm_worlds','vm_members','vm_boss_hits','vm_grants'] loop
    execute format('alter table %I enable row level security', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then execute format('revoke all on table %I from anon', t); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then execute format('revoke all on table %I from authenticated', t); end if;
  end loop;
end $$;

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

create or replace function vm_level(p_kills int, p_bosses int) returns int language sql immutable set search_path = pg_catalog as $$
  select 1 + floor(sqrt(greatest(0, p_kills * 10 + p_bosses * 120) / 40.0))::int
$$;

create or replace function vm_char_json(p_char uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare v_c vm_characters; v_w text; v_bosses int; v_place text;
begin
  select * into v_c from vm_characters where id = p_char;
  select d.name into v_w from vm_items i join vm_item_defs d on d.id = i.def
    where i.character_id = p_char and i.equipped and d.slot = 'main' limit 1;
  select count(*)::int into v_bosses from vm_grants g where g.character_id = p_char;
  select name into v_place from vm_worlds where id = v_c.last_world;
  return jsonb_build_object(
    'id', v_c.id, 'name', v_c.name, 'look', v_c.look, 'hp', v_c.hp, 'max_hp', v_c.max_hp, 'mana_max', v_c.mana_max,
    'flags', v_c.flags - 'gather_at', 'kills', v_c.kills, 'deaths', v_c.deaths, 'play_seconds', v_c.play_seconds,
    'level', vm_level(v_c.kills, v_bosses), 'weapon', coalesce(v_w, 'Fists'), 'items', vm_items_json(p_char),
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
  if not found or p_n <= 0 then return 0; end if;
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

-- Removes p_n of an item or raises: callers hold the character lock, and nothing is taken unless all of it is there.
create or replace function vm_take_item(p_char uuid, p_def text, p_n int) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_have int; v_left int := p_n; v_r record; v_rows int;
begin
  select coalesce(sum(count), 0) into v_have from vm_items where character_id = p_char and def = p_def;
  if v_have < p_n then raise exception 'materials'; end if;
  for v_r in select uid, count from vm_items where character_id = p_char and def = p_def order by equipped, length(uid), uid for update loop
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

create or replace function vm_count(p_char uuid, p_def text) returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(count), 0)::int from vm_items where character_id = p_char and def = p_def
$$;

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

create or replace function vm_enter_internal(p_world uuid, p_char uuid, p_player uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_online int;
begin
  select count(*) into v_online from vm_members
    where world_id = p_world and character_id <> p_char and player_id <> p_player and left_at is null and last_seen > now() - interval '40 seconds';
  if v_online >= 4 then raise exception 'Four players are already in that world'; end if;
  insert into vm_members (world_id, character_id, player_id, last_seen) values (p_world, p_char, p_player, now())
    on conflict (world_id, character_id) do update set last_seen = now(), left_at = null;
  update vm_characters set last_world = p_world, updated_at = now() where id = p_char;
  update vm_worlds set updated_at = now() where id = p_world;
  perform vm_tick(p_world);
  return jsonb_build_object(
    'world', vm_world_json(p_world),
    'character', vm_char_json(p_char),
    'member', (select jsonb_build_object('x', x, 'z', z, 'yaw', yaw, 'dungeon', dungeon, 'flags', flags) from vm_members where world_id = p_world and character_id = p_char));
end $$;

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
                        where w.owner = p_player or exists (select 1 from vm_members m where m.world_id = w.id and m.player_id = p_player and m.left_at is null)), '[]'::jsonb));
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
  -- uniques, keys, late-tier items or boss progress (those are earned in a world)
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
  for v_it in select * from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) loop
    select * into v_def from vm_item_defs where id = v_it->>'def';
    continue when not found or v_def.id = 'arm_cloth' or v_def.kind = 'key' or v_def.soulbound or v_def.tier >= 4 or v_def.id = 'mat_iron';
    perform vm_add_item(v_id, v_def.id, least(greatest(coalesce((v_it->>'count')::int, 1), 1), 20));
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
  -- soft delete: the row stays so world history (grants, hits) keeps its references
  update vm_characters set deleted = true, updated_at = now() where id = p_char;
  update vm_members set last_seen = now() - interval '10 minutes', left_at = coalesce(left_at, now()) where character_id = p_char;
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
declare v_code text; v_id uuid; v_alpha text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; v_i int; v_name text; v_hp int;
begin
  perform vm_auth(p_player, p_secret);
  if (select count(*) from vm_worlds where owner = p_player) >= 6 then raise exception 'You already own six worlds'; end if;
  v_name := coalesce(nullif(left(btrim(regexp_replace(coalesce(p_name, ''), '[[:cntrl:]<>]', '', 'g')), 32), ''), 'A Realm');
  loop
    v_code := '';
    for v_i in 1..6 loop
      v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
    end loop;
    exit when not exists (select 1 from vm_worlds where code = v_code);
  end loop;
  v_hp := coalesce((vm_cfg('cookie_hp') #>> '{}')::int, 280);
  insert into vm_worlds (code, name, owner, seed, boss)
  values (v_code, v_name, p_player, floor(random() * 1000000)::int,
          jsonb_build_object('cookie', jsonb_build_object('hp', v_hp, 'max', v_hp, 'dead', false, 'fight', 1)))
  returning id into v_id;
  return vm_world_card(v_id, p_player);
end $$;

create or replace function vm_join(p_player uuid, p_secret text, p_code text, p_char uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_w vm_worlds; v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')); v_players int;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  -- lock the world so two people joining at once cannot both take the last seat
  select * into v_w from vm_worlds where code = v_code for update;
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
  if not exists (select 1 from vm_worlds where id = p_world and owner = p_player)
     and not exists (select 1 from vm_members where world_id = p_world and player_id = p_player and left_at is null) then
    raise exception 'Join that world with its code first';
  end if;
  return vm_enter_internal(p_world, p_char, p_player);
end $$;

-- Every few seconds: persist the position (if it is physically possible), health and play time,
-- advance the world clock, and return the shared world state.
create or replace function vm_heartbeat(p_player uuid, p_secret text, p_world uuid, p_char uuid, p_x real, p_z real, p_yaw real,
                                        p_dungeon boolean, p_hp real, p_play int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_m vm_members; v_dt double precision; v_ok boolean := true; v_w vm_worlds;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  perform vm_tick(p_world);
  select * into v_m from vm_members where world_id = p_world and character_id = p_char and left_at is null for update;
  if not found then raise exception 'Not in this world'; end if;
  v_dt := greatest(0.2, extract(epoch from now() - v_m.pos_at));
  if v_m.x is not null and v_m.dungeon = p_dungeon and sqrt((p_x - v_m.x) ^ 2 + (p_z - v_m.z) ^ 2) > 9.5 * v_dt + 8 then
    v_ok := false;
  end if;
  -- changing zone needs a door: the castle door outside, the entry hall or the courtyard gate inside
  if v_m.x is not null and v_m.dungeon <> p_dungeon and not vm_at_portal(v_m.dungeon, v_m.x, v_m.z, v_dt) then
    v_ok := false;
  end if;
  if v_ok then
    update vm_members set x = p_x, z = p_z, yaw = p_yaw, dungeon = p_dungeon, pos_at = now(), last_seen = now()
      where world_id = p_world and character_id = p_char;
  else
    update vm_members set last_seen = now() where world_id = p_world and character_id = p_char;
  end if;
  update vm_characters set hp = least(greatest(coalesce(p_hp, hp), 0), max_hp),
                           play_seconds = play_seconds + least(greatest(coalesce(p_play, 0), 0), 60), updated_at = now()
    where id = p_char;
  select * into v_w from vm_worlds where id = p_world;
  return jsonb_build_object('ok', v_ok, 'hour', v_w.hour, 'day', v_w.day, 'flags', v_w.flags, 'boss', v_w.boss, 'now', now(),
    'online', (select count(*) from vm_members where world_id = p_world and last_seen > now() - interval '40 seconds'));
end $$;

-- Doors between zones (static map data). Walking speed covers the gap since the last save.
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

-- Leave a world for good (it disappears from your list and frees your seat). Rejoin with the code.
create or replace function vm_leave_world(p_player uuid, p_secret text, p_world uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform vm_auth(p_player, p_secret);
  if exists (select 1 from vm_worlds where id = p_world and owner = p_player) then raise exception 'You made this world: it stays in your list'; end if;
  update vm_members set left_at = now(), last_seen = now() - interval '10 minutes' where world_id = p_world and player_id = p_player and left_at is null;
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
declare v_c vm_characters; v_n vm_nodes; v_w vm_worlds; v_st jsonb; v_left int; v_regrow timestamptz;
begin
  v_c := vm_own_char(p_player, p_secret, p_char);
  perform vm_member(p_world, p_char);
  select * into v_n from vm_nodes where id = p_node;
  if not found then raise exception 'Nothing to gather there'; end if;
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

create or replace function vm_craft(p_player uuid, p_secret text, p_world uuid, p_char uuid, p_recipe text, p_station text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_r vm_recipes; v_in record; v_m vm_members; v_d vm_item_defs;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  v_m := vm_member(p_world, p_char);
  perform vm_lock_char(p_char);
  select * into v_r from vm_recipes where id = p_recipe;
  if not found then raise exception 'Unknown recipe'; end if;
  if v_r.station <> 'hand' then
    -- the workbench and the forge stand in Hearthfen
    if p_station is distinct from v_r.station or v_m.dungeon or v_m.x is null or sqrt(v_m.x ^ 2 + v_m.z ^ 2) > 60 then
      raise exception 'station';
    end if;
  end if;
  for v_in in select item, n from vm_recipe_inputs where recipe = p_recipe loop
    if vm_count(p_char, v_in.item) < v_in.n then raise exception 'materials'; end if;
  end loop;
  for v_in in select item, n from vm_recipe_inputs where recipe = p_recipe loop
    if not vm_take_item(p_char, v_in.item, v_in.n) then raise exception 'materials'; end if;
  end loop;
  perform vm_add_item(p_char, v_r.out_item, 1);
  select * into v_d from vm_item_defs where id = v_r.out_item;
  if v_d.slot <> 'none' and v_d.moveset not like '%pick%' then perform vm_equip_def(p_char, v_r.out_item); end if;
  return jsonb_build_object('items', vm_items_json(p_char), 'made', v_r.out_item);
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

-- A foe dies once per spawn. The first claim records the death and rolls the loot; any later
-- claim for the same foe before it respawns gets nothing.
create or replace function vm_loot(p_player uuid, p_secret text, p_world uuid, p_char uuid, p_mob text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_s vm_mob_spawns; v_w vm_worlds; v_dead jsonb; v_r record; v_drops jsonb := '[]'::jsonb; v_until timestamptz;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  perform vm_member(p_world, p_char);
  select * into v_s from vm_mob_spawns where key = p_mob;
  if not found then raise exception 'Unknown foe'; end if;
  select * into v_w from vm_worlds where id = p_world for update;
  perform vm_lock_char(p_char);
  v_dead := v_w.dead_mobs -> p_mob;
  if v_dead is not null and (jsonb_typeof(v_dead) = 'null' or (v_dead #>> '{}')::timestamptz > now()) then
    return jsonb_build_object('items', vm_items_json(p_char), 'drops', '[]'::jsonb, 'dup', true);
  end if;
  v_until := case when v_s.respawns then now() + interval '150 seconds' else null end;
  update vm_worlds set dead_mobs = dead_mobs || jsonb_build_object(p_mob, v_until), updated_at = now() where id = p_world;
  for v_r in select item, n, chance from vm_loot where kind = v_s.kind loop
    if random() < v_r.chance then
      perform vm_add_item(p_char, v_r.item, v_r.n);
      v_drops := v_drops || jsonb_build_array(jsonb_build_object('item', v_r.item, 'n', v_r.n));
    end if;
  end loop;
  update vm_characters set kills = kills + 1 where id = p_char;
  return jsonb_build_object('items', vm_items_json(p_char), 'drops', v_drops, 'dup', false);
end $$;

create or replace function vm_world_flag(p_player uuid, p_secret text, p_world uuid, p_char uuid, p_flag text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_w vm_worlds;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  perform vm_member(p_world, p_char);
  select * into v_w from vm_worlds where id = p_world for update;
  if p_flag = 'slab' then
    null;
  elsif p_flag = 'nursery' then
    if not (v_w.dead_mobs ? 'dh') then raise exception 'The door will not budge while the rocking horse still rocks'; end if;
  elsif p_flag = 'gate' then
    if not coalesce((v_w.flags->>'cookie')::boolean, false) then raise exception 'The gate does not answer'; end if;
  else
    raise exception 'Unknown flag';
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
    if not exists (select 1 from vm_items where character_id = p_char
                   and def in ('wpn_stone_knife', 'wpn_copper_sword', 'wpn_iron_sword', 'wpn_cookie_blade', 'wpn_smacko')) then
      raise exception 'Tanic wants to see an edge first';
    end if;
    update vm_characters set mana_max = greatest(mana_max, 30) where id = p_char;
  elsif p_flag not in ('talked', 'voss', 'ended') then
    raise exception 'Unknown flag';
  end if;
  update vm_characters set flags = flags || jsonb_build_object(p_flag, true), updated_at = now() where id = p_char;
  return vm_char_json(p_char);
end $$;

-- Per character, per world: one-time caches, the shrine, having entered the castle.
create or replace function vm_member_flag(p_player uuid, p_secret text, p_world uuid, p_char uuid, p_flag text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_m vm_members; v_r record; v_drops jsonb := '[]'::jsonb;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  select * into v_m from vm_members where world_id = p_world and character_id = p_char and left_at is null for update;
  if not found then raise exception 'Not in this world'; end if;
  perform vm_lock_char(p_char);
  if p_flag not in ('chest', 'hollow', 'shrine', 'entered') then raise exception 'Unknown flag'; end if;
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

-- Cookie has one health pool per world. The server computes the damage from the attacker's
-- equipped weapon, throttles swings, and on the killing blow marks the world, then grants the
-- three uniques exactly once to every character who fought (or stood in the castle) for this fight.
create or replace function vm_boss_hit(p_player uuid, p_secret text, p_world uuid, p_char uuid, p_heavy boolean, p_fire boolean,
                                       p_behind boolean, p_perched boolean, p_dizzy boolean) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_w vm_worlds; v_b jsonb; v_hp int; v_max int; v_fight int; v_d vm_item_defs; v_dmg double precision; v_last timestamptz;
        v_rec record; v_item text; v_granted boolean := false; v_m vm_members; v_dead boolean := false;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  select * into v_w from vm_worlds where id = p_world for update;
  v_m := vm_member(p_world, p_char);
  -- the hitter must be in the castle courtyard, by its last save (every 5 s while playing)
  if not v_m.dungeon or v_m.last_seen < now() - interval '20 seconds' or v_m.x is null
     or sqrt((v_m.x - 1200) ^ 2 + (v_m.z - 104) ^ 2) > 34 then
    raise exception 'Cookie is not within reach';
  end if;
  if p_fire then
    if (select mana_max from vm_characters where id = p_char) <= 0 then raise exception 'You do not know Ember'; end if;
    if exists (select 1 from vm_boss_hits where character_id = p_char and world_id = p_world and boss = 'cookie' and fire and at > now() - interval '900 milliseconds') then
      return jsonb_build_object('hp', (v_w.boss->'cookie'->>'hp')::int, 'max', (v_w.boss->'cookie'->>'max')::int, 'dead', false, 'dealt', 0, 'throttled', true);
    end if;
  end if;
  v_b := coalesce(v_w.boss->'cookie', jsonb_build_object('hp', 280, 'max', 280, 'dead', false, 'fight', 1));
  v_hp := (v_b->>'hp')::int;
  v_max := (v_b->>'max')::int;
  v_fight := coalesce((v_b->>'fight')::int, 1);
  if coalesce((v_b->>'dead')::boolean, false) then
    return jsonb_build_object('hp', 0, 'max', v_max, 'dead', true, 'dealt', 0, 'granted',
                              exists (select 1 from vm_grants where world_id = p_world and boss = 'cookie' and character_id = p_char));
  end if;
  select max(at) into v_last from vm_boss_hits where character_id = p_char and world_id = p_world and boss = 'cookie';
  if v_last is not null and v_last > now() - interval '250 milliseconds' then
    return jsonb_build_object('hp', v_hp, 'max', v_max, 'dead', false, 'dealt', 0, 'throttled', true);
  end if;
  if p_fire then
    v_dmg := 14 * 1.5;
  else
    select d.* into v_d from vm_items i join vm_item_defs d on d.id = i.def where i.character_id = p_char and i.equipped and d.slot = 'main' limit 1;
    if not found then select * into v_d from vm_item_defs where id = 'wpn_fists'; end if;
    v_dmg := v_d.damage * (case when p_heavy then 1.6 else 1 end) * (0.92 + random() * 0.16);
    if p_heavy and p_behind and not p_perched then v_dmg := v_dmg * 1.3; end if;
    if p_perched then v_dmg := v_dmg * 0.5; end if;
  end if;
  if p_dizzy then v_dmg := v_dmg * 1.3; end if;
  v_dmg := greatest(1, round(v_dmg));
  v_hp := greatest(0, v_hp - v_dmg::int);
  insert into vm_boss_hits (world_id, boss, character_id, fight, dmg, fire) values (p_world, 'cookie', p_char, v_fight, v_dmg::int, p_fire);
  v_b := v_b || jsonb_build_object('hp', v_hp);
  if v_hp <= 0 then
    v_dead := true;
    v_b := v_b || jsonb_build_object('dead', true, 'hp', 0);
    update vm_worlds set boss = boss || jsonb_build_object('cookie', v_b), flags = flags || '{"cookie": true}'::jsonb, updated_at = now()
      where id = p_world;
    for v_rec in
      select character_id from (
        select distinct h.character_id from vm_boss_hits h where h.world_id = p_world and h.boss = 'cookie' and h.fight = v_fight
        union
        select m.character_id from vm_members m where m.world_id = p_world and m.left_at is null and m.dungeon and m.last_seen > now() - interval '60 seconds'
      ) f order by character_id
    loop
      insert into vm_grants (world_id, boss, character_id) values (p_world, 'cookie', v_rec.character_id) on conflict do nothing;
      if found then
        foreach v_item in array array['wpn_cookie_blade', 'wpn_cookie_pick', 'key_cookie_core'] loop
          perform vm_add_item(v_rec.character_id, v_item, 1);
        end loop;
        update vm_characters set flags = flags || '{"cookie": true}'::jsonb, updated_at = now() where id = v_rec.character_id;
      end if;
    end loop;
    v_granted := exists (select 1 from vm_grants where world_id = p_world and boss = 'cookie' and character_id = p_char);
  else
    update vm_worlds set boss = boss || jsonb_build_object('cookie', v_b), updated_at = now() where id = p_world;
  end if;
  return jsonb_build_object('hp', v_hp, 'max', v_max, 'dead', v_dead, 'dealt', v_dmg::int, 'granted', v_granted);
end $$;

-- The fight resets (full health, a new fight number) when everyone has fallen or left.
create or replace function vm_boss_reset(p_player uuid, p_secret text, p_world uuid, p_char uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_w vm_worlds; v_b jsonb;
begin
  perform vm_own_char(p_player, p_secret, p_char);
  perform vm_member(p_world, p_char);
  select * into v_w from vm_worlds where id = p_world for update;
  v_b := v_w.boss->'cookie';
  if v_b is null or coalesce((v_b->>'dead')::boolean, false) then return v_w.boss; end if;
  -- a fight that is still being fought is not reset (a client with stale state may ask)
  if exists (select 1 from vm_boss_hits where world_id = p_world and boss = 'cookie' and at > now() - interval '15 seconds') then return v_w.boss; end if;
  v_b := v_b || jsonb_build_object('hp', (v_b->>'max')::int, 'fight', coalesce((v_b->>'fight')::int, 1) + 1);
  update vm_worlds set boss = boss || jsonb_build_object('cookie', v_b), updated_at = now() where id = p_world returning * into v_w;
  return v_w.boss;
end $$;

create or replace function vm_died(p_player uuid, p_secret text, p_world uuid, p_char uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform vm_own_char(p_player, p_secret, p_char);
  perform vm_lock_char(p_char);
  update vm_characters set deaths = deaths + 1, hp = max_hp, updated_at = now() where id = p_char;
  -- waking somewhere else is allowed: the next position is not checked against the last one
  update vm_members set x = null, z = null where world_id = p_world and character_id = p_char;
  return vm_char_json(p_char);
end $$;

-- ------------------------------------------------------------------ privileges
do $$
declare f record; api text[] := array['vm_register','vm_profile','vm_create_character','vm_import_character','vm_delete_character','vm_character',
  'vm_create_world','vm_join','vm_enter','vm_heartbeat','vm_leave','vm_gather','vm_craft','vm_equip','vm_use','vm_trade','vm_loot',
  'vm_world_flag','vm_char_flag','vm_member_flag','vm_boss_hit','vm_boss_reset','vm_died','vm_leave_world','vm_kick'];
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
