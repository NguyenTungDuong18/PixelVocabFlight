using System;
using System.IO;
using UnityEngine;

namespace PixelVocabFlight
{
    // Player settings: three volumes (0-100, step 5), the window resolution and full screen. Saved as settings.json.
    // The folder is Application.persistentDataPath, or a sub-folder of the smoke output with --smoke-test (never the user's).
    [Serializable]
    public sealed class GameSettings
    {
        public const string FileName = "settings.json";
        public const int VolumeStep = 5;
        public static readonly (int width, int height)[] Resolutions = { (1280, 720), (1600, 900), (1920, 1080) };
        public const int DefaultResolution = 2;

        public int version = 1;
        public int master = 100, ambient = 100, effects = 100;
        public int resolution = DefaultResolution;
        public bool fullscreen = true;

        public (int width, int height) Size => Resolutions[Mathf.Clamp(resolution, 0, Resolutions.Length - 1)];
        public string ResolutionText { get { var s = Size; return s.width + "×" + s.height; } }

        public GameSettings Clamped()
        {
            master = Step(master); ambient = Step(ambient); effects = Step(effects);
            resolution = Mathf.Clamp(resolution, 0, Resolutions.Length - 1);
            return this;
        }

        public static int Step(int value) => Mathf.Clamp(Mathf.RoundToInt(value / (float)VolumeStep) * VolumeStep, 0, 100);

        // Missing or broken file: the defaults (Full HD, full screen, everything at 100).
        public static GameSettings Load(string folder)
        {
            try
            {
                string path = Path.Combine(folder, FileName);
                if (File.Exists(path)) return (JsonUtility.FromJson<GameSettings>(File.ReadAllText(path)) ?? new GameSettings()).Clamped();
            }
            catch (Exception exception) { Debug.LogWarning("settings.json hỏng, dùng mặc định: " + exception.Message); }
            return new GameSettings();
        }

        public void Save(string folder)
        {
            try
            {
                Directory.CreateDirectory(folder);
                File.WriteAllText(Path.Combine(folder, FileName), JsonUtility.ToJson(this, true));
            }
            catch (Exception exception) { Debug.LogWarning("Không lưu được settings.json: " + exception.Message); }
        }
    }
}
