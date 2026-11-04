const fs=require('fs');function edit(p,fn){let s=fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');fs.writeFileSync(p,fn(s));}
const r='Game/Assets/_Project/Scripts/';
edit(r+'Art/ScrollingTerrain.cs',s=>{const a=s.indexOf('            const int w = 320, h = 128;');const b=s.lastIndexOf('\n        }');return s.slice(0,a)+`            var texture=PixelTerrain.Get(environment);
            return Sprite.Create(texture,new Rect(0,0,texture.width,texture.height),new Vector2(.5f,.5f));`+s.slice(b);});
edit(r+'Art/ScrollingTerrain.cs',s=>s.replace(':.46f *',':.85f *'));
edit(r+'Art/OceanBackdrop.cs',s=>s.replace('Resources.Load<Texture2D>("Ocean/Ocean0"+(i+1))','PixelTerrain.Get(FlightEnvironment.Ocean,i)').replace('Resources.Load<Texture2D>("Ocean/OceanWide")','PixelTerrain.Get(FlightEnvironment.Ocean,3)').replace('public const float SourceImageScale=.65f','public const float SourceImageScale=1f').replace('alpha.alpha=visibility*.82f','alpha.alpha=visibility').replace('extension.color=new Color(.72f,.9f,1,1)','extension.color=Color.white').replace('image.color=new Color(.72f,.9f,1,alpha)','image.color=new Color(1,1,1,alpha)'));
// Cache sprites as well as textures: rebuilding a menu must not leak Unity native objects.
edit(r+'Art/ScrollingTerrain.cs',s=>s.replace('private readonly Sprite[] textures = new Sprite[4];','private static readonly Sprite[] textures = new Sprite[4];').replace('textures[i] = Generate((FlightEnvironment)i);','if(!textures[i]) textures[i] = Generate((FlightEnvironment)i);'));
