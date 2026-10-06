namespace Veyr.Content;

public static class VerbTuning
{
    public const int FreshHealth = 80;
    public const int LethalWindupTicks = 8;

    public static VerbProfile For(string verb) => verb switch
    {
        "pounce" => new(10, 12, 2.4f, 0.5f),
        "rush" => new(6, 8, 1.8f, 0f),
        "net" => new(12, 16, 2.2f, 0f),
        "brood" => new(14, 18, 2.0f, 0f),
        "maul" => new(12, 14, 1.6f, 0.8f),
        "charge" => new(8, 10, 2.6f, 1.2f),
        _ => new(8, 10, 1.8f, 0f)
    };

    public static bool WindupLegal(int damage, int telegraphTicks) =>
        damage < FreshHealth || telegraphTicks >= LethalWindupTicks;
}

public static class BossTells
{
    public static int WindupTicks(string attackId) => attackId switch
    {
        "spin" => 10,
        "slam" => 16,
        "circle" => 100,
        "peck" => 8,
        _ => Lethal()
    };

    static int Lethal() => VerbTuning.LethalWindupTicks;
}

public static class SliceBuild
{
    public static readonly string[] PlayerScenes = ["Boot", "Forest_Blockout", "Cookie_Nursery"];

    public static bool Ships(string scene)
    {
        foreach (var name in PlayerScenes)
        {
            if (name == scene)
                return true;
        }
        return false;
    }
}
