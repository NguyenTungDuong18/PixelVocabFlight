using UnityEditor;
using UnityEngine;

namespace PixelVocabFlight.Editor
{
    // The title music (Audio/Music/Resources/Music/*.wav) is scheduled on the audio clock to the sample, so it is kept in memory as Vorbis
    // (Compressed In Memory: it can start on time, which a stream may not), preloaded, stereo, never normalised or resampled.
    public sealed class MusicImporter : AssetPostprocessor
    {
        public const string MusicFolder = "Assets/_Project/Audio/Music/";

        // Bumped when Configure changes so Unity reimports the files already imported.
        public override uint GetVersion() => 1;

        private void OnPreprocessAudio()
        {
            if (!assetPath.StartsWith(MusicFolder)) return;
            Configure((AudioImporter)assetImporter);
        }

        public static void Configure(AudioImporter importer)
        {
            importer.forceToMono = false;
            importer.loadInBackground = false;
            importer.ambisonic = false;
            var settings = new AudioImporterSampleSettings
            {
                loadType = AudioClipLoadType.CompressedInMemory,
                compressionFormat = AudioCompressionFormat.Vorbis,
                quality = .75f,
                sampleRateSetting = AudioSampleRateSetting.PreserveSampleRate,
                preloadAudioData = true,
            };
            importer.defaultSampleSettings = settings;
        }
    }
}
