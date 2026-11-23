namespace Veyr.Content
{
    public static class VerbTuning
    {
        public const int FreshHealth = 80;
        public const int LethalWindupTicks = 8;

        public static VerbProfile For(string verb)
        {
            switch (verb)
            {
                case "pounce": return new VerbProfile(10, 12, 2.4f, 0.5f);
                case "rush": return new VerbProfile(6, 8, 1.8f, 0f);
                case "net": return new VerbProfile(12, 16, 2.2f, 0f);
                case "brood": return new VerbProfile(14, 18, 2.0f, 0f);
                case "maul": return new VerbProfile(12, 14, 1.6f, 0.8f);
                case "charge": return new VerbProfile(8, 10, 2.6f, 1.2f);
                default: return new VerbProfile(8, 10, 1.8f, 0f);
            }
        }

        public static bool WindupLegal(int damage, int telegraphTicks) =>
            damage < FreshHealth || telegraphTicks >= LethalWindupTicks;
    }

    public static class BossTells
    {
        public static int WindupTicks(string attackId)
        {
            switch (attackId)
            {
                case "spin": return 10;
                case "slam": return 16;
                case "circle": return 100;
                case "peck": return 8;
                default: return VerbTuning.LethalWindupTicks;
            }
        }
    }

    public static class SliceBuild
    {
        public static readonly string[] PlayerScenes = { "Boot", "Forest_Blockout", "Cookie_Nursery" };

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
}
