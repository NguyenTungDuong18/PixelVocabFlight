const fs=require('fs');
const base='Game/Assets/_Project/';
function edit(p,fn){let s=fs.readFileSync(base+p,'utf8').replace(/^\uFEFF/,'').replace(/\r\n/g,'\n');fs.writeFileSync(base+p,fn(s));}
edit('Scripts/UI/UiKit.cs',s=>s.replace('Hex("0B1720")','Hex("191D18")').replace('Hex("11252D")','Hex("30392F")').replace('Hex("25404A")','Hex("505944")').replace('Hex("8CA7AF")','Hex("B5BA9B")').replace('Hex("F2EBD8")','Hex("F2E7C9")').replace('Hex("A6E7CC")','Hex("D3BC78")').replace('Hex("F0B779")','Hex("E2A75B")').replace('Hex("F18D7C")','Hex("E58F70")').replace('            image.raycastTarget = false;\n            return image;',`            image.raycastTarget = false;
            if (name == "Dialog" || name == "Telemetry" || name == "Question panel")
                WarVisuals.Frame(image.rectTransform,w,h);
            return image;`).replace('            image.raycastTarget = true;\n            var button','            image.raycastTarget = true;\n            WarVisuals.Frame(image.rectTransform,w,h,false);\n            var button'));
edit('Scripts/Art/UserArt.cs',s=>s.replace('player, carrier;','player, carrier, hangar;').replace('        private static Sprite Load','        public static Sprite Hangar => hangar ? hangar : hangar = Load("War/Hangar");\n        private static Sprite Load').replace('"Art/UserEnemy"','"War/Enemy"').replace('"Art/UserMissile"','"War/Rocket"').replace('"Art/UserPlayer"','"War/Fighter"').replace('"Art/UserCarrier"','"War/Carrier"'));
edit('Editor/SelectedArtImporter.cs',s=>s.replace('if (!assetPath.StartsWith(','if (!assetPath.StartsWith("Assets/_Project/Art/Resources/War/") && !assetPath.StartsWith('));
edit('Editor/PrototypeBuild.cs',s=>s.replace('0.11.0','0.12.0').replace('"Art/UserEnemy",','"War/Fighter", "War/Enemy", "War/Rocket", "War/Carrier", "War/Hangar", "Art/UserEnemy",'));
edit('Scripts/UI/FlightView.cs',s=>{
s=s.replace('private ScrollingTerrain hangarTerrain;','private ScrollingTerrain hangarTerrain;\n        private RectTransform hangarProp, hangarPlane;\n        private float hangarTime;');
s=s.replace('Setup = null; hangarTerrain = null; pos.Hide();','Setup = null; hangarTerrain = null; hangarProp = hangarPlane = null; pos.Hide();');
const a=s.indexOf('            var panel = ClearOverlay(75, 80, 1290, 740);'),b=s.indexOf('\n        public void ShowMenu',a);
if(a<0||b<0)throw Error('hangar section');
s=s.slice(0,a)+`            var panel = ClearOverlay(45, 38, 1350, 824);
            UiKit.Label("WORDWING",panel,36,22,650,64,49,UiKit.Cream,true);
            UiKit.Label("FLIGHT COMMAND  /  PHI ĐỘI TỪ VỰNG",panel,39,88,730,28,14,UiKit.Mint,true);
            UiKit.Label("OPERATIONS • 1944",panel,968,43,340,32,17,UiKit.Muted,true,TextAnchor.MiddleRight);
            var preview=UiKit.Box("Hangar scene",panel,32,141,716,601,Color.white);
            preview.sprite=UserArt.Hangar;
            UiKit.Box("Hangar caption shade",preview.transform,0,463,716,138,new Color(.07f,.09f,.07f,.9f));
            hangarPlane=UiKit.Rect("Hangar aircraft",preview.transform,205,178,290,290);
            UiKit.Box("Aircraft shadow",hangarPlane,14,14,280,280,new Color(0,0,0,.3f)).sprite=UserArt.Player;
            var plane=UiKit.Box("Fighter",hangarPlane,0,0,280,280,Color.white);plane.sprite=UserArt.Player;plane.preserveAspect=true;
            hangarProp=WarVisuals.Propeller(hangarPlane,140,36,92);
            UiKit.Label("SKYLARK  /  MK. I",preview.transform,27,477,650,43,29,UiKit.Cream,true);
            UiKit.Label("CHUỘT: LÁI    •    TAB: LÁI / BẮN\\nGõ đáp án + Enter để khai hỏa. Né địch khi đèn cảnh báo.",preview.transform,28,529,660,53,16,UiKit.Muted);
            UiKit.Label("LỆNH XUẤT KÍCH",panel,786,143,510,33,23,UiKit.Cream,true);
            UiKit.Label("01 / CHỌN CHIẾN TRƯỜNG",panel,786,191,510,25,12,UiKit.Mint,true);
            string[] descriptions={"Rừng nhiệt đới • mật độ địch +30%","Bắc Phi • trả lời kèm từ loại","Mặt trận mùa đông • giáp hai lớp","Thái Bình Dương • tàu & rocket"};
            for(int i=0;i<4;i++)
            {
                int selected=i; float y=233+i*80;
                var button=UiKit.Button(((int)environment==i?"●  ":"○  ")+EnvironmentNames[i],panel,786,y,528,66,
                    (int)environment==i?UiKit.Mint:UiKit.Line,(int)environment==i?UiKit.Ink:UiKit.Cream,()=>game.ChooseStartingEnvironment(selected));
                var label=button.GetComponentInChildren<Text>();label.fontSize=19;label.alignment=TextAnchor.UpperLeft;
                label.rectTransform.anchoredPosition=new Vector2(16,-8);
                UiKit.Label(descriptions[i],button.transform,17,35,490,24,13,(int)environment==i?UiKit.Ink:UiKit.Muted);
            }
            int count=filter.from>=1&&filter.to<=available&&filter.to>=filter.from?filter.to-filter.from+1:0;
            UiKit.Label(count.ToString("N0")+" MỤC TỪ  /  5 GIÁP  /  3 LƯỢT ĐỔI",panel,786,566,528,30,15,UiKit.Mint,true);
            UiKit.Button("02 / CHUẨN BỊ BỘ TỪ",panel,786,614,528,51,UiKit.Line,UiKit.Cream,game.OpenVocabulary);
            UiKit.Button("CẤT CÁNH  →",panel,786,684,528,64,UiKit.Mint,UiKit.Ink,game.StartFlight);
            UiKit.Label("PHIÊN BẢN 0.12   •   PIXEL SQUADRON",panel,34,772,700,25,12,UiKit.Muted,true);
            UiKit.Label("MỖI CHIẾN TRƯỜNG 03:00",panel,925,772,390,25,12,UiKit.Muted,true,TextAnchor.MiddleRight);
        }

        public void AnimateHangar(float delta, FlightEnvironment environment)
        {
            hangarTerrain?.Animate(delta,environment,.25f);
            hangarTime+=delta;
            if(hangarProp)WarVisuals.Spin(hangarProp,hangarTime);
            if(hangarPlane)hangarPlane.anchoredPosition=new Vector2(205,-178+Mathf.Sin(hangarTime*2)*2);
        }
`+s.slice(b);
s=s.replace('CONTINUOUS FLIGHT','FLIGHT COMMAND').replace('NGHĨA CẦN TÌM  /  CÁC MÁY BAY KHÁC BẤT TỬ','ĐIỆN ĐÀI / GIẢI MÃ MỤC TIÊU').replace('TẠM DỪNG CHUYẾN BAY','TẠM NGỪNG XUẤT KÍCH').replace('CHUYẾN BAY ĐÃ KẾT THÚC','BÁO CÁO SAU NHIỆM VỤ').replace('Nền biển: ba ảnh người dùng cung cấp; các vùng khác tạo bằng mã. Sprite địch/tên lửa tạo bằng imagegen. Máy bay người chơi từ maybayta.jpg; tàu từ Pixel-Art Aircraft Carrier 78.png, chuẩn bị nền bằng imagegen.','Đồ họa 0.12: máy bay, tàu, rocket và hangar pixel mới tạo bằng imagegen. Địa hình, bảng điều khiển, tiếp tế và hiệu ứng chuyển động được vẽ bằng mã. Lấy cảm hứng hàng không thập niên 1940.');
return s;});
edit('Scripts/UI/VocabularySetupView.cs',s=>s.replace('WORDWING  /  THƯ VIỆN TỪ VỰNG','FLIGHT COMMAND  /  HỒ SƠ HUẤN LUYỆN').replace('CHỌN BỘ HỌC TRƯỚC CHUYẾN BAY','CHUẨN BỊ ĐIỆN MẬT CHO PHI ĐỘI'));
edit('Scripts/Aircraft/FlightBoardView.cs',s=>{
s=s.replace('public Image Shield, Body;','public Image Shield, Body; public RectTransform LeftProp, RightProp;');
s=s.replace('private readonly Image flame, playerBody;','private readonly Image flame, playerBody;\n        private readonly RectTransform playerProp;\n        private float animationTime, previousX=.5f, trailTimer;');
s=s.replace('UiKit.Label("YOU", player','playerProp=WarVisuals.Propeller(player,33,8,25);\n            UiKit.Label("01", player');
s=s.replace('            flame.rectTransform.sizeDelta = new Vector2(flight?.Progress.Powered == true ? 12 : 8, 19 + Mathf.Sin(Time.unscaledTime * 20) * 4);','            animationTime+=delta; trailTimer+=delta;\n            flame.gameObject.SetActive(false);\n            WarVisuals.Spin(playerProp,animationTime);');
s=s.replace('                Place(player, flight.PlayerX','                float bank=Mathf.Clamp((flight.PlayerX-previousX)/Mathf.Max(.001f,delta)*-13,-12,12); previousX=flight.PlayerX;\n                playerBody.rectTransform.localScale=new Vector3(1-Mathf.Abs(bank)*.009f,1,1);\n                Place(player, flight.PlayerX');
s=s.replace('wakeTimer = 0; playerBody.color','wakeTimer = 0; previousX = .5f; trailTimer = 0; animationTime = 0; playerBody.color');
s=s.replace('Body = body, Threat = threat','Body = body, Threat = threat, LeftProp = WarVisuals.Propeller(body.transform,22,16,22), RightProp = WarVisuals.Propeller(body.transform,60,16,22)');
s=s.replace('                visual.Shield.gameObject.SetActive','                WarVisuals.Spin(visual.LeftProp,animationTime,enemy.Id);WarVisuals.Spin(visual.RightProp,animationTime,enemy.Id+.5f);\n                visual.Shield.gameObject.SetActive');
s=s.replace('Time.unscaledTime % .3f','animationTime % .3f');
s=s.replace('Vector2.SignedAngle(new Vector2(1,1),','Vector2.SignedAngle(Vector2.up,');
s=s.replace('                visual.Marker.SetAsLastSibling();',`                if(trailTimer>=.09f)
                {
                    var velocity=new Vector2(missile.VelocityX*Width,-missile.VelocityY*Height).normalized;
                    var puff=UiKit.Box("Rocket exhaust",field,missile.X*Width-velocity.x*28,missile.Y*Height+velocity.y*28,6,6,UiKit.Orange).rectTransform;
                    effects.Add(new Effect{Rect=puff,Lifetime=.4f,Remaining=.4f,Velocity=-velocity*28});
                }
                visual.Marker.SetAsLastSibling();`);
s=s.replace('            bool overOpen =','            if(trailTimer>=.09f)trailTimer=0;\n            bool overOpen =');
s=s.replace('rect = UiKit.Box("Supply " + supply.Kind, field, 0, 0, 42, 34, UiKit.Ink).rectTransform;','rect = UiKit.Box("Supply " + supply.Kind, field, 0, 0, 42, 34, UiKit.Line).rectTransform;\n                    WarVisuals.Frame(rect,42,34,false);\n                    UiKit.Box("Crate band",rect,4,0,3,34,UiKit.Orange);UiKit.Box("Crate band",rect,35,0,3,34,UiKit.Orange);');
s=s.replace('Place(rect, supply.X, supply.Y, 21, 17); rect.SetAsLastSibling();','Place(rect, supply.X, supply.Y, 21, 17); rect.localEulerAngles=new Vector3(0,0,Mathf.Sin(animationTime*3+supply.Id)*5); rect.SetAsLastSibling();');
return s;});
edit('Scripts/Core/FlightGame.Verification.cs',s=>s.replace('0.11.0','0.12.0'));
