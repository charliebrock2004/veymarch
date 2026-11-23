# Phase 3 device note — movement on a real phone (T015, T016, checkpoint 1)

This is the first human checkpoint. Nothing here has been run yet: there was no Unity editor and no phone in the agent's environment. Every number in the report table must come from the device. Leave a cell empty rather than guess.

## What you need

- Unity Hub with **Unity 6.3 LTS (6000.3.x)** and the **Android Build Support** module, including OpenJDK and the Android SDK & NDK tools.
- A mid-range Android phone. The programme's gate device is the "mid Android" class: about 6–8 GB RAM, a recent mid-tier SoC. Enable **Developer options → USB debugging**.
- A USB cable. `adb` comes with the SDK Unity installs.
- iOS is optional at this checkpoint and needs your signing account.

## First open (about 15 minutes, once)

1. Unity Hub → **Add project from disk** → choose the repository folder.
   If the Hub offers a different 6000.3 patch than `6000.3.25f1`, accept it. The editor rewrites `ProjectSettings/ProjectVersion.txt`. Commit that file.
2. Wait for the import. If Package Manager reports a version for URP, Test Framework, or uGUI that the editor doesn't bundle, accept the editor's version.
   If it asks **"Enable the new input backends?"**, answer **Yes**. The editor restarts.
3. Menu **Veyrmarch → Setup → Run All Setup Steps**. The Console prints a report. It does the following:
   - Configures the player: landscape, IL2CPP, ARM64, Vulkan with GLES3, linear colour, frame timing stats, Input System, and the `Landmark` layer.
   - Creates the Low/Medium/High URP assets.
   - Generates `Boot`, `Dev_Move`, and `Forest_Blockout` with the player, camera, and HUD.
4. **Restart the editor once** so Active Input Handling takes effect.
5. Menu **Veyrmarch → Validate Project**. It must say `clean`. If it doesn't, the message names the fix.
6. **Window → General → Test Runner**:
   - EditMode: run all. This covers the sim, server, and client-core tests (about 134).
   - PlayMode: run all. This covers 4 smoke tests in `Veyr.Tests.Play`.
   - Note any failure in the report below. Do not continue to the phone with a red test.
7. Commit what the editor created: `.meta` files, the scenes, `Assets/_Project/Generated`, `Assets/_Project/Settings`, `Assets/_Project/Prefabs`, `Assets/_Project/Art`, and the changed `ProjectSettings`.

Command-line alternative for steps 3 and 5:
`Unity -batchmode -projectPath . -executeMethod Veyr.EditorTools.VeyrSetup.BatchSetup -quit -logFile setup.log`. Exit code 0 means clean.

## Editor smoke (5 minutes)

Open `Assets/_Project/Scenes/Boot.unity` and press Play.

- **WASD** walk, **Shift** sprint, **Space** jump, **K** dodge, **J** or left mouse strike, **right mouse drag** look.
- The overlay at the top-left shows frame ms, tick, and tier. The tick should rise by about 20 per second.
- Walk into the stone L-wall and the 1.6 m corridor east of the pad. The camera should pull in and never enter the capsule.
- Press **Next test** (top-right) to switch to `Forest_Blockout`.

The editor result is not the checkpoint. It only shows the build is worth putting on a phone.

## Phone build

1. **File → Build Profiles** (or Build Settings) → **Android** → **Switch Platform**.
2. Tick **Development Build**. The scene list should read Boot, Dev_Move, Forest_Blockout.
3. Connect the phone → **Build And Run**.
   Command line: `-executeMethod Veyr.EditorTools.VeyrSetup.BatchBuildAndroid` writes `Builds/Android/veyrmarch-dev.apk`; then run `adb install -r Builds/Android/veyrmarch-dev.apk`.

## The 10-minute walk (T016)

1. Launch. You land on the Hearthfen pad in `Dev_Move`, the near-empty scene the frame gate is measured in.
2. Walk for **10 minutes**: the road, the camera course, ramps, stairs, the ledge (jump), the corridor and the low arch. Try sprint at the stick rim, a dodge button, a **dodge flick** (short fast swipe on the right half), and jump.
3. Press **Next test** and walk `Forest_Blockout` for 10 more minutes. The forest is the performance test (design bible §49).
4. Note the overlay numbers. A screenshot is ideal.
5. Pull the log: `adb pull /sdcard/Android/data/com.veyrmarch.slice/files/device_logs/ .`
   Each CSV has one row per second and `# summary` lines with the whole-run median, p95, and p99.

## Report (fill in and append to DEVELOPMENT_LOG.md)

| Field | Dev_Move | Forest_Blockout |
| --- | --- | --- |
| Phone model / Android version | | |
| SoC / RAM | | |
| Tier chosen (overlay) and render height | | |
| Minutes walked | | |
| Run median frame ms (CSV summary) | | |
| p95 / p99 frame ms | | |
| GPU ms (overlay or CSV) | | |
| Reserved memory MB | | |
| Thermal step-downs (overlay "thermal -n") | | |
| Battery start → end | | |
| Crashes, errors, freezes | | |

Gate (programme Phase 3): **median frame ≤ 33 ms in `Dev_Move` on the mid device.** If it is over, stop: content work does not continue until it is fixed (programme §8).

Feel notes, in your words (this is a human judgement, not a number):

- Stick: dead zone, sprint at the rim, does the stick follow the thumb?
- Look: speed, direction (drag up = look up), any jitter?
- Dodge button and dodge flick: does the flick fire when you mean it and not when you look?
- Camera: does it fight you near walls? Does it ever end up inside the body or a wall?
- Snaps: does the body ever jump backwards (a refused move)?
- Text and buttons readable in daylight?

## What the agent can and cannot claim

- Can claim: the sources compile against Unity's language limits and hand-written API declarations, and 134 edit-mode tests pass on .NET 8.
- Cannot claim: that Unity compiled it, that the generator ran, that the play-mode tests passed, or any frame time. Those are yours at this checkpoint.
