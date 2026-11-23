#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Veyr.Content;

namespace Veyr.Sim
{
    public static class DurabilityRules
    {
        public static bool IsBroken(ItemInstance? inst, ItemDef def, DeathMode mode)
        {
            if (inst == null || def.DurabilityMax <= 0)
                return false;
            if (mode is not (DeathMode.Survival or DeathMode.Hardcore))
                return false;
            if (def.Rarity == Rarity.Unique)
                return false;
            return inst.Durability <= 0;
        }

        public static void Chip(ItemInstance inst, ItemDef def, DeathMode mode)
        {
            if (def.DurabilityMax <= 0)
                return;
            if (mode is not (DeathMode.Survival or DeathMode.Hardcore))
                return;
            if (inst.Durability > 0)
                inst.Durability--;
        }

        public static float Scale(ItemInstance? inst, ItemDef def)
        {
            if (inst == null || def.Rarity != Rarity.Unique || def.DurabilityMax <= 0)
                return 1f;
            return inst.Durability <= 0 ? 0.9f : 1f;
        }
    }

    public static class MaterialVerbs
    {
        public static int LightningMana(int cost, bool copperTrinket)
        {
            if (!copperTrinket)
                return cost;
            return Math.Max(1, (int)MathF.Round(cost * 0.85f));
        }

        public static bool CookieConfuse(ulong seed, bool humanoid) =>
            humanoid && seed % 10 == 0;

        public static float SunstoneScale(bool daylight) => daylight ? 1.15f : 1f;

        public static float AbyssalScale(bool underwater, bool desertNoon)
        {
            if (underwater)
                return 1.15f;
            return desertNoon ? 0.85f : 1f;
        }

        public static int CombatRankSum(SkillSheet skills)
        {
            int sum = 0;
            sum += skills.Rank(SkillId.Sword);
            sum += skills.Rank(SkillId.Greatsword);
            sum += skills.Rank(SkillId.Axe);
            sum += skills.Rank(SkillId.Hammer);
            sum += skills.Rank(SkillId.Spear);
            sum += skills.Rank(SkillId.Dagger);
            sum += skills.Rank(SkillId.Archery);
            sum += skills.Rank(SkillId.Defence);
            sum += skills.Rank(SkillId.Magic);
            return sum;
        }

        public static float SoftTax(int combatRankSum) =>
            combatRankSum <= 24 ? 1f : 1f / (1f + 0.05f * (combatRankSum - 24));
    }

    public sealed class StatusSheet
    {
        readonly Dictionary<StatusId, int> _build = new Dictionary<StatusId, int>();
        readonly Dictionary<StatusId, int> _left = new Dictionary<StatusId, int>();

        public bool Silenced { get; private set; }
        public float MoveScale { get; private set; } = 1f;

        public bool IsActive(StatusId id) => _left.TryGetValue(id, out var ticks) && ticks > 0;

        public bool Apply(StatusDef def, int amount)
        {
            if (def.Id == StatusId.None || IsActive(def.Id))
                return false;
            _build.TryGetValue(def.Id, out var built);
            built += amount;
            if (built < def.BuildupMax)
            {
                _build[def.Id] = built;
                return false;
            }

            _build[def.Id] = 0;
            _left[def.Id] = def.DurationTicks;
            return true;
        }

        public void Tick(ActorBody body, IReadOnlyDictionary<StatusId, StatusDef> defs)
        {
            Silenced = false;
            MoveScale = 1f;
            foreach (var id in _left.Keys.ToList())
            {
                if (!defs.TryGetValue(id, out var def))
                    continue;
                if (def.DamagePerTick > 0 && body.Life == LifeState.Alive)
                {
                    body.Health -= def.DamagePerTick;
                    if (body.Health <= 0)
                    {
                        body.Health = 0;
                        body.Life = LifeState.Dead;
                    }
                }

                MoveScale = MathF.Min(MoveScale, def.MoveScale);
                if (def.Silences)
                    Silenced = true;
                int left = _left[id] - 1;
                if (left <= 0)
                    _left.Remove(id);
                else
                    _left[id] = left;
            }
        }

        public int Cleanse(CleanseSource source, IReadOnlyDictionary<StatusId, StatusDef> defs)
        {
            int removed = 0;
            foreach (var id in _left.Keys.ToList())
            {
                if (!defs.TryGetValue(id, out var def))
                    continue;
                if (!def.CleansedBy.Contains(source))
                    continue;
                _left.Remove(id);
                removed++;
            }

            if (removed > 0)
            {
                Silenced = false;
                MoveScale = 1f;
            }

            return removed;
        }
    }

    public enum AiPose
    {
        Idle,
        Telegraph,
        Strike,
        Recover,
        Stagger,
        Dead
    }

    public sealed class EnemyBrain
    {
        public AiPose Pose { get; private set; } = AiPose.Idle;
        public int TicksInPose { get; private set; }
        public bool StrikeThisTick { get; private set; }

        public void Tick(ActorBody self, ActorBody target, VerbProfile profile)
        {
            StrikeThisTick = false;
            if (self.Life == LifeState.Dead)
            {
                Pose = AiPose.Dead;
                return;
            }

            if (self.StaggerTicks > 0)
            {
                Pose = AiPose.Stagger;
                TicksInPose = 0;
                return;
            }

            float dx = target.X - self.X;
            float dz = target.Z - self.Z;
            float dist = MathF.Sqrt(dx * dx + dz * dz);
            switch (Pose)
            {
                case AiPose.Idle:
                case AiPose.Stagger:
                    if (dist <= profile.Range)
                    {
                        Pose = AiPose.Telegraph;
                        TicksInPose = 0;
                    }
                    break;
                case AiPose.Telegraph:
                    TicksInPose++;
                    if (TicksInPose >= profile.TelegraphTicks)
                    {
                        Pose = AiPose.Strike;
                        StrikeThisTick = true;
                        TicksInPose = 0;
                    }
                    break;
                case AiPose.Strike:
                    Pose = AiPose.Recover;
                    TicksInPose = 0;
                    break;
                case AiPose.Recover:
                    TicksInPose++;
                    if (TicksInPose >= profile.RecoverTicks)
                    {
                        Pose = AiPose.Idle;
                        TicksInPose = 0;
                    }
                    break;
            }
        }
    }

    public static class Ecology
    {
        public static bool WolfFleesBear(ActorBody wolf, ActorBody bear, float radius = 8f)
        {
            float dx = wolf.X - bear.X;
            float dz = wolf.Z - bear.Z;
            float dist = MathF.Sqrt(dx * dx + dz * dz);
            if (dist > radius || dist < 0.001f)
                return false;
            float step = 0.4f / dist;
            wolf.X += dx * step;
            wolf.Z += dz * step;
            return true;
        }
    }

    public static class AiBudget
    {
        public const int HostileCap = 15;

        public static int Admit(int active, int requested) =>
            Math.Min(requested, Math.Max(0, HostileCap - active));
    }

    public sealed class RareClock
    {
        public const int CooldownTicks = 20 * 60 * 20;
        readonly Dictionary<string, long> _next = new(StringComparer.Ordinal);

        public bool TrySpawn(string id, long tick)
        {
            if (_next.TryGetValue(id, out var at) && tick < at)
                return false;
            _next[id] = tick + CooldownTicks;
            return true;
        }
    }

    public static class LootRoll
    {
        public static List<string> Roll(LootTableDef table, ulong seed, ICollection<string> alreadyOwned)
        {
            var result = new List<string>();
            foreach (var entry in table.Entries)
            {
                if (!entry.Guaranteed)
                    continue;
                if (entry.Unique && alreadyOwned.Contains(entry.ItemId))
                    continue;
                result.Add(entry.ItemId);
            }

            int weight = 0;
            foreach (var entry in table.Entries)
            {
                if (!entry.Guaranteed)
                    weight += entry.Weight;
            }

            if (weight <= 0)
                return result;

            ulong state = seed == 0 ? 1 : seed;
            state ^= state << 13;
            state ^= state >> 7;
            state ^= state << 17;
            int pick = (int)(state % (ulong)weight);
            int acc = 0;
            foreach (var entry in table.Entries)
            {
                if (entry.Guaranteed)
                    continue;
                acc += entry.Weight;
                if (pick >= acc)
                    continue;
                if (!(entry.Unique && alreadyOwned.Contains(entry.ItemId)))
                    result.Add(entry.ItemId);
                break;
            }

            return result;
        }
    }

    public sealed class PlacedRoom
    {
        public string Id { get; init; } = "";
        public RoomKind Kind { get; init; }
        public int TellTicks { get; init; }
        public int TrapDamage { get; init; }
        public List<int> Links { get; } = new List<int>();
    }

    public static class DungeonLayout
    {
        public static IReadOnlyList<PlacedRoom> Build(DungeonKitDef kit, ulong seed, Func<string, bool>? schoolAllowed = null)
        {
            var pool = kit.Rooms.Where(r => r.RequiredSchool.Length == 0 || (schoolAllowed != null && schoolAllowed(r.RequiredSchool))).ToList();
            var entrance = pool.First(r => r.Kind == RoomKind.Entrance);
            var boss = pool.First(r => r.Kind == RoomKind.Boss);
            var middle = pool.Where(r => r.Kind is not (RoomKind.Entrance or RoomKind.Boss)).ToList();
            ulong state = seed == 0 ? 1UL : seed;
            int span = Math.Max(1, kit.MaxRooms - kit.MinRooms + 1);
            state = Mix(state);
            int count = kit.MinRooms + (int)(state % (ulong)span);
            count = Math.Clamp(count, kit.MinRooms, kit.MaxRooms);

            var chosen = new List<RoomKitDef> { entrance };
            var trap = middle.FirstOrDefault(r => r.Kind == RoomKind.Trap);
            var secret = middle.FirstOrDefault(r => r.Kind == RoomKind.Secret);
            var puzzle = middle.FirstOrDefault(r => r.Kind == RoomKind.Puzzle);
            if (trap != null)
                chosen.Add(trap);
            if (puzzle != null)
                chosen.Add(puzzle);
            if (secret != null)
                chosen.Add(secret);
            int guard = 0;
            while (chosen.Count < count - 1 && middle.Count > 0 && guard < 40)
            {
                guard++;
                state = Mix(state);
                chosen.Add(middle[(int)(state % (ulong)middle.Count)]);
            }

            chosen.Add(boss);
            var rooms = chosen.Select(ToRoom).ToList();
            for (int i = 0; i < rooms.Count - 1; i++)
                Link(rooms, i, i + 1);
            if (rooms.Count >= 6)
                Link(rooms, 1, rooms.Count - 3);
            return rooms;
        }

        static PlacedRoom ToRoom(RoomKitDef def) => new()
        {
            Id = def.Id,
            Kind = def.Kind,
            TellTicks = def.TellTicks,
            TrapDamage = def.TrapDamage
        };

        static void Link(List<PlacedRoom> rooms, int a, int b)
        {
            if (a == b || a < 0 || b < 0 || a >= rooms.Count || b >= rooms.Count)
                return;
            if (!rooms[a].Links.Contains(b))
                rooms[a].Links.Add(b);
            if (!rooms[b].Links.Contains(a))
                rooms[b].Links.Add(a);
        }

        static ulong Mix(ulong x)
        {
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
            return x;
        }
    }

    public sealed class DungeonRun
    {
        readonly IReadOnlyList<PlacedRoom> _rooms;
        int _tell;
        bool _trapSpent;

        public DungeonRun(IReadOnlyList<PlacedRoom> rooms) => _rooms = rooms;

        public int Room { get; private set; }
        public bool WeightDown { get; private set; }
        public bool DoorOpen { get; private set; }
        public bool SecretFound { get; private set; }
        public int TellLeft => _tell;

        public PlacedRoom Current => _rooms[Room];

        public bool TryMove(int index)
        {
            if (index < 0 || index >= _rooms.Count)
                return false;
            if (index != Room && !_rooms[Room].Links.Contains(index))
                return false;
            if (_rooms[index].Kind == RoomKind.Boss && !DoorOpen && HasPuzzle())
                return false;
            Room = index;
            _tell = Current.Kind == RoomKind.Trap ? Math.Max(Current.TellTicks, 1) : 0;
            _trapSpent = false;
            if (Current.Kind == RoomKind.Secret)
                SecretFound = true;
            return true;
        }

        public int TickTrap(ActorBody body)
        {
            if (Current.Kind != RoomKind.Trap || _trapSpent)
                return 0;
            if (_tell > 0)
            {
                _tell--;
                return 0;
            }

            _trapSpent = true;
            body.Health -= Current.TrapDamage;
            if (body.Health <= 0)
            {
                body.Health = 0;
                body.Life = LifeState.Dead;
            }

            return Current.TrapDamage;
        }

        public void PlaceWeight()
        {
            if (Current.Kind != RoomKind.Puzzle)
                return;
            WeightDown = true;
            DoorOpen = true;
        }

        bool HasPuzzle()
        {
            foreach (var room in _rooms)
            {
                if (room.Kind == RoomKind.Puzzle)
                    return true;
            }
            return false;
        }
    }

    public static class MagicRules
    {
        public static SchoolId DisciplineOf(SpellDef spell)
        {
            if (spell.Discipline != SchoolId.None)
                return spell.Discipline;
            return spell.School switch
            {
                Element.Fire => SchoolId.Fire,
                Element.Ice => SchoolId.Ice,
                Element.Lightning => SchoolId.Lightning,
                Element.Earth => SchoolId.Earth,
                Element.Holy => SchoolId.Holy,
                Element.Shadow => SchoolId.Shadow,
                _ => SchoolId.None
            };
        }

        public static string Gate(SpellDef spell, int magicRank, int corruption, bool sealOpen, bool silenced)
        {
            if (silenced)
                return "silence";
            if (magicRank < spell.MinMagicRank)
                return "rank";
            if (spell.RequiredSeal.Length > 0 && !sealOpen)
                return "seal";
            if (spell.Grade == "rite" && corruption >= 100)
                return "backfire";
            return "";
        }

        public static int ManaCost(SpellDef spell, bool copperTrinket) =>
            MaterialVerbs.LightningMana(spell.ManaCost, copperTrinket && DisciplineOf(spell) == SchoolId.Lightning);
    }

    public sealed class CorruptionMeter
    {
        public int Value { get; private set; }
        public bool ShopTax => Value > 50;
        public bool HauntReady => Value >= 80;
        public bool BackfireReady => Value >= 100;

        public void Add(int amount) => Value = Math.Clamp(Value + amount, 0, 100);

        public int Price(int basePrice) => ShopTax ? (int)MathF.Ceiling(basePrice * 1.25f) : basePrice;

        public int ApplyBackfire(ActorBody body)
        {
            if (!BackfireReady)
                return 0;
            const int damage = 20;
            body.Health = Math.Max(0, body.Health - damage);
            Value = 80;
            return damage;
        }
    }

    public readonly struct ClientEnvelope
    {
        public ClientEnvelope(int protocol, string type, string actorId)
        {
            Protocol = protocol;
            Type = type;
            ActorId = actorId;
        }

        public int Protocol { get; }
        public string Type { get; }
        public string ActorId { get; }
    }

    public readonly struct ReconnectSpot
    {
        public ReconnectSpot(float x, float z, string where)
        {
            X = x;
            Z = z;
            Where = where;
        }

        public float X { get; }
        public float Z { get; }
        public string Where { get; }
    }

    public static class NetSession
    {
        public const int ReconnectTicks = SimRates.TicksPerSecond * 90;

        public static string Reject(ClientEnvelope envelope)
        {
            if (envelope.Protocol != SimRates.ProtocolVersion)
                return "protocol";
            if (!Authority.ClientMaySend(envelope.Type))
                return "authority";
            return "";
        }

        public static ReconnectSpot Reconnect(bool withinWindow, float x, float z, float shrineX, float shrineZ) =>
            withinWindow
                ? new ReconnectSpot(x, z, "restore")
                : new ReconnectSpot(shrineX, shrineZ, "shrine");

        public static bool LateJoinerGetsUnique(bool presentAtKill) => presentAtKill;

        public static List<string> Visible(IEnumerable<(string Id, float Distance)> actors)
        {
            var ids = new List<string>();
            foreach (var actor in actors)
            {
                if (Authority.Relevant(actor.Distance))
                    ids.Add(actor.Id);
            }
            return ids;
        }
    }

    public sealed class DialogueSession
    {
        readonly string[] _keys;

        public DialogueSession(string npcId, IReadOnlyList<string> keys)
        {
            NpcId = npcId;
            _keys = keys.ToArray();
        }

        public string NpcId { get; }
        public int Index { get; private set; }
        public bool Done => _keys.Length == 0 || Index >= _keys.Length - 1;
        public string CurrentKey => _keys.Length == 0 ? "" : _keys[Math.Min(Index, _keys.Length - 1)];

        public bool Advance()
        {
            if (Done)
                return false;
            Index++;
            return true;
        }
    }

    public sealed class CorpseMarker
    {
        public string Id { get; init; } = "";
        public float X { get; init; }
        public float Z { get; init; }
        public long ExpireTick { get; init; }
        public List<ItemInstance> Items { get; init; } = new List<ItemInstance>();
    }

    public static class CorpseRules
    {
        public const int LifetimeTicks = SimRates.TicksPerSecond * 60 * 10;

        public static CorpseMarker Create(string id, float x, float z, long tick, IReadOnlyList<ItemInstance> dropped) => new()
        {
            Id = id,
            X = x,
            Z = z,
            ExpireTick = tick + LifetimeTicks,
            Items = dropped.ToList()
        };

        public static bool Expired(CorpseMarker corpse, long tick) => tick >= corpse.ExpireTick;
    }

    public sealed class TrustLedger
    {
        readonly Dictionary<string, int> _score = new(StringComparer.Ordinal);

        public int Get(string npc) => _score.TryGetValue(npc, out var value) ? value : 0;

        public void Note(string npc, int delta) => _score[npc] = Math.Clamp(Get(npc) + delta, -2, 3);

        public int JobSlots(string npc) => Get(npc) >= 1 ? 3 : 0;
    }

    public static class ArmourSets
    {
        public static int Worn(ArmourSetDef set, ActorBody body, Inventory bag)
        {
            var worn = new HashSet<string>(StringComparer.Ordinal);
            foreach (var id in Equipment.SlotInstances(body))
            {
                if (id.Length == 0)
                    continue;
                var inst = bag.Find(id);
                if (inst != null)
                    worn.Add(inst.DefId);
            }

            int count = 0;
            foreach (var piece in set.PieceIds)
            {
                if (worn.Contains(piece))
                    count++;
            }
            return count;
        }

        public static string Active(ArmourSetDef set, int worn)
        {
            if (worn >= 4 && set.BonusFour.Length > 0)
                return set.BonusFour;
            if (worn >= 2)
                return set.BonusTwo;
            return "";
        }
    }

    public static class Equipment
    {
        public static IEnumerable<string> SlotInstances(ActorBody body)
        {
            yield return body.EquippedId;
            yield return body.OffHandId;
            yield return body.HeadId;
            yield return body.ChestId;
            yield return body.HandsId;
            yield return body.LegsId;
            yield return body.CloakId;
            yield return body.TrinketId;
        }

        public static int Defence(ContentCatalog content, ActorBody body, Inventory bag)
        {
            int sum = 0;
            foreach (var id in SlotInstances(body))
            {
                if (id.Length == 0)
                    continue;
                var inst = bag.Find(id);
                if (inst == null)
                    continue;
                sum += content.Item(inst.DefId).Defence;
            }
            return sum;
        }

        public static bool Wears(ActorBody body, Inventory bag, string defId)
        {
            foreach (var id in SlotInstances(body))
            {
                var inst = id.Length == 0 ? null : bag.Find(id);
                if (inst != null && inst.DefId == defId)
                    return true;
            }
            return false;
        }
    }

    public static class Consumables
    {
        public static string TryUse(ItemDef def, ActorBody body, Inventory bag)
        {
            if (def.Kind != ItemKind.Consumable || def.Heal <= 0)
                return "item";
            if (!bag.TryConsume(def.Id, 1))
                return "missing";
            body.Health = MathF.Min(body.MaxHealth, body.Health + def.Heal);
            return "";
        }
    }

    public static class ContentRules
    {
        public static List<string> Audit(ContentCatalog content)
        {
            var problems = new List<string>();
            foreach (var recipe in content.Recipes.Values)
            {
                if (!content.Items.ContainsKey(recipe.OutputItemId))
                    problems.Add("recipe output " + recipe.Id);
                foreach (var input in recipe.Inputs)
                {
                    if (!content.Items.ContainsKey(input.ItemId))
                        problems.Add("recipe input " + recipe.Id + " " + input.ItemId);
                }
            }

            foreach (var node in content.Nodes.Values)
            {
                if (!content.Items.ContainsKey(node.YieldItemId))
                    problems.Add("node yield " + node.Id);
            }

            foreach (var boss in content.Bosses.Values)
            {
                foreach (var reward in boss.RewardItemIds)
                {
                    if (!content.Items.ContainsKey(reward))
                        problems.Add("boss reward " + boss.Id + " " + reward);
                }
            }

            foreach (var quest in content.Quests)
            {
                foreach (var step in quest.Steps)
                {
                    if (step.Kind == "possess" && !content.Items.ContainsKey(step.Arg))
                        problems.Add("quest item " + quest.Id);
                    if (step.Kind == "boss" && !content.Bosses.ContainsKey(step.Arg))
                        problems.Add("quest boss " + quest.Id);
                    if (step.Kind == "talk" && step.Arg.StartsWith("npc_", StringComparison.Ordinal) && content.Npcs.All(n => n.Id != step.Arg))
                        problems.Add("quest npc " + quest.Id);
                    if (step.Kind == "talk" && !step.Arg.StartsWith("npc_", StringComparison.Ordinal) && !content.Lines.ContainsKey(step.Arg))
                        problems.Add("quest line " + quest.Id);
                }
            }

            foreach (var actor in content.Actors.Values)
            {
                var profile = VerbTuning.For(actor.Verb);
                if (!VerbTuning.WindupLegal(actor.Damage, profile.TelegraphTicks))
                    problems.Add("windup " + actor.Id);
            }

            foreach (var kit in content.Dungeons.Values)
            {
                if (kit.MinRooms < 6 || kit.MaxRooms > 28 || kit.MinRooms > kit.MaxRooms)
                    problems.Add("dungeon size " + kit.Id);
                if (kit.Rooms.All(r => r.Kind != RoomKind.Entrance) || kit.Rooms.All(r => r.Kind != RoomKind.Boss))
                    problems.Add("dungeon ends " + kit.Id);
            }

            if (SliceBuild.Ships("Kingdom") || SliceBuild.Ships("Harrenvale"))
                problems.Add("kingdom scene in slice build");
            return problems;
        }

        public static string Fingerprint(ContentCatalog content)
        {
            var lines = new List<string>();
            void Add(string prefix, IEnumerable<string> ids)
            {
                foreach (var id in ids.OrderBy(id => id, StringComparer.Ordinal))
                    lines.Add(prefix + id);
            }

            Add("item:", content.Items.Keys);
            Add("recipe:", content.Recipes.Keys);
            Add("node:", content.Nodes.Keys);
            Add("actor:", content.Actors.Keys);
            Add("boss:", content.Bosses.Keys);
            Add("spell:", content.Spells.Keys);
            Add("quest:", content.Quests.Select(q => q.Id));
            Add("status:", content.Statuses.Keys.Select(id => id.ToString()));
            Add("loot:", content.Loot.Keys);
            Add("set:", content.Sets.Keys);
            Add("dungeon:", content.Dungeons.Keys);
            return Hex.Sha256(string.Join("\n", lines));
        }
    }

    /// <summary>
    /// Per-device settings. Kept on the phone, never on the cloud character. Accessibility
    /// options come from design bible §33 and architecture §39.
    /// </summary>
    public sealed class LocalSettings
    {
        public const int CurrentSchema = 1;
        public int Schema { get; set; } = CurrentSchema;
        public bool Haptics { get; set; } = true;
        public bool ColourblindShapes { get; set; } = true;
        /// <summary>Low, Medium, High, or Auto to pick by device.</summary>
        public string Quality { get; set; } = "Auto";
        public bool Subtitles { get; set; } = true;
        public float TextScale { get; set; } = 1f;
        public float UiScale { get; set; } = 1f;
        public bool SprintToggle { get; set; }
        public bool BlockToggle { get; set; }
        public bool DodgeFlick { get; set; } = true;
        public float LookSensitivity { get; set; } = 1f;
        public bool InvertLook { get; set; }
        public bool CameraShake { get; set; } = true;
        public bool ReduceFlash { get; set; }
        public bool LockOnAssist { get; set; } = true;
        /// <summary>Boss tell window scale for accessibility. Clamped to 1–1.25 (architecture §39).</summary>
        public float TellWindowScale { get; set; } = 1f;
        /// <summary>Combat cluster offset in reference pixels, for one-handed play.</summary>
        public float ControlOffsetX { get; set; }
        public float ControlOffsetY { get; set; }
        public bool ShowFrameOverlay { get; set; } = true;

        public void Clamp()
        {
            TextScale = Math.Clamp(TextScale, 0.8f, 1.6f);
            UiScale = Math.Clamp(UiScale, 0.8f, 1.4f);
            LookSensitivity = Math.Clamp(LookSensitivity, 0.2f, 3f);
            TellWindowScale = Math.Clamp(TellWindowScale, 1f, 1.25f);
            ControlOffsetX = Math.Clamp(ControlOffsetX, -300f, 300f);
            ControlOffsetY = Math.Clamp(ControlOffsetY, -300f, 300f);
            if (Quality != "Low" && Quality != "Medium" && Quality != "High")
                Quality = "Auto";
        }

        public string ToJson() =>
            new JsonWriter().BeginObject()
                .Field("Schema", Schema)
                .Field("Haptics", Haptics)
                .Field("ColourblindShapes", ColourblindShapes)
                .Field("Quality", Quality)
                .Field("Subtitles", Subtitles)
                .Field("TextScale", TextScale)
                .Field("UiScale", UiScale)
                .Field("SprintToggle", SprintToggle)
                .Field("BlockToggle", BlockToggle)
                .Field("DodgeFlick", DodgeFlick)
                .Field("LookSensitivity", LookSensitivity)
                .Field("InvertLook", InvertLook)
                .Field("CameraShake", CameraShake)
                .Field("ReduceFlash", ReduceFlash)
                .Field("LockOnAssist", LockOnAssist)
                .Field("TellWindowScale", TellWindowScale)
                .Field("ControlOffsetX", ControlOffsetX)
                .Field("ControlOffsetY", ControlOffsetY)
                .Field("ShowFrameOverlay", ShowFrameOverlay)
                .EndObject().ToString();

        public static LocalSettings FromJson(string text)
        {
            var node = JsonNode.Parse(text);
            var settings = new LocalSettings
            {
                Schema = node["Schema"].AsInt(),
                Haptics = node.Bool("Haptics", true),
                ColourblindShapes = node.Bool("ColourblindShapes", true),
                Quality = node.Str("Quality", "Auto"),
                Subtitles = node.Bool("Subtitles", true),
                TextScale = node.Float("TextScale", 1f),
                UiScale = node.Float("UiScale", 1f),
                SprintToggle = node.Bool("SprintToggle"),
                BlockToggle = node.Bool("BlockToggle"),
                DodgeFlick = node.Bool("DodgeFlick", true),
                LookSensitivity = node.Float("LookSensitivity", 1f),
                InvertLook = node.Bool("InvertLook"),
                CameraShake = node.Bool("CameraShake", true),
                ReduceFlash = node.Bool("ReduceFlash"),
                LockOnAssist = node.Bool("LockOnAssist", true),
                TellWindowScale = node.Float("TellWindowScale", 1f),
                ControlOffsetX = node.Float("ControlOffsetX"),
                ControlOffsetY = node.Float("ControlOffsetY"),
                ShowFrameOverlay = node.Bool("ShowFrameOverlay", true)
            };
            settings.Clamp();
            return settings;
        }
    }

    public static class SettingsStore
    {
        public static void Write(string path, LocalSettings settings) =>
            AtomicStore.Write(path, settings.ToJson());

        public static LocalSettings Read(string path)
        {
            var settings = LocalSettings.FromJson(AtomicStore.ReadBody(path));
            if (settings.Schema != LocalSettings.CurrentSchema)
                throw new InvalidDataException("schema");
            return settings;
        }
    }
}
