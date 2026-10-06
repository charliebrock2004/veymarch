#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using Veyr.Content;

namespace Veyr.Sim
{
    public sealed class WorldSimulation
    {
        readonly ContentCatalog _content;
        readonly Dictionary<string, Inventory> _bags = new(StringComparer.Ordinal);
        readonly Dictionary<string, SkillSheet> _skills = new(StringComparer.Ordinal);
        readonly Dictionary<string, HurtboxHistory> _hurt = new(StringComparer.Ordinal);
        readonly Dictionary<string, StatusSheet> _status = new(StringComparer.Ordinal);
        readonly Dictionary<string, BossController> _bosses = new(StringComparer.Ordinal);
        readonly List<string> _players = new List<string>();
        readonly List<string> _actorOrder = new List<string>();
        readonly Dictionary<string, PlayerIntent> _pending = new(StringComparer.Ordinal);
        readonly Dictionary<string, MoveResult> _lastMove = new(StringComparer.Ordinal);
        readonly Dictionary<string, NodeInstance> _nodes = new(StringComparer.Ordinal);
        readonly Dictionary<string, StationInstance> _stations = new(StringComparer.Ordinal);
        int _seq;

        public SimClock Clock { get; } = new();
        public DayClock Day { get; } = new();
        public WorldFlags Flags { get; } = new();
        public Dictionary<string, ActorBody> Actors { get; } = new(StringComparer.Ordinal);
        public WorldGeometry Geometry { get; } = new WorldGeometry();
        public SimEventLog Events { get; } = new SimEventLog();
        /// <summary>Players in join order. Steps visit them in this order so a tick is deterministic.</summary>
        public IReadOnlyList<string> Players => _players;
        public IReadOnlyDictionary<string, NodeInstance> Nodes => _nodes;
        public IReadOnlyDictionary<string, StationInstance> Stations => _stations;
        public DeathMode Mode { get; }
        public string WorldId { get; }
        public ulong Seed { get; }
        public ContentCatalog Content => _content;

        public WorldSimulation(string worldId, DeathMode mode, ulong seed, ContentCatalog? content = null)
        {
            WorldId = worldId;
            Mode = mode;
            Seed = seed;
            _content = content ?? ContentCatalog.Slice();
        }

        public ActorBody SpawnPlayer(string id, float x = 0f, float y = 0f, float z = 0f)
        {
            if (Actors.ContainsKey(id))
                throw new ArgumentException("Actor " + id + " already exists.");
            var body = new ActorBody
            {
                Id = id,
                DefId = "player",
                Health = 80,
                MaxHealth = 80,
                Stamina = 60,
                MaxStamina = 60,
                X = x,
                Y = y,
                Z = z,
                SpawnX = x,
                SpawnY = y,
                SpawnZ = z
            };
            Register(body);
            _players.Add(id);
            return body;
        }

        public ActorBody SpawnActor(string defId, float x, float z)
        {
            var def = _content.Actors[defId];
            var body = new ActorBody
            {
                Id = NextId("mob"),
                DefId = defId,
                X = x,
                Z = z,
                Health = def.MaxHealth,
                MaxHealth = def.MaxHealth
            };
            Register(body);
            return body;
        }

        void Register(ActorBody body)
        {
            Actors[body.Id] = body;
            _actorOrder.Add(body.Id);
            _bags[body.Id] = new Inventory();
            _skills[body.Id] = new SkillSheet();
            _hurt[body.Id] = new HurtboxHistory();
            _status[body.Id] = new StatusSheet();
        }

        public Inventory Bag(string actorId) => _bags[actorId];
        public SkillSheet Skills(string actorId) => _skills[actorId];
        public StatusSheet Status(string actorId) => _status[actorId];

        int DodgeCost(string actorId)
        {
            if (!_content.Sets.TryGetValue("set_knight", out var knight))
                return 16;
            string bonus = ArmourSets.Active(knight, ArmourSets.Worn(knight, Actors[actorId], Bag(actorId)));
            return bonus == "dodge_cost" ? 20 : 16;
        }

        public BossController SpawnBoss(string bossId, int players = 1)
        {
            var def = _content.Boss(bossId);
            var boss = new BossController(def, players);
            _bosses[bossId] = boss;
            var body = new ActorBody
            {
                Id = bossId,
                DefId = bossId,
                Health = boss.Health,
                MaxHealth = boss.MaxHealth,
                X = 8,
                Z = 0
            };
            Register(body);
            boss.Begin();
            return boss;
        }

        public BossController Boss(string id) => _bosses[id];

        public NodeInstance PlaceNode(string instanceId, string nodeDefId, float x, float y, float z)
        {
            if (_nodes.ContainsKey(instanceId))
                throw new ArgumentException("Node " + instanceId + " already placed.");
            var node = new NodeInstance(instanceId, _content.Node(nodeDefId), x, y, z);
            _nodes[instanceId] = node;
            return node;
        }

        public StationInstance PlaceStation(string instanceId, StationId station, float x, float y, float z)
        {
            if (station == StationId.Hand)
                throw new ArgumentException("Hand crafting needs no station.");
            if (_stations.ContainsKey(instanceId))
                throw new ArgumentException("Station " + instanceId + " already placed.");
            var placed = new StationInstance(instanceId, station, x, y, z);
            _stations[instanceId] = placed;
            return placed;
        }

        /// <summary>True when a station of this kind is in reach. Hand is always in reach.</summary>
        public bool StationInReach(string actorId, StationId station)
        {
            if (station == StationId.Hand)
                return true;
            if (!Actors.TryGetValue(actorId, out var body))
                return false;
            foreach (var placed in _stations.Values)
            {
                if (placed.Station == station && Reach.Within(body, placed.X, placed.Y, placed.Z))
                    return true;
            }
            return false;
        }

        /// <summary>
        /// Queues a player's intent for the next <see cref="Step"/>. If two arrive before a step,
        /// the newer movement wins and button presses from both are kept.
        /// </summary>
        public void Submit(string actorId, PlayerIntent intent)
        {
            if (!Actors.TryGetValue(actorId, out var body) || body.DefId != "player")
            {
                Events.Add(new SimEvent(SimEventKind.Rejected, Clock.Tick, actorId, arg: "unknown_actor"));
                return;
            }
            _pending[actorId] = _pending.TryGetValue(actorId, out var older) ? PlayerIntent.Merge(older, intent) : intent;
        }

        /// <summary>
        /// One 20 Hz tick. Every actor's pose is recorded for hit rewind, every player's queued
        /// intent is applied in join order, statuses and bosses advance, then the clock moves once.
        /// </summary>
        public void Step()
        {
            long tick = Clock.Tick;
            foreach (var id in _actorOrder)
            {
                var body = Actors[id];
                _hurt[id].Record(tick, body.X, body.Z);
                if (body.IFrameTicks > 0)
                    body.IFrameTicks--;
                if (body.StaggerTicks > 0)
                    body.StaggerTicks--;
                if (body.DodgeTicks > 0)
                    body.DodgeTicks--;
            }

            foreach (var id in _players)
            {
                _pending.TryGetValue(id, out var intent);
                ApplyIntent(id, intent, tick);
            }
            _pending.Clear();

            foreach (var id in _actorOrder)
                _status[id].Tick(Actors[id], _content.Statuses);

            foreach (var pair in _bosses)
                pair.Value.Tick(_content.Boss(pair.Key));

            foreach (var node in _nodes.Values)
            {
                if (node.Spent && node.RespawnAtTick >= 0 && tick >= node.RespawnAtTick)
                {
                    node.ChargesLeft = Math.Max(1, node.Def.Charges);
                    node.RespawnAtTick = -1;
                    Events.Add(new SimEvent(SimEventKind.NodeRestored, tick, "", arg: node.Id, x: node.X, y: node.Y, z: node.Z));
                }
            }

            Clock.Advance();
            Day.AdvanceTicks(1);
        }

        void ApplyIntent(string actorId, PlayerIntent intent, long tick)
        {
            var body = Actors[actorId];
            bool alive = body.Life == LifeState.Alive;
            if (alive && intent.Dodge && body.DodgeTicks <= 0 && body.Stamina >= DodgeCost(actorId))
            {
                body.Stamina -= DodgeCost(actorId);
                body.IFrameTicks = SimRates.DodgeIFrameTicks;
                body.DodgeTicks = _content.Move.DodgeTicks;
                Events.Add(new SimEvent(SimEventKind.Dodged, tick, actorId, x: body.X, y: body.Y, z: body.Z));
            }

            if (alive)
            {
                body.Yaw = Movement.NormaliseYaw(intent.Yaw);
                float scale = MoveScale(actorId, body);
                var move = intent.HasClaim
                    ? Movement.ValidateClaim(body, intent, _content.Move, scale, Geometry, Flags)
                    : Movement.Step(body, intent, _content.Move, scale, Geometry, Flags);
                _lastMove[actorId] = move;
                if (!move.Accepted)
                    Events.Add(new SimEvent(SimEventKind.MoveRejected, tick, actorId, arg: move.Reason, x: body.X, y: body.Y, z: body.Z));
            }

            if (intent.Block && alive)
            {
                if (!body.Blocking)
                    body.BlockStartedTick = tick;
                body.Blocking = true;
            }
            else
            {
                body.Blocking = false;
            }

            if (body.Stamina < body.MaxStamina)
                body.Stamina = Math.Min(body.MaxStamina, body.Stamina + 0.4f);
            if (intent.Seq > body.LastSeq)
                body.LastSeq = intent.Seq;
        }

        float MoveScale(string actorId, ActorBody body)
        {
            float scale = _status.TryGetValue(actorId, out var sheet) ? sheet.MoveScale : 1f;
            if (_content.Sets.TryGetValue("set_hunter", out var hunter) && ArmourSets.Worn(hunter, body, Bag(actorId)) >= 2)
                scale *= 1.05f;
            return scale;
        }

        /// <summary>Submit and step in one call. Kept for tests and single-player harnesses.</summary>
        public void Tick(PlayerIntent intent, string actorId)
        {
            Submit(actorId, intent);
            Step();
        }

        /// <summary>Submit, step, and report how this actor's move went.</summary>
        public MoveResult TryMove(string actorId, PlayerIntent intent)
        {
            _lastMove.Remove(actorId);
            Submit(actorId, intent);
            Step();
            return _lastMove.TryGetValue(actorId, out var result)
                ? result
                : new MoveResult(false, "dead", Actors[actorId].X, Actors[actorId].Z, Actors[actorId].Y);
        }

        public MoveResult LastMove(string actorId) =>
            _lastMove.TryGetValue(actorId, out var result) ? result : new MoveResult(true, "", Actors[actorId].X, Actors[actorId].Z, Actors[actorId].Y);

        /// <summary>
        /// Strikes a placed node. The sim checks that the node exists, is in reach, is not spent,
        /// and that the seal and tool tier allow it. A client cannot name a node type and mine it
        /// from anywhere.
        /// </summary>
        public GatherResult TryGather(string actorId, string nodeInstanceId)
        {
            var reason = GatherGate(actorId, nodeInstanceId, out var body, out var node);
            if (reason.Length > 0)
            {
                Events.Add(new SimEvent(SimEventKind.Rejected, Clock.Tick, actorId, arg: "gather_" + reason));
                return new GatherResult(false, reason, 0);
            }

            var result = Gathering.TryGather(_content, Bag(actorId), body!, node!.Def, Flags, actorId, () => NextId("item"));
            if (!result.Ok)
            {
                Events.Add(new SimEvent(SimEventKind.Rejected, Clock.Tick, actorId, arg: "gather_" + result.Reason));
                return result;
            }

            Skills(actorId).Practise(node.Def.Practice);
            node.ChargesLeft--;
            Events.Add(new SimEvent(SimEventKind.Gathered, Clock.Tick, actorId, node.Id, node.Def.YieldItemId, result.Amount, node.X, node.Y, node.Z));
            if (node.Spent)
            {
                node.RespawnAtTick = node.Def.RespawnTicks > 0 ? Clock.Tick + node.Def.RespawnTicks : -1;
                Events.Add(new SimEvent(SimEventKind.NodeDepleted, Clock.Tick, actorId, arg: node.Id, x: node.X, y: node.Y, z: node.Z));
            }
            return result;
        }

        string GatherGate(string actorId, string nodeInstanceId, out ActorBody? body, out NodeInstance? node)
        {
            node = null;
            if (!Actors.TryGetValue(actorId, out body))
                return "actor";
            if (body.Life != LifeState.Alive)
                return "dead";
            if (!_nodes.TryGetValue(nodeInstanceId, out node))
                return "node";
            if (!Reach.Within(body, node.X, node.Y, node.Z))
                return "range";
            if (node.Spent)
                return "spent";
            return "";
        }

        /// <summary>
        /// Crafts in one transaction. Hand needs nothing; any other station must be placed in the
        /// world and in reach of the crafter. A retry with the same key returns the first result.
        /// </summary>
        public CraftResult TryCraft(string actorId, string recipeId, StationId station, string key)
        {
            if (!Actors.TryGetValue(actorId, out var body))
                return new CraftResult(false, "", "actor");
            if (body.Life != LifeState.Alive)
                return new CraftResult(false, "", "dead");
            if (!_content.Recipes.TryGetValue(recipeId, out var recipe))
                return Reject(actorId, new CraftResult(false, "", "recipe"));
            int rank = Skills(actorId).Rank(recipe.Skill);
            var result = Crafting.TryCraft(_content, Bag(actorId), actorId, recipeId, station, rank, key, () => NextId("item"), StationInReach(actorId, station));
            if (!result.Ok)
                return Reject(actorId, result);
            if (result.Reason != "replay")
            {
                Skills(actorId).Practise(recipe.Skill == SkillId.None ? SkillId.Blacksmithing : recipe.Skill);
                Events.Add(new SimEvent(SimEventKind.Crafted, Clock.Tick, actorId, arg: result.InstanceId, x: body.X, y: body.Y, z: body.Z));
            }
            return result;
        }

        CraftResult Reject(string actorId, CraftResult result)
        {
            Events.Add(new SimEvent(SimEventKind.Rejected, Clock.Tick, actorId, arg: "craft_" + result.Reason));
            return result;
        }

        public bool TryEquip(string actorId, string instanceId)
        {
            var inst = Bag(actorId).Find(instanceId);
            if (inst == null)
                return false;
            var def = _content.Item(inst.DefId);
            var body = Actors[actorId];
            if (def.Slot == EquipSlot.None)
                return false;
            if (def.Slot == EquipSlot.OffHand && MainIsGreatsword(body, actorId))
                return false;
            ClearSlot(actorId, def.Slot, body);
            switch (def.Slot)
            {
                case EquipSlot.OffHand:
                    body.OffHandId = instanceId;
                    break;
                case EquipSlot.Head:
                    body.HeadId = instanceId;
                    break;
                case EquipSlot.Chest:
                    body.ChestId = instanceId;
                    break;
                case EquipSlot.Hands:
                    body.HandsId = instanceId;
                    break;
                case EquipSlot.Legs:
                    body.LegsId = instanceId;
                    break;
                case EquipSlot.Cloak:
                    body.CloakId = instanceId;
                    break;
                case EquipSlot.Trinket:
                    body.TrinketId = instanceId;
                    break;
                default:
                    if (def.MovesetId == "greatsword")
                        ClearOffhandShield(actorId, body);
                    body.EquippedId = instanceId;
                    break;
            }

            inst.Equipped = true;
            return true;
        }

        bool MainIsGreatsword(ActorBody body, string actorId)
        {
            if (body.EquippedId.Length == 0)
                return false;
            var main = Bag(actorId).Find(body.EquippedId);
            return main != null && _content.Item(main.DefId).MovesetId == "greatsword";
        }

        void ClearOffhandShield(string actorId, ActorBody body)
        {
            if (body.OffHandId.Length == 0)
                return;
            var off = Bag(actorId).Find(body.OffHandId);
            if (off == null || _content.Item(off.DefId).MovesetId != "shield")
                return;
            off.Equipped = false;
            body.OffHandId = "";
        }

        void ClearSlot(string actorId, EquipSlot slot, ActorBody body)
        {
            string previous = slot switch
            {
                EquipSlot.OffHand => body.OffHandId,
                EquipSlot.Head => body.HeadId,
                EquipSlot.Chest => body.ChestId,
                EquipSlot.Hands => body.HandsId,
                EquipSlot.Legs => body.LegsId,
                EquipSlot.Cloak => body.CloakId,
                EquipSlot.Trinket => body.TrinketId,
                _ => body.EquippedId
            };
            if (previous.Length == 0)
                return;
            var old = Bag(actorId).Find(previous);
            if (old != null)
                old.Equipped = false;
        }

        /// <summary>
        /// Resolves one swing. Damage, flank, parry, and kills are the sim's call. The client may
        /// name the tick it saw for rewind; anything older than the hurtbox buffer is refused.
        /// </summary>
        public AttackResult TryAttack(string actorId, string targetId, bool heavy, long? clientTick = null)
        {
            if (!Actors.TryGetValue(actorId, out var attacker) || !Actors.TryGetValue(targetId, out var target) || actorId == targetId)
            {
                Events.Add(new SimEvent(SimEventKind.Rejected, Clock.Tick, actorId, targetId, "attack_target"));
                return new AttackResult(false, "target", 0, false, false, false);
            }
            long tick = clientTick ?? Clock.Tick;
            bool flank = Reach.Flank(target, attacker);
            bool boss = _bosses.ContainsKey(targetId);
            RegionDef region;
            Element weakness;
            if (boss)
            {
                var bossDef = _content.Boss(targetId);
                region = _content.Regions[bossDef.RegionId];
                weakness = bossDef.Weakness;
            }
            else if (_content.Actors.TryGetValue(target.DefId, out var actorDef))
            {
                region = _content.Regions[actorDef.RegionId];
                weakness = actorDef.Weakness;
            }
            else
            {
                region = _content.Regions["forest"];
                weakness = Element.None;
            }
            var result = Attacks.Resolve(
                _content,
                attacker,
                target,
                Bag(actorId),
                Bag(targetId),
                Skills(actorId),
                Clock.Tick,
                tick,
                heavy,
                flank,
                _hurt[targetId],
                boss,
                region.Band,
                region.DefenceK,
                Skills(targetId).Rank(SkillId.Greatsword),
                weakness,
                Equipment.Defence(_content, target, Bag(targetId)),
                Mode);
            if (result.Parried)
                Events.Add(new SimEvent(SimEventKind.Parried, Clock.Tick, targetId, actorId, x: target.X, y: target.Y, z: target.Z));
            else if (result.Accepted && result.Damage > 0)
                Events.Add(new SimEvent(SimEventKind.Hit, Clock.Tick, actorId, targetId, heavy ? "heavy" : "light", result.Damage, target.X, target.Y, target.Z));
            else if (!result.Accepted)
                Events.Add(new SimEvent(SimEventKind.Rejected, Clock.Tick, actorId, targetId, "attack_" + result.Reason));

            if (boss && result.Damage > 0)
            {
                var def = _content.Boss(targetId);
                _bosses[targetId].Damage(def, result.Damage);
                target.Health = _bosses[targetId].Health;
                if (_bosses[targetId].State == BossState.Dead)
                {
                    target.Life = LifeState.Dead;
                    Events.Add(new SimEvent(SimEventKind.Killed, Clock.Tick, actorId, targetId, x: target.X, y: target.Y, z: target.Z));
                    foreach (var mint in Grants.Mint(_content, Bag(actorId), def, WorldId, actorId, () => NextId("item")))
                    {
                        if (mint.Created)
                            Events.Add(new SimEvent(SimEventKind.ItemGranted, Clock.Tick, actorId, arg: mint.InstanceId));
                    }
                    if (def.SealId != null && !Flags.Has(def.SealId))
                    {
                        Flags.Set(def.SealId);
                        Events.Add(new SimEvent(SimEventKind.SealSet, Clock.Tick, actorId, arg: def.SealId));
                    }
                }
            }
            else if (result.Killed)
            {
                Events.Add(new SimEvent(SimEventKind.Killed, Clock.Tick, actorId, targetId, x: target.X, y: target.Y, z: target.Z));
            }
            if (result.Killed && Mode == DeathMode.Adventure && target.DefId == "player")
                Respawn(target);
            return result;
        }

        public void Respawn(ActorBody body)
        {
            body.Life = LifeState.Alive;
            body.Health = body.MaxHealth;
            body.X = body.SpawnX;
            body.Y = body.SpawnY;
            body.Z = body.SpawnZ;
            body.MoveBank = 0f;
            body.Ascent = 0f;
            Events.Add(new SimEvent(SimEventKind.Respawned, Clock.Tick, body.Id, arg: body.SpawnId, x: body.X, y: body.Y, z: body.Z));
        }

        public void RecordHurt(string actorId)
        {
            var body = Actors[actorId];
            _hurt[actorId].Record(Clock.Tick, body.X, body.Z);
        }

        public string NextId(string prefix) => prefix + "_" + (++_seq).ToString("x");

        public CharacterDocument CaptureCharacter(string actorId, string name)
        {
            var body = Actors[actorId];
            var skills = Skills(actorId).Ranks.ToDictionary(p => p.Key.ToString(), p => p.Value);
            return new CharacterDocument
            {
                Schema = 1,
                CharacterId = actorId,
                Name = name,
                Health = body.Health,
                EquippedInstanceId = body.EquippedId,
                Items = Bag(actorId).Items.ToList(),
                Skills = skills
            };
        }

        public WorldDocument CaptureWorld() => new()
        {
            Schema = 1,
            WorldId = WorldId,
            Mode = Mode.ToString().ToLowerInvariant(),
            Seed = Seed,
            Seals = Flags.All.ToList()
        };
    }
}
