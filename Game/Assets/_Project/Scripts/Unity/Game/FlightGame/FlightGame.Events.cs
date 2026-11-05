using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.LowLevel;

namespace PixelVocabFlight
{
    public sealed partial class FlightGame : MonoBehaviour
    {
        private void DrainEvents()
        {
            FlightEvent ev;
            while ((ev = flight.PopEvent()) != null)
            {
                switch (ev.Kind)
                {
                    case FlightEventKind.Retarget: typed = ""; view.SetQuestion(ev.Entry, flight.TargetChanges); break;
                    case FlightEventKind.Wrong:
                    case FlightEventKind.MissileWrong:
                        if (ev.Entry != null) { mistakes.Add(ev.Entry.id); if (!reviewWords.Any(e => e.id == ev.Entry.id)) reviewWords.Add(ev.Entry); }
                        if (ev.Kind == FlightEventKind.MissileWrong) { view.Board.FlashMissile(ev.EntityId); audioPlayer.MissileReject(); }
                        else audioPlayer.Wrong();
                        view.Feedback("Chưa đúng. Kiểm tra từ, từ loại hoặc lựa chọn tên lửa.", true); break;
                    case FlightEventKind.Hit:
                        view.Board.Hit(ev.X, ev.Y, ev.Value == 0, flight.PlayerX);
                        if (ev.Value > 0) { audioPlayer.Success(); view.Feedback("Đã phá khiên băng. Nghĩa chuyển sang một máy bay khác."); }
                        break;
                    case FlightEventKind.Kill:
                        if (ev.Source == KillSource.MissileBlast)
                        {
                            view.Board.Burst(ev.X, ev.Y, UiKit.Orange);
                            view.Feedback("Nổ dây chuyền +" + ev.Value + " điểm");
                            break;
                        }
                        goto case FlightEventKind.MissileSolved;
                    case FlightEventKind.MissileSolved:
                        bool first = !mistakes.Contains(ev.Entry.id); if (first) firstTry++;
                        view.Log(ev.Entry, true); audioPlayer.Success();
                        if (ev.ShouldPronounce) speech.Enqueue(ev.Entry);
                        profile.Record(ev.Entry, true, first, bestKey, progress.Score);
                        view.Feedback(ev.Entry.word + "  +" + ev.Value + " điểm"); break;
                    case FlightEventKind.Pickup:
                        audioPlayer.Pickup(); view.Feedback(ev.Supply == SupplyKind.Roll ? "Đón R+ thành công: +1 lượt đổi nghĩa." : ev.Supply == SupplyKind.Fuel ? "+50 xăng" : "+1 kim loại: sửa 1 giáp (tối đa 5)"); break;
                    case FlightEventKind.MissileBlast:
                        view.Board.Blast(ev.X, ev.Y); audioPlayer.Success(); view.Feedback("Tên lửa nổ! Máy bay trong vòng nổ bị hạ, kể cả còn khiên."); break;
                    case FlightEventKind.MissileFailure:
                        view.Feedback("Sai 3 lần: tên lửa khóa mục tiêu và sắp tăng tốc! Trúng mất 2 giáp.", true); break;
                    case FlightEventKind.AircraftLock:
                        audioPlayer.LockWarning();
                        view.Feedback("CẢNH BÁO: " + ev.Entry.word.ToUpperInvariant() + " đang khóa mục tiêu! Gõ đúng để hạ trước khi nó bắn.", true); break;
                    case FlightEventKind.AircraftFire:
                        view.Board.EnemyFire(ev.EntityId); audioPlayer.Gunfire(); break;
                    case FlightEventKind.MissileLock:
                        audioPlayer.LockWarning();
                        view.Feedback("Tên lửa đã khóa mục tiêu! Chọn đáp án ngay (phím 1–4).", true); break;
                    case FlightEventKind.MissileBoost:
                        audioPlayer.Boost(); view.Feedback("Tên lửa tăng tốc lao tới — không thể né!", true); break;
                    case FlightEventKind.AircraftImpact:
                    case FlightEventKind.MissileImpact:
                        view.Board.Impact(ev.X, ev.Y); audioPlayer.Wrong();
                        view.Feedback((ev.Kind == FlightEventKind.MissileImpact ? "Tên lửa trúng!" : "Trúng loạt đạn đuổi!") + " -" + ev.Value + " giáp / còn " + progress.Metal + "/5.", true);
                        if (ev.Entry != null && !reviewWords.Any(e => e.id == ev.Entry.id)) reviewWords.Add(ev.Entry);
                        break;
                }
            }
        }
    }
}
