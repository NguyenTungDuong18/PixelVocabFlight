using System.Collections.Generic;
using static PixelVocabFlight.StoryDialogue;

namespace PixelVocabFlight
{
    // M1 Phần 1, P1.02-P1.07: objects on the walls, the handkerchief, Floris' story, the first exchange.
    // Texts in the "Lời thoại" column are copied as they are; descriptions of an object become narrator (N) lines.
    public static partial class Act0Content
    {
        private static IEnumerable<DialogueGraph> M1Part1Dialogues()
        {
            // P1.02 Jonas' wall.
            yield return Lines("m1_mailmap", (N, "Tấm bản đồ tuyến thư ra các đảo, cắm đinh ghim đánh dấu từng chặng."));
            yield return Lines("m1_sketchbook", (N, "Cuốn sổ vẽ tay của chú Floris: hình vẽ đuôi tàu lượn, chữ chú nghiêng về bên phải."));

            // P1.03 Daan's wall.
            yield return Lines("m1_poster", (N, "Tấm áp phích hãng hàng không: “Amsterdam–London 2 giờ 30 phút”."));
            yield return Lines("m1_notebook", (N, "Cuốn sổ tay tiếng Anh, gáy sờn."));
            yield return Lines("m1_letter", (N, "Lá thư của mẹ Daan, dặn mặc áo ấm."));

            // P1.04 the photo (back side, then Jonas' inner voice).
            yield return Lines("m1_photo",
                (N, "Mặt sau tấm ảnh ghi: “F. Hartveld, tuyến Amelsand, 1935”"),
                (J, "Sáng Chủ nhật nào chú cũng bay qua tháp chuông, lắc cánh hai cái, thả cho mình một lá thư buộc vào khăn tay."));

            // P1.05 the handkerchief: Floris' last note, Daan does not look up.
            yield return Lines("m1_handkerchief",
                (N, "Mẩu giấy chữ chú Floris: “Lần sau chú cho cháu cầm lái. — F.”"),
                (N, "Đây là lá thư cuối cùng chú thả."),
                (D, "Lại nhìn cái đó à. Ba năm rồi đấy."));

            // P1.06 optional branch "Kể tiếp". The story is the table's summary put in Jonas' mouth.
            yield return new DialogueGraph("m1_floris_story",
                Ask("start", N, "Jonas ngồi xuống giường.", Pick("Kể tiếp", "tell1"), Pick("Thôi", null)),
                Line("tell1", J, "Tháng 11 năm 1936, chú bay chuyến thư Giáng sinh ra đảo Amelsand trong sương mù, vì “thư phải đến đúng hôm”.", "tell2"),
                Line("tell2", J, "Ba ngày sau, túi thư dạt vào bờ. Còn chú thì không.", null));

            // P1.07 the first sign of Jonas' pride; the silence after Daan's line is the last node.
            yield return Lines("m1_unlucky",
                (J, "Chú bay giỏi. Chỉ là không may. Tớ thì sẽ không bao giờ bay vào sương mà không biết mình đang ở đâu."),
                (D, "Chú cậu chắc cũng nghĩ thế."),
                (N, "Jonas không trả lời."));
        }
    }
}
