using PixelVocabFlight;
using System.Text.Json;

internal static partial class WorldChecks
{
    private static void CheckMovement()
    {
        var map = AirbaseMap.Create();
        var professorDef = map.FindNpc("professor");
        // --- Movement ---
        var walk = new BaseWorld(map, new MissionLog());
        var warehouse = map.FootprintOf(map.Find("warehouse"));
        float wallY = warehouse.y + warehouse.h;
        walk.PlacePlayer(39.5f, wallY + 1f, Facing.S);
        for (int i = 0; i < 40; i++) walk.Tick(1 / 30f, 0, -1, false);
        Check(walk.PlayerY >= wallY + BaseWorld.BodyHalfDepth - .001f && walk.PlayerY < wallY + BaseWorld.BodyHalfDepth + .02f && Near(walk.PlayerX, 39.5f), "walking into a building stops flush at its wall");
        Check(walk.PlayerFacing == Facing.N && walk.Moving && !walk.Running, "facing and walking state");
        float before = walk.PlayerX;
        walk.Tick(.1f, 1, -1, false);
        Check(walk.PlayerX > before + .2f && walk.PlayerY >= wallY + BaseWorld.BodyHalfDepth - .001f, "diagonal into a wall slides along it");
        walk.Tick(.1f, 0, 0, false);
        Check(!walk.Moving && !walk.Running, "no input means standing");
        walk.PlacePlayer(39.5f, wallY + 1.5f, Facing.S);
        for (int i = 0; i < 20; i++) walk.Tick(.25f, 0, -1, true);
        Check(walk.PlayerY >= wallY + BaseWorld.BodyHalfDepth - .001f, "long frames cannot tunnel through a wall");
        var lamp = map.Find("lamp_road_2");
        walk.PlacePlayer(lamp.X + .5f, lamp.Y + 3f, Facing.N);
        for (int i = 0; i < 20; i++) walk.Tick(.25f, 0, -1, true);
        Check(walk.PlayerY >= lamp.Y + 1 + BaseWorld.BodyHalfDepth - .001f, "a 1×1 prop blocks a sprinting pilot");
        walk.PlacePlayer(28f, 21.5f, Facing.S);
        walk.Tick(.1f, 1, 1, false);
        Check(Near(Dist(walk.PlayerX, walk.PlayerY, 28f, 21.5f), BaseWorld.WalkSpeed * .1f) && Near(walk.PlayerX - 28f, walk.PlayerY - 21.5f), "diagonal walking is normalised");
        walk.PlacePlayer(28f, 21.5f, Facing.S);
        walk.Tick(.1f, 1, 0, true);
        Check(Near(walk.PlayerX - 28f, BaseWorld.RunSpeed * .1f) && walk.Running && walk.PlayerFacing == Facing.E, "running is faster than walking");
        Check(BaseWorld.RunSpeed > BaseWorld.WalkSpeed, "run speed above walk speed");
        walk.PlacePlayer(28f, 21.5f, Facing.S);
        walk.Tick(.1f, .5f, 0, false);
        Check(Near(walk.PlayerX - 28f, BaseWorld.WalkSpeed * .05f), "analog input below 1 walks slower");
        var coarse = new BaseWorld(map, new MissionLog()); var fine = new BaseWorld(map, new MissionLog());
        coarse.PlacePlayer(27f, 20.5f, Facing.S); fine.PlacePlayer(27f, 20.5f, Facing.S);
        coarse.Tick(.2f, 1, .5f, false);
        for (int i = 0; i < 20; i++) fine.Tick(.01f, 1, .5f, false);
        Check(Near(coarse.PlayerX, fine.PlayerX, .001f) && Near(coarse.PlayerY, fine.PlayerY, .001f), "movement agrees across frame rates");
        walk.PlacePlayer(28f, 21.5f, Facing.S);
        walk.Tick(float.NaN, 1, 0, false); walk.Tick(-1, 1, 0, false); walk.Tick(.1f, float.NaN, float.PositiveInfinity, false);
        Check(Near(walk.PlayerX, 28f) && Near(walk.PlayerY, 21.5f) && !float.IsNaN(walk.PlayerX), "invalid time and input do not move the pilot");
        Check(walk.Blocked(-.1f, 10) && walk.Blocked(10, map.Height) && walk.Blocked(map.FenceVariant(3, 20) >= 0 ? 3.5f : 0, 20.5f), "map edges and fence block");
        Check(walk.Blocked(8.5f, 42.5f), "pond water blocks");
        var gateBarrier = map.Find("gate_barrier");
        Check(!walk.Blocked(31.5f, 48.5f) && map.PlacementAt(31, 48) == gateBarrier, "open barrier can be walked through");
        Check(walk.Blocked(professorDef.X + .4f, professorDef.Y + .2f), "NPCs block the pilot");
        walk.PlacePlayer(professorDef.X, professorDef.Y + 2f, Facing.N);
        for (int i = 0; i < 60; i++) walk.Tick(1 / 30f, 0, -1, false);
        Check(walk.PlayerY >= professorDef.Y + 2 * BaseWorld.BodyHalfDepth - .001f && walk.PlayerY < professorDef.Y + 2 * BaseWorld.BodyHalfDepth + .02f, "pilot stops at an NPC");
    }

    private static void CheckInteraction()
    {
        var map = AirbaseMap.Create();
        var skylark = map.FindTag(MapDef.PlayerAircraftTag);
        var professorDef = map.FindNpc("professor");
        // --- Interaction ---
        var log = new MissionLog();
        var talk = new BaseWorld(map, log);
        talk.PlacePlayer(professorDef.X, professorDef.Y + 1f, Facing.N);
        Check(talk.NearestKind == InteractKind.Npc && talk.NearestId == "professor" && talk.PromptText == "[E] Nói chuyện với Giáo sư Whitmore", "prompt next to the professor");
        while (talk.PopEvent() != null) { }
        talk.Interact();
        var opened = talk.PopEvent();
        Check(opened != null && opened.Kind == WorldEventKind.DialogueOpened && opened.NpcId == "professor" && opened.Text == "professor", "interacting opens the professor's dialogue");
        var professor = talk.Npc("professor");
        Check(professor.Talking && professor.Facing == Facing.S && talk.PlayerFacing == Facing.N && talk.InDialogue, "professor turns to the pilot while talking");
        Check(talk.PromptText == null && talk.NearestKind == InteractKind.None, "no prompt during dialogue");
        float frozen = talk.PlayerY;
        talk.Tick(.2f, 0, 1, true);
        Check(talk.PlayerY == frozen && !talk.Moving, "pilot cannot walk away mid-dialogue");
        talk.Interact();
        Check(talk.PopEvent() == null, "no second dialogue while one is open");
        talk.EndDialogue();
        Check(!professor.Talking && professor.Facing == professorDef.Facing && talk.NearestId == "professor", "ending the dialogue releases the professor");
        var medicDef = map.FindNpc("medic");
        talk.PlacePlayer(medicDef.X - 1f, medicDef.Y, Facing.E);
        talk.Interact();
        var medicEvent = talk.PopEvent();
        while (medicEvent != null && medicEvent.Kind == WorldEventKind.ZoneEntered) medicEvent = talk.PopEvent();
        Check(medicEvent != null && medicEvent.NpcId == "medic" && talk.Npc("medic").Facing == Facing.W, "other NPCs face the pilot from the side");
        talk.EndDialogue();
        talk.PlacePlayer(map.AircraftReturnX, map.AircraftReturnY, map.AircraftReturnFacing);
        while (talk.PopEvent() != null) { }
        Check(talk.NearestKind == InteractKind.Aircraft && talk.NearestId == skylark.Id && talk.PromptText == "[E] SKYLARK MK.I", "aircraft prompt without orders");
        talk.Interact();
        var hint = talk.PopEvent();
        Check(hint != null && hint.Kind == WorldEventKind.Hint && hint.Text == "Chưa có lệnh bay. Hãy gặp Giáo sư Whitmore ở Trường huấn luyện ngoại ngữ.", "aircraft without orders gives a hint");
        Check(log.Accept(BaseContent.VocabSortie, 1), "accept mission");
        Check(talk.PromptText == "[E] Lên máy bay SKYLARK MK.I", "aircraft prompt with orders");
        talk.Interact();
        var board = talk.PopEvent();
        Check(board != null && board.Kind == WorldEventKind.BoardAircraft && board.Text == skylark.Id, "aircraft with orders boards");
        talk.PlacePlayer(28f, 21.5f, Facing.S);
        Check(talk.NearestKind == InteractKind.None && talk.PromptText == null, "nothing to interact with on the parade ground");
        while (talk.PopEvent() != null) { }
        talk.Interact();
        Check(talk.PopEvent() == null, "interacting with nothing emits nothing");

        var zone = new BaseWorld(map, new MissionLog());
        zone.PlacePlayer(professorDef.X, professorDef.Y + 1.5f, Facing.N);
        var entered = zone.PopEvent();
        Check(zone.CurrentZone == "Trường huấn luyện ngoại ngữ" && entered != null && entered.Kind == WorldEventKind.ZoneEntered && entered.Text == zone.CurrentZone, "zone label of the nearest building");
        zone.PlacePlayer(professorDef.X, professorDef.Y + 1.6f, Facing.N);
        Check(zone.PopEvent() == null, "same zone is not announced twice");
        zone.PlacePlayer(55f, 15f, Facing.S);
        Check(zone.CurrentZone == "Sân đỗ", "named area when no building is near");
        Check(zone.ZoneAt(skylark.X + 1, skylark.Y + 1) != skylark.DisplayName, "aircraft are not zones");
    }
}
