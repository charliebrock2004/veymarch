using Veyr.Content;

namespace Veyr.Sim;

public sealed class ItemInstance
{
    public required string InstanceId { get; init; }
    public required string DefId { get; init; }
    public required string OwnerId { get; init; }
    public int Count { get; set; }
    public bool Soulbound { get; init; }
    public string BirthKey { get; init; } = "";
    public int Durability { get; set; }
    public string Mods { get; init; } = "";
    public bool Equipped { get; set; }
}

public readonly record struct StackAdd(bool Ok, string InstanceId, string Reason);

public sealed class Inventory
{
    public const int SlotCap = 40;
    readonly List<ItemInstance> _items = [];
    readonly Dictionary<string, string> _birth = new(StringComparer.Ordinal);

    public IReadOnlyList<ItemInstance> Items => _items;

    public int CountOf(string defId) => _items.Where(i => i.DefId == defId).Sum(i => i.Count);

    public ItemInstance? Find(string instanceId) => _items.FirstOrDefault(i => i.InstanceId == instanceId);

    public string? InstanceForBirth(string birthKey) =>
        _birth.TryGetValue(birthKey, out var id) ? id : null;

    public StackAdd Add(ItemDef def, int count, string owner, string instanceId, string birthKey = "")
    {
        if (count <= 0)
            return new StackAdd(false, "", "count");
        if (birthKey.Length > 0 && _birth.TryGetValue(birthKey, out var existing))
            return new StackAdd(true, existing, "replay");

        if (def.MaxStack > 1 && !def.Soulbound && def.Kind == ItemKind.Material)
        {
            var stack = _items.FirstOrDefault(i =>
                i.DefId == def.Id && i.OwnerId == owner && i.Mods.Length == 0 && i.Durability == 0 && i.Count < def.MaxStack);
            if (stack != null)
            {
                int room = def.MaxStack - stack.Count;
                int take = Math.Min(room, count);
                stack.Count += take;
                count -= take;
                if (count == 0)
                    return new StackAdd(true, stack.InstanceId, "");
            }
        }

        if (def.MaxStack == 1 && count != 1)
            return new StackAdd(false, "", "stack");

        if (_items.Count >= SlotCap && def.MaxStack == 1)
            return new StackAdd(false, "", "overflow");

        var created = new ItemInstance
        {
            InstanceId = instanceId,
            DefId = def.Id,
            OwnerId = owner,
            Count = count,
            Soulbound = def.Soulbound,
            BirthKey = birthKey
        };
        _items.Add(created);
        if (birthKey.Length > 0)
            _birth[birthKey] = instanceId;
        return new StackAdd(true, instanceId, "");
    }

    public bool TryConsume(string defId, int count)
    {
        if (CountOf(defId) < count)
            return false;
        int left = count;
        foreach (var item in _items.Where(i => i.DefId == defId).ToList())
        {
            int take = Math.Min(item.Count, left);
            item.Count -= take;
            left -= take;
            if (item.Count == 0)
                _items.Remove(item);
            if (left == 0)
                return true;
        }
        return false;
    }

    public bool RemoveInstance(string instanceId)
    {
        var item = Find(instanceId);
        if (item == null)
            return false;
        _items.Remove(item);
        return true;
    }
}

public readonly record struct CraftResult(bool Ok, string InstanceId, string Reason);

public static class Crafting
{
    public static CraftResult TryCraft(
        ContentCatalog content,
        Inventory inventory,
        string owner,
        string recipeId,
        StationId station,
        int skillRank,
        string idempotencyKey,
        Func<string> nextId)
    {
        if (!content.Recipes.TryGetValue(recipeId, out var recipe))
            return new CraftResult(false, "", "recipe");
        if (!recipe.Craftable)
            return new CraftResult(false, "", "not_craftable");
        if (!recipe.Stations.Contains(station))
            return new CraftResult(false, "", "station");
        if (recipe.MinSkillRank > 0 && skillRank < recipe.MinSkillRank)
            return new CraftResult(false, "", "skill");

        var known = inventory.InstanceForBirth(idempotencyKey);
        if (known != null)
            return new CraftResult(true, known, "replay");

        foreach (var input in recipe.Inputs)
        {
            if (inventory.CountOf(input.ItemId) < input.Count)
                return new CraftResult(false, "", "materials");
        }

        foreach (var input in recipe.Inputs)
            inventory.TryConsume(input.ItemId, input.Count);

        var output = content.Item(recipe.OutputItemId);
        string id = nextId();
        var added = inventory.Add(output, recipe.OutputCount, owner, id, idempotencyKey);
        return new CraftResult(added.Ok, added.InstanceId, added.Reason);
    }
}

public readonly record struct GatherResult(bool Ok, string Reason, int Amount);

public static class Gathering
{
    public static ToolTier TierOf(ContentCatalog content, ActorBody body, Inventory inventory)
    {
        if (body.EquippedId.Length == 0)
            return ToolTier.Hand;
        var inst = inventory.Find(body.EquippedId);
        if (inst == null)
            return ToolTier.Hand;
        return content.Item(inst.DefId).Tier;
    }

    public static GatherResult TryGather(
        ContentCatalog content,
        Inventory inventory,
        ActorBody body,
        NodeDef node,
        WorldFlags flags,
        string owner,
        Func<string> nextId)
    {
        if (node.RequiredSeal != null && !flags.Has(node.RequiredSeal))
            return new GatherResult(false, "sealed", 0);
        var tier = TierOf(content, body, inventory);
        if (tier < node.RequiredTier)
            return new GatherResult(false, "tier", 0);
        var yield = content.Item(node.YieldItemId);
        var added = inventory.Add(yield, node.YieldCount, owner, nextId());
        return added.Ok
            ? new GatherResult(true, "", node.YieldCount)
            : new GatherResult(false, added.Reason, 0);
    }
}
