using UnityEditor;
using UnityEngine;

namespace PixelVocabFlight.Editor
{
    // Every PixelForge frame must stay a crisp, uncompressed pixel grid.
    public sealed class SelectedArtImporter : AssetPostprocessor
    {
        public const string PixelFolder = "Assets/_Project/Art/Resources/Pixel/";

        // Bumped when Configure changes so Unity reimports already imported frames (0.15: readable Ground tiles).
        public override uint GetVersion() => 2;

        private void OnPreprocessTexture()
        {
            if (!assetPath.StartsWith(PixelFolder)) return;
            Configure((TextureImporter)assetImporter, assetPath);
        }

        public static void Configure(TextureImporter importer, string path)
        {
            importer.textureType = TextureImporterType.Default;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.filterMode = path.Contains("_blur_") ? FilterMode.Bilinear : FilterMode.Point;
            importer.wrapMode = path.Contains("title_clouds") ? TextureWrapMode.Repeat : TextureWrapMode.Clamp;
            importer.mipmapEnabled = false;
            importer.alphaIsTransparency = true;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.maxTextureSize = 2048;
            // BaseView composes the walkable base ground from these 16x16 tiles on the CPU (GetPixels32).
            importer.isReadable = path.Contains("/Ground/");
        }
    }
}
