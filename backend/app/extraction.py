"""Floor plan extraction using Azure CU + GPT-5 inference.

Pipeline:
  1. CU OCR — extracts dimension numbers and room labels with pixel bounding boxes
  2. Spatial classification — uses bbox aspect ratio & position to classify dims
  3. GPT-5 inference — uses CU data + image to produce accurate layout
"""

import asyncio
import base64
import json
import logging
import re
import time

import httpx
from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from openai import AzureOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

# How long to poll for CU results (seconds)
_CU_POLL_TIMEOUT = 60
_CU_POLL_INTERVAL = 3


def _get_cu_token() -> str:
    """Get a bearer token for CU via DefaultAzureCredential."""
    cred = DefaultAzureCredential()
    token = cred.get_token("https://cognitiveservices.azure.com/.default")
    return token.token


async def extract_floor_plan(image_bytes: bytes, filename: str) -> dict:
    """Run CU OCR on a floor plan and return structured extraction with spatial analysis.

    Returns:
        {
            "dimensions": [
                {"value_mm": 4172, "orientation": "horizontal", "side": "top", "cx": 596, "cy": 33},
                ...
            ],
            "room_labels": [
                {"name": "BEDROOM", "cx": 631, "cy": 224, "quadrant": "top-right"},
                ...
            ],
            "page_width": 902,
            "page_height": 642,
            "image_base64": "...",
            "image_mime": "image/png",
        }
    """
    token = _get_cu_token()
    base = settings.AZURE_CU_ENDPOINT.rstrip("/")
    analyzer = settings.AZURE_CU_ANALYZER
    api_ver = settings.AZURE_CU_API_VERSION

    mime = "image/png" if filename.lower().endswith(".png") else "image/jpeg"

    # 1. Submit image for analysis
    submit_url = (
        f"{base}/contentunderstanding/analyzers/{analyzer}:analyze"
        f"?_overload=analyzeDocument&api-version={api_ver}"
    )
    logger.info("Submitting %s to CU analyzer %s", filename, analyzer)

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            submit_url,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": mime,
            },
            content=image_bytes,
        )
        resp.raise_for_status()
        result_id = resp.json()["id"]
        logger.info("CU analysis submitted: %s", result_id)

    # 2. Poll for results
    poll_url = (
        f"{base}/contentunderstanding/analyzerResults/{result_id}"
        f"?api-version={api_ver}"
    )
    start = time.time()
    result = None

    async with httpx.AsyncClient(timeout=30.0) as client:
        while time.time() - start < _CU_POLL_TIMEOUT:
            await asyncio.sleep(_CU_POLL_INTERVAL)
            resp = await client.get(
                poll_url,
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            data = resp.json()
            status = data.get("status", "")
            if status == "Succeeded":
                result = data
                break
            elif status in ("Failed", "Canceled"):
                raise RuntimeError(f"CU analysis {status}: {data}")
            logger.debug("CU poll: %s (%.0fs)", status, time.time() - start)

    if result is None:
        raise TimeoutError(f"CU analysis timed out after {_CU_POLL_TIMEOUT}s")

    # 3. Parse OCR words with bounding boxes
    page = result["result"]["contents"][0]["pages"][0]
    pw, ph = page["width"], page["height"]

    words = []
    for w in page["words"]:
        src = w.get("source", "")
        m = re.match(
            r"D\((\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)\)", src
        )
        if not m:
            continue
        coords = [int(m.group(i)) for i in range(2, 10)]
        xs = [coords[i] for i in [0, 2, 4, 6]]
        ys = [coords[i] for i in [1, 3, 5, 7]]
        words.append(
            {
                "text": w["content"],
                "confidence": w["confidence"],
                "cx": sum(xs) // 4,
                "cy": sum(ys) // 4,
                "bw": max(xs) - min(xs),
                "bh": max(ys) - min(ys),
            }
        )

    # 4. Classify words into dimensions and room labels
    dimensions = []
    room_labels = []

    # Skip labels for non-room elements
    skip_labels = {"DROP", "SCALE", "UP", "DN"}

    for w in words:
        text = w["text"]

        # Match dimension numbers: 3-5 digits, optionally with one decimal
        if re.match(r"^\d{3,5}(\.\d)?$", text):
            val = float(text)
            is_horiz = w["bw"] > w["bh"]
            rx, ry = w["cx"] / pw, w["cy"] / ph

            if is_horiz:
                orientation = "horizontal"
                if ry < 0.15:
                    side = "top"
                elif ry > 0.85:
                    side = "bottom"
                else:
                    side = "interior"
            else:
                orientation = "vertical"
                if rx < 0.15:
                    side = "left"
                elif rx > 0.80:
                    side = "right"
                else:
                    side = "interior"

            dimensions.append(
                {
                    "value_mm": val,
                    "orientation": orientation,
                    "side": side,
                    "cx": w["cx"],
                    "cy": w["cy"],
                    "rel_x": round(rx, 2),
                    "rel_y": round(ry, 2),
                }
            )

        # Match room labels: 2+ uppercase letters, may contain / or .
        elif re.match(r"^[A-Z][A-Z./]{1,}$", text) and text not in skip_labels:
            rx, ry = w["cx"] / pw, w["cy"] / ph
            qx = "left" if rx < 0.4 else ("right" if rx > 0.6 else "center")
            qy = "top" if ry < 0.35 else ("bottom" if ry > 0.65 else "center")

            room_labels.append(
                {
                    "name": text,
                    "cx": w["cx"],
                    "cy": w["cy"],
                    "rel_x": round(rx, 2),
                    "rel_y": round(ry, 2),
                    "quadrant": f"{qy}-{qx}",
                }
            )

    # 5. Detect potential L-shaped rooms from dimension clustering
    shape_hints = _detect_shape_hints(dimensions, room_labels, pw, ph)

    # 6. Build base64 for passing to frontend (for reference image)
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    logger.info(
        "CU extraction: %d dimensions, %d room labels, %d shape hints (page %dx%d)",
        len(dimensions),
        len(room_labels),
        len(shape_hints),
        pw,
        ph,
    )

    return {
        "dimensions": sorted(dimensions, key=lambda d: d["cy"]),
        "room_labels": sorted(room_labels, key=lambda r: r["cy"]),
        "shape_hints": shape_hints,
        "page_width": pw,
        "page_height": ph,
        "image_base64": b64,
        "image_mime": mime,
    }


def _detect_shape_hints(
    dimensions: list, room_labels: list, pw: int, ph: int,
) -> list:
    """Detect potential L-shaped rooms by analyzing dimension positions.

    Heuristic: If interior horizontal dimensions at different y-positions have
    different values, the plan likely has rooms that change width at that height,
    which indicates an L-shaped room boundary.

    Similarly, if vertical interior dimensions at different x-positions have
    different values, there's a column-width change suggesting an L-shape.
    """
    hints = []

    # Group horizontal interior dims by approximate y-band
    horiz_interior = [
        d for d in dimensions
        if d["orientation"] == "horizontal" and d["side"] == "interior"
    ]
    vert_interior = [
        d for d in dimensions
        if d["orientation"] == "vertical" and d["side"] == "interior"
    ]

    # Get edge dimensions for reference
    top_dims = [d for d in dimensions if d["side"] == "top"]
    bottom_dims = [d for d in dimensions if d["side"] == "bottom"]
    left_dims = [d for d in dimensions if d["side"] == "left"]
    right_dims = [d for d in dimensions if d["side"] == "right"]

    # Check if top-edge dims differ from bottom-edge dims (different row widths)
    top_vals = sorted(set(d["value_mm"] for d in top_dims))
    bottom_vals = sorted(set(d["value_mm"] for d in bottom_dims))
    left_vals = sorted(set(d["value_mm"] for d in left_dims))
    right_vals = sorted(set(d["value_mm"] for d in right_dims))

    # If top row has more dimension segments than bottom (or vice versa),
    # it means rooms have different widths at different heights → L-shape
    if len(top_vals) != len(bottom_vals) and top_vals and bottom_vals:
        hints.append({
            "type": "row_width_mismatch",
            "description": (
                f"Top edge has {len(top_vals)} width segments {top_vals}, "
                f"bottom edge has {len(bottom_vals)} width segments {bottom_vals}. "
                f"This means rooms change width between top and bottom rows, "
                f"indicating one or more L-shaped rooms."
            ),
        })

    if len(left_vals) != len(right_vals) and left_vals and right_vals:
        hints.append({
            "type": "column_height_mismatch",
            "description": (
                f"Left edge has {len(left_vals)} height segments {left_vals}, "
                f"right edge has {len(right_vals)} height segments {right_vals}. "
                f"This means rooms change height between left and right columns, "
                f"indicating one or more L-shaped rooms."
            ),
        })

    # Check for rooms near the boundary where adjacent rooms don't align
    # Group room labels by rough y-band (top third, middle, bottom third)
    for label in room_labels:
        name = label["name"]
        if name not in ("KITCHEN", "LIVING", "LIVING/DINING"):
            continue

        # Find dimensions near this room's position
        nearby_horiz = [
            d for d in horiz_interior
            if abs(d["rel_y"] - label["rel_y"]) < 0.2
        ]
        nearby_vert = [
            d for d in vert_interior
            if abs(d["rel_x"] - label["rel_x"]) < 0.2
        ]

        # If there are multiple horizontal dims near a room at different x-positions,
        # the room may have different widths at different heights
        if len(nearby_horiz) >= 2:
            vals = [d["value_mm"] for d in nearby_horiz]
            if len(set(vals)) > 1:
                hints.append({
                    "type": "room_multi_width",
                    "room": name,
                    "description": (
                        f"{name} has multiple nearby horizontal dimensions: {vals}. "
                        f"This suggests the room has different widths at different "
                        f"heights, which means it is L-shaped."
                    ),
                })

    logger.info("Shape hints detected: %d", len(hints))
    for h in hints:
        logger.info("  Shape hint: %s", h["description"])

    return hints


# ── GPT-5 Layout Inference ────────────────────────────────────────────────────

_LAYOUT_SYSTEM_PROMPT = """\
You are an expert at reading HDB/apartment floor plans. You receive:
1. A floor plan IMAGE
2. OCR-extracted dimension annotations with orientation and position
3. OCR-extracted room labels with approximate position

Your job: produce a PRECISE room layout where rooms tile perfectly with NO overlaps and NO gaps.

## CRITICAL TILING RULES — MOST IMPORTANT
Think of the floor plan as a grid. Rooms are rectangles that tile together like a jigsaw puzzle:
1. **NO OVERLAPS**: No two rooms may share any interior area. If room A occupies x=0-4000, room B must start at x=4000 or later (not 3500).
2. **NO GAPS**: Every point inside the plan boundary must belong to a room. If the plan is 9000mm wide, rooms in each row must sum to exactly 9000mm.
3. **SHARED EDGES**: Adjacent rooms share exact edge coordinates. If room A ends at x=4000, room B starts at x=4000 — not 4001, not 3999.
4. **ROW/COLUMN ALIGNMENT**: Rooms in the same row have the same y_mm and height_mm. Rooms in the same column have the same x_mm and width_mm.

## VERIFICATION STEP
Before outputting, verify:
- Sum of widths in each horizontal row = overall_width_mm
- Sum of heights in each vertical column = overall_height_mm
- No room bbox overlaps another room bbox
- Every mm² of the plan footprint is covered

## Room coordinates
- Origin at top-left (0,0). All values in MILLIMETERS.
- Each room: {name, type, x_mm, y_mm, width_mm, height_mm}

## Doors and Windows — include orientation
- Each door: {x_mm, y_mm, width_mm, type, orientation}
  - orientation: "horizontal" if on a top/bottom wall, "vertical" if on a left/right wall
  - x_mm/y_mm is the CENTER point of the door on the wall
- Each window: {x_mm, y_mm, width_mm, orientation}
  - Same orientation rule as doors
- Place doors and windows on the wall edges between rooms or on exterior walls

## CRITICAL: Step-by-step spatial analysis
Before producing the layout, follow these steps:

### Step 1: Identify the overall plan boundary
Look at the dimension annotations to determine overall width and height.

### Step 2: Identify each room and trace its ACTUAL boundary in the image
For EACH labeled room, carefully trace its walls in the image:
- Follow the thick wall lines around the room
- Note where the room's boundary is NOT a simple rectangle
- If a room has an inner corner (one wall steps in/out), it's L-shaped

### Step 3: Handle L-shaped rooms by splitting
If any room is L-shaped (has a step in its boundary), split it into exactly 2 rectangles:
- Name them ROOMNAME_A and ROOMNAME_B (e.g. KITCHEN_A, KITCHEN_B)
- The two rectangles must share an exact edge
- Together they must cover the entire L-shaped area with no gaps

**Common L-shape in HDB 3-room plans**: The KITCHEN often forms an L-shape because:
- Its top portion sits next to the BATH/WC (narrower, sharing the row)
- Its bottom portion extends further left (wider, no BATH next to it)
- The left wall of the kitchen "steps" at the bottom of the BATH
- Split this as: KITCHEN_A (narrow top part, same row as BATH) + KITCHEN_B (wide bottom part)

### Step 4: Tile all rooms with NO gaps and NO overlaps
- Rooms in the same row must have matching y_mm and height_mm
- Rooms in the same column must have matching x_mm and width_mm
- The sum of widths in each row = overall_width_mm
- The sum of heights in each column = overall_height_mm
- Verify: no room bbox overlaps another, every mm² is covered

### Step 5: Place doors and windows
- Doors go on shared interior walls between rooms
- Windows go on exterior walls (plan boundary)

## Room type mapping
BEDROOM → bedroom, LIVING/LIVING ROOM → living, KITCHEN → kitchen,
BATH/BATHROOM → bathroom, WC/W.C. → wc, DINING → dining,
CORRIDOR/HALL → corridor, STORE → storage, YARD → yard, BALCONY → balcony

## Output — return ONLY valid JSON, no markdown:
{
  "rooms": [
    {"name": "BEDROOM_1", "type": "bedroom", "x_mm": 0, "y_mm": 1700, "width_mm": 4600, "height_mm": 3400},
    {"name": "KITCHEN_A", "type": "kitchen", "x_mm": 6000, "y_mm": 1700, "width_mm": 3100, "height_mm": 1700},
    {"name": "KITCHEN_B", "type": "kitchen", "x_mm": 4600, "y_mm": 3400, "width_mm": 4500, "height_mm": 2500},
    ...
  ],
  "doors": [
    {"x_mm": 4600, "y_mm": 3000, "width_mm": 900, "type": "hinged", "orientation": "vertical"},
    ...
  ],
  "windows": [
    {"x_mm": 2000, "y_mm": 0, "width_mm": 1200, "orientation": "horizontal"},
    ...
  ],
  "overall_width_mm": 9100,
  "overall_height_mm": 9900
}
"""


def _get_openai_client() -> AzureOpenAI:
    """Get Azure OpenAI client (reuses vision.py pattern)."""
    ep = settings.AZURE_OPENAI_ENDPOINT
    if settings.AZURE_OPENAI_API_KEY:
        return AzureOpenAI(
            azure_endpoint=ep,
            api_key=settings.AZURE_OPENAI_API_KEY,
            api_version=settings.AZURE_OPENAI_API_VERSION,
            timeout=180.0,
        )
    token_provider = get_bearer_token_provider(
        DefaultAzureCredential(),
        "https://cognitiveservices.azure.com/.default",
    )
    return AzureOpenAI(
        azure_endpoint=ep,
        azure_ad_token_provider=token_provider,
        api_version=settings.AZURE_OPENAI_API_VERSION,
        timeout=180.0,
    )


async def infer_layout(
    cu_result: dict, image_bytes: bytes, filename: str,
) -> dict:
    """Use GPT-5 to combine CU OCR data + image to produce a layout.

    Args:
        cu_result: Output from extract_floor_plan() (dimensions, room_labels, etc.)
        image_bytes: Original floor plan image
        filename: Image filename for MIME type detection

    Returns:
        Dict with rooms, doors, windows, overall dimensions — ready for the 2D editor.
    """
    client = _get_openai_client()
    deployment = settings.AZURE_OPENAI_DEPLOYMENT

    mime = cu_result.get("image_mime", "image/png")
    b64 = base64.b64encode(image_bytes).decode("utf-8")

    # Build the structured CU data summary for GPT-5
    dims_text = "## Dimension annotations (from Azure Content Understanding OCR)\n"
    for d in cu_result["dimensions"]:
        dims_text += (
            f"- {d['value_mm']}mm | {d['orientation']} | edge: {d['side']} "
            f"| position: ({d['rel_x']:.0%}, {d['rel_y']:.0%})\n"
        )

    labels_text = "\n## Room labels (from Azure Content Understanding OCR)\n"
    for r in cu_result["room_labels"]:
        labels_text += (
            f"- {r['name']} | quadrant: {r['quadrant']} "
            f"| position: ({r['rel_x']:.0%}, {r['rel_y']:.0%})\n"
        )

    # Build shape hints section (from dimension analysis)
    shape_hints = cu_result.get("shape_hints", [])
    hints_text = ""
    if shape_hints:
        hints_text = "\n## Shape analysis (from dimension position analysis)\n"
        hints_text += "⚠️ The following L-shape indicators were detected from the OCR dimension positions:\n"
        for h in shape_hints:
            hints_text += f"- **{h.get('type', 'hint')}**: {h['description']}\n"
        hints_text += (
            "\nThese hints strongly suggest L-shaped rooms exist. "
            "You MUST split any L-shaped room into two rectangles (e.g. KITCHEN_A + KITCHEN_B).\n"
        )

    user_content = (
        f"Analyze this floor plan using the OCR data and image:\n\n"
        f"{dims_text}{labels_text}{hints_text}\n"
        f"Page size: {cu_result['page_width']}x{cu_result['page_height']} pixels.\n\n"
        f"CRITICAL ANALYSIS REQUIRED:\n"
        f"1. Look at the KITCHEN area in the image. In most HDB plans, the kitchen shares a row with "
        f"BATH/WC at the top but then extends further down on the right side, making it L-shaped. "
        f"If the kitchen's left wall has a STEP (changes position at the BATH boundary), split it into "
        f"KITCHEN_A (top narrow part beside BATH) and KITCHEN_B (bottom wider part below BATH).\n\n"
        f"2. Similarly check LIVING ROOM — if it shares space with bedrooms on one side but extends "
        f"further on the other, it may also be L-shaped.\n\n"
        f"3. The area between the bedrooms and the kitchen/living room is critical — there should be "
        f"NO empty gaps and NO tiny filler rooms. Every part of the plan must be covered by a real room.\n\n"
        f"4. Use the OCR dimensions for exact room sizes. Use the image to trace wall boundaries.\n\n"
        f"Produce the most accurate JSON layout with perfect tiling."
    )

    logger.info(
        "Sending CU data + image to GPT-5 for layout inference (deployment: %s)",
        deployment,
    )

    response = client.chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": _LAYOUT_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": user_content},
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
        max_completion_tokens=8192,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    logger.info("GPT-5 layout inference response: %d chars", len(raw or ""))

    try:
        layout = json.loads(raw)
    except (json.JSONDecodeError, TypeError) as e:
        logger.error("Failed to parse GPT-5 layout: %s\nRaw: %s", e, (raw or "")[:500])
        raise ValueError(f"GPT-5 returned invalid layout JSON: {e}") from e

    # Validate and add IDs
    rooms = layout.get("rooms", [])
    for i, r in enumerate(rooms):
        r.setdefault("name", f"Room {i+1}")
        r.setdefault("type", "living")
        r["id"] = f"room_{i+1}"

    doors = layout.get("doors", [])
    for i, d in enumerate(doors):
        d["id"] = f"door_{i+1}"
        d.setdefault("width_mm", 900)
        d.setdefault("type", "hinged")
        d.setdefault("orientation", "horizontal")

    windows = layout.get("windows", [])
    for i, w in enumerate(windows):
        w["id"] = f"win_{i+1}"
        w.setdefault("width_mm", 1200)
        w.setdefault("orientation", "horizontal")

    overall_w = layout.get("overall_width_mm", 0)
    overall_h = layout.get("overall_height_mm", 0)

    # Post-process: fix overlaps and snap coordinates
    rooms = _post_process_layout(rooms, overall_w, overall_h)

    result = {
        "rooms": rooms,
        "doors": doors,
        "windows": windows,
        "overall_width_mm": overall_w,
        "overall_height_mm": overall_h,
    }

    logger.info(
        "Layout inference: %d rooms, %d doors, %d windows, overall %dx%dmm",
        len(rooms), len(doors), len(windows),
        result["overall_width_mm"], result["overall_height_mm"],
    )

    return result


def _post_process_layout(rooms: list[dict], overall_w: float, overall_h: float) -> list[dict]:
    """Post-process GPT-5 layout to fix overlaps, gaps, and coordinate misalignment.

    Steps:
    1. Snap all coordinates to 50mm grid
    2. Collect unique X and Y edge values and merge close ones
    3. Resolve overlaps by adjusting room boundaries
    """
    if not rooms:
        return rooms

    SNAP = 50  # snap to 50mm grid

    def snap(v):
        return round(v / SNAP) * SNAP

    # Step 1: Snap all coordinates
    for r in rooms:
        r["x_mm"] = snap(r.get("x_mm", 0))
        r["y_mm"] = snap(r.get("y_mm", 0))
        r["width_mm"] = max(snap(r.get("width_mm", 1000)), 200)
        r["height_mm"] = max(snap(r.get("height_mm", 1000)), 200)

    # Step 2: Collect all unique edge coordinates and merge close values
    # This forces rooms to share exact edges instead of being off by small amounts
    all_x = set()
    all_y = set()
    for r in rooms:
        all_x.add(r["x_mm"])
        all_x.add(r["x_mm"] + r["width_mm"])
        all_y.add(r["y_mm"])
        all_y.add(r["y_mm"] + r["height_mm"])

    def merge_close(values, threshold=150):
        """Merge coordinate values within threshold of each other."""
        sorted_vals = sorted(values)
        merge_map = {}
        i = 0
        while i < len(sorted_vals):
            group = [sorted_vals[i]]
            j = i + 1
            while j < len(sorted_vals) and sorted_vals[j] - sorted_vals[i] < threshold:
                group.append(sorted_vals[j])
                j += 1
            avg = snap(sum(group) / len(group))
            for v in group:
                merge_map[v] = avg
            i = j
        return merge_map

    x_map = merge_close(all_x)
    y_map = merge_close(all_y)

    # Apply merged coordinates
    for r in rooms:
        old_x = r["x_mm"]
        old_right = old_x + r["width_mm"]
        old_y = r["y_mm"]
        old_bottom = old_y + r["height_mm"]

        new_x = x_map.get(old_x, old_x)
        new_right = x_map.get(old_right, old_right)
        new_y = y_map.get(old_y, old_y)
        new_bottom = y_map.get(old_bottom, old_bottom)

        r["x_mm"] = new_x
        r["y_mm"] = new_y
        r["width_mm"] = max(new_right - new_x, 200)
        r["height_mm"] = max(new_bottom - new_y, 200)

    # Step 3: Resolve overlaps — if two rooms overlap, shrink the smaller one
    for i in range(len(rooms)):
        for j in range(i + 1, len(rooms)):
            a, b = rooms[i], rooms[j]
            # Check overlap
            ox = max(0, min(a["x_mm"] + a["width_mm"], b["x_mm"] + b["width_mm"]) - max(a["x_mm"], b["x_mm"]))
            oy = max(0, min(a["y_mm"] + a["height_mm"], b["y_mm"] + b["height_mm"]) - max(a["y_mm"], b["y_mm"]))

            if ox > 0 and oy > 0:
                # Overlap exists — resolve by adjusting the one that starts later
                area_a = a["width_mm"] * a["height_mm"]
                area_b = b["width_mm"] * b["height_mm"]
                smaller = b if area_b <= area_a else a
                larger = a if area_b <= area_a else b

                # Determine which direction has less overlap to resolve
                if ox < oy:
                    # Horizontal overlap — push smaller room's x
                    if smaller["x_mm"] < larger["x_mm"]:
                        smaller["width_mm"] = larger["x_mm"] - smaller["x_mm"]
                    else:
                        old_right = smaller["x_mm"] + smaller["width_mm"]
                        smaller["x_mm"] = larger["x_mm"] + larger["width_mm"]
                        smaller["width_mm"] = old_right - smaller["x_mm"]
                else:
                    # Vertical overlap — push smaller room's y
                    if smaller["y_mm"] < larger["y_mm"]:
                        smaller["height_mm"] = larger["y_mm"] - smaller["y_mm"]
                    else:
                        old_bottom = smaller["y_mm"] + smaller["height_mm"]
                        smaller["y_mm"] = larger["y_mm"] + larger["height_mm"]
                        smaller["height_mm"] = old_bottom - smaller["y_mm"]

                # Ensure minimum size
                smaller["width_mm"] = max(smaller["width_mm"], 200)
                smaller["height_mm"] = max(smaller["height_mm"], 200)

    logger.info("Post-processed: %d rooms, merged %d x-coords → %d, %d y-coords → %d",
                len(rooms), len(all_x), len(set(x_map.values())),
                len(all_y), len(set(y_map.values())))

    return rooms
