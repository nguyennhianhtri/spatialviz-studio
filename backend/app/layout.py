"""Shared editor-layout validation and lossless millimetre-to-metre conversion."""
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.models import SceneGraph

Dimension = Annotated[float, Field(ge=1, le=100_000, allow_inf_nan=False, strict=True)]
Coordinate = Annotated[float, Field(ge=0, le=100_000, allow_inf_nan=False, strict=True)]
Identifier = Annotated[str, Field(min_length=1, max_length=100)]
Label = Annotated[str, Field(min_length=1, max_length=120)]


class LayoutItem(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, allow_inf_nan=False)
    id: Identifier | None = None
    x_mm: Coordinate
    y_mm: Coordinate
    width_mm: Dimension


class RoomLayout(LayoutItem):
    name: Label
    type: Label
    height_mm: Dimension
    merge_group: Identifier | None = None


class OpeningLayout(LayoutItem):
    orientation: Literal['horizontal', 'vertical'] | None = None
    rotation: Literal[0, 90, 180, 270] | None = None

    @model_validator(mode='after')
    def check_orientation(self):
        if self.rotation is not None:
            derived = 'vertical' if self.rotation in (90, 270) else 'horizontal'
            if self.orientation is not None and self.orientation != derived:
                raise ValueError('Opening rotation conflicts with orientation.')
            self.orientation = derived
        elif self.orientation is not None:
            self.rotation = 90 if self.orientation == 'vertical' else 0
        return self


class DoorLayout(OpeningLayout):
    type: Literal['hinged', 'sliding', 'main_entrance', 'opening'] = 'hinged'


class WindowLayout(OpeningLayout):
    pass


class ConfirmedLayout(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    rooms: list[RoomLayout] = Field(min_length=1, max_length=256)
    doors: list[DoorLayout] = Field(max_length=512)
    windows: list[WindowLayout] = Field(max_length=512)
    overall_width_mm: Dimension
    overall_height_mm: Dimension
    source_file: Annotated[str, Field(max_length=255)] = 'upload.png'

    @model_validator(mode='after')
    def validate_geometry(self):
        seen = set()
        for prefix, items in [('room', self.rooms), ('door', self.doors), ('window', self.windows)]:
            for i, item in enumerate(items, 1):
                if item.id is None:
                    item.id = f'{prefix}_{i}'
                if item.id in seen:
                    raise ValueError('IDs must be unique across rooms, doors and windows.')
                seen.add(item.id)
                if item.x_mm > self.overall_width_mm + 1e-6 or item.y_mm > self.overall_height_mm + 1e-6:
                    raise ValueError('Geometry lies outside the overall plan bounds.')
        for room in self.rooms:
            if (room.x_mm + room.width_mm > self.overall_width_mm + 1e-6 or
                    room.y_mm + room.height_mm > self.overall_height_mm + 1e-6):
                raise ValueError('Room extent lies outside the overall plan bounds.')
        for i, a in enumerate(self.rooms):
            for b in self.rooms[i + 1:]:
                ox = min(a.x_mm + a.width_mm, b.x_mm + b.width_mm) - max(a.x_mm, b.x_mm)
                oy = min(a.y_mm + a.height_mm, b.y_mm + b.height_mm) - max(a.y_mm, b.y_mm)
                if ox > 1e-6 and oy > 1e-6:
                    raise ValueError('Rooms overlap; correct the geometry instead of silently shrinking it.')
        for opening in [*self.doors, *self.windows]:
            axes = set()
            half = opening.width_mm / 2
            for room in self.rooms:
                if (min(abs(opening.x_mm - room.x_mm), abs(opening.x_mm - room.x_mm - room.width_mm)) <= 1e-6
                        and opening.y_mm - half >= room.y_mm - 1e-6
                        and opening.y_mm + half <= room.y_mm + room.height_mm + 1e-6):
                    axes.add('vertical')
                if (min(abs(opening.y_mm - room.y_mm), abs(opening.y_mm - room.y_mm - room.height_mm)) <= 1e-6
                        and opening.x_mm - half >= room.x_mm - 1e-6
                        and opening.x_mm + half <= room.x_mm + room.width_mm + 1e-6):
                    axes.add('horizontal')
            if opening.orientation is None:
                if len(axes) != 1:
                    raise ValueError('Opening needs an unambiguous room edge and orientation.')
                opening.orientation = next(iter(axes))
                opening.rotation = 90 if opening.orientation == 'vertical' else 0
            elif opening.orientation not in axes:
                raise ValueError('Opening must lie on and fit a room edge with its supplied orientation.')
        return self


def layout_to_scene(layout: ConfirmedLayout) -> SceneGraph:
    rooms = []
    for r in layout.rooms:
        x, y, w, h = (v / 1000 for v in (r.x_mm, r.y_mm, r.width_mm, r.height_mm))
        rooms.append({'id': r.id, 'label': r.name, 'type': r.type.lower(),
                      'area_sqm': w * h,
                      'polygon': [[x, y], [(r.x_mm + r.width_mm) / 1000, y],
                                  [(r.x_mm + r.width_mm) / 1000, (r.y_mm + r.height_mm) / 1000],
                                  [x, (r.y_mm + r.height_mm) / 1000]],
                      'floor_material': 'wood_light' if r.type.lower() in {'bedroom', 'living', 'dining', 'office'} else 'tile_white',
                      'wall_color': '#e2e8f0', 'merge_group': r.merge_group})
    def opening(item):
        # No fake wall reference: renderer derives walls from room polygons.
        result = {'id': item.id, 'position': [item.x_mm / 1000, item.y_mm / 1000],
                  'width_m': item.width_mm / 1000, 'wall_id': '',
                  'orientation': item.orientation, 'rotation': item.rotation}
        return result
    return SceneGraph.model_validate({
        'metadata': {'source_file': layout.source_file,
                     'total_area_sqm': sum(r['area_sqm'] for r in rooms),
                     'scale_factor': 1.0, 'floor_height_m': 2.8},
        'rooms': rooms, 'walls': [],
        'doors': [{**opening(d), 'type': d.type} for d in layout.doors],
        'windows': [{**opening(w), 'height_m': 1.2, 'sill_height_m': 0.9} for w in layout.windows],
        'furniture': [],
    })
