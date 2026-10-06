using System.Collections.Generic;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.UI;
using UnityEngine.Rendering;
using UnityEngine.SceneManagement;
using Veyr.App;
using Veyr.Client.CameraRig;
using Veyr.Client.Input;
using Veyr.Client.Platform;
using Veyr.Client.Player;
using Veyr.Sim;

namespace Veyr.EditorTools
{
    /// <summary>
    /// Builds Boot.unity and Dev_Move.unity from code (T005, T013). Dev_Move is the grey forest
    /// blockout for the first phone test: a Hearthfen pad, a road north, a seeded forest combined
    /// into 64 m chunk meshes, giant-tree landmarks, Cookie's castle hill on the horizon, and a
    /// camera course (walls, corridor, low arch, ramps, steps, ledge). Re-running replaces both scenes.
    /// </summary>
    public static class SceneBuilder
    {
        public const string SceneFolder = "Assets/_Project/Scenes";
        public const string BootPath = SceneFolder + "/Boot.unity";
        public const string DevMovePath = SceneFolder + "/Dev/Dev_Move.unity";
        public const string ForestPath = SceneFolder + "/Regions/Forest_Blockout.unity";
        public const string PrefabFolder = "Assets/_Project/Prefabs";
        public const string GeneratedRoot = "Assets/_Project/Generated";
        public const string InputPath = "Assets/_Project/Input/Veyr.inputactions";
        public const ulong ForestSeed = 7;

        // Each scene keeps its meshes in its own folder: rebuilding one scene must never delete
        // a mesh another scene references. Set at the start of each build; editor-only, single-threaded.
        static string _meshFolder = GeneratedRoot;

        const float GroundMinX = -128f;
        const float GroundMaxX = 128f;
        const float GroundMinZ = -128f;
        const float GroundMaxZ = 256f;

        public static string BuildAll(QualityAssetSet quality)
        {
            BuildMovementScene(quality, DevMovePath, false, "Forest_Blockout");
            var stats = BuildMovementScene(quality, ForestPath, true, "Dev_Move");
            BuildBoot(quality);
            SetBuildScenes();
            AssetDatabase.SaveAssets();
            return stats;
        }

        public static void SetBuildScenes()
        {
            EditorBuildSettings.scenes = new[]
            {
                new EditorBuildSettingsScene(BootPath, true),
                new EditorBuildSettingsScene(DevMovePath, true),
                new EditorBuildSettingsScene(ForestPath, true)
            };
        }

        public static void BuildBoot(QualityAssetSet quality)
        {
            Folders.Ensure(SceneFolder);
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var cameraObject = new GameObject("Boot Camera");
            var camera = cameraObject.AddComponent<Camera>();
            camera.clearFlags = CameraClearFlags.SolidColor;
            camera.backgroundColor = Palette.Ink;
            camera.cullingMask = 0;
            cameraObject.AddComponent<AudioListener>();
            var boot = new GameObject("GameBootstrap").AddComponent<GameBootstrap>();
            boot.Wire("Dev_Move", quality);
            EditorSceneManager.SaveScene(scene, BootPath);
        }

        /// <summary>
        /// Dev_Move is the near-empty movement scene the Phase 3 frame gate asks for. Forest_Blockout
        /// adds the seeded forest, giant trees, and roots: the forest is the performance test.
        /// </summary>
        public static string BuildMovementScene(QualityAssetSet quality, string path, bool forest, string switchTo)
        {
            Folders.Ensure(SceneFolder + "/Dev");
            Folders.Ensure(SceneFolder + "/Regions");
            Folders.Ensure(PrefabFolder + "/Characters");
            Folders.Ensure(PrefabFolder + "/UI");
            _meshFolder = GeneratedRoot + "/" + System.IO.Path.GetFileNameWithoutExtension(path);
            Folders.Ensure(_meshFolder);
            var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            Lighting();
            var world = new GameObject("World").transform;
            Ground(world);
            var spawn = SpawnPad(world);
            Road(world);
            string stats = "Dev_Move: ground, pad, course, horizon landmarks";
            if (forest)
            {
                stats = Forest(world);
                ForestLandmarks(world);
            }
            HorizonLandmarks(world);
            CameraCourse(world);
            Boundary(world);

            var hud = HudBuilder.Build(out var touch, out var overlay, out var vitals, out var switchButton);
            HudBuilder.EventSystemObject();

            var player = Player(spawn.position, out var model, out var bodyRenderers);
            var controller = player.GetComponent<LocalPlayerController>();
            var input = player.GetComponent<PlayerInputReader>();
            var rigObject = CameraRigObject(out var camera);
            var rig = rigObject.GetComponent<OrbitCameraRig>();

            var actions = AssetDatabase.LoadAssetAtPath<InputActionAsset>(InputPath);
            if (actions == null)
                Debug.LogWarning("Veyr scenes: " + InputPath + " did not import as an InputActionAsset. Touch still works; check the Input System package.");
            input.Wire(actions, touch);
            controller.Wire(input, rig, model);
            rig.Wire(camera, player.transform, input, bodyRenderers);
            rigObject.transform.position = spawn.position + new Vector3(0f, 2.6f, -5f);

            var rootObject = new GameObject("SceneRoot");
            var root = rootObject.AddComponent<SceneRoot>();
            var deviceLog = rootObject.AddComponent<DeviceLog>();
            root.Wire(spawn, controller, input, rig, overlay, deviceLog, vitals, quality);
            rootObject.AddComponent<DevSceneSwitch>().Wire(switchButton, switchTo);

            PrefabUtility.SaveAsPrefabAssetAndConnect(player, PrefabFolder + "/Characters/PF_Player.prefab", InteractionMode.AutomatedAction);
            PrefabUtility.SaveAsPrefabAssetAndConnect(rigObject, PrefabFolder + "/Characters/PF_CameraRig.prefab", InteractionMode.AutomatedAction);
            PrefabUtility.SaveAsPrefabAssetAndConnect(hud, PrefabFolder + "/UI/PF_Hud.prefab", InteractionMode.AutomatedAction);

            EditorSceneManager.SaveScene(scene, path);
            return stats;
        }

        static void Lighting()
        {
            var sunObject = new GameObject("Sun");
            var sun = sunObject.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.color = Palette.HoneyLight;
            sun.intensity = 1.25f;
            sun.shadows = LightShadows.Soft;
            sunObject.transform.rotation = Quaternion.Euler(42f, -35f, 0f);
            RenderSettings.sun = sun;
            RenderSettings.ambientMode = AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = Palette.Hex("#AEB8C2");
            RenderSettings.ambientEquatorColor = Palette.Hex("#8F9A7A");
            RenderSettings.ambientGroundColor = Palette.Hex("#4A4236");
            RenderSettings.fog = true;
            RenderSettings.fogMode = FogMode.Exponential;
            RenderSettings.fogDensity = 0.0055f;
            RenderSettings.fogColor = Palette.FogHaze;
            var sky = AssetDatabase.GetBuiltinExtraResource<Material>("Default-Skybox.mat");
            if (sky != null)
                RenderSettings.skybox = sky;
        }

        static void Ground(Transform world)
        {
            var parent = new GameObject("Terrain").transform;
            parent.SetParent(world, false);
            var moss = Palette.Get("forest_ground", Palette.Moss);
            for (float x = GroundMinX; x < GroundMaxX; x += WorldGrid.TerrainTileMetres)
            {
                for (float z = GroundMinZ; z < GroundMaxZ; z += WorldGrid.TerrainTileMetres)
                {
                    var tile = WorldGrid.TileOf(x, z);
                    var plane = GameObject.CreatePrimitive(PrimitiveType.Plane);
                    plane.name = "Tile_" + tile.X + "_" + tile.Z;
                    plane.transform.SetParent(parent, false);
                    float half = WorldGrid.TerrainTileMetres * 0.5f;
                    plane.transform.position = new Vector3(x + half, 0f, z + half);
                    plane.transform.localScale = new Vector3(WorldGrid.TerrainTileMetres / 10f, 1f, WorldGrid.TerrainTileMetres / 10f);
                    plane.GetComponent<MeshRenderer>().sharedMaterial = moss;
                    MarkStatic(plane);
                }
            }
        }

        static Transform SpawnPad(Transform world)
        {
            var pad = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            pad.name = "PF_HearthfenPad";
            pad.transform.SetParent(world, false);
            pad.transform.position = new Vector3(0f, 0.1f, 0f);
            pad.transform.localScale = new Vector3(5f, 0.1f, 5f);
            // The cylinder primitive's capsule collider turns into a sphere at this scale. Use the mesh.
            Object.DestroyImmediate(pad.GetComponent<Collider>());
            pad.AddComponent<MeshCollider>().sharedMesh = pad.GetComponent<MeshFilter>().sharedMesh;
            pad.GetComponent<MeshRenderer>().sharedMaterial = Palette.Get("pale_stone", Palette.BoneStone);
            MarkStatic(pad);

            var spawn = new GameObject("Spawn").transform;
            spawn.SetParent(world, false);
            spawn.position = new Vector3(0f, 0.25f, 0f);
            return spawn;
        }

        static void Road(Transform world)
        {
            var kit = new MeshKit();
            kit.Box(new Vector3(0f, 0.015f, 103f), new Vector3(3.2f, 0.03f, 200f), Quaternion.identity);
            kit.Box(new Vector3(0f, 0.015f, -40f), new Vector3(2.4f, 0.03f, 76f), Quaternion.identity);
            var road = MeshObject("Road", world, kit, "Dev_Road", Palette.Get("earth_path", Palette.Earth), false);
            MarkStatic(road);
        }

        /// <summary>Seeded forest, combined per 64 m object chunk. Returns a one-line summary.</summary>
        static string Forest(Transform world)
        {
            var parent = new GameObject("Forest").transform;
            parent.SetParent(world, false);
            var bark = Palette.Get("bark", Palette.SootTimber);
            var canopy = Palette.Get("canopy", Palette.Canopy);

            var points = Scatter.Grid(ForestSeed, GroundMinX + 4f, GroundMinZ + 4f, GroundMaxX - 4f, 196f, 7.5f, 2.6f, KeepTree);
            var chunks = new Dictionary<(int, int), (MeshKit Trunks, MeshKit Canopy)>();
            foreach (var p in points)
            {
                var key = WorldGrid.ChunkOf(p.X, p.Z);
                if (!chunks.TryGetValue(key, out var kits))
                {
                    kits = (new MeshKit(), new MeshKit());
                    chunks[key] = kits;
                }
                var origin = new Vector3(key.Item1 * WorldGrid.ObjectChunkMetres, 0f, key.Item2 * WorldGrid.ObjectChunkMetres);
                var foot = new Vector3(p.X, 0f, p.Z) - origin;
                float height = 9f + p.A * 7f;
                float radius = 0.35f + p.B * 0.45f;
                kits.Trunks.Prism(foot, radius, height, 7, 0.7f, p.C * 51f);
                float crown = 2.2f + p.C * 2.2f;
                kits.Canopy.Blob(foot + new Vector3(0f, height * 0.9f + crown * 0.4f, 0f), new Vector3(crown, crown * 0.75f, crown), 1, Quaternion.Euler(0f, p.B * 360f, 0f));
            }

            int trunkTris = 0;
            int canopyTris = 0;
            foreach (var pair in chunks)
            {
                var (cx, cz) = pair.Key;
                var chunk = new GameObject("Chunk_" + cx + "_" + cz).transform;
                chunk.SetParent(parent, false);
                chunk.position = new Vector3(cx * WorldGrid.ObjectChunkMetres, 0f, cz * WorldGrid.ObjectChunkMetres);
                trunkTris += pair.Value.Trunks.TriangleCount;
                canopyTris += pair.Value.Canopy.TriangleCount;
                var trunks = MeshObject("Trunks", chunk, pair.Value.Trunks, "Dev_Forest_" + cx + "_" + cz + "_Trunks", bark, true);
                var leaves = MeshObject("Canopy", chunk, pair.Value.Canopy, "Dev_Forest_" + cx + "_" + cz + "_Canopy", canopy, false);
                MarkStatic(trunks);
                MarkStatic(leaves);
            }
            return "forest: " + points.Count + " trees in " + chunks.Count + " chunks, " + trunkTris + " trunk tris, " + canopyTris + " canopy tris";
        }

        static bool KeepTree(float x, float z)
        {
            if (x * x + z * z < 18f * 18f)
                return false;
            if (Mathf.Abs(x) < 4.5f && z > -80f && z < 205f)
                return false;
            if (x > 14f && x < 48f && z > -28f && z < 12f)
                return false;
            foreach (var giant in GiantTrees)
            {
                float dx = x - giant.x;
                float dz = z - giant.z;
                if (dx * dx + dz * dz < 12f * 12f)
                    return false;
            }
            if (z > 50f && z < 70f && Mathf.Abs(x) < 14f)
                return false;
            if (x > -18f && x < -6f && z > 64f && z < 90f)
                return false;
            return true;
        }

        static readonly Vector3[] GiantTrees =
        {
            new Vector3(-38f, 0f, 46f),
            new Vector3(44f, 0f, 92f),
            new Vector3(-26f, 0f, 134f)
        };

        static void ForestLandmarks(Transform world)
        {
            var parent = new GameObject("ForestLandmarks").transform;
            parent.SetParent(world, false);
            int layer = LayerMask.NameToLayer(ProjectSetup.LandmarkLayer);
            var bark = Palette.Get("bark", Palette.SootTimber);
            var canopy = Palette.Get("canopy_old", Palette.DeepMoss);

            for (int i = 0; i < GiantTrees.Length; i++)
            {
                var g = GiantTrees[i];
                float height = 48f + i * 6f;
                float radius = 3.2f + i * 0.4f;
                var trunkKit = new MeshKit();
                trunkKit.Prism(Vector3.zero, radius, height, 10, 0.55f, i * 17f);
                var tree = MeshObject("GiantTree_" + i, parent, trunkKit, "Dev_GiantTrunk_" + i, bark, false);
                tree.transform.position = g;
                var collider = tree.AddComponent<CapsuleCollider>();
                collider.radius = radius * 0.85f;
                collider.height = height;
                collider.center = new Vector3(0f, height * 0.5f, 0f);
                var crownKit = new MeshKit();
                crownKit.Blob(new Vector3(0f, height + 4f, 0f), new Vector3(18f, 11f, 18f), 2, Quaternion.Euler(0f, i * 40f, 0f));
                var crown = MeshObject("Crown", tree.transform, crownKit, "Dev_GiantCrown_" + i, canopy, false);
                SetLayer(tree, layer);
                SetLayer(crown, layer);
                MarkStatic(tree);
                MarkStatic(crown);
            }

            // A giant root arching over the road: roots are the forest's roads (art bible §8).
            var arch = new MeshKit();
            for (int s = 0; s < 7; s++)
            {
                float t = s / 6f;
                float x = Mathf.Lerp(-10f, 10f, t);
                float y = Mathf.Sin(t * Mathf.PI) * 5.5f + 0.6f;
                float slope = Mathf.Cos(t * Mathf.PI) * 52f;
                arch.Box(new Vector3(x, y, 60f), new Vector3(3.6f, 1.6f, 2.2f), Quaternion.Euler(0f, 0f, slope));
            }
            var root = MeshObject("GiantRootArch", parent, arch, "Dev_RootArch", bark, true);
            MarkStatic(root);

            // A root you can climb: an 18 degree ramp onto a root platform.
            var ramp = new MeshKit();
            ramp.Box(new Vector3(-12f, 2.2f, 74f), new Vector3(3f, 0.8f, 14f), Quaternion.Euler(-18f, 0f, 0f));
            ramp.Box(new Vector3(-12f, 4.2f, 84f), new Vector3(6f, 0.8f, 6f), Quaternion.identity);
            var climb = MeshObject("RootRamp", parent, ramp, "Dev_RootRamp", bark, true);
            MarkStatic(climb);
        }

        /// <summary>Visible before reachable: the castle hill and a frost peak on the Landmark layer.</summary>
        static void HorizonLandmarks(Transform world)
        {
            var parent = new GameObject("HorizonLandmarks").transform;
            parent.SetParent(world, false);
            int layer = LayerMask.NameToLayer(ProjectSetup.LandmarkLayer);
            var stone = Palette.Get("pale_stone", Palette.BoneStone);
            var red = Palette.Get("nursery_red", Palette.NurseryRed, 0.3f);
            var moss = Palette.Get("forest_ground", Palette.Moss);
            var frost = Palette.Get("frost_peak", Palette.FrostWhite);

            // Cookie's castle: a nursery fossilised into a hill, on the horizon from the pad.
            var hillKit = new MeshKit();
            hillKit.Blob(Vector3.zero, new Vector3(62f, 40f, 52f), 2, Quaternion.identity);
            var hill = MeshObject("CastleHill", parent, hillKit, "Dev_CastleHill", moss, false);
            hill.transform.position = new Vector3(0f, -14f, 232f);
            var keep = new MeshKit();
            keep.Box(new Vector3(0f, 32f, 230f), new Vector3(24f, 14f, 16f), Quaternion.identity);
            keep.Prism(new Vector3(-12f, 25f, 222f), 3.4f, 20f, 8, 0.9f);
            keep.Prism(new Vector3(12f, 25f, 222f), 3.4f, 18f, 8, 0.9f);
            var castle = MeshObject("CastleKeep", parent, keep, "Dev_CastleKeep", stone, false);
            var toyTower = new MeshKit();
            toyTower.Prism(new Vector3(6f, 38f, 236f), 2.6f, 22f, 8, 1f);
            toyTower.Prism(new Vector3(6f, 60f, 236f), 3.4f, 7f, 8, 0f);
            var tower = MeshObject("NurseryTower", parent, toyTower, "Dev_NurseryTower", red, false);
            var peakKit = new MeshKit();
            peakKit.Blob(Vector3.zero, new Vector3(55f, 170f, 55f), 2, Quaternion.Euler(0f, 23f, 0f));
            var peak = MeshObject("FrostTooth", parent, peakKit, "Dev_FrostTooth", frost, false);
            peak.transform.position = new Vector3(-235f, -10f, 300f);
            foreach (var go in new[] { hill, castle, tower, peak })
            {
                SetLayer(go, layer);
                MarkStatic(go);
                go.GetComponent<MeshRenderer>().shadowCastingMode = ShadowCastingMode.Off;
            }
        }

        static void CameraCourse(Transform world)
        {
            var kit = new MeshKit();
            // L-shaped wall.
            kit.Box(new Vector3(24f, 2f, -6f), new Vector3(12f, 4f, 0.6f), Quaternion.identity);
            kit.Box(new Vector3(30f, 2f, -12f), new Vector3(0.6f, 4f, 12f), Quaternion.identity);
            // Narrow corridor, 1.6 m between walls.
            kit.Box(new Vector3(36.1f - 0.9f, 1.75f, -16f), new Vector3(0.6f, 3.5f, 10f), Quaternion.identity);
            kit.Box(new Vector3(36.1f + 0.9f, 1.75f, -16f), new Vector3(0.6f, 3.5f, 10f), Quaternion.identity);
            // Low arch: a 2.6 m ceiling for the indoor pull-in.
            kit.Box(new Vector3(23f, 2.9f, -18f), new Vector3(6f, 0.6f, 6f), Quaternion.identity);
            foreach (var corner in new[] { new Vector3(20.5f, 0f, -20.5f), new Vector3(25.5f, 0f, -20.5f), new Vector3(20.5f, 0f, -15.5f), new Vector3(25.5f, 0f, -15.5f) })
                kit.Box(corner + new Vector3(0f, 1.3f, 0f), new Vector3(0.6f, 2.6f, 0.6f), Quaternion.identity);
            // Ramps at 20 and 35 degrees.
            kit.Box(new Vector3(42f, Mathf.Sin(20f * Mathf.Deg2Rad) * 5f, 0f), new Vector3(3f, 0.4f, 10f), Quaternion.Euler(-20f, 0f, 0f));
            kit.Box(new Vector3(46f, Mathf.Sin(35f * Mathf.Deg2Rad) * 5f, 0f), new Vector3(3f, 0.4f, 10f), Quaternion.Euler(-35f, 0f, 0f));
            // Stairs: 0.3 m rise, inside the 0.4 m step offset.
            for (int i = 0; i < 6; i++)
                kit.Box(new Vector3(18f, 0.15f * (i + 1), 2f + i * 0.5f), new Vector3(3f, 0.3f * (i + 1), 0.5f), Quaternion.identity);
            // A 1 m ledge to jump onto, and a pillar to orbit.
            kit.Box(new Vector3(30f, 0.5f, 4f), new Vector3(4f, 1f, 4f), Quaternion.identity);
            kit.Prism(new Vector3(35f, 0f, 2f), 0.8f, 6f, 10, 1f);
            var course = MeshObject("CameraCourse", world, kit, "Dev_CameraCourse", Palette.Get("pale_stone", Palette.BoneStone), true);
            MarkStatic(course);
        }

        static void Boundary(Transform world)
        {
            var parent = new GameObject("Boundary").transform;
            parent.SetParent(world, false);
            float midX = (GroundMinX + GroundMaxX) * 0.5f;
            float midZ = (GroundMinZ + GroundMaxZ) * 0.5f;
            float width = GroundMaxX - GroundMinX;
            float depth = GroundMaxZ - GroundMinZ;
            Wall(parent, "North", new Vector3(midX, 15f, GroundMaxZ), new Vector3(width, 30f, 1f));
            Wall(parent, "South", new Vector3(midX, 15f, GroundMinZ), new Vector3(width, 30f, 1f));
            Wall(parent, "East", new Vector3(GroundMaxX, 15f, midZ), new Vector3(1f, 30f, depth));
            Wall(parent, "West", new Vector3(GroundMinX, 15f, midZ), new Vector3(1f, 30f, depth));
        }

        static void Wall(Transform parent, string name, Vector3 centre, Vector3 size)
        {
            var wall = new GameObject("Edge_" + name);
            wall.transform.SetParent(parent, false);
            wall.transform.position = centre;
            wall.AddComponent<BoxCollider>().size = size;
            MarkStatic(wall);
        }

        static GameObject Player(Vector3 spawn, out Transform model, out Renderer[] renderers)
        {
            var player = new GameObject("PF_Player");
            player.transform.position = spawn;
            var body = player.AddComponent<CharacterController>();
            body.height = 1.8f;
            body.radius = 0.35f;
            body.center = new Vector3(0f, 0.9f, 0f);
            body.stepOffset = 0.4f;
            body.slopeLimit = 50f;
            body.skinWidth = 0.04f;
            body.minMoveDistance = 0f;

            model = new GameObject("Model").transform;
            model.SetParent(player.transform, false);
            var wool = Palette.Get("player_wool", Palette.Wool);
            var copper = Palette.Get("copper", Palette.Copper, 0.5f, 0.6f);
            var soot = Palette.Get("bark", Palette.SootTimber);
            var capsule = Part(PrimitiveType.Capsule, "Body", model, new Vector3(0f, 0.9f, 0f), new Vector3(0.7f, 0.9f, 0.7f), wool);
            var facing = Part(PrimitiveType.Cube, "Facing", model, new Vector3(0f, 1.45f, 0.32f), new Vector3(0.2f, 0.1f, 0.12f), copper);
            var pack = Part(PrimitiveType.Cube, "Pack", model, new Vector3(0f, 1.15f, -0.32f), new Vector3(0.46f, 0.5f, 0.2f), soot);
            renderers = new[] { capsule.GetComponent<Renderer>(), facing.GetComponent<Renderer>(), pack.GetComponent<Renderer>() };

            player.AddComponent<PlayerInputReader>();
            player.AddComponent<LocalPlayerController>();
            return player;
        }

        static GameObject Part(PrimitiveType type, string name, Transform parent, Vector3 position, Vector3 scale, Material material)
        {
            var part = GameObject.CreatePrimitive(type);
            part.name = name;
            Object.DestroyImmediate(part.GetComponent<Collider>());
            part.transform.SetParent(parent, false);
            part.transform.localPosition = position;
            part.transform.localScale = scale;
            part.GetComponent<MeshRenderer>().sharedMaterial = material;
            return part;
        }

        static GameObject CameraRigObject(out Camera camera)
        {
            var rig = new GameObject("PF_CameraRig");
            rig.tag = "MainCamera";
            camera = rig.AddComponent<Camera>();
            camera.nearClipPlane = 0.1f;
            camera.farClipPlane = 400f;
            camera.fieldOfView = 60f;
            camera.clearFlags = CameraClearFlags.Skybox;
            rig.AddComponent<AudioListener>();
            rig.AddComponent<OrbitCameraRig>();
            return rig;
        }

        static GameObject MeshObject(string name, Transform parent, MeshKit kit, string assetName, Material material, bool collider)
        {
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            var mesh = SaveMesh(kit.ToMesh(assetName), assetName);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            go.AddComponent<MeshRenderer>().sharedMaterial = material;
            if (collider)
                go.AddComponent<MeshCollider>().sharedMesh = mesh;
            return go;
        }

        static Mesh SaveMesh(Mesh mesh, string assetName)
        {
            string path = _meshFolder + "/" + assetName + ".asset";
            if (AssetDatabase.LoadAssetAtPath<Mesh>(path) != null)
                AssetDatabase.DeleteAsset(path);
            AssetDatabase.CreateAsset(mesh, path);
            return mesh;
        }

        static void MarkStatic(GameObject go)
        {
            GameObjectUtility.SetStaticEditorFlags(go, StaticEditorFlags.BatchingStatic | StaticEditorFlags.OccludeeStatic | StaticEditorFlags.OccluderStatic | StaticEditorFlags.ContributeGI);
        }

        static void SetLayer(GameObject go, int layer)
        {
            if (layer >= 0)
                go.layer = layer;
        }
    }
}
