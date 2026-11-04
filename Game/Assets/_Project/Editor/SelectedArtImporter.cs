using UnityEditor;
using UnityEngine;

namespace PixelVocabFlight.Editor
{
    // Every PixelForge frame must stay a crisp, uncompressed pixel grid.
    public sealed class SelectedArtImporter : AssetPostprocessor
    {
        public const string PixelFolder = "Assets/_Project/Art/Resources/Pixel/";

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
        }
    }
}
