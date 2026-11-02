using UnityEditor;
using UnityEngine;

namespace PixelVocabFlight.Editor
{
    public sealed class SelectedArtImporter : AssetPostprocessor
    {
        private void OnPreprocessTexture()
        {
            if (!assetPath.StartsWith("Assets/_Project/Art/Resources/Ocean/") && assetPath != "Assets/_Project/Art/Resources/Art/UserEnemy.png" && assetPath != "Assets/_Project/Art/Resources/Art/UserMissile.png" &&
                assetPath != "Assets/_Project/Art/Resources/Art/UserPlayer.png" && assetPath != "Assets/_Project/Art/Resources/Art/UserCarrier.png") return;
            var importer = (TextureImporter)assetImporter;
            importer.textureType = TextureImporterType.Default;
            importer.npotScale = TextureImporterNPOTScale.None;
            importer.filterMode = FilterMode.Point;
            importer.wrapMode = assetPath.EndsWith("OceanWide.png")?TextureWrapMode.Repeat:TextureWrapMode.Clamp;
            importer.mipmapEnabled = false;
            importer.textureCompression = TextureImporterCompression.Uncompressed;
            importer.maxTextureSize = 2048;
        }
    }
}
