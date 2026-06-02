export interface RoomDef {
  id: string;
  label: string;
  type: string;
  area_sqm: number;
  polygon: [number, number][];
  floor_material: string;
  wall_color: string;
  /** Rooms sharing the same merge_group are treated as one space (no wall between them). */
  merge_group?: string;
}

export interface WallDef {
  id: string;
  start: [number, number];
  end: [number, number];
  thickness_m: number;
  height_m: number;
}

export interface DoorDef {
  id: string;
  position: [number, number];
  width_m: number;
  wall_id: string;
  type: string;
}

export interface WindowDef {
  id: string;
  position: [number, number];
  width_m: number;
  height_m: number;
  sill_height_m: number;
  wall_id: string;
}

export interface FurnitureDef {
  id: string;
  type: string;
  position: [number, number, number];
  rotation_y: number;
  model_url?: string;
}

export interface SceneMetadata {
  source_file: string;
  total_area_sqm: number;
  scale_factor: number;
  floor_height_m: number;
}

export interface SceneGraph {
  metadata: SceneMetadata;
  rooms: RoomDef[];
  walls: WallDef[];
  doors: DoorDef[];
  windows: WindowDef[];
  furniture: FurnitureDef[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}
