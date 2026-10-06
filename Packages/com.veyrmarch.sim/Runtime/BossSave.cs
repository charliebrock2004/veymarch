#nullable enable
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Veyr.Content;

namespace Veyr.Sim
{
    public sealed class WorldFlags
    {
        readonly HashSet<string> _seals = new(StringComparer.Ordinal);

        public bool Has(string id) => _seals.Contains(id);

        public void Set(string id) => _seals.Add(id);

        public IReadOnlyCollection<string> All => _seals;

        public static bool GateOpen(WorldFlags flags, string gateId) =>
            gateId switch
            {
                "gate_green" => flags.Has("seal_cookie"),
                "gate_frost" => flags.Has("seal_knight"),
                "gate_mire" => flags.Has("seal_knight"),
                "gate_dead_river" => flags.Has("seal_mire"),
                "gate_desert" => flags.Has("seal_grave"),
                "gate_volcano" => flags.Has("seal_pharaoh"),
                "gate_drowned" => flags.Has("seal_titan"),
                "gate_sky" => flags.Has("seal_queen"),
                "gate_tear" => flags.Has("seal_guardian"),
                _ => false
            };
    }

    public sealed class BossController
    {
        public string BossId { get; }
        public BossState State { get; private set; } = BossState.Idle;
        public int PhaseIndex { get; private set; }
        public int PhaseTicks { get; private set; }
        public float Health { get; private set; }
        public float MaxHealth { get; private set; }
        public int Adds { get; private set; }
        public bool SealApplied { get; private set; }

        public BossController(BossDef def, int playersPresent)
        {
            BossId = def.Id;
            MaxHealth = CombatMath.BossHealth(def.BaseHealth, playersPresent);
            Health = MaxHealth;
        }

        public void Begin()
        {
            if (State == BossState.Dead)
                return;
            State = BossState.Intro;
            PhaseIndex = 0;
            PhaseTicks = 0;
        }

        public void Tick(BossDef def)
        {
            if (State is BossState.Dead or BossState.Idle)
                return;
            if (State == BossState.Intro)
            {
                State = BossState.Phase;
                PhaseIndex = 1;
                PhaseTicks = 0;
                return;
            }
            if (State == BossState.Transition)
            {
                State = BossState.Phase;
                PhaseTicks = 0;
                return;
            }
            if (State != BossState.Phase)
                return;
            PhaseTicks++;
            var phase = def.Phases.FirstOrDefault(p => p.Index == PhaseIndex);
            if (phase != null && phase.MaxTicks > 0 && PhaseTicks >= phase.MaxTicks && PhaseIndex < def.Phases.Length)
                AdvancePhase(def);
        }

        public void Damage(BossDef def, int amount)
        {
            if (State is BossState.Dead or BossState.Idle or BossState.Reset)
                return;
            if (State == BossState.Intro)
            {
                State = BossState.Phase;
                PhaseIndex = 1;
            }
            Health = Math.Max(0, Health - amount);
            if (Health <= 0)
            {
                State = BossState.Dead;
                return;
            }
            float frac = Health / MaxHealth;
            if (PhaseIndex == 1 && frac <= def.HpPhase2)
                AdvancePhase(def);
            else if (PhaseIndex == 2 && frac <= def.HpPhase3)
                AdvancePhase(def);
        }

        public bool TryAdd(BossDef def)
        {
            if (Adds >= def.AddCap)
                return false;
            Adds++;
            return true;
        }

        public void Wipe(BossDef def)
        {
            State = BossState.Reset;
            Health = MaxHealth;
            PhaseIndex = 0;
            PhaseTicks = 0;
            Adds = 0;
            SealApplied = false;
            State = BossState.Intro;
        }

        void AdvancePhase(BossDef def)
        {
            if (PhaseIndex >= def.Phases.Length)
                return;
            PhaseIndex++;
            PhaseTicks = 0;
            State = BossState.Transition;
        }
    }

    public readonly struct GrantMint
    {
        public GrantMint(bool created, string instanceId)
        {
            Created = created;
            InstanceId = instanceId;
        }

        public bool Created { get; }
        public string InstanceId { get; }
    }

    public static class Grants
    {
        public static string Key(string worldId, string bossId, string characterId, string itemId) =>
            $"boss:{worldId}:{bossId}:{characterId}:{itemId}";

        public static IReadOnlyList<GrantMint> Mint(
            ContentCatalog content,
            Inventory inventory,
            BossDef def,
            string worldId,
            string characterId,
            Func<string> nextId)
        {
            var list = new List<GrantMint>();
            foreach (var itemId in def.RewardItemIds)
            {
                string key = Key(worldId, def.Id, characterId, itemId);
                var existing = inventory.InstanceForBirth(key);
                if (existing != null)
                {
                    list.Add(new GrantMint(false, existing));
                    continue;
                }
                var defn = content.Item(itemId);
                string id = nextId();
                inventory.Add(defn, 1, characterId, id, key);
                list.Add(new GrantMint(true, id));
            }
            return list;
        }
    }

    /// <summary>
    /// Checksummed wrapper around a document body. Schema here is the envelope format,
    /// not the document schema; each document carries its own.
    /// </summary>
    public sealed class SaveEnvelope
    {
        public const int EnvelopeSchema = 1;
        public int Schema { get; set; } = EnvelopeSchema;
        public string Checksum { get; set; } = "";
        public string Body { get; set; } = "";

        public string ToJson() =>
            new JsonWriter().BeginObject()
                .Field("Schema", Schema)
                .Field("Checksum", Checksum)
                .Field("Body", Body)
                .EndObject().ToString();

        public static SaveEnvelope FromJson(string text)
        {
            var node = JsonNode.Parse(text);
            return new SaveEnvelope
            {
                Schema = node["Schema"].AsInt(),
                Checksum = node["Checksum"].AsString(),
                Body = node["Body"].AsString()
            };
        }
    }

    /// <summary>
    /// Transactional local files. A write goes to <c>path.tmp</c>, is flushed to disk, then
    /// replaces <c>path</c> by rename. The two previous good copies stay as <c>path.1</c> and
    /// <c>path.2</c>. A read takes the newest copy whose checksum holds, so a kill at any point
    /// loads either the old or the new document, never a torn one.
    /// </summary>
    public static class AtomicStore
    {
        public static string Checksum(string body) => Hex.Sha256(body);

        public static string Generation(string path, int back) => back == 0 ? path : path + "." + back;

        public static void Write(string path, string body)
        {
            var envelope = new SaveEnvelope { Checksum = Checksum(body), Body = body };
            byte[] bytes = Encoding.UTF8.GetBytes(envelope.ToJson());
            string tmp = path + ".tmp";
            string? dir = Path.GetDirectoryName(Path.GetFullPath(path));
            if (!string.IsNullOrEmpty(dir))
                Directory.CreateDirectory(dir);

            using (var stream = new FileStream(tmp, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                stream.Write(bytes, 0, bytes.Length);
                stream.Flush(true);
            }

            if (File.Exists(path))
            {
                string older = Generation(path, 2);
                string previous = Generation(path, 1);
                if (File.Exists(previous))
                {
                    if (File.Exists(older))
                        File.Delete(older);
                    File.Move(previous, older);
                }
                File.Replace(tmp, path, previous);
            }
            else
            {
                File.Move(tmp, path);
            }
        }

        public static string ReadBody(string path)
        {
            string? main = TryRead(path);
            if (main != null)
                return main;

            string tmp = path + ".tmp";
            string? finished = TryRead(tmp);
            if (finished != null)
            {
                // The rename did not happen before the kill. The temp copy is complete, so promote it.
                if (File.Exists(path))
                    File.Delete(path);
                File.Move(tmp, path);
                return finished;
            }

            for (int back = 1; back <= 2; back++)
            {
                string? old = TryRead(Generation(path, back));
                if (old != null)
                    return old;
            }
            throw new InvalidDataException("Save is torn and has no good copy.");
        }

        public static string? TryRead(string path)
        {
            if (!File.Exists(path))
                return null;
            try
            {
                var env = SaveEnvelope.FromJson(File.ReadAllText(path, Encoding.UTF8));
                if (env.Schema != SaveEnvelope.EnvelopeSchema)
                    return null;
                if (!string.Equals(env.Checksum, Checksum(env.Body), StringComparison.OrdinalIgnoreCase))
                    return null;
                return env.Body;
            }
            catch (FormatException)
            {
                return null;
            }
            catch (IOException)
            {
                return null;
            }
        }
    }

    public sealed class CharacterDocument
    {
        public const int CurrentSchema = 1;
        public int Schema { get; set; } = CurrentSchema;
        public string CharacterId { get; set; } = "";
        public string Name { get; set; } = "";
        public float Health { get; set; }
        public string EquippedInstanceId { get; set; } = "";
        public List<ItemInstance> Items { get; set; } = new List<ItemInstance>();
        public Dictionary<string, int> Skills { get; set; } = new Dictionary<string, int>();

        public string ToJson()
        {
            var w = new JsonWriter().BeginObject()
                .Field("Schema", Schema)
                .Field("CharacterId", CharacterId)
                .Field("Name", Name)
                .Field("Health", Health)
                .Field("EquippedInstanceId", EquippedInstanceId);
            w.Key("Items").BeginArray();
            foreach (var item in Items)
                WriteItem(w, item);
            w.EndArray();
            w.Key("Skills").BeginObject();
            foreach (var pair in Skills.OrderBy(p => p.Key, StringComparer.Ordinal))
                w.Field(pair.Key, pair.Value);
            w.EndObject();
            return w.EndObject().ToString();
        }

        public static CharacterDocument FromJson(string text)
        {
            var node = JsonNode.Parse(text);
            var doc = new CharacterDocument
            {
                Schema = node["Schema"].AsInt(),
                CharacterId = node["CharacterId"].AsString(),
                Name = node.Str("Name"),
                Health = node.Float("Health"),
                EquippedInstanceId = node.Str("EquippedInstanceId")
            };
            foreach (var item in node["Items"].Items)
                doc.Items.Add(ReadItem(item));
            foreach (var pair in node["Skills"].Fields)
                doc.Skills[pair.Key] = pair.Value.AsInt();
            return doc;
        }

        internal static void WriteItem(JsonWriter w, ItemInstance item) =>
            w.BeginObject()
                .Field("InstanceId", item.InstanceId)
                .Field("DefId", item.DefId)
                .Field("OwnerId", item.OwnerId)
                .Field("Count", item.Count)
                .Field("Soulbound", item.Soulbound)
                .Field("BirthKey", item.BirthKey)
                .Field("Durability", item.Durability)
                .Field("Mods", item.Mods)
                .Field("Equipped", item.Equipped)
                .EndObject();

        internal static ItemInstance ReadItem(JsonNode node) => new ItemInstance
        {
            InstanceId = node["InstanceId"].AsString(),
            DefId = node["DefId"].AsString(),
            OwnerId = node["OwnerId"].AsString(),
            Count = node["Count"].AsInt(),
            Soulbound = node.Bool("Soulbound"),
            BirthKey = node.Str("BirthKey"),
            Durability = node.Int("Durability"),
            Mods = node.Str("Mods"),
            Equipped = node.Bool("Equipped")
        };
    }

    public sealed class WorldDocument
    {
        public const int CurrentSchema = 1;
        public int Schema { get; set; } = CurrentSchema;
        public string WorldId { get; set; } = "";
        public string Mode { get; set; } = "adventure";
        public ulong Seed { get; set; }
        public List<string> Seals { get; set; } = new List<string>();

        public string ToJson()
        {
            var w = new JsonWriter().BeginObject()
                .Field("Schema", Schema)
                .Field("WorldId", WorldId)
                .Field("Mode", Mode)
                .Field("Seed", Seed);
            w.Key("Seals").BeginArray();
            foreach (var seal in Seals.OrderBy(s => s, StringComparer.Ordinal))
                w.Value(seal);
            w.EndArray();
            return w.EndObject().ToString();
        }

        public static WorldDocument FromJson(string text)
        {
            var node = JsonNode.Parse(text);
            var doc = new WorldDocument
            {
                Schema = node["Schema"].AsInt(),
                WorldId = node["WorldId"].AsString(),
                Mode = node.Str("Mode", "adventure"),
                Seed = node["Seed"].AsULong()
            };
            foreach (var seal in node["Seals"].Items)
                doc.Seals.Add(seal.AsString());
            return doc;
        }
    }

    /// <summary>Character and world are separate files. Never one blob.</summary>
    public static class SaveGame
    {
        public static void WriteCharacter(string path, CharacterDocument doc) =>
            AtomicStore.Write(path, doc.ToJson());

        public static void WriteWorld(string path, WorldDocument doc) =>
            AtomicStore.Write(path, doc.ToJson());

        public static CharacterDocument ReadCharacter(string path)
        {
            var doc = CharacterDocument.FromJson(AtomicStore.ReadBody(path));
            if (doc.Schema != CharacterDocument.CurrentSchema)
                throw new InvalidDataException("schema");
            return doc;
        }

        public static WorldDocument ReadWorld(string path)
        {
            var doc = WorldDocument.FromJson(AtomicStore.ReadBody(path));
            if (doc.Schema != WorldDocument.CurrentSchema)
                throw new InvalidDataException("schema");
            return doc;
        }
    }
}
