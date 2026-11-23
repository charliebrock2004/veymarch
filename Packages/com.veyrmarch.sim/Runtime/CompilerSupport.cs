// Unity 6 compiles C# 9 against .NET Standard 2.1, which does not ship this type.
// `init` accessors and records need it. Internal, so each assembly carries its own copy.
namespace System.Runtime.CompilerServices
{
    internal static class IsExternalInit
    {
    }
}
