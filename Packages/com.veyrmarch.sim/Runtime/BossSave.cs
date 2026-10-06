using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Veyr.Content;

namespace Veyr.Sim;

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

public readonly record struct GrantMint(bool Created, string InstanceId);

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

public sealed class SaveEnvelope
{
    public int Schema { get; set; } = 1;
    public string Checksum { get; set; } = "";
    public string Body { get; set; } = "";
}

public static class AtomicStore
{
    static readonly JsonSerializerOptions Json = new() { WriteIndented = false };

    public static string Checksum(string body)
    {
        byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes(body));
        return Convert.ToHexString(hash);
    }

    public static void Write(string path, string body)
    {
        var envelope = new SaveEnvelope { Schema = 1, Checksum = Checksum(body), Body = body };
        string tmp = path + ".tmp";
        string bak = path + ".bak";
        File.WriteAllText(tmp, JsonSerializer.Serialize(envelope, Json));
        if (File.Exists(path))
            File.Copy(path, bak, true);
        File.Move(tmp, path, true);
        File.Copy(path, bak, true);
    }

    public static string ReadBody(string path)
    {
        string? tmp = TryRead(path + ".tmp");
        string? main = TryRead(path);
        if (main == null && tmp != null)
        {
            File.Move(path + ".tmp", path, true);
            return tmp;
        }
        if (main != null)
            return main;
        string? bak = TryRead(path + ".bak");
        if (bak != null)
            return bak;
        throw new InvalidDataException("Save is torn and has no good copy.");
    }

    public static string? TryRead(string path)
    {
        if (!File.Exists(path))
            return null;
        try
        {
            var env = JsonSerializer.Deserialize<SaveEnvelope>(File.ReadAllText(path));
            if (env == null || env.Schema != 1)
                return null;
            if (!string.Equals(env.Checksum, Checksum(env.Body), StringComparison.OrdinalIgnoreCase))
                return null;
            return env.Body;
        }
        catch (JsonException)
        {
            return null;
        }
    }
}

public sealed class CharacterDocument
{
    public int Schema { get; set; } = 1;
    public string CharacterId { get; set; } = "";
    public string Name { get; set; } = "";
    public float Health { get; set; }
    public string EquippedInstanceId { get; set; } = "";
    public List<ItemInstance> Items { get; set; } = [];
    public Dictionary<string, int> Skills { get; set; } = [];
}

public sealed class WorldDocument
{
    public int Schema { get; set; } = 1;
    public string WorldId { get; set; } = "";
    public string Mode { get; set; } = "adventure";
    public ulong Seed { get; set; }
    public List<string> Seals { get; set; } = [];
}

public static class SaveGame
{
    static readonly JsonSerializerOptions Json = new() { WriteIndented = true };

    public static void WriteCharacter(string path, CharacterDocument doc) =>
        AtomicStore.Write(path, JsonSerializer.Serialize(doc, Json));

    public static void WriteWorld(string path, WorldDocument doc) =>
        AtomicStore.Write(path, JsonSerializer.Serialize(doc, Json));

    public static CharacterDocument ReadCharacter(string path)
    {
        var doc = JsonSerializer.Deserialize<CharacterDocument>(AtomicStore.ReadBody(path))
            ?? throw new InvalidDataException("character");
        if (doc.Schema != 1)
            throw new InvalidDataException("schema");
        return doc;
    }

    public static WorldDocument ReadWorld(string path)
    {
        var doc = JsonSerializer.Deserialize<WorldDocument>(AtomicStore.ReadBody(path))
            ?? throw new InvalidDataException("world");
        if (doc.Schema != 1)
            throw new InvalidDataException("schema");
        return doc;
    }
}
