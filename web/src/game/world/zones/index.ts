import { registerZone } from "../zone";

/**
 * The zones beyond Hearthfen and Cookie's Castle. Each is its own chunk, downloaded and built
 * the first time someone walks toward it.
 */
registerZone("kingdom", () => import("./kingdom").then((m) => m.buildKingdom));
