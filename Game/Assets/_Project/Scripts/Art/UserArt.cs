using System;
using UnityEngine;

namespace PixelVocabFlight
{
    // All four runtime models are self-contained transparent PNG resources.
    public static class UserArt
    {
        private static Sprite enemy, missile, player, carrier;
        public static Sprite Enemy => enemy ? enemy : enemy = Load("Art/UserEnemy");
        public static Sprite Missile => missile ? missile : missile = Load("Art/UserMissile");
        public static Sprite Player => player ? player : player = Load("Art/UserPlayer");
        public static Sprite Carrier => carrier ? carrier : carrier = Load("Art/UserCarrier");
        private static Sprite Load(string path)
        {
            var texture = Resources.Load<Texture2D>(path);
            if (!texture) throw new InvalidOperationException("Thiếu hình được chọn: " + path);
            texture.filterMode = FilterMode.Point;
            return Sprite.Create(texture, new Rect(0,0,texture.width,texture.height), new Vector2(.5f,.5f), 100, 0, SpriteMeshType.FullRect);
        }
    }
}
