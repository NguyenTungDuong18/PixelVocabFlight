# Danh mục tên sprite

Tra tên để dùng trong C# (`PixelSprites.Get/At("name")`). Thư mục chứa: `sprite-folders.md`. Danh sách đầy đủ, chính xác: Grep `"name": "<tên>"` trong `Art/Resources/Pixel/pixel-manifest.json`.

- **Aircraft (bay):** `fighter_level`, `fighter_bank_left/right`, `fighter_shadow`; `bomber_{jungle,desert,ice,ocean}` + `_damaged`, `_bank_left`, `_bank_right`; `bomber_shadow`, `bomber_guns` (11 khung).
- **Weapons:** `rocket`, `rocket_hot`, `rocket_boost`, `tracer`, `enemy_tracer`, `muzzle_flash`.
- **Naval:** `carrier`, `carrier_bow_wave`, `carrier_stern_wake`.
- **Supplies:** `supply_fuel`, `supply_metal`, `supply_roll`.
- **Effects:** `fx_explosion`, `fx_spark`, `fx_smoke`, `fx_shockwave`, `fx_ice_shield`, `fx_splash`, `fx_lock_reticle`, `fx_quest_marker`, `fx_dust`; lá rơi `fx_leaves_{green,autumn,palm}`, `fx_petals` (48×64, 12 khung @10, lặp, trôi sang phải; đặt chồng lên tán cây).
- **Terrain:** `terrain_{jungle,desert,ice}` + `_blur`.
- **Wildlife:** `actor_{buffalo,camel,crow,egret,elephant,locomotive,reindeer,sampan,steam,tank_desert,truck_desert,truck_jungle,vulture,wagon,wolf}` + `_blur`.
- **Title:** `title_airbase`, `title_clouds`, `title_runway_edge`, `title_runway_jungle`, `logo`, `card_{jungle,desert,ice,ocean}`.
- **UI:**
  - Cockpit: `cockpit_panel`, `gauge_needle` (48 khung), `ui_lamp_{off,green,amber,red}`, `ui_lever`.
  - Widgets: `ui_panel`, `ui_card(_selected)`, `ui_plate`, `ui_ink`, `ui_button_{olive,gold,cream,red}`, `ui_keycap`, `ui_input(_focus)`, `ui_cell_{empty,low,full}`, `ui_scanline`, `ui_pointer`.
  - Icons: `icon_{armor,arrow_left,arrow_right,check,clock,fuel,medal,pause,radio,sound_off,sound_on,speed,target}`.
- **World (model 4 hướng `_s/_e/_n/_w`):** 247 model. 43 model đang đặt trên map có trong `Scripts/Logic/World/WorldModels.cs`; số còn lại nằm trong thư viện, chưa dùng. Id theo module (`models-characters.md`): nhà `bld_barracks_*`, `bld_hq_*`, `bld_mess_*`, `bld_medical_*`…; kho `bld_store_*`, `bld_shed_*`, `bld_tank_*`, `bld_bunker_*`, `bld_depot_*`; nhà máy `bld_factory_*`, `prop_jig_*`, `prop_gantry*`; sân bay `bld_hangar_*`, `bld_tower_*`, `bld_terminal`, `bld_fire_station`, `bld_revetment*`, `bld_pillbox`, `prop_airfield_*`; vật nhỏ `prop_crate_*`, `prop_drum_*`, `prop_can_*`, `prop_bomb_*`, `prop_sandbag_*`, `prop_sign_*`…; dụng cụ `prop_bench_work*`, `prop_tool_*`, `prop_engine_*`, `prop_hoist_*`, `prop_invention_*`…; thiên nhiên `prop_tree_*`, `prop_bush_*`, `prop_plant_*`, `prop_rock_*`, `prop_log_*`, `prop_stump_*`; máy bay `air_*`. Danh sách đầy đủ: Grep `def('` trong `Tools/PixelForge/world/`.
- **Characters:** `chr_<pilot|professor|guard|mechanic|medic|officer|engineer>_<idle|walk|run>_<s|e|n|w>`, `chr_professor_talk_s`, `chr_engineer_work_<s|e|n|w>` (8 khung @10), `chr_shadow`. `engineer` chưa có trong `BaseContent.Roster`.
- **Portraits:** `portrait_<cid>`. **Ground:** `tile_{grass,dirt,concrete,asphalt,sand,runway,water,fence}`.
