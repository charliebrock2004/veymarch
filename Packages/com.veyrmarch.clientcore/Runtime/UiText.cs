#nullable enable
using System.Collections.Generic;

namespace Veyr.Client.Core
{
    /// <summary>
    /// Player-facing interface strings by key (architecture §38). English is the slice language;
    /// a later language is another table, not a code change. Dialogue lives in the content catalog.
    /// </summary>
    public static class UiText
    {
        static readonly Dictionary<string, string> English = new Dictionary<string, string>
        {
            ["hud.strike"] = "Strike",
            ["hud.dodge"] = "Dodge",
            ["hud.jump"] = "Jump",
            ["hud.use"] = "Use",
            ["hud.block"] = "Block",
            ["hud.lock"] = "Lock",
            ["hud.health"] = "Health",
            ["hud.stamina"] = "Stamina",
            ["boot.loading"] = "The sealed lands",
            ["dev.switch"] = "Next test"
        };

        /// <summary>The text for a key, or the key itself so a missing string is visible, never blank.</summary>
        public static string Get(string key) => English.TryGetValue(key, out var text) ? text : key;

        public static bool Has(string key) => English.ContainsKey(key);

        public static IEnumerable<string> Keys => English.Keys;
    }
}
