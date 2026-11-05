using System;
using System.Collections.Generic;

namespace PixelVocabFlight
{
    // Model facing; matches sprite suffixes _s/_e/_n/_w. S = front towards the camera.
    public enum Facing { S = 0, E = 1, N = 2, W = 3 }
    public enum ModelKind { Building, Prop, Vehicle, Aircraft }

    // A reusable world model (building, prop, vehicle, parked aircraft). Footprint is declared for facing S.
    public sealed class ModelDef
    {
        public string Id, Name;
        public ModelKind Kind;
        public int FootW, FootH;
        public bool Solid;
        // Animated models (radar, flag, windsock, smoke) keep the same frame count in all four facings.
        public int Frames = 1;

        public string Group => Kind == ModelKind.Vehicle ? "Vehicles" : Kind == ModelKind.Aircraft ? "Aircraft" : "World";
    }

    public static class Facings
    {
        public static readonly Facing[] All = { Facing.S, Facing.E, Facing.N, Facing.W };

        // One-tile step for a facing (Y grows southwards).
        public static (int dx, int dy) Delta(Facing f) =>
            f == Facing.E ? (1, 0) : f == Facing.N ? (0, -1) : f == Facing.W ? (-1, 0) : (0, 1);

        public static Facing Opposite(Facing f) => (Facing)(((int)f + 2) % 4);

        // Facing for a direction; the dominant axis wins, vertical wins exact ties.
        public static Facing Toward(float dx, float dy)
        {
            if (Math.Abs(dx) > Math.Abs(dy)) return dx > 0 ? Facing.E : Facing.W;
            return dy < 0 ? Facing.N : Facing.S;
        }
    }

    // Catalogue of every world model. New models only need one line here plus sprites in PixelForge.
    public static class WorldModels
    {
        private static readonly ModelDef[] models =
        {
            B("bld_control_tower", "Tháp chỉ huy", 5, 5),
            B("bld_hq", "Sở chỉ huy", 8, 5),
            B("bld_hangar", "Nhà chứa máy bay", 10, 8),
            B("bld_barracks", "Doanh trại", 8, 4),
            B("bld_mess_hall", "Nhà ăn", 7, 5, frames: 4),
            B("bld_medical", "Trạm y tế", 6, 5),
            B("bld_academy", "Trường huấn luyện ngoại ngữ", 7, 5),
            B("bld_workshop", "Xưởng sửa chữa", 7, 5),
            B("bld_warehouse", "Kho quân nhu", 7, 5),
            B("bld_fuel_depot", "Kho nhiên liệu", 5, 4),
            B("bld_ammo_bunker", "Kho đạn", 5, 4),
            B("bld_radar", "Trạm radar", 3, 3, frames: 8),
            B("bld_radio_hut", "Trạm điện đài", 3, 3),
            B("bld_watchtower", "Tháp canh", 2, 2),
            B("bld_water_tower", "Tháp nước", 3, 3),
            B("bld_guardhouse", "Chốt gác", 3, 3),
            B("bld_aa_emplacement", "Ụ pháo cao xạ", 4, 4),
            B("bld_tent", "Lều dã chiến", 3, 3),
            P("prop_sandbags", "Bao cát", 3, 1),
            P("prop_barrels", "Thùng phuy", 1, 1),
            P("prop_crates", "Thùng gỗ", 2, 1),
            P("prop_jerrycans", "Can xăng", 1, 1),
            P("prop_flagpole", "Cột cờ", 1, 1, frames: 6),
            P("prop_windsock", "Ống gió", 1, 1, frames: 6),
            P("prop_searchlight", "Đèn pha", 1, 1),
            P("prop_lamp_post", "Cột đèn", 1, 1),
            P("prop_signpost", "Biển chỉ dẫn", 1, 1),
            P("prop_bench", "Ghế dài", 2, 1),
            P("prop_barbed_wire", "Dây thép gai", 2, 1),
            P("prop_gate_barrier", "Barie cổng", 3, 1, solid: false),
            P("prop_tree_palm", "Cây cọ", 2, 2, frames: 4),
            P("prop_tree_jungle", "Cây rừng", 2, 2, frames: 4),
            P("prop_bush", "Bụi cây", 1, 1, solid: false, frames: 4),
            V("veh_jeep", "Xe jeep", 2, 3),
            V("veh_truck", "Xe tải", 2, 4),
            V("veh_fuel_truck", "Xe bồn", 2, 4),
            V("veh_tank", "Xe tăng", 3, 4),
            V("veh_aa_gun", "Pháo cao xạ", 2, 2),
            V("veh_artillery", "Lựu pháo", 2, 3),
            V("veh_motorcycle", "Mô tô", 1, 2),
            A("air_fighter", "SKYLARK MK.I", 4, 4),
            A("air_transport", "Máy bay vận tải", 6, 5),
            A("air_bomber_enemy", "Máy bay ném bom địch", 6, 5),
        };
        private static readonly Dictionary<string, ModelDef> byId = Index();

        public static IReadOnlyList<ModelDef> All => models;

        public static ModelDef Get(string id)
        {
            if (id != null && byId.TryGetValue(id, out var model)) return model;
            throw new KeyNotFoundException("Unknown world model: " + id);
        }

        public static bool TryGet(string id, out ModelDef model)
        {
            model = null;
            return id != null && byId.TryGetValue(id, out model);
        }

        // Footprint in tiles for a facing: E and W swap width and depth.
        public static (int w, int h) Footprint(ModelDef m, Facing f) =>
            f == Facing.E || f == Facing.W ? (m.FootH, m.FootW) : (m.FootW, m.FootH);

        public static string SpriteName(string id, Facing f) => id + "_" + Suffix(f);

        public static string Suffix(Facing f) => f == Facing.E ? "e" : f == Facing.N ? "n" : f == Facing.W ? "w" : "s";

        private static ModelDef B(string id, string name, int w, int h, int frames = 1) => Def(id, name, ModelKind.Building, w, h, true, frames);
        private static ModelDef P(string id, string name, int w, int h, bool solid = true, int frames = 1) => Def(id, name, ModelKind.Prop, w, h, solid, frames);
        private static ModelDef V(string id, string name, int w, int h) => Def(id, name, ModelKind.Vehicle, w, h, true, 1);
        private static ModelDef A(string id, string name, int w, int h) => Def(id, name, ModelKind.Aircraft, w, h, true, 1);

        private static ModelDef Def(string id, string name, ModelKind kind, int w, int h, bool solid, int frames) =>
            new ModelDef { Id = id, Name = name, Kind = kind, FootW = w, FootH = h, Solid = solid, Frames = frames };

        private static Dictionary<string, ModelDef> Index()
        {
            var index = new Dictionary<string, ModelDef>();
            foreach (var model in models) index[model.Id] = model;
            return index;
        }
    }
}
