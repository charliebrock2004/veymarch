#nullable enable
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Veyr.Content;

namespace Veyr.Sim
{
    public sealed class DayClock
    {
        public float RealSeconds { get; private set; }

        public float Hour => (RealSeconds % SimRates.RealSecondsPerDay) / SimRates.RealSecondsPerDay * 24f;

        public bool IsNight => Hour >= SimRates.NightStartsHour;

        public void AdvanceRealSeconds(float seconds) => RealSeconds += seconds;

        public void AdvanceTicks(int ticks) => AdvanceRealSeconds(ticks / (float)SimRates.TicksPerSecond);
    }

    public static class Schedules
    {
        public static string StationAt(NpcSchedule schedule, float hour)
        {
            foreach (var entry in schedule.Entries)
            {
                if (entry.StartHour <= entry.EndHour)
                {
                    if (hour >= entry.StartHour && hour < entry.EndHour)
                        return entry.StationId;
                }
                else if (hour >= entry.StartHour || hour < entry.EndHour)
                {
                    return entry.StationId;
                }
            }
            return schedule.Entries.Length == 0 ? "" : schedule.Entries[^1].StationId;
        }
    }

    public enum QuestState
    {
        Inactive,
        Active,
        Complete,
        Failed
    }

    public sealed class QuestProgress
    {
        public string QuestId { get; init; } = "";
        public QuestState State { get; set; } = QuestState.Active;
        public int Step { get; set; }
    }

    public static class Quests
    {
        public static void Advance(QuestProgress progress, QuestDef def, string kind, string arg)
        {
            if (progress.State != QuestState.Active)
                return;
            if (progress.Step >= def.Steps.Length)
            {
                progress.State = QuestState.Complete;
                return;
            }
            var step = def.Steps[progress.Step];
            if (step.Kind == kind && step.Arg == arg)
            {
                progress.Step++;
                if (progress.Step >= def.Steps.Length)
                    progress.State = QuestState.Complete;
            }
        }
    }

    public readonly struct DeathSplit
    {
        public DeathSplit(bool keep, string reason)
        {
            Keep = keep;
            Reason = reason;
        }

        public bool Keep { get; }
        public string Reason { get; }
    }

    public static class DeathRules
    {
        public static DeathSplit OnItem(DeathMode mode, bool soulbound, bool equipped) => mode switch
        {
            DeathMode.Adventure => new DeathSplit(true, "adventure"),
            DeathMode.Hardcore => new DeathSplit(false, "hardcore"),
            DeathMode.Survival when soulbound || equipped => new DeathSplit(true, "kept"),
            DeathMode.Survival => new DeathSplit(false, "dropped"),
            _ => new DeathSplit(true, "custom")
        };

        public static List<ItemInstance> DropCarried(Inventory bag, DeathMode mode)
        {
            var dropped = new List<ItemInstance>();
            foreach (var item in bag.Items.ToList())
            {
                if (DeathRules.OnItem(mode, item.Soulbound, item.Equipped).Keep)
                    continue;
                dropped.Add(item);
                bag.RemoveInstance(item.InstanceId);
            }
            return dropped;
        }

        public static bool TickDowned(ActorBody body)
        {
            if (body.Life != LifeState.Downed)
                return false;
            body.DownedTicks++;
            if (body.DownedTicks < SimRates.DownedTicks)
                return false;
            body.Life = LifeState.Dead;
            return true;
        }

        public static bool CharacterDeleted(DeathMode mode) => mode == DeathMode.Hardcore;
    }

    public sealed class EffectPatch
    {
        public string Id { get; init; } = "";
        public int TicksLeft { get; set; }
    }

    public sealed class Caster
    {
        public float Mana { get; private set; }
        public float MaxMana { get; private set; }
        public int Cooldown { get; private set; }
        public List<EffectPatch> Patches { get; } = new List<EffectPatch>();

        public void Awaken(float maxMana)
        {
            MaxMana = maxMana;
            Mana = maxMana;
        }

        public void Tick()
        {
            if (Cooldown > 0)
                Cooldown--;
            for (int i = Patches.Count - 1; i >= 0; i--)
            {
                Patches[i].TicksLeft--;
                if (Patches[i].TicksLeft <= 0)
                    Patches.RemoveAt(i);
            }
        }

        public string TryCast(SpellDef spell, Func<string> nextId)
        {
            if (Mana < spell.ManaCost)
                return "mana";
            if (Cooldown > 0)
                return "cooldown";
            if (Patches.Count >= spell.CapPerCaster)
                return "cap";
            Mana -= spell.ManaCost;
            Cooldown = spell.CooldownTicks;
            Patches.Add(new EffectPatch { Id = nextId(), TicksLeft = spell.TtlTicks });
            return "";
        }
    }

    public sealed class PlacedPiece
    {
        public string Id { get; init; } = "";
        public string PieceId { get; init; } = "";
        public string Owner { get; init; } = "";
        public int X { get; init; }
        public int Z { get; init; }
    }

    public readonly struct PlaceResult
    {
        public PlaceResult(bool ok, string reason, string pieceInstanceId)
        {
            Ok = ok;
            Reason = reason;
            PieceInstanceId = pieceInstanceId;
        }

        public bool Ok { get; }
        public string Reason { get; }
        public string PieceInstanceId { get; }
    }

    public sealed class BuildPlot
    {
        readonly List<PlacedPiece> _pieces = new List<PlacedPiece>();
        readonly List<PlacedPiece> _undo = new List<PlacedPiece>();

        public IReadOnlyList<PlacedPiece> Pieces => _pieces;

        public PlaceResult TryPlace(PieceDef def, Inventory inventory, string owner, int x, int z, int anchors, Func<string> nextId)
        {
            if (_pieces.Any(p => p.X == x && p.Z == z))
                return new PlaceResult(false, "overlap", "");
            if (def.Bridge && anchors < def.AnchorCount)
                return new PlaceResult(false, "anchors", "");
            if (def.CostCount > 0 && inventory.CountOf(def.CostItemId) < def.CostCount)
                return new PlaceResult(false, "cost", "");
            if (def.CostCount > 0 && !inventory.TryConsume(def.CostItemId, def.CostCount))
                return new PlaceResult(false, "cost", "");
            var placed = new PlacedPiece { Id = nextId(), PieceId = def.Id, Owner = owner, X = x, Z = z };
            _pieces.Add(placed);
            _undo.Add(placed);
            if (_undo.Count > 10)
                _undo.RemoveAt(0);
            return new PlaceResult(true, "", placed.Id);
        }

        public bool TryUndo(ContentCatalog content, Inventory inventory, string owner, Func<string> nextId)
        {
            if (_undo.Count == 0)
                return false;
            var last = _undo[^1];
            _undo.RemoveAt(_undo.Count - 1);
            _pieces.RemoveAll(p => p.Id == last.Id);
            var def = content.Pieces[last.PieceId];
            if (def.CostCount > 0)
                inventory.Add(content.Item(def.CostItemId), def.CostCount, owner, nextId());
            return true;
        }
    }

    public sealed class SettlementState
    {
        public int Beds { get; set; }
        public bool Well { get; set; }
        public bool Bench { get; set; }
        public bool Palisade { get; set; }
        public int Food { get; set; }
        public int Population { get; set; }
        public int Happiness { get; set; }
        public bool Smith { get; set; }
        public bool Shrine { get; set; }
        public bool Warehouse { get; set; }
        public bool Walls { get; set; }
        public bool Hall { get; set; }
        public bool Barracks { get; set; }
        public bool Market { get; set; }
    }

    public static class Settlements
    {
        public static int Tier(SettlementState state, IReadOnlyList<SettlementTierDef> tiers)
        {
            int tier = 0;
            var village = tiers.First(t => t.Tier == 1);
            if (state.Beds >= village.Beds && state.Well && state.Bench && state.Palisade)
                tier = 1;
            var town = tiers.First(t => t.Tier == 2);
            if (tier >= 1 && state.Smith && state.Shrine && state.Warehouse && state.Population >= town.Population && state.Happiness > town.MinHappiness)
                tier = 2;
            var city = tiers.First(t => t.Tier == 3);
            if (tier >= 2 && state.Walls && state.Hall && state.Barracks && state.Market && state.Population >= city.Population)
                tier = 3;
            return tier;
        }

        public static bool FarmerArrives(SettlementState state, IReadOnlyList<SettlementTierDef> tiers)
        {
            var village = tiers.First(t => t.Tier == 1);
            if (state.Food <= 0 && village.FoodRequired)
                return false;
            return Tier(state, tiers) >= 1 && state.Food > 0;
        }
    }

    public static class DungeonGraph
    {
        public static IReadOnlyList<string> Roll(ulong seed, IReadOnlyList<string> kit, int count)
        {
            var rooms = new List<string>(count);
            ulong state = seed == 0 ? 1 : seed;
            for (int i = 0; i < count; i++)
            {
                state = Xor(state);
                rooms.Add(kit[(int)(state % (ulong)kit.Count)]);
            }
            return rooms;
        }

        static ulong Xor(ulong x)
        {
            x ^= x << 13;
            x ^= x >> 7;
            x ^= x << 17;
            return x;
        }
    }

    public static class Authority
    {
        public const int ProtocolVersion = SimRates.ProtocolVersion;

        static readonly HashSet<string> Allowed = new(StringComparer.Ordinal)
        {
            "TryMove", "TryAttack", "TryCraft", "TryPlace", "TryGather", "TryCast", "TryEquip", "TryTalk"
        };

        public static bool ClientMaySend(string messageType) => Allowed.Contains(messageType);

        public static bool Relevant(float distanceMetres, float radius = SimRates.InterestMetres) =>
            distanceMetres <= radius;
    }

    public readonly struct AppearanceBlob
    {
        public AppearanceBlob(string bodyPreset, float height, string hair, int voicePitch)
        {
            BodyPreset = bodyPreset;
            Height = height;
            Hair = hair;
            VoicePitch = voicePitch;
        }

        public string BodyPreset { get; }
        public float Height { get; }
        public string Hair { get; }
        public int VoicePitch { get; }
    }

    public static class AppearanceRules
    {
        public static bool Valid(AppearanceBlob blob, string json)
        {
            if (json.Contains("\"class\"", StringComparison.OrdinalIgnoreCase))
                return false;
            return Encoding.UTF8.GetByteCount(json) < 4096 && blob.BodyPreset.Length > 0;
        }
    }

    public static class Events
    {
        public static bool CanStart(IReadOnlyCollection<string> activeMajor, WorldEventDef next)
        {
            if (!next.Major)
                return true;
            return activeMajor.Count == 0;
        }
    }
}
