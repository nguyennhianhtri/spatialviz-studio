import logging
import time
import json
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import settings
from app.models import SceneGraph, ChatRequest, ChatResponse
from app.demo_scene import DEMO_SCENE
from app.vision import analyze_floor_plan
from app.extraction import extract_floor_plan, infer_layout
from app.chat import chat_with_scene
from app.valuation import get_valuation

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("/tmp/spatialviz-backend.log"),
    ],
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="SpatialViz Studio API",
    description="2D floor plan → 3D spatial intelligence backend",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    models = []
    if settings.AZURE_OPENAI_ENDPOINT:
        models.append(settings.AZURE_OPENAI_DEPLOYMENT)
    if settings.AZURE_OPENAI_ENDPOINT_ALT:
        models.append(settings.AZURE_OPENAI_DEPLOYMENT_ALT)
    return {"status": "ok", "service": "spatialviz-backend", "models": models}


# ── Saved layout (refined output persisted to disk) ──────────────────────────

SAVED_LAYOUT_PATH = Path(__file__).resolve().parent.parent / "saved_layout.json"


def _load_saved_layout() -> dict | None:
    try:
        if SAVED_LAYOUT_PATH.exists():
            return json.loads(SAVED_LAYOUT_PATH.read_text())
    except Exception:
        logger.exception("Failed to load saved layout")
    return None


@app.get("/api/saved-layout")
async def get_saved_layout():
    """Return the refined layout the user has saved, or 404 if none exists."""
    saved = _load_saved_layout()
    if saved is None:
        raise HTTPException(status_code=404, detail="No saved layout")
    return saved


@app.post("/api/save-layout")
async def save_layout(layout: dict):
    """Persist the user's refined editor layout to disk.

    Subsequent /api/extract calls will return this layout instead of the
    default Opus-authored one.
    """
    try:
        SAVED_LAYOUT_PATH.write_text(json.dumps(layout, indent=2))
        logger.info("Saved refined layout (%d rooms)", len(layout.get("rooms", [])))
        return {"status": "ok", "path": str(SAVED_LAYOUT_PATH)}
    except Exception as e:
        logger.exception("Failed to save layout")
        raise HTTPException(status_code=500, detail=f"Save failed: {e}")


@app.delete("/api/saved-layout")
async def delete_saved_layout():
    """Clear the saved refined layout."""
    try:
        if SAVED_LAYOUT_PATH.exists():
            SAVED_LAYOUT_PATH.unlink()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Delete failed: {e}")


@app.get("/api/demo-scene", response_model=SceneGraph)
async def get_demo_scene():
    """Return a pre-built demo scene for the HDB 4-room flat."""
    return DEMO_SCENE


class AnalyzeResponse(BaseModel):
    scene: SceneGraph
    model_used: str
    processing_time_ms: int
    room_count: int
    total_area_sqm: float


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(
    file: UploadFile = File(...),
    model: str = Query(default="primary", description="Model: 'primary' or 'alt'"),
):
    """Upload a floor plan image and get back a SceneGraph JSON with metadata."""
    if not file.content_type or not any(
        t in file.content_type for t in ["image/png", "image/jpeg", "application/pdf"]
    ):
        raise HTTPException(status_code=400, detail="Unsupported file type.")

    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 20MB).")

    if not settings.AZURE_OPENAI_ENDPOINT:
        logger.warning("Azure OpenAI not configured — returning demo scene")
        return AnalyzeResponse(
            scene=DEMO_SCENE,
            model_used="demo",
            processing_time_ms=0,
            room_count=len(DEMO_SCENE.rooms),
            total_area_sqm=DEMO_SCENE.metadata.total_area_sqm,
        )

    # Select model
    endpoint = settings.AZURE_OPENAI_ENDPOINT
    deployment = settings.AZURE_OPENAI_DEPLOYMENT
    if model == "alt" and settings.AZURE_OPENAI_ENDPOINT_ALT:
        endpoint = settings.AZURE_OPENAI_ENDPOINT_ALT
        deployment = settings.AZURE_OPENAI_DEPLOYMENT_ALT

    try:
        start = time.time()
        scene = await analyze_floor_plan(
            contents,
            file.filename or "upload.png",
            endpoint_override=endpoint,
            deployment_override=deployment,
        )
        elapsed = int((time.time() - start) * 1000)
        return AnalyzeResponse(
            scene=scene,
            model_used=deployment,
            processing_time_ms=elapsed,
            room_count=len(scene.rooms),
            total_area_sqm=scene.metadata.total_area_sqm,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.exception("Analysis failed")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {e}")


# ── Stage 1: CU + OpenCV + GPT-5 Layout Inference ────────────────────────────


@app.post("/api/extract")
async def extract(file: UploadFile = File(...)):
    """Extract floor plan data using CU OCR + OpenCV CV + GPT-5 inference.

    Pipeline: CU OCR → OpenCV CV → GPT-5 layout inference (all 3 combined).
    Returns: extraction data + CV data + inferred rooms/doors/windows for the 2D editor.
    """
    if not file.content_type or not any(
        t in file.content_type for t in ["image/png", "image/jpeg", "application/pdf"]
    ):
        raise HTTPException(status_code=400, detail="Unsupported file type.")

    contents = await file.read()
    if len(contents) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 20MB).")

    try:
        start = time.time()

        # Step 1: CU OCR extraction (async — takes ~10s)
        cu_result = await extract_floor_plan(contents, file.filename or "upload.png")
        cu_elapsed = int((time.time() - start) * 1000)

        # Step 2: GPT-5 layout inference (CU data + image)
        layout = await infer_layout(
            cu_result, contents, file.filename or "upload.png",
        )
        total_elapsed = int((time.time() - start) * 1000)
        inference_elapsed = total_elapsed - cu_elapsed

        # Merge data
        result = {
            **cu_result,
            "inferred_layout": layout,
            "processing_time_ms": total_elapsed,
            "cu_time_ms": cu_elapsed,
            "inference_time_ms": inference_elapsed,
        }
        return result
    except Exception as e:
        logger.exception("Extraction failed")
        raise HTTPException(status_code=500, detail=f"Extraction failed: {e}")


# ── Stage 2: Generate 3D from confirmed layout ───────────────────────────────


class RoomLayout(BaseModel):
    """User-confirmed room layout from the 2D editor."""
    name: str
    type: str
    x_mm: float
    y_mm: float
    width_mm: float
    height_mm: float
    merge_group: str | None = None


class DoorLayout(BaseModel):
    x_mm: float
    y_mm: float
    width_mm: float = 900
    type: str = "hinged"


class WindowLayout(BaseModel):
    x_mm: float
    y_mm: float
    width_mm: float = 1200


class ConfirmedLayout(BaseModel):
    rooms: list[RoomLayout]
    doors: list[DoorLayout]
    windows: list[WindowLayout]
    overall_width_mm: float
    overall_height_mm: float
    source_file: str = "upload.png"


@app.post("/api/generate-3d", response_model=AnalyzeResponse)
async def generate_3d(layout: ConfirmedLayout):
    """Convert a user-confirmed 2D layout into a 3D SceneGraph.

    No AI needed — pure geometric conversion from mm to meters.
    """
    start = time.time()

    # Convert mm to meters
    scale = 0.001
    rooms = []
    for i, r in enumerate(layout.rooms):
        x = round(r.x_mm * scale, 2)
        y = round(r.y_mm * scale, 2)
        w = round(r.width_mm * scale, 2)
        h = round(r.height_mm * scale, 2)
        area = round(w * h, 1)

        # Map room type to floor material
        mat_map = {
            "bedroom": "wood_light",
            "living": "wood_light",
            "dining": "wood_light",
            "kitchen": "tile_white",
            "bathroom": "tile_white",
            "wc": "tile_white",
            "corridor": "tile_white",
            "balcony": "concrete",
            "yard": "concrete",
            "storage": "concrete",
        }
        floor_mat = mat_map.get(r.type.lower(), "tile_white")

        color_map = {
            "bedroom": "#F5F0E8",
            "living": "#F0EDE5",
            "dining": "#F0EDE5",
            "kitchen": "#E8F0E8",
            "bathroom": "#E0EBF0",
            "wc": "#E0EBF0",
            "corridor": "#EDEDF0",
            "balcony": "#F0F0E0",
            "yard": "#E8E8D0",
        }
        wall_color = color_map.get(r.type.lower(), "#F0F0F0")

        rooms.append({
            "id": f"room_{i+1}",
            "label": r.name,
            "type": r.type.lower(),
            "area_sqm": area,
            "polygon": [
                [x, y],
                [x + w, y],
                [x + w, y + h],
                [x, y + h],
            ],
            "floor_material": floor_mat,
            "wall_color": wall_color,
            **({
                "merge_group": r.merge_group
            } if r.merge_group else {}),
        })

    doors = []
    for i, d in enumerate(layout.doors):
        doors.append({
            "id": f"d{i+1}",
            "position": [round(d.x_mm * scale, 2), round(d.y_mm * scale, 2)],
            "width_m": round(d.width_mm * scale, 2),
            "wall_id": "w1",
            "type": d.type,
        })

    windows = []
    for i, w in enumerate(layout.windows):
        windows.append({
            "id": f"win{i+1}",
            "position": [round(w.x_mm * scale, 2), round(w.y_mm * scale, 2)],
            "width_m": round(w.width_mm * scale, 2),
            "height_m": 1.2,
            "sill_height_m": 0.9,
            "wall_id": "w1",
        })

    total_area = round(sum(r["area_sqm"] for r in rooms), 1)
    scene_data = {
        "metadata": {
            "source_file": layout.source_file,
            "total_area_sqm": total_area,
            "scale_factor": 1.0,
            "floor_height_m": 2.8,
        },
        "rooms": rooms,
        "walls": [],
        "doors": doors,
        "windows": windows,
        "furniture": [],
    }

    scene = SceneGraph.model_validate(scene_data)
    elapsed = int((time.time() - start) * 1000)

    return AnalyzeResponse(
        scene=scene,
        model_used="confirmed-layout",
        processing_time_ms=elapsed,
        room_count=len(rooms),
        total_area_sqm=total_area,
    )


class CompareResponse(BaseModel):
    primary: AnalyzeResponse
    alt: AnalyzeResponse | None = None


@app.post("/api/compare", response_model=CompareResponse)
async def compare(file: UploadFile = File(...)):
    """Run the same floor plan through both models and compare results."""
    contents = await file.read()
    if not settings.AZURE_OPENAI_ENDPOINT:
        raise HTTPException(status_code=400, detail="No models configured")

    async def run_model(ep: str, dep: str) -> AnalyzeResponse:
        start = time.time()
        scene = await analyze_floor_plan(
            contents, file.filename or "upload.png",
            endpoint_override=ep, deployment_override=dep,
        )
        elapsed = int((time.time() - start) * 1000)
        return AnalyzeResponse(
            scene=scene, model_used=dep,
            processing_time_ms=elapsed,
            room_count=len(scene.rooms),
            total_area_sqm=scene.metadata.total_area_sqm,
        )

    primary = await run_model(settings.AZURE_OPENAI_ENDPOINT, settings.AZURE_OPENAI_DEPLOYMENT)

    alt = None
    if settings.AZURE_OPENAI_ENDPOINT_ALT:
        try:
            alt = await run_model(settings.AZURE_OPENAI_ENDPOINT_ALT, settings.AZURE_OPENAI_DEPLOYMENT_ALT)
        except Exception as e:
            logger.warning(f"Alt model failed: {e}")

    return CompareResponse(primary=primary, alt=alt)


class ReportRequest(BaseModel):
    scene: SceneGraph


class ReportResponse(BaseModel):
    summary: str
    accessibility_score: int  # 0-100
    issues: list[str]
    recommendations: list[str]


@app.post("/api/report", response_model=ReportResponse)
async def generate_report(req: ReportRequest):
    """Generate an executive summary report for the floor plan."""
    if not settings.AZURE_OPENAI_ENDPOINT:
        return ReportResponse(
            summary="Report generation requires Azure OpenAI.",
            accessibility_score=0, issues=[], recommendations=[],
        )

    from app.vision import _get_client

    client = _get_client()

    scene_json = req.scene.model_dump_json(indent=2)

    response = client.chat.completions.create(
        model=settings.AZURE_OPENAI_DEPLOYMENT,
        messages=[
            {
                "role": "system",
                "content": """You are a building accessibility auditor for Singapore HDB flats. Analyze the SceneGraph JSON and produce a JSON report.

Return ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "summary": "2-3 sentence executive summary",
  "accessibility_score": <integer 0-100>,
  "issues": ["issue 1", "issue 2"],
  "recommendations": ["recommendation 1", "recommendation 2"]
}

Scoring criteria (Singapore BCA Code):
- Doorways ≥ 0.85m width: +10 per compliant door
- Corridors ≥ 1.2m width: +15
- Bathroom turning circle ≥ 1.5m diameter: +20
- Ramps/level floors: +10
- Grab bars in bathrooms: +10
- Visual contrasts at door frames: +5

Reference actual room names and measurements from the SceneGraph.""",
            },
            {
                "role": "user",
                "content": f"Analyze this floor plan:\n\n{scene_json}",
            },
        ],
        max_completion_tokens=1024,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content
    import json
    try:
        data = json.loads(raw)
        return ReportResponse(**data)
    except Exception as e:
        logger.error("Failed to parse report JSON: %s\nRaw: %s", e, raw[:500])
        return ReportResponse(
            summary=raw[:500] if raw else "Report generation failed.",
            accessibility_score=50,
            issues=["Report format error — try regenerating"],
            recommendations=["Click 'Regenerate report' to try again"],
        )


@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """Chat with the Planner Copilot about the current floor plan."""
    if not settings.AZURE_OPENAI_ENDPOINT:
        return ChatResponse(
            response="Azure OpenAI is not configured. Set AZURE_OPENAI_ENDPOINT in .env to enable the Planner Copilot."
        )
    try:
        response = await chat_with_scene(req.message, req.scene)
        return ChatResponse(response=response)
    except Exception as e:
        logger.exception("Chat failed")
        raise HTTPException(status_code=500, detail=f"Chat failed: {e}")


class ValuationRequest(BaseModel):
    total_area_sqm: float
    town: str = "ALL"


@app.post("/api/valuation")
async def valuation(req: ValuationRequest):
    """Get HDB resale valuation estimate based on floor area and town."""
    try:
        result = get_valuation(req.total_area_sqm, req.town)
        return result
    except Exception as e:
        logger.exception("Valuation failed")
        raise HTTPException(status_code=500, detail=f"Valuation failed: {e}")
