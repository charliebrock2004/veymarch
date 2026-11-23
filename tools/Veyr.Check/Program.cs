using System;
using Veyr.Content;
using Veyr.Sim;

var content = ContentCatalog.Slice();
var problems = ContentRules.Audit(content);
foreach (var problem in problems)
    Console.Error.WriteLine(problem);
Console.WriteLine("items " + content.Items.Count);
Console.WriteLine("spells " + content.Spells.Count);
Console.WriteLine("fingerprint " + ContentRules.Fingerprint(content));
Console.WriteLine(problems.Count == 0 ? "audit clean" : "audit failed");
return problems.Count == 0 ? 0 : 1;
