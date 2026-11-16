using System.Collections.Generic;
using static PixelVocabFlight.StoryDialogue;

namespace PixelVocabFlight
{
    // M1 Phần 1, P1.08-P1.16: the exam diagram, the tone choice (pride), the roof.
    public static partial class Act0Content
    {
        // The hidden stat of Jonas' ego ("cái tôi"); P1.10 moves it by PrideStep.
        public const string PrideFlag = "pride";
        public const int PrideStep = 1;

        private static IEnumerable<DialogueGraph> M1Part2Dialogues()
        {
            // P1.08 text on the diagram (the rules of the hardest test, and why Daan fears it).
            yield return Lines("m1_exam",
                (N, "Bài thi khó nhất ngày 14/5 là liệng tắt máy: tắt máy ở 2.000 bộ, liệng xuống, đáp trong vòng 150 thước quanh tấm vải trắng, không được nổ máy lại."),
                (N, "Daan trượt bài này hai lần trong buổi tập: cứ hoảng là cậu nổ máy lại."));

            // P1.09
            yield return Lines("m1_hesitate",
                (J, "Cậu chần chừ. Trên trời chần chừ là chết."),
                (D, "Còn cậu thì chẳng bao giờ chần chừ."),
                (J, "Thế nên tớ sẽ đỗ hạng nhất."));

            // P1.10 the first choice: both are Jonas' voice. (a) raises pride, (b) lowers it. Each line is repeated by Jonas after the pick.
            yield return new DialogueGraph("m1_tone",
                Ask("start", N, "Jonas nói gì với Daan?",
                    Pick("Ngày mai cứ bám theo tớ. Tớ liệng thế nào cậu liệng thế ấy.", "a1", "flag.add:" + PrideFlag + "=" + PrideStep),
                    Pick("Cậu sẽ đỗ. Cậu chỉ cần tin là cậu đỗ.", "b1", "flag.add:" + PrideFlag + "=-" + PrideStep)),
                Line("a1", J, "Ngày mai cứ bám theo tớ. Tớ liệng thế nào cậu liệng thế ấy.", "a2"),
                Line("a2", D, "Tớ bám cậu từ năm sáu tuổi rồi.", null),
                Line("b1", J, "Cậu sẽ đỗ. Cậu chỉ cần tin là cậu đỗ.", "b2"),
                Line("b2", D, "Cậu tin hộ tớ đi.", null));

            // P1.11 the 1938 propeller: Daan jokes, Jonas stays silent.
            yield return Lines("m1_propeller", (D, "Tớ vẫn chưa bay bù được hai tuần bị cấm hôm ấy đâu nhé."));

            // P1.13 three far things seen from the roof.
            yield return Lines("m1_water_tower",
                (D, "Năm đầu tớ trèo lên đấy để xem biển. Lên rồi không dám xuống. Cậu đứng dưới đếm từng nấc thang cho tớ."),
                (J, "Bốn mươi hai nấc. Cậu khóc ở nấc thứ mười."),
                (D, "Nấc thứ mười hai."));
            yield return Lines("m1_airfield",
                (J, "Chỗ kia là lần đầu tớ bay một mình. Thầy Asch bước xuống, không nói gì, chỉ gõ hai cái lên cánh."),
                (D, "Tớ thì thầy dặn mười phút. Rồi thầy đứng nhìn theo cho tới lúc tớ đáp."));
            yield return Lines("m1_plane",
                (D, "Cái số 7 ấy. Bác Bram bảo nó già hơn hai đứa mình cộng lại."),
                (J, "Hôm thi tớ sẽ bay nó."),
                (D, "Hôm thi cậu bay cái nào cũng đỗ. Tớ thì phải xin cái nào hiền nhất."));

            // P1.14 the bet.
            yield return Lines("m1_london_bet",
                (D, "Ai tới London trước thì người kia trả bia."),
                (J, "Tớ sẽ bay tuyến thư của chú. Chẳng ai tới London cả."));

            // P1.15 the first idle promise; "Sky." is the last line (one note of music at the start of the beat).
            yield return Lines("m1_first_word",
                (D, "Mà cậu tới London thì cũng chết đói. Cậu có biết chữ tiếng Anh nào đâu."),
                (J, "Thì cậu dạy."),
                (D, "Tớ dạy. Mỗi ngày một chữ. Tới nơi thì cậu đủ chữ để gọi bia."),
                (D, "Sky."));

            // P1.16
            yield return Lines("m1_drone", (J, "Không phải của mình. Mình không có nhiều máy bay thế."));
        }
    }
}
