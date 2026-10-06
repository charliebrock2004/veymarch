using System;
using Veyr.Content;
using Veyr.Sim;

var sim = new WorldSimulation("hearthfen", DeathMode.Adventure, 7);
var player = sim.SpawnPlayer("unmarked");
Console.WriteLine("wake fists health=" + player.Health);

sim.PlaceNode("creek_flint", "node_flint", 1f, 0f, 0.5f);
sim.PlaceNode("fallen_limb", "node_wood", -1f, 0f, 0.5f);
sim.TryGather("unmarked", "creek_flint");
sim.TryGather("unmarked", "creek_flint");
sim.TryGather("unmarked", "fallen_limb");
var craft = sim.TryCraft("unmarked", "recipe_stone_knife", StationId.Hand, "loop-knife");
var replay = sim.TryCraft("unmarked", "recipe_stone_knife", StationId.Hand, "loop-knife");
Console.WriteLine($"knife {craft.InstanceId} replay {replay.InstanceId}");
sim.TryEquip("unmarked", craft.InstanceId);

var wolf = sim.SpawnActor("mob_wolf", 1.1f, 0f);
while (wolf.Life == LifeState.Alive)
{
    player.Stamina = player.MaxStamina;
    var hit = sim.TryAttack("unmarked", wolf.Id, false);
    Console.WriteLine($"wolf hit {hit.Damage} hp {wolf.Health}");
}

player.X = player.SpawnX;
player.Z = player.SpawnZ;
Console.WriteLine("returned to the pad");

if (craft.InstanceId != replay.InstanceId || wolf.Life != LifeState.Dead)
    return 1;
return 0;
