using System;
using System.IO;
using UnityEngine;
using Veyr.Sim;

namespace Veyr.Client.Platform
{
    /// <summary>Local device settings in persistentDataPath, written through the same atomic store as saves.</summary>
    public sealed class SettingsService
    {
        public SettingsService(string directory = null)
        {
            Directory = string.IsNullOrEmpty(directory) ? Application.persistentDataPath : directory;
        }

        public string Directory { get; }
        public string FilePath => Path.Combine(Directory, "settings.json");
        public LocalSettings Current { get; private set; } = new LocalSettings();

        public LocalSettings Load()
        {
            try
            {
                Current = SettingsStore.Read(FilePath);
            }
            catch (Exception e) when (e is InvalidDataException || e is IOException || e is FormatException || e is UnauthorizedAccessException)
            {
                // First launch, or every copy failed its checksum: start from defaults rather than refuse to boot.
                Current = new LocalSettings();
            }
            Current.Clamp();
            return Current;
        }

        public void Save()
        {
            Current.Clamp();
            try
            {
                SettingsStore.Write(FilePath, Current);
            }
            catch (IOException e)
            {
                Debug.LogWarning("Veyr settings: could not save (" + e.Message + ").");
            }
        }
    }
}
