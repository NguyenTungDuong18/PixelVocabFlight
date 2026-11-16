using UnityEditor;
using UnityEngine;

namespace PixelVocabFlight.Editor
{
    // Every PixelForge frame must stay a crisp, uncompressed pixel grid.
    public sealed class SelectedArtImporter : AssetPostprocessor
    {
        public const string PixelFolder = "Assets/_Project/Art/Resources/Pixel/";

        // Bumped when Configure changes so Unity reimports already imported frames (3: Sprite type for the editor).
        public override uint GetVersion() => 4;

        public const string FontFolder = "Assets/_Project/Art/Resources/Fonts/";

        // WordwingVi / WordwingEn (16 px em) must stay hard-edged: hinted raster, dynamic glyphs. VT323 is untouched.
        private void OnPreprocessAsset()
        {
            if (assetImporter is TrueTypeFontImporter font) ConfigureFont(font, assetPath);
        }

        public static void ConfigureFont(TrueTypeFontImporter importer, string path)
        {
            if (!path.StartsWith(FontFolder + "Wordwing")) return;
            importer.fontRenderingMode = FontRenderingMode.HintedRaster;
            importer.fontTextureCase = FontTextureCase.Dynamic;
        }

        private void OnPreprocessTexture()
        {
            if (!assetPath.StartsWith(PixelFolder)) return;
            Configure((TextureImporter)assetImporter, assetPath);
        }

        public static void Configure(TextureImporter importer, string path)
        {
            // Sprite type only so frames can be dragged into a scene or the Animation window; the game itself
            // still loads the Texture2D and builds its own Sprite with the manifest pivot (PixelSprites).
            importer.textureType = TextureImporterType.Sprite;
            importer.spriteImportMode = SpriteImportMode.Single;
            importer.spritePixelsPerUnit = 16; // 1 base tile = 1 Unity unit
            importer.spritePivot = new Vector2(.5f, .5f);
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
