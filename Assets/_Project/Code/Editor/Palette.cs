using UnityEditor;
using UnityEngine;

namespace Veyr.EditorTools
{
    /// <summary>
    /// The shared world dyes from art bible §4 as blockout materials. One lit shader, few
    /// materials, GPU instancing on. Placeholder textures are allowed only if they use the palette;
    /// these are flat colours in that palette.
    /// </summary>
    public static class Palette
    {
        public const string Folder = "Assets/_Project/Art/Materials";

        public static readonly Color BoneStone = Hex("#E4D7C3");
        public static readonly Color SootTimber = Hex("#3C342C");
        public static readonly Color Moss = Hex("#5E6B45");
        public static readonly Color Copper = Hex("#B87333");
        public static readonly Color Iron = Hex("#6E7378");
        public static readonly Color Wool = Hex("#CDBBA6");
        public static readonly Color SplitSunGold = Hex("#D7A441");
        public static readonly Color SealGreen = Hex("#7C8C62");
        public static readonly Color Ink = Hex("#1C1916");
        public static readonly Color Parchment = Hex("#E7DCC8");
        /// <summary>Cookie's nursery red: the one saturated toy colour in the forest, the foreign note.</summary>
        public static readonly Color NurseryRed = Hex("#A3302A");
        public static readonly Color Earth = Hex("#6B5A44");
        public static readonly Color DeepMoss = Hex("#46523A");
        public static readonly Color Canopy = Hex("#56663E");
        public static readonly Color HoneyLight = Hex("#FFE2B4");
        public static readonly Color FogHaze = Hex("#9DA88E");
        public static readonly Color FrostWhite = Hex("#DDE6EC");

        public static Color Hex(string hex)
        {
            ColorUtility.TryParseHtmlString(hex, out var c);
            return c;
        }

        public static Material Get(string name, Color color, float smoothness = 0.12f, float metallic = 0f)
        {
            Folders.Ensure(Folder);
            string path = Folder + "/MAT_" + name + ".mat";
            var shader = Shader.Find("Universal Render Pipeline/Lit");
            if (shader == null)
                shader = Shader.Find("Standard");
            var material = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (material == null)
            {
                material = new Material(shader);
                AssetDatabase.CreateAsset(material, path);
            }
            else if (shader != null && material.shader != shader)
            {
                material.shader = shader;
            }
            if (material.HasProperty("_BaseColor"))
                material.SetColor("_BaseColor", color);
            if (material.HasProperty("_Color"))
                material.SetColor("_Color", color);
            if (material.HasProperty("_Smoothness"))
                material.SetFloat("_Smoothness", smoothness);
            if (material.HasProperty("_Glossiness"))
                material.SetFloat("_Glossiness", smoothness);
            if (material.HasProperty("_Metallic"))
                material.SetFloat("_Metallic", metallic);
            material.enableGPUInstancing = true;
            EditorUtility.SetDirty(material);
            return material;
        }
    }

    public static class Folders
    {
        public static void Ensure(string path)
        {
            if (AssetDatabase.IsValidFolder(path))
                return;
            string parent = System.IO.Path.GetDirectoryName(path).Replace('\\', '/');
            string leaf = System.IO.Path.GetFileName(path);
            Ensure(parent);
            AssetDatabase.CreateFolder(parent, leaf);
        }
    }
}
