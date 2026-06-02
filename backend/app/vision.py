"""Vision analysis — uses Azure OpenAI GPT-4o/GPT-5 vision to extract a SceneGraph from a floor plan image."""

import base64
import json
import logging

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from openai import AzureOpenAI

from app.config import settings
from app.models import SceneGraph

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert architectural analyst. You receive a 2D floor plan image and must produce a structured JSON SceneGraph representing the spatial layout.

## CRITICAL GEOMETRY RULES — READ CAREFULLY

The most important requirement is that room polygons TILE PERFECTLY with NO GAPS:

1. **Shared vertices**: Adjacent rooms MUST share EXACT coordinates at their boundary. If Room A has edge [[0,0],[4,0]] and Room B is next to it, Room B MUST use the EXACT points [0,0] and [4,0] — not [0.01,0] or [3.99,0].

2. **Grid alignment**: Round ALL coordinates to the nearest 0.1 meters. No coordinate should have more than 1 decimal place.

3. **Axis-aligned rectangles**: For HDB/apartment floor plans, ALL rooms should be RECTANGLES with edges parallel to X and Y axes. No diagonal edges. Every polygon should have exactly 4 points.

4. **Complete tiling**: The room polygons should tile together to fill the entire floor plan footprint with ZERO gaps between them. Think of it like a jigsaw puzzle — every edge of one room that borders another room must use identical coordinate pairs.

5. **Origin at (0,0)**: Place the bottom-left corner of the overall floor plan at origin (0,0). All coordinates should be positive.

## Output Schema
Return ONLY valid JSON matching this exact structure (no markdown, no explanation):

{
  "metadata": {
    "source_file": "<filename>",
    "total_area_sqm": <number>,
    "scale_factor": 1.0,
    "floor_height_m": 2.8
  },
  "rooms": [
    {
      "id": "room_<n>",
      "label": "<Room Name>",
      "type": "<living|bedroom|kitchen|bathroom|dining|corridor|balcony|storage|office>",
      "area_sqm": <number>,
      "polygon": [[x1,y1],[x2,y2],[x3,y3],[x4,y4]],
      "floor_material": "<wood_light|tile_white|carpet|concrete>",
      "wall_color": "<hex color>"
    }
  ],
  "walls": [],
  "doors": [
    {
      "id": "d<n>",
      "position": [x, y],
      "width_m": <number>,
      "wall_id": "w1",
      "type": "<hinged|sliding|main_entrance>"
    }
  ],
  "windows": [
    {
      "id": "win<n>",
      "position": [x, y],
      "width_m": <number>,
      "height_m": <number>,
      "sill_height_m": 0.9,
      "wall_id": "w1"
    }
  ],
  "furniture": []
}

## Additional Rules
1. All coordinates in METERS, rounded to 0.1m, origin at bottom-left.
2. Room polygons: exactly 4 points (rectangles only), axis-aligned.
3. Leave "walls" array EMPTY — walls will be derived from room polygons automatically.
4. Door/window positions: place on the shared edge between rooms. The position should be a point ON the room polygon edge.
5. If dimensions are labeled on the plan, use them. Otherwise estimate from standard conventions.
6. Assign floor_material: wood_light for bedrooms/living, tile_white for kitchen/bath/corridor.
"""


def _get_client(endpoint: str | None = None) -> AzureOpenAI:
    ep = endpoint or settings.AZURE_OPENAI_ENDPOINT
    if settings.AZURE_OPENAI_API_KEY:
        return AzureOpenAI(
            azure_endpoint=ep,
            api_key=settings.AZURE_OPENAI_API_KEY,
            api_version=settings.AZURE_OPENAI_API_VERSION,
            timeout=120.0,
        )
    token_provider = get_bearer_token_provider(
        DefaultAzureCredential(),
        "https://cognitiveservices.azure.com/.default",
    )
    return AzureOpenAI(
        azure_endpoint=ep,
        azure_ad_token_provider=token_provider,
        api_version=settings.AZURE_OPENAI_API_VERSION,
        timeout=120.0,
    )


async def analyze_floor_plan(
    image_bytes: bytes,
    filename: str,
    endpoint_override: str | None = None,
    deployment_override: str | None = None,
) -> SceneGraph:
    """Send floor plan image to GPT vision and parse the SceneGraph response."""
    client = _get_client(endpoint_override)
    deployment = deployment_override or settings.AZURE_OPENAI_DEPLOYMENT

    b64 = base64.b64encode(image_bytes).decode("utf-8")
    mime = "image/png" if filename.lower().endswith(".png") else "image/jpeg"

    logger.info("Sending floor plan to vision model: %s (deployment: %s)", filename, deployment)

    response = client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": f"Analyze this floor plan image (filename: {filename}). Return the SceneGraph JSON.",
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:{mime};base64,{b64}",
                            "detail": "high",
                        },
                    },
                ],
            },
        ],
        max_completion_tokens=4096,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    logger.info("Vision model response length: %d chars", len(raw or ""))

    try:
        data = json.loads(raw)
        # Post-process: force-snap all coordinates to 0.1m grid
        data = _post_process_scene(data)
        scene = SceneGraph.model_validate(data)
        return scene
    except Exception as e:
        logger.error("Failed to parse SceneGraph: %s\nRaw: %s", e, raw[:500])
        raise ValueError(f"AI returned invalid scene data: {e}") from e


def _snap(v: float, grid: float = 0.1) -> float:
    """Snap a value to the nearest grid point."""
    return round(round(v / grid) * grid, 1)


def _post_process_scene(data: dict) -> dict:
    """Post-process GPT-5 output to fix coordinate alignment issues."""

    # 1. Snap all room polygon coordinates to 0.1m grid
    for room in data.get("rooms", []):
        room["polygon"] = [[_snap(p[0]), _snap(p[1])] for p in room.get("polygon", [])]

    # 2. Collect all unique coordinate values on each axis
    all_x = set()
    all_y = set()
    for room in data.get("rooms", []):
        for p in room.get("polygon", []):
            all_x.add(p[0])
            all_y.add(p[1])

    # 3. Merge coordinates that are within 0.2m of each other (force shared vertices)
    def merge_close(values: set, threshold: float = 0.2) -> dict:
        sorted_vals = sorted(values)
        merge_map = {}
        i = 0
        while i < len(sorted_vals):
            group = [sorted_vals[i]]
            j = i + 1
            while j < len(sorted_vals) and sorted_vals[j] - sorted_vals[i] < threshold:
                group.append(sorted_vals[j])
                j += 1
            # Map all values in group to their average (snapped)
            avg = _snap(sum(group) / len(group))
            for v in group:
                merge_map[v] = avg
            i = j
        return merge_map

    x_map = merge_close(all_x)
    y_map = merge_close(all_y)

    # 4. Apply merge to all room polygons
    for room in data.get("rooms", []):
        room["polygon"] = [
            [x_map.get(p[0], p[0]), y_map.get(p[1], p[1])]
            for p in room.get("polygon", [])
        ]
        # Recalculate area from polygon
        poly = room["polygon"]
        if len(poly) >= 3:
            # Shoelace formula
            n = len(poly)
            area = 0
            for i in range(n):
                j = (i + 1) % n
                area += poly[i][0] * poly[j][1]
                area -= poly[j][0] * poly[i][1]
            room["area_sqm"] = round(abs(area) / 2, 1)

    # 5. Snap door/window positions
    for door in data.get("doors", []):
        pos = door.get("position", [0, 0])
        door["position"] = [x_map.get(_snap(pos[0]), _snap(pos[0])),
                            y_map.get(_snap(pos[1]), _snap(pos[1]))]

    for win in data.get("windows", []):
        pos = win.get("position", [0, 0])
        win["position"] = [x_map.get(_snap(pos[0]), _snap(pos[0])),
                           y_map.get(_snap(pos[1]), _snap(pos[1]))]

    # 6. Recalculate total area
    total = sum(r.get("area_sqm", 0) for r in data.get("rooms", []))
    if "metadata" in data:
        data["metadata"]["total_area_sqm"] = round(total, 1)

    logger.info("Post-processed: merged %d x-coords → %d, %d y-coords → %d",
                len(all_x), len(set(x_map.values())),
                len(all_y), len(set(y_map.values())))

    return data
