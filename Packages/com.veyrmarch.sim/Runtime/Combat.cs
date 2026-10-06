using Veyr.Content;

namespace Veyr.Sim;

public sealed class SkillSheet
{
    readonly Dictionary<SkillId, int> _ranks = [];
    readonly Dictionary<SkillId, int> _practice = [];

    public int Rank(SkillId id) => _ranks.TryGetValue(id, out var r) ? r : 0;

    public void Practise(SkillId used, int sliceCap = 4)
    {
        if (used == SkillId.None)
            return;
        _practice.TryGetValue(used, out var p);
        p++;
        int need = 3;
        while (p >= need && Rank(used) < sliceCap)
        {
            p -= need;
            _ranks[used] = Rank(used) + 1;
        }
        _practice[used] = p;
    }

    public void SetRank(SkillId id, int rank) => _ranks[id] = rank;

    public IReadOnlyDictionary<SkillId, int> Ranks => _ranks;
}

public sealed class HurtboxHistory
{
    readonly Queue<(long Tick, float X, float Z)> _samples = new();

    public void Record(long tick, float x, float z)
    {
        _samples.Enqueue((tick, x, z));
        while (_samples.Count > SimRates.HurtboxTicks)
            _samples.Dequeue();
    }

    public bool TryAt(long tick, out float x, out float z)
    {
        foreach (var sample in _samples)
        {
            if (sample.Tick == tick)
            {
                x = sample.X;
                z = sample.Z;
                return true;
            }
        }
        x = 0;
        z = 0;
        return false;
    }
}

public readonly record struct AttackResult(
    bool Accepted,
    string Reason,
    int Damage,
    bool Killed,
    bool Parried,
    bool Staggered,
    float Knockback = 0);

public static class CombatMath
{
    public static float Mitigate(float raw, int defence, int k)
    {
        if (raw <= 0)
            return 0;
        if (defence <= 0)
            return raw;
        float reduction = defence / (float)(defence + Math.Max(1, k));
        return raw * (1f - reduction);
    }

    public static float RegionCap(float damage, int attackerLevel, int regionBand, bool boss)
    {
        if (boss)
            return damage;
        int over = attackerLevel - regionBand;
        return over > 5 ? damage * 0.35f : damage;
    }

    public static bool CanBlock(ItemDef? offHand, int greatswordRank) =>
        (offHand != null && offHand.MovesetId == "shield") || greatswordRank >= 4;

    public static float ElementAdjust(string targetDefId, Element element, Element weakness, float raw)
    {
        if (element != Element.None && element == weakness)
            raw *= 1.25f;
        if (targetDefId == "boss_cookie" && element == Element.Shadow)
            raw *= 0.5f;
        return raw;
    }

    public static int BossHealth(int baseHealth, int playersPresent)
    {
        int extra = Math.Max(0, playersPresent - 1);
        return (int)MathF.Round(baseHealth * (1f + 0.4f * extra));
    }

    public static long RiteStartTick(long phaseStart, int playerIndex) =>
        phaseStart + playerIndex * 10L;
}

public static class Attacks
{
    public static AttackResult Resolve(
        ContentCatalog content,
        ActorBody attacker,
        ActorBody target,
        Inventory attackerBag,
        Inventory targetBag,
        SkillSheet skills,
        long simTick,
        long clientTick,
        bool heavy,
        bool flank,
        HurtboxHistory targetHistory,
        bool bossTarget,
        int regionBand,
        int defenceK,
        int targetGreatswordRank,
        Element targetWeakness,
        int targetArmour,
        DeathMode durabilityMode = DeathMode.Adventure)
    {
        if (attacker.Life != LifeState.Alive)
            return new AttackResult(false, "dead", 0, false, false, false);
        if (target.Life == LifeState.Dead)
            return new AttackResult(false, "dead", 0, false, false, false);

        var weapon = WeaponOf(content, attacker, attackerBag);
        ItemInstance? held = attacker.EquippedId.Length == 0 ? null : attackerBag.Find(attacker.EquippedId);
        if (DurabilityRules.IsBroken(held, weapon, durabilityMode))
            return new AttackResult(false, "broken", 0, false, false, false);

        int cost = heavy ? weapon.StaminaHeavy : weapon.StaminaLight;
        if (attacker.Stamina < cost)
            return new AttackResult(false, "stamina", 0, false, false, false);

        float tx = target.X;
        float tz = target.Z;
        if (clientTick < simTick - SimRates.HurtboxTicks)
            return new AttackResult(false, "rewind", 0, false, false, false);
        if (targetHistory.TryAt(clientTick, out var hx, out var hz))
        {
            tx = hx;
            tz = hz;
        }

        float dx = tx - attacker.X;
        float dz = tz - attacker.Z;
        float dist = MathF.Sqrt(dx * dx + dz * dz);
        if (dist > weapon.RangeMetres + SimRates.HitSlackMetres)
            return new AttackResult(false, "range", 0, false, false, false);

        attacker.Stamina -= cost;
        skills.Practise(weapon.Skill);

        if (target.IFrameTicks > 0)
            return new AttackResult(true, "iframe", 0, false, false, false);

        bool inParry = target.Blocking
            && target.BlockStartedTick >= 0
            && simTick - target.BlockStartedTick <= SimRates.ParryWindowTicks
            && CombatMath.CanBlock(OffHand(content, target, targetBag), targetGreatswordRank);
        if (inParry)
        {
            attacker.StaggerTicks = SimRates.StaggerTicks;
            return new AttackResult(true, "parry", 0, false, true, true);
        }

        float chain = 1f;
        if (!heavy)
        {
            if (simTick <= attacker.ComboExpireTick && attacker.Combo > 0)
                attacker.Combo++;
            else
                attacker.Combo = 1;
            if (attacker.Combo >= 3)
            {
                chain = 1.15f;
                attacker.Combo = 0;
            }

            attacker.ComboExpireTick = simTick + 15;
        }
        else
        {
            attacker.Combo = 0;
        }

        float raw = weapon.BaseDamage * (heavy ? 1.6f : 1f) * chain;
        raw *= 1f + 0.05f * skills.Rank(weapon.Skill);
        raw *= MaterialVerbs.SoftTax(MaterialVerbs.CombatRankSum(skills));
        raw *= DurabilityRules.Scale(held, weapon);
        raw = CombatMath.ElementAdjust(target.DefId, weapon.Element, targetWeakness, raw);
        if (target.StaggerTicks > 0)
            raw *= 1.25f;
        if (target.DefId == "boss_wyrm" && weapon.Element == Element.Ice)
        {
            target.Health = MathF.Min(target.MaxHealth, target.Health + raw);
            return new AttackResult(true, "heal", 0, false, false, false);
        }

        raw = CombatMath.RegionCap(raw, attacker.Level, regionBand, bossTarget);

        var blockItem = OffHand(content, target, targetBag);
        bool legalBlock = target.Blocking && CombatMath.CanBlock(blockItem, targetGreatswordRank);
        if (legalBlock)
        {
            bool clumsy = blockItem == null || blockItem.MovesetId != "shield";
            raw *= clumsy ? 0.6f : 0.35f;
        }

        raw = CombatMath.Mitigate(raw, legalBlock ? 0 : targetArmour, defenceK);
        int damage = Math.Max(1, (int)MathF.Round(raw));

        target.Health -= damage;
        if (held != null)
            DurabilityRules.Chip(held, weapon, durabilityMode);
        int postureHit = weapon.PostureDamage * (heavy ? 2 : 1);
        if (flank && heavy)
            postureHit += 20;
        target.Posture -= postureHit;
        bool staggered = false;
        if (target.Posture <= 0)
        {
            target.Posture = target.MaxPosture;
            target.StaggerTicks = SimRates.StaggerTicks;
            staggered = true;
        }

        bool killed = target.Health <= 0;
        if (killed)
        {
            target.Health = 0;
            target.Life = LifeState.Dead;
        }

        return new AttackResult(true, "", damage, killed, false, staggered, weapon.Knockback);
    }

    public static ItemDef WeaponOf(ContentCatalog content, ActorBody body, Inventory bag)
    {
        if (body.EquippedId.Length == 0)
            return content.Item(SimRates.FistId);
        var inst = bag.Find(body.EquippedId);
        if (inst == null)
            return content.Item(SimRates.FistId);
        return content.Item(inst.DefId);
    }

    public static ItemDef? OffHand(ContentCatalog content, ActorBody body, Inventory bag)
    {
        if (body.OffHandId.Length == 0)
            return null;
        var inst = bag.Find(body.OffHandId);
        return inst == null ? null : content.Item(inst.DefId);
    }
}
