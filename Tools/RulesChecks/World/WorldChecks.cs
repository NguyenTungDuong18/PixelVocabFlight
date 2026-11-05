using PixelVocabFlight;
using System.Text.Json;

// Walkable base (0.15.0): model catalogue, airbase map, movement, interaction, dialogue and missions.
internal static partial class WorldChecks
{
    // Contract table 3.2: id, footprint for facing S, solid, display name, frames.
    private static readonly (string id, int w, int h, bool solid, string name, int frames)[] Contract =
    {
        ("bld_control_tower", 5, 5, true, "Tháp chỉ huy", 1), ("bld_hq", 8, 5, true, "Sở chỉ huy", 1),
        ("bld_hangar", 10, 8, true, "Nhà chứa máy bay", 1), ("bld_barracks", 8, 4, true, "Doanh trại", 1),
        ("bld_mess_hall", 7, 5, true, "Nhà ăn", 4), ("bld_medical", 6, 5, true, "Trạm y tế", 1),
        ("bld_academy", 7, 5, true, "Trường huấn luyện ngoại ngữ", 1), ("bld_workshop", 7, 5, true, "Xưởng sửa chữa", 1),
        ("bld_warehouse", 7, 5, true, "Kho quân nhu", 1), ("bld_fuel_depot", 5, 4, true, "Kho nhiên liệu", 1),
        ("bld_ammo_bunker", 5, 4, true, "Kho đạn", 1), ("bld_radar", 3, 3, true, "Trạm radar", 8),
        ("bld_radio_hut", 3, 3, true, "Trạm điện đài", 1), ("bld_watchtower", 2, 2, true, "Tháp canh", 1),
        ("bld_water_tower", 3, 3, true, "Tháp nước", 1), ("bld_guardhouse", 3, 3, true, "Chốt gác", 1),
        ("bld_aa_emplacement", 4, 4, true, "Ụ pháo cao xạ", 1), ("bld_tent", 3, 3, true, "Lều dã chiến", 1),
        ("prop_sandbags", 3, 1, true, "Bao cát", 1), ("prop_barrels", 1, 1, true, "Thùng phuy", 1),
        ("prop_crates", 2, 1, true, "Thùng gỗ", 1), ("prop_jerrycans", 1, 1, true, "Can xăng", 1),
        ("prop_flagpole", 1, 1, true, "Cột cờ", 6), ("prop_windsock", 1, 1, true, "Ống gió", 6),
        ("prop_searchlight", 1, 1, true, "Đèn pha", 1), ("prop_lamp_post", 1, 1, true, "Cột đèn", 1),
        ("prop_signpost", 1, 1, true, "Biển chỉ dẫn", 1), ("prop_bench", 2, 1, true, "Ghế dài", 1),
        ("prop_barbed_wire", 2, 1, true, "Dây thép gai", 1), ("prop_gate_barrier", 3, 1, false, "Barie cổng", 1),
        ("prop_tree_palm", 2, 2, true, "Cây cọ", 4), ("prop_tree_jungle", 2, 2, true, "Cây rừng", 4),
        ("prop_bush", 1, 1, false, "Bụi cây", 4),("veh_jeep", 2, 3, true, "Xe jeep", 1),
        ("veh_truck", 2, 4, true, "Xe tải", 1), ("veh_fuel_truck", 2, 4, true, "Xe bồn", 1),
        ("veh_tank", 3, 4, true, "Xe tăng", 1), ("veh_aa_gun", 2, 2, true, "Pháo cao xạ", 1),
        ("veh_artillery", 2, 3, true, "Lựu pháo", 1), ("veh_motorcycle", 1, 2, true, "Mô tô", 1),
        ("air_fighter", 4, 4, true, "SKYLARK MK.I", 1), ("air_transport", 6, 5, true, "Máy bay vận tải", 1),
        ("air_bomber_enemy", 6, 5, true, "Máy bay ném bom địch", 1),
    };

    private static readonly HashSet<string> ContractActions = new HashSet<string>
    { "mission.accept:0", "mission.accept:1", "mission.accept:2", "mission.accept:3", "mission.cancel", "vocab.open", "end" };
    private static readonly HashSet<string> ContractConditions = new HashSet<string> { "mission.active", "!mission.active", "completed>0" };

    private static int checks;
    private static void Check(bool pass, string message) { checks++; if (!pass) throw new Exception("FAIL: " + message); }
    private static bool Near(float a, float b, float eps = .0005f) => Math.Abs(a - b) <= eps;

    public static int Run()
    {
        checks = 0;
        CheckModels();
        CheckMap();
        CheckMovement();
        CheckInteraction();
        CheckDialogueData();
        CheckProfessorFlow();
        Console.WriteLine("PASS: " + checks + " walkable base checks.");
        return checks;
    }
}
