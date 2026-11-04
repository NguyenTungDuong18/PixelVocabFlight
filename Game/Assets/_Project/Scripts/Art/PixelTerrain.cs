using UnityEngine;
namespace PixelVocabFlight
{
    // Small, repeatable tile maps drawn on a real pixel grid and shared across screens.
    public static class PixelTerrain
    {
        private static readonly Texture2D[] cache = new Texture2D[7];
        public static Texture2D Get(FlightEnvironment environment,int variant=0)
        {
            int index=(int)environment+(environment==FlightEnvironment.Ocean?variant:0);
            if(cache[index])return cache[index];
            const int w=384,h=160;
            var tex=new Texture2D(w,h,TextureFormat.RGBA32,false){filterMode=FilterMode.Point,wrapMode=TextureWrapMode.Repeat};
            var pixels=new Color[w*h];var rng=new System.Random(1944+index);
            Color C(string hex)=>UiKit.Hex(hex);
            void Rect(int x,int y,int width,int height,Color color)
            {
                for(int yy=y;yy<y+height;yy++)for(int xx=x;xx<x+width;xx++)pixels[((yy%h+h)%h)*w+(xx%w+w)%w]=color;
            }
            for(int y=0;y<h;y++)for(int x=0;x<w;x++)
            {
                int patch=(int)(Mathf.PerlinNoise(x*.045f,Mathf.Sin(y*Mathf.PI*2/h)*1.5f+10)*4);
                Color color;
                if(environment==FlightEnvironment.Jungle)color=patch<2?C("40553A"):C("4C6140");
                else if(environment==FlightEnvironment.Desert)color=patch<2?C("AD8D55"):C("B99B62");
                else if(environment==FlightEnvironment.Ice)color=patch<2?C("AAB7AF"):C("BAC6BC");
                else color=patch<2?C("284C59"):C("2E5661");
                pixels[y*w+x]=color;
            }
            if(environment==FlightEnvironment.Ocean)
            {
                for(int i=0;i<330;i++)Rect(rng.Next(w),rng.Next(h),rng.Next(2,9),1,i%3==0?C("4D7478"):C("355F6B"));
                if(variant<3)
                {
                    for(int y=0;y<h;y++)
                    {
                        int coast=20+(int)(Mathf.Sin(y*Mathf.PI*2/h)*8);
                        Rect(0,y,coast+4,1,C("A39C6F"));Rect(0,y,coast,1,C("5C6944"));
                    }
                }
            }
            else
            {
                // Road and airstrip stay away from the central combat area.
                Rect(302,0,10,h,environment==FlightEnvironment.Ice?C("738785"):C("786F51"));
                Rect(304,0,1,h,C("C2B589"));
                Rect(326,39,32,83,C("424B41"));
                Rect(329,42,26,77,C("6A705B"));
                for(int y=46;y<116;y+=12)Rect(341,y,2,6,C("D9CDA3"));
                for(int i=0;i<10;i++){int x=315+(i%2)*48,y=12+(i/2)*29;Rect(x+2,y+2,12,9,C("323D34"));Rect(x,y,12,8,C("7C8060"));Rect(x+1,y,10,2,C("B4AC7C"));}
                if(environment==FlightEnvironment.Jungle)
                {
                    for(int y=0;y<h;y++){int river=92+(int)(Mathf.Sin(y*Mathf.PI*2/h)*14);Rect(river-3,y,20,1,C("7A8052"));Rect(river,y,14,1,C("41656A"));}
                    for(int i=0;i<230;i++){int x=rng.Next(288),y=rng.Next(h);if(x>69&&x<124)continue;Rect(x+2,y+3,7,6,C("293E2D"));Rect(x,y,8,6,C("334B31"));Rect(x+1,y,5,2,C("65764B"));}
                }
                if(environment==FlightEnvironment.Desert)
                    for(int i=0;i<75;i++){int x=rng.Next(290),y=rng.Next(h);Rect(x,y,18,1,C("CBB17B"));Rect(x+4,y+1,17,1,C("997B4D"));}
                if(environment==FlightEnvironment.Ice)
                    for(int i=0;i<90;i++){int x=rng.Next(290),y=rng.Next(h);Rect(x+1,y+3,6,5,C("849D96"));Rect(x,y,4,6,C("516B62"));Rect(x,y,3,2,C("D8DED0"));}
            }
            tex.SetPixels(pixels);tex.Apply();cache[index]=tex;return tex;
        }
    }
}
