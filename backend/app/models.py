from __future__ import annotations

from pydantic import BaseModel


class RoomDef(BaseModel):
    id: str
    label: str
    type: str
    area_sqm: float
    polygon: list[list[float]]
    floor_material: str = "wood_light"
    wall_color: str = "#e2e8f0"
    merge_group: str | None = None


class WallDef(BaseModel):
    id: str
    start: list[float]
    end: list[float]
    thickness_m: float = 0.15
    height_m: float = 2.8


class DoorDef(BaseModel):
    id: str
    position: list[float]
    width_m: float = 0.9
    wall_id: str
    type: str = "hinged"


class WindowDef(BaseModel):
    id: str
    position: list[float]
    width_m: float = 1.2
    height_m: float = 1.4
    sill_height_m: float = 0.9
    wall_id: str


class FurnitureDef(BaseModel):
    id: str
    type: str
    position: list[float]
    rotation_y: float = 0.0
    model_url: str | None = None


class SceneMetadata(BaseModel):
    source_file: str
    total_area_sqm: float
    scale_factor: float = 0.01
    floor_height_m: float = 2.8


class SceneGraph(BaseModel):
    metadata: SceneMetadata
    rooms: list[RoomDef]
    walls: list[WallDef]
    doors: list[DoorDef]
    windows: list[WindowDef]
    furniture: list[FurnitureDef] = []


class ChatRequest(BaseModel):
    message: str
    scene: SceneGraph | None = None


class ChatResponse(BaseModel):
    response: str
