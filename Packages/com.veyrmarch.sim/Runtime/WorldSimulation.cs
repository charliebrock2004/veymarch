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
        int _seq;

        public SimClock Clock { get; } = new();
        public DayClock Day { get; } = new();
        public WorldFlags Flags { get; } = new();
        public Dictionary<string, ActorBody> Actors { get; } = new(StringComparer.Ordinal);
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

        public ActorBody SpawnPlayer(string id)
        {
            var body = new ActorBody
            {
                Id = id,
                DefId = "player",
                Health = 80,
                MaxHealth = 80,
                Stamina = 60,
                MaxStamina = 60
            };
            Actors[id] = body;
            _bags[id] = new Inventory();
            _skills[id] = new SkillSheet();
            _hurt[id] = new HurtboxHistory();
            _status[id] = new StatusSheet();
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
            Actors[body.Id] = body;
            _bags[body.Id] = new Inventory();
            _skills[body.Id] = new SkillSheet();
            _hurt[body.Id] = new HurtboxHistory();
            _status[body.Id] = new StatusSheet();
            return body;
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
            Actors[bossId] = body;
            _bags[bossId] = new Inventory();
            _skills[bossId] = new SkillSheet();
            _hurt[bossId] = new HurtboxHistory();
            _status[bossId] = new StatusSheet();
            boss.Begin();
            return boss;
        }

        public BossController Boss(string id) => _bosses[id];

        public void Tick(PlayerIntent intent, string actorId)
        {
            var body = Actors[actorId];
            _hurt[actorId].Record(Clock.Tick, body.X, body.Z);
            if (body.IFrameTicks > 0)
                body.IFrameTicks--;
            if (body.StaggerTicks > 0)
                body.StaggerTicks--;
            if (intent.Dodge && body.Stamina >= DodgeCost(actorId) && body.Life == LifeState.Alive)
            {
                body.Stamina -= DodgeCost(actorId);
                body.IFrameTicks = SimRates.DodgeIFrameTicks;
            }
            if (body.Life == LifeState.Alive)
            {
                float scale = _status.TryGetValue(actorId, out var sheet) ? sheet.MoveScale : 1f;
                if (_content.Sets.TryGetValue("set_hunter", out var hunter) && ArmourSets.Worn(hunter, body, Bag(actorId)) >= 2)
                    scale *= 1.05f;
                Movement.Step(body, intent, _content.Move, scale);
            }
            if (intent.Block && body.Life == LifeState.Alive)
            {
                if (!body.Blocking)
                    body.BlockStartedTick = Clock.Tick;
                body.Blocking = true;
            }
            else
            {
                body.Blocking = false;
            }

            if (body.Stamina < body.MaxStamina)
                body.Stamina = Math.Min(body.MaxStamina, body.Stamina + 0.4f);
            if (_status.TryGetValue(actorId, out var statuses))
                statuses.Tick(body, _content.Statuses);
            Clock.Advance();
            Day.AdvanceTicks(1);
        }

        public MoveResult TryMove(string actorId, PlayerIntent intent)
        {
            var body = Actors[actorId];
            var result = Movement.Step(body, intent, _content.Move);
            _hurt[actorId].Record(Clock.Tick, body.X, body.Z);
            Clock.Advance();
            return result;
        }

        public GatherResult TryGather(string actorId, string nodeId)
        {
            var node = _content.Node(nodeId);
            var result = Gathering.TryGather(_content, Bag(actorId), Actors[actorId], node, Flags, actorId, () => NextId("item"));
            if (result.Ok)
                Skills(actorId).Practise(node.Practice);
            return result;
        }

        public CraftResult TryCraft(string actorId, string recipeId, StationId station, string key)
        {
            var recipe = _content.Recipe(recipeId);
            int rank = Skills(actorId).Rank(recipe.Skill);
            var result = Crafting.TryCraft(_content, Bag(actorId), actorId, recipeId, station, rank, key, () => NextId("item"));
            if (result.Ok && result.Reason != "replay")
                Skills(actorId).Practise(recipe.Skill == SkillId.None ? SkillId.Blacksmithing : recipe.Skill);
            return result;
        }

        public bool TryEquip(string actorId, string instanceId)
        {
            var inst = Bag(actorId).Find(instanceId);
            if (inst == null)
                return false;
            var def = _content.Item(inst.DefId);
            var body = Actors[actorId];
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

        public AttackResult TryAttack(string actorId, string targetId, bool heavy, bool flank, long? clientTick = null)
        {
            var attacker = Actors[actorId];
            var target = Actors[targetId];
            long tick = clientTick ?? Clock.Tick;
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
            if (boss && result.Damage > 0)
            {
                var def = _content.Boss(targetId);
                _bosses[targetId].Damage(def, result.Damage);
                target.Health = _bosses[targetId].Health;
                if (_bosses[targetId].State == BossState.Dead)
                {
                    target.Life = LifeState.Dead;
                    Grants.Mint(_content, Bag(actorId), def, WorldId, actorId, () => NextId("item"));
                    if (def.SealId != null)
                        Flags.Set(def.SealId);
                }
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
            body.Z = body.SpawnZ;
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
