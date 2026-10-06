using System.Collections;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityEngine.TestTools;
using Veyr.App;
using Veyr.Client;
using Veyr.Client.Core;
using Veyr.Client.Input;
using Veyr.Client.Player;

namespace Veyr.Tests.Play
{
    /// <summary>
    /// Play-mode smoke for Phase 1–2 (T007, T010, T011, T013). Needs Boot and Dev_Move in the build
    /// list: run Veyrmarch > Setup first. These run in the editor; they are not a device result.
    /// </summary>
    public class DevMoveTests
    {
        const float Timeout = 10f;

        [UnitySetUp]
        public IEnumerator CleanSlate()
        {
            foreach (var driver in Object.FindObjectsByType<SessionDriver>(FindObjectsSortMode.None))
                Object.Destroy(driver.gameObject);
            yield return null;
        }

        [UnityTest]
        public IEnumerator BootLoadsDevMoveAndTheTickAdvances()
        {
            SceneManager.LoadScene("Boot", LoadSceneMode.Single);
            SceneRoot root = null;
            yield return WaitFor(() => (root = Object.FindAnyObjectByType<SceneRoot>()) != null && root.IsBound);
            Assert.That(root, Is.Not.Null, "Dev_Move did not load and bind from Boot.");
            Assert.That(root.IsBound, Is.True);
            Assert.That(Object.FindObjectsByType<LocalPlayerController>(FindObjectsSortMode.None).Length, Is.EqualTo(1));
            Assert.That(Object.FindObjectsByType<SessionDriver>(FindObjectsSortMode.None).Length, Is.EqualTo(1));

            long start = root.Driver.Context.Endpoint.ServerTick;
            yield return new WaitForSecondsRealtime(1f);
            long ticks = root.Driver.Context.Endpoint.ServerTick - start;
            Assert.That(ticks, Is.InRange(15, 25), "A real second should be about 20 sim ticks.");
        }

        [UnityTest]
        public IEnumerator AScriptedStickMovesTheBodyAndTheSimAgrees()
        {
            var root = default(SceneRoot);
            yield return LoadDevMove(r => root = r);
            var player = root.Player;
            var input = root.InputReader;
            Vector3 start = player.transform.position;
            input.Scripted = true;
            input.ScriptedFrame = new PlayerInputFrame { Move = new Vector2(0f, 1f) };
            yield return new WaitForSecondsRealtime(1.5f);
            input.ScriptedFrame = new PlayerInputFrame();
            yield return new WaitForSecondsRealtime(0.3f);

            Vector3 moved = player.transform.position - start;
            moved.y = 0f;
            Assert.That(moved.magnitude, Is.GreaterThan(4f), "Walking 1.5 s at 4.2 m/s should cover more than 4 m.");
            Assert.That(player.Snaps, Is.EqualTo(0), "The authority refused an honest walk.");
            Assert.That(root.Driver.Context.Endpoint.Latest.TryGet(player.ActorId, out var body), Is.True);
            Vector3 server = new Vector3(body.X, body.Y, body.Z);
            Assert.That(Vector3.Distance(server, player.transform.position), Is.LessThan(0.6f));
        }

        [UnityTest]
        public IEnumerator TheCameraStaysOutOfTheBodyAgainstAWall()
        {
            var root = default(SceneRoot);
            yield return LoadDevMove(r => root = r);
            var player = root.Player.transform;
            var wall = GameObject.CreatePrimitive(PrimitiveType.Cube);
            wall.transform.position = player.position + new Vector3(0f, 1.5f, -0.9f);
            wall.transform.localScale = new Vector3(6f, 4f, 0.4f);
            var rig = root.CameraRig;
            var cam = rig.ViewCamera.transform;
            for (int i = 0; i < 72; i++)
            {
                rig.Rig.ApplyLook(5f, i % 2 == 0 ? 3f : -3f);
                yield return null;
                var feet = player.position;
                Assert.That(OrbitRig.InsideCapsule(feet.ToNumerics(), cam.position.ToNumerics(), 0.35f, 1.8f), Is.False, "Camera entered the body at step " + i);
            }
            Object.Destroy(wall);
        }

        [UnityTest]
        public IEnumerator ReloadingDevMoveKeepsOneSession()
        {
            var root = default(SceneRoot);
            yield return LoadDevMove(r => root = r);
            long tick = root.Driver.Context.Endpoint.ServerTick;
            yield return LoadDevMove(r => root = r);
            Assert.That(Object.FindObjectsByType<SessionDriver>(FindObjectsSortMode.None).Length, Is.EqualTo(1));
            Assert.That(root.Driver.Context.Endpoint.ServerTick, Is.GreaterThanOrEqualTo(tick));
        }

        static IEnumerator LoadDevMove(System.Action<SceneRoot> found)
        {
            SceneManager.LoadScene("Dev_Move", LoadSceneMode.Single);
            SceneRoot root = null;
            yield return WaitFor(() => (root = Object.FindAnyObjectByType<SceneRoot>()) != null && root.IsBound);
            Assert.That(root, Is.Not.Null, "Dev_Move has no SceneRoot.");
            Assert.That(root.IsBound, Is.True, "Dev_Move did not start a dev session.");
            found(root);
        }

        static IEnumerator WaitFor(System.Func<bool> condition)
        {
            float until = Time.realtimeSinceStartup + Timeout;
            while (!condition() && Time.realtimeSinceStartup < until)
                yield return null;
        }
    }
}
