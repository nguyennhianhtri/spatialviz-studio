"""Demo scene — realistic Singapore HDB 4-Room Type A flat (90 sqm)."""

from app.models import SceneGraph

DEMO_SCENE = SceneGraph.model_validate({
    "metadata": {
        "source_file": "demo-hdb-4room-type-a.png",
        "total_area_sqm": 90.0,
        "scale_factor": 1.0,
        "floor_height_m": 2.8
    },
    "rooms": [
        {
            "id": "living",
            "label": "Living / Dining",
            "type": "living",
            "area_sqm": 31.5,
            "polygon": [[0, 0], [7, 0], [7, 4.5], [0, 4.5]],
            "floor_material": "wood_light",
            "wall_color": "#F5F0E5"
        },
        {
            "id": "kitchen",
            "label": "Kitchen",
            "type": "kitchen",
            "area_sqm": 22.0,
            "polygon": [[7, 0], [12.5, 0], [12.5, 4], [7, 4]],
            "floor_material": "tile_white",
            "wall_color": "#F0EDE5"
        },
        {
            "id": "master",
            "label": "Master Bedroom",
            "type": "bedroom",
            "area_sqm": 18.0,
            "polygon": [[0, 4.5], [4.5, 4.5], [4.5, 8.5], [0, 8.5]],
            "floor_material": "wood_light",
            "wall_color": "#EDE8DB"
        },
        {
            "id": "bed2",
            "label": "Bedroom 2",
            "type": "bedroom",
            "area_sqm": 14.0,
            "polygon": [[4.5, 4.5], [8, 4.5], [8, 8.5], [4.5, 8.5]],
            "floor_material": "wood_light",
            "wall_color": "#E8E4D5"
        },
        {
            "id": "bed3",
            "label": "Bedroom 3",
            "type": "bedroom",
            "area_sqm": 11.25,
            "polygon": [[8, 4.5], [12.5, 4.5], [12.5, 7], [8, 7]],
            "floor_material": "wood_light",
            "wall_color": "#EDE8DB"
        },
        {
            "id": "corridor",
            "label": "Corridor",
            "type": "corridor",
            "area_sqm": 4.5,
            "polygon": [[8, 7], [10, 7], [10, 8.5], [8, 8.5]],
            "floor_material": "tile_white",
            "wall_color": "#F0EDE5"
        },
        {
            "id": "bath1",
            "label": "Bathroom 1",
            "type": "bathroom",
            "area_sqm": 5.6,
            "polygon": [[10, 7], [12.5, 7], [12.5, 9.25], [10, 9.25]],
            "floor_material": "tile_white",
            "wall_color": "#E0E0E0"
        },
        {
            "id": "bath2",
            "label": "Bathroom 2",
            "type": "bathroom",
            "area_sqm": 3.75,
            "polygon": [[0, 8.5], [2.5, 8.5], [2.5, 10], [0, 10]],
            "floor_material": "tile_white",
            "wall_color": "#E0E0E0"
        },
        {
            "id": "service",
            "label": "Service Yard",
            "type": "balcony",
            "area_sqm": 3.0,
            "polygon": [[7, 4], [10, 4], [10, 4.5], [7, 4.5]],
            "floor_material": "concrete",
            "wall_color": "#D0D0D0"
        }
    ],
    "walls": [
        {"id": "w_outer_s", "start": [0, 0], "end": [12.5, 0], "thickness_m": 0.2, "height_m": 2.8},
        {"id": "w_outer_e", "start": [12.5, 0], "end": [12.5, 9.25], "thickness_m": 0.2, "height_m": 2.8},
        {"id": "w_outer_w", "start": [0, 0], "end": [0, 10], "thickness_m": 0.2, "height_m": 2.8},
        {"id": "w_outer_n1", "start": [0, 10], "end": [2.5, 10], "thickness_m": 0.2, "height_m": 2.8},
        {"id": "w_outer_n2", "start": [0, 8.5], "end": [8, 8.5], "thickness_m": 0.15, "height_m": 2.8},
        {"id": "w_outer_n3", "start": [10, 9.25], "end": [12.5, 9.25], "thickness_m": 0.15, "height_m": 2.8},
        {"id": "w_living_kit", "start": [7, 0], "end": [7, 4.5], "thickness_m": 0.15, "height_m": 2.8},
        {"id": "w_living_bed", "start": [0, 4.5], "end": [8, 4.5], "thickness_m": 0.15, "height_m": 2.8},
        {"id": "w_kit_bottom", "start": [7, 4], "end": [12.5, 4], "thickness_m": 0.15, "height_m": 2.8},
        {"id": "w_master_bed2", "start": [4.5, 4.5], "end": [4.5, 8.5], "thickness_m": 0.15, "height_m": 2.8},
        {"id": "w_bed2_bed3", "start": [8, 4.5], "end": [8, 8.5], "thickness_m": 0.15, "height_m": 2.8},
        {"id": "w_bed3_corr", "start": [8, 7], "end": [12.5, 7], "thickness_m": 0.15, "height_m": 2.8},
        {"id": "w_corr_bath1", "start": [10, 7], "end": [10, 9.25], "thickness_m": 0.15, "height_m": 2.8},
        {"id": "w_bath2_top", "start": [2.5, 8.5], "end": [2.5, 10], "thickness_m": 0.15, "height_m": 2.8},
        {"id": "w_bed2_n", "start": [4.5, 8.5], "end": [8, 8.5], "thickness_m": 0.15, "height_m": 2.8},
        {"id": "w_corr_n", "start": [8, 8.5], "end": [10, 8.5], "thickness_m": 0.15, "height_m": 2.8},
        {"id": "w_service", "start": [8, 4], "end": [8, 4.5], "thickness_m": 0.1, "height_m": 2.8}
    ],
    "doors": [
        {"id": "d_entrance", "position": [3.5, 0], "width_m": 0.9, "wall_id": "w_outer_s", "type": "main_entrance"},
        {"id": "d_kitchen", "position": [7, 2.0], "width_m": 0.8, "wall_id": "w_living_kit", "type": "sliding"},
        {"id": "d_master", "position": [2.0, 4.5], "width_m": 0.85, "wall_id": "w_living_bed", "type": "hinged"},
        {"id": "d_bed2", "position": [6.0, 4.5], "width_m": 0.85, "wall_id": "w_living_bed", "type": "hinged"},
        {"id": "d_bed3", "position": [10.0, 7.0], "width_m": 0.85, "wall_id": "w_bed3_corr", "type": "hinged"},
        {"id": "d_bath1", "position": [10, 8.0], "width_m": 0.7, "wall_id": "w_corr_bath1", "type": "hinged"},
        {"id": "d_bath2", "position": [1.25, 8.5], "width_m": 0.7, "wall_id": "w_outer_n2", "type": "hinged"}
    ],
    "windows": [
        {"id": "win_living1", "position": [2.0, 0], "width_m": 1.8, "height_m": 1.4, "sill_height_m": 0.9, "wall_id": "w_outer_s"},
        {"id": "win_living2", "position": [5.5, 0], "width_m": 1.2, "height_m": 1.4, "sill_height_m": 0.9, "wall_id": "w_outer_s"},
        {"id": "win_kit", "position": [12.5, 2.0], "width_m": 1.8, "height_m": 1.4, "sill_height_m": 0.9, "wall_id": "w_outer_e"},
        {"id": "win_master", "position": [0, 6.5], "width_m": 1.6, "height_m": 1.4, "sill_height_m": 0.9, "wall_id": "w_outer_w"},
        {"id": "win_bed2", "position": [6.25, 8.5], "width_m": 1.2, "height_m": 1.4, "sill_height_m": 0.9, "wall_id": "w_bed2_n"},
        {"id": "win_bed3", "position": [12.5, 5.5], "width_m": 1.4, "height_m": 1.4, "sill_height_m": 0.9, "wall_id": "w_outer_e"},
        {"id": "win_bath1", "position": [12.5, 8.0], "width_m": 0.6, "height_m": 0.8, "sill_height_m": 1.4, "wall_id": "w_outer_e"}
    ],
    "furniture": []
})
