using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    // Uses supplied images as whole textures. UV crops preserve their aspect ratio;
    // two layers crossfade before scrolling reaches an image edge.
    public sealed class OceanBackdrop
    {
        private sealed class Ripple { public Image Image; public Vector2 Position; public float Age, Life; }
        private readonly RectTransform root;
        private readonly CanvasGroup alpha;
        private readonly RawImage[] water = new RawImage[2];
        private readonly RawImage extension;
        public const float SourceImageScale=1f;
        private readonly Image[] glints = new Image[30];
        private readonly Vector2[] glintPositions = new Vector2[30];
        private readonly List<Ripple> ripples = new List<Ripple>();
        private static Texture2D[] textures;
        private static Texture2D wideTexture;
        private static Sprite ring;
        private readonly float width, height;
        private float time, rippleTimer, opacity;
        public float AnimationSeconds => time;
        public int CurrentImage => (int)(time/30)%3;

        public OceanBackdrop(Transform parent,float width,float height)
        {
            this.width=width;this.height=height;
            if(textures==null)
            {
                textures=new Texture2D[3];
                for(int i=0;i<3;i++)
                {
                    textures[i]=PixelTerrain.Get(FlightEnvironment.Ocean,i);
                    if(!textures[i])throw new InvalidOperationException("Thiếu ảnh biển Ocean0"+(i+1));
                    textures[i].filterMode=FilterMode.Point;textures[i].wrapMode=TextureWrapMode.Clamp;
                }
            }
            if(!ring)ring=MakeRing();
            if(!wideTexture)
            {
                wideTexture=PixelTerrain.Get(FlightEnvironment.Ocean,3);
                if(!wideTexture)throw new InvalidOperationException("Thiếu ảnh biển mở rộng OceanWide");
                wideTexture.filterMode=FilterMode.Point;wideTexture.wrapMode=TextureWrapMode.Repeat;
            }
            root=UiKit.Rect("Ocean image layers",parent,0,0,width,height);
            alpha=root.gameObject.AddComponent<CanvasGroup>();alpha.blocksRaycasts=false;
            extension=UiKit.Rect("Wide water extension",root,0,0,width,height).gameObject.AddComponent<RawImage>();
            extension.texture=wideTexture;extension.raycastTarget=false;
            var detailPanel=UiKit.Rect("Smaller ocean scenery",root,width*(1-SourceImageScale)*.5f,0,width*SourceImageScale,height);
            var mask=detailPanel.gameObject.AddComponent<RectMask2D>();
            mask.softness=new Vector2Int(Mathf.RoundToInt(Mathf.Min(72,width*.06f)),0);
            for(int i=0;i<2;i++)
            {
                var go=UiKit.Rect("Supplied ocean image "+i,detailPanel,0,0,width*SourceImageScale,height).gameObject;
                water[i]=go.AddComponent<RawImage>();water[i].raycastTarget=false;
            }
            var random=new System.Random(937);
            for(int i=0;i<glints.Length;i++)
            {
                glintPositions[i]=new Vector2((float)random.NextDouble()*width,(float)random.NextDouble()*height);
                glints[i]=UiKit.Box("Water glimmer",root,0,0,3+i%3*2,2,Color.clear);
            }
            root.gameObject.SetActive(false);
        }

        public void Animate(float delta,float visibility,float multiplier)
        {
            opacity=visibility;root.gameObject.SetActive(visibility>.001f);
            alpha.alpha=visibility;
            if(visibility<=.001f)return;
            time+=delta*Mathf.Lerp(.85f,1.1f,Mathf.InverseLerp(1,1.5f,multiplier));
            int index=CurrentImage;float phase=time%30;
            float tileHeight=height*1.4f,tileWidth=tileHeight*wideTexture.width/wideTexture.height;
            extension.uvRect=new Rect(Mathf.Sin(time*.02f)*.02f,Mathf.Repeat(time*.032f,1),width/tileWidth,height/tileHeight);
            extension.color=Color.white;
            float blend=Mathf.SmoothStep(0,1,Mathf.Clamp01((phase-25)/5));
            SetLayer(water[0],textures[index],phase/30,1);
            SetLayer(water[1],textures[(index+1)%3],0,blend);
            for(int i=0;i<glints.Length;i++)
            {
                var position=glintPositions[i];
                float x=Mathf.Repeat(position.x+Mathf.Sin(time*.35f+i)*12,width);
                float y=Mathf.Repeat(position.y+time*21,height);
                glints[i].rectTransform.anchoredPosition=new Vector2(x,-y);
                float pulse=Mathf.Pow(Mathf.Max(0,Mathf.Sin(time*1.3f+i*1.7f)),6);
                glints[i].color=new Color(.68f,.94f,1,pulse*.25f);
            }
            rippleTimer+=delta;
            if(rippleTimer>1.6f)
            {
                rippleTimer=0;
                AddRipple(new Vector2(Mathf.Repeat(time*83,width),Mathf.Repeat(time*37,height)),2.8f);
            }
            for(int i=ripples.Count-1;i>=0;i--)
            {
                var item=ripples[i];item.Age+=delta;
                if(item.Age>=item.Life){UnityEngine.Object.Destroy(item.Image.gameObject);ripples.RemoveAt(i);continue;}
                float t=item.Age/item.Life,size=Mathf.Lerp(12,58,t);
                item.Position.y+=delta*18;
                item.Image.rectTransform.anchoredPosition=new Vector2(item.Position.x-size*.5f,-item.Position.y+size*.2f);
                item.Image.rectTransform.sizeDelta=new Vector2(size,size*.4f);
                item.Image.color=new Color(.68f,.94f,1,(1-t)*.22f);
            }
        }

        private void SetLayer(RawImage image,Texture2D texture,float progress,float alpha)
        {
            image.texture=texture;
            float visibleHeight=Mathf.Clamp01(height/(width*SourceImageScale*texture.height/texture.width));
            image.uvRect=new Rect(0,(1-visibleHeight)*Mathf.Clamp01(progress),1,visibleHeight);
            image.color=new Color(1,1,1,alpha);
        }

        public void Wake(float x,float y)
        {
            if(opacity>.01f)AddRipple(new Vector2(x*width,y*height),1.8f);
        }
        private void AddRipple(Vector2 position,float lifetime)
        {
            if(ripples.Count>=20)return;
            var image=UiKit.Box("Ocean ripple",root,0,0,12,5,Color.clear);image.sprite=ring;
            ripples.Add(new Ripple{Image=image,Position=position,Life=lifetime});
        }
        private static Sprite MakeRing()
        {
            var texture=new Texture2D(48,48,TextureFormat.RGBA32,false){filterMode=FilterMode.Point};
            for(int y=0;y<48;y++)for(int x=0;x<48;x++)
            {float distance=new Vector2(x-23.5f,y-23.5f).magnitude;texture.SetPixel(x,y,distance>20&&distance<23?Color.white:Color.clear);}
            texture.Apply();return Sprite.Create(texture,new Rect(0,0,48,48),new Vector2(.5f,.5f));
        }
    }
}
