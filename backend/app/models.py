from __future__ import annotations

from pydantic import BaseModel, Field, model_validator


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
    width_m: float = Field(default=0.9, gt=0, le=100, allow_inf_nan=False)
    wall_id: str
    orientation: str | None = None
    rotation: float | None = None
    type: str = "hinged"


class WindowDef(BaseModel):
    id: str
    position: list[float]
    width_m: float = Field(default=1.2, gt=0, le=100, allow_inf_nan=False)
    height_m: float = 1.4
    sill_height_m: float = 0.9
    wall_id: str
    orientation: str | None = None
    rotation: float | None = None


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
    furniture: list[FurnitureDef] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_collections(self):
        seen=set()
        for items in [self.rooms,self.walls,self.doors,self.windows,self.furniture]:
            if len(items)>512:raise ValueError("Scene collection exceeds 512 objects.")
            for item in items:
                if item.id in seen:raise ValueError("Scene IDs must be unique.")
                seen.add(item.id)
        return self


class ChatRequest(BaseModel):
    message: str
    scene: SceneGraph | None = None


class ChatResponse(BaseModel):
    response: str
