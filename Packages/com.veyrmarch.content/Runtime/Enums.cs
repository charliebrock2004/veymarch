namespace Veyr.Content;

public enum ItemKind
{
    Material,
    Tool,
    Weapon,
    Armour,
    Key,
    Consumable,
    Quest
}

public enum EquipSlot
{
    None,
    MainHand,
    OffHand,
    Head,
    Chest,
    Hands,
    Legs,
    Cloak,
    Trinket
}

public enum Rarity
{
    Common,
    Uncommon,
    Rare,
    Epic,
    Legendary,
    Mythic,
    Unique
}

/// <summary>
/// Mining gate. Higher values include lower nodes.
/// Iron is Cookie, not Copper: the slice test rejects a copper pick on iron.
/// </summary>
public enum ToolTier
{
    None = 0,
    Hand = 1,
    Stone = 2,
    Copper = 3,
    Cookie = 4,
    Royal = 5,
    Frostbite = 6,
    Rotbreaker = 7,
    Soulbreaker = 8,
    Sunbreaker = 9,
    Magma = 10,
    Abyssal = 11,
    Starforged = 12
}

public enum SkillId
{
    None,
    Sword,
    Greatsword,
    Axe,
    Hammer,
    Spear,
    Dagger,
    Archery,
    Defence,
    Magic,
    Mining,
    Woodcutting,
    Fishing,
    Farming,
    Blacksmithing,
    Alchemy,
    Cooking,
    Enchanting,
    Building,
    Engineering
}

public enum StationId
{
    Hand,
    Bench,
    Campfire,
    Forge,
    Alchemy,
    Cookpot,
    Enchanter,
    Engineer,
    SkyForge
}

public enum Element
{
    None,
    Fire,
    Ice,
    Lightning,
    Earth,
    Holy,
    Rot,
    Soul,
    Void,
    Shadow
}

public enum DeathMode
{
    Adventure,
    Survival,
    Hardcore,
    Custom
}

public enum LifeState
{
    Alive,
    Downed,
    Dead
}

public enum BossState
{
    Idle,
    Intro,
    Phase,
    Transition,
    Dead,
    Reset
}

public enum StatusId
{
    None,
    Bleed,
    Poison,
    Burn,
    Frost,
    Shock,
    Rot,
    Curse,
    Silence
}

public enum CleanseSource
{
    Potion,
    Spell,
    Campfire
}

public enum SchoolId
{
    None,
    Fire,
    Ice,
    Lightning,
    Earth,
    Shadow,
    Holy,
    Forbidden
}

public enum RoomKind
{
    Corridor,
    Entrance,
    Trap,
    Puzzle,
    Elite,
    Secret,
    Boss
}

