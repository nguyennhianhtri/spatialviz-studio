# SpatialViz Studio

A floor-plan-to-3D **home design studio** for exploring HDB and condo interiors. Upload a dimensioned plan, review the inferred layout, then furnish and customise an interactive architectural model.

## Studio experience

- PNG/JPEG upload with an explicit dimension-unit setting; original image retained beside the editable plan.
- Image-driven Azure vision extraction, bounded geometry review and disclosed small opening alignment. **Uploads never silently return a demo.**
- Correct room labels, types, sizes, positions, doors and windows; undo/redo changes before creating 3D.
- Architectural dollhouse, plan and walkthrough views; cutaway walls, fitted camera, daylight/evening, three palettes and ambient occlusion.
- 18 editable furniture/decor types: sofas, chairs, rugs, beds, wardrobes, dining set, plants, lamps, media consoles, kitchen cabinetry/island, bathroom fittings and desk.
- Select furniture, drag, rotate, scale, recolour, add or remove. Per-room floor and wall finishes; room-focus camera.
- Browser-local project persistence, portable project JSON including furnishings, undo/redo, and actual WebGL PNG export.
- An explicitly labelled offline sample works without an inference service.

## Run

Use Node 22+ and Python 3.11+ with dependencies installed from your organisation's approved package source. The frontend lockfile is committed. No automatic cloud-resource discovery or provisioning occurs.

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
python -m pip install -e .
# Supply these as process environment variables; .env is NOT implicitly loaded.
export AZURE_OPENAI_ENDPOINT=https://YOUR-RESOURCE.cognitiveservices.azure.com
export AZURE_OPENAI_DEPLOYMENT=YOUR-VISION-DEPLOYMENT
export AZURE_OPENAI_AUTH_MODE=entra
# Authenticate your operator identity using az login, or use a managed identity.
python -m uvicorn app.main:app --host 127.0.0.1 --port 8310
```

API-key authentication is also supported through `AZURE_OPENAI_API_KEY`. Never put credentials in frontend environment variables. `/health` reports **configuration readiness**, not proof that credentials or the remote deployment work.

### Frontend

```bash
cd frontend
npm ci
npm run build
HOSTNAME=127.0.0.1 PORT=3312 npm start
```

Open `http://127.0.0.1:3312` on the host. Development: `npm run dev -- --port 3310`. `API_INTERNAL_URL` changes the backend origin at build time. Production start uses Next's standalone server with copied static assets.

### Checks

```bash
cd frontend
npm test
npm run typecheck
npm run build
cd ../backend
python -m unittest discover -s tests -t . -q
```

Browser acceptance scripts in `scripts/` require Playwright and a local Chrome installation. `verify_upload.py` calls the **real configured model** and consumes inference tokens. `verify_studio.py` exercises an explicit sample, customisation, persistence and PNG export. Its matched-comparison project input is prepared by the operator and is not model extraction.

## Architecture

`image → short upload job → Azure vision → schema/topology review → source/plan editor → deterministic SceneGraph → Three.js studio`

Long inference runs use short job-submit/poll requests instead of holding a request open across a reverse proxy. Up to eight ephemeral jobs are retained, completed jobs expire after one hour, and a process restart loses in-flight jobs. No server database or permanent uploaded-image storage is required for this single-user preview.

`frontend/src/lib/interior-design.ts` defines furniture dimensions and placement, `store/design-store.ts` owns edits, and `components/editable-furnishings.tsx` renders the editable pieces. `geometry-engine.ts` derives wall topology without rounding room coordinates.

## Honest limits

This is a substantial **design-studio preview**, not a finished replacement for professional interior CAD.

- Output is stylised real-time architectural 3D, **not photorealistic offline rendering**.
- AI layout interpretation is approximate. Rectangular room sections/merge groups represent orthogonal shapes; diagonal/curved private rooms are not faithfully supported. Verify scale, partitions, room grouping and openings.
- Initial placement checks room containment and basic door approach. Manual moves are not a full furniture/door-swing collision or accessibility certification system.
- Furniture/decor is procedural and illustrative, not a manufacturer SKU library. No cost quotation, plumbing/electrical design or HDB renovation approvals.
- PDF is not rasterised here: export it to PNG/JPEG first.
- Local browser data may be removed by clearing site storage. Save a project copy before moving devices. There is no account sync/collaboration.
- A bounded retry may review invalid model geometry against the original image. Opening-centre alignment up to 180 mm is disclosed with original coordinates; rooms are not silently shrunk to fit.
- Walkthrough closed-door collision is not enforced; mobile is best for orbit/design review.
- Legacy valuation/report/chat endpoints are not part of the designer journey.

See [rebuild critique and verification](docs/REBUILD.md) and [comparison methodology](docs/COMPARISON.md). The original version remains in Git history; no history was rewritten.
