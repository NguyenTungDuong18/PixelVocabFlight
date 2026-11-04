using System;
using System.Linq;
using UnityEngine;
using UnityEngine.UI;

namespace PixelVocabFlight
{
    public sealed class VocabularySetupView
    {
        public InputField From { get; }
        public InputField To { get; }
        public InputField Search { get; }
        public Dropdown MinimumLevel { get; }

        public VocabularySetupView(FlightGame game,RectTransform panel,VocabularyCatalog catalog,VocabularyFilter filter,VocabularyEntry[] filtered,int page,string error)
        {
            const int pageSize = 8;
            UiKit.Box("Accent",panel,0,0,1360,4,UiKit.Mint);
            UiKit.Label("FLIGHT COMMAND  /  HỒ SƠ HUẤN LUYỆN",panel,28,18,800,32,14,UiKit.Mint,true);
            UiKit.Label("CHUẨN BỊ ĐIỆN MẬT CHO PHI ĐỘI",panel,28,52,1050,46,29,UiKit.Cream,true);
            UiKit.Button("NGUỒN & GIẤY PHÉP",panel,1106,24,225,36,UiKit.Line,UiKit.Muted,game.ShowVocabularyCredits).GetComponentInChildren<Text>().fontSize=UiKit.Px(13);
            UiKit.Box("Divider",panel,466,116,1,580,UiKit.Line);
            UiKit.Label("01  DANH MỤC",panel,28,116,412,24,12,UiKit.Muted,true);
            UiKit.Button("OXFORD 5000",panel,28,149,198,39,filter.collection=="oxford5000"?UiKit.Mint:UiKit.Line,filter.collection=="oxford5000"?UiKit.Ink:UiKit.Cream,()=>game.ChooseCollection("oxford5000")).GetComponentInChildren<Text>().fontSize=UiKit.Px(16);
            UiKit.Button("OXFORD 3000",panel,240,149,198,39,filter.collection=="oxford3000"?UiKit.Mint:UiKit.Line,filter.collection=="oxford3000"?UiKit.Ink:UiKit.Cream,()=>game.ChooseCollection("oxford3000")).GetComponentInChildren<Text>().fontSize=UiKit.Px(16);
            UiKit.Label("02  KHOẢNG TRÌNH ĐỘ CEFR",panel,28,208,412,24,12,UiKit.Muted,true);
            MinimumLevel=UiKit.Select(VocabularyQuery.Levels,filter.minimumLevel,panel,28,241,184,40,value=>game.ChooseLevel(true,value));
            UiKit.Label("đến",panel,214,241,42,40,14,UiKit.Muted,false,TextAnchor.MiddleCenter);
            UiKit.Select(VocabularyQuery.Levels,filter.maximumLevel,panel,258,241,180,40,value=>game.ChooseLevel(false,value));
            UiKit.Label("03  CHỦ ĐỀ  ·  CÓ THỂ CHỌN NHIỀU",panel,28,300,412,24,12,UiKit.Muted,true);
            var allTopics = new[] { new VocabularyTopic {id="all",name="Tất cả"} }.Concat(catalog.Topics).ToArray();
            for (int i=0;i<allTopics.Length;i++)
            {
                string id=allTopics[i].id;
                bool active=id=="all" ? filter.topics.Length==0 : filter.topics.Contains(id);
                var button=UiKit.Button((active?"+ ":"")+allTopics[i].name,panel,28+(i%4)*105,334+(i/4)*35,99,29,active?UiKit.Mint:UiKit.Line,active?UiKit.Ink:UiKit.Cream,()=>game.ToggleTopic(id));
                UiKit.Fit(button.GetComponentInChildren<Text>(),9,12);
            }
            UiKit.Label("04  KHOẢNG THỨ TỰ SAU BỘ LỌC",panel,28,531,412,24,12,UiKit.Muted,true);
            From=UiKit.Input(filter.from.ToString(),"Từ mục",panel,28,564,164,41,true);
            UiKit.Label("đến",panel,195,564,68,41,14,UiKit.Muted,false,TextAnchor.MiddleCenter);
            To=UiKit.Input(filter.to.ToString(),"Đến mục",panel,266,564,172,41,true);
            int[] sizes={20,50,100,int.MaxValue};
            string[] names={"20 MỤC","50 MỤC","100 MỤC","TẤT CẢ"};
            for(int i=0;i<sizes.Length;i++)
            {
                int amount=sizes[i];
                UiKit.Button(names[i],panel,28+i*105,615,99,32,UiKit.Line,UiKit.Cream,()=>game.ChooseRangeSize(amount)).GetComponentInChildren<Text>().fontSize=UiKit.Px(12);
            }
            UiKit.Button("ÁP DỤNG KHOẢNG",panel,28,660,410,43,UiKit.Cream,UiKit.Ink,game.ApplyMenuRange).GetComponentInChildren<Text>().fontSize=UiKit.Px(15);

            Search=UiKit.Input(filter.search,"Tìm từ tiếng Anh hoặc nghĩa Việt…",panel,497,119,654,42);
            UiKit.Button("TÌM",panel,1167,119,164,42,UiKit.Line,UiKit.Cream,game.ApplyMenuSearch).GetComponentInChildren<Text>().fontSize=UiKit.Px(15);
            UiKit.Label(filtered.Length.ToString("N0")+" MỤC KHỚP BỘ LỌC",panel,497,178,520,29,16,UiKit.Mint,true);
            UiKit.Button("TOÀN BỘ OXFORD 5000",panel,1055,178,276,29,UiKit.Mint,UiKit.Ink,game.SelectFullOxford).GetComponentInChildren<Text>().fontSize=UiKit.Px(12);
            UiKit.Label("#",panel,503,220,48,23,12,UiKit.Muted,true);
            UiKit.Label("TỪ / TỪ LOẠI",panel,559,220,240,23,12,UiKit.Muted,true);
            UiKit.Label("CEFR",panel,811,220,68,23,12,UiKit.Muted,true);
            UiKit.Label("NGHĨA TIẾNG VIỆT",panel,896,220,425,23,12,UiKit.Muted,true);
            int pageCount=Math.Max(1,(filtered.Length+pageSize-1)/pageSize);
            page=Math.Max(0,Math.Min(page,pageCount-1));
            for(int row=0;row<pageSize;row++)
            {
                int index=page*pageSize+row;
                if(index>=filtered.Length)break;
                var entry=filtered[index];
                bool selected=index+1>=filter.from && index+1<=filter.to;
                float y=252+row*48;
                UiKit.Box("Preview row",panel,497,y,834,46,selected?new Color(UiKit.Mint.r,UiKit.Mint.g,UiKit.Mint.b,0.07f):new Color(0,0,0,0.07f));
                if(selected)UiKit.Box("Range selection",panel,497,y,3,46,UiKit.Mint);
                UiKit.Label((index+1).ToString(),panel,505,y,47,46,13,UiKit.Muted);
                var word=UiKit.Label(entry.word,panel,559,y+2,240,24,18,UiKit.Cream,true);
                UiKit.Fit(word,12,18);
                UiKit.Label(entry.partOfSpeech,panel,559,y+26,240,18,11,UiKit.Muted);
                UiKit.Label(entry.cefr,panel,811,y,68,46,15,UiKit.Mint,true);
                var meaning=UiKit.Label(entry.meaning,panel,896,y+2,425,42,15,UiKit.Cream);
                UiKit.Fit(meaning,11,15);
            }
            if(filtered.Length==0) UiKit.Label("Không có mục phù hợp. Hãy mở rộng trình độ,\nbỏ bớt chủ đề hoặc xóa nội dung tìm kiếm.",panel,530,320,750,110,22,UiKit.Muted);
            UiKit.Button("<",panel,497,645,52,34,UiKit.Line,UiKit.Cream,()=>game.ChangePreviewPage(-1));
            UiKit.Label("Trang "+(page+1)+" / "+pageCount,panel,563,645,230,34,14,UiKit.Muted);
            UiKit.Button(">",panel,802,645,52,34,UiKit.Line,UiKit.Cream,()=>game.ChangePreviewPage(1));
            int selectedAmount=filter.to>=filter.from && filter.to<=filtered.Length ? filter.to-filter.from+1 : 0;
            string status=string.IsNullOrEmpty(error) ? "Đã chọn "+selectedAmount+" mục  ·  thứ tự "+filter.from+"–"+filter.to : error;
            var statusText=UiKit.Label(status,panel,497,695,570,41,15,string.IsNullOrEmpty(error)?UiKit.Mint:UiKit.Coral);
            UiKit.Fit(statusText,11,15);
            var launch=UiKit.Button("CẤT CÁNH  >>",panel,1092,687,239,49,UiKit.Mint,UiKit.Ink,game.StartFlight);
            launch.interactable=selectedAmount>=4;
        }
    }
}
