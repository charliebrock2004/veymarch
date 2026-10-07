import { registerZone } from "../zone";

/**
 * The zones beyond Hearthfen and Cookie's Castle. Each is its own chunk, downloaded and built
 * the first time someone walks toward it.
 */
registerZone("kingdom", () => import("./kingdom").then((m) => m.buildKingdom));
registerZone("hunt", () => import("./hunt").then((m) => m.buildHunt));
registerZone("kennel", () => import("./kennel").then((m) => m.buildKennel));
registerZone("mire", () => import("./mire").then((m) => m.buildMire));
registerZone("keep", () => import("./keep").then((m) => m.buildKeep));
