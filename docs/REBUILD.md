# Rebuild assessment and verification

## Why the original needed more than a restyle

The original source compiled for development but failed its production TypeScript build (`DerivedEdge` was imported but not exported). Its unconfigured `/api/analyze` returned a fixed demo after accepting an upload. The actual UI `/api/extract` instead depended on a hardcoded Content Understanding resource. The README conflated those behaviours.

The progress list advanced on a timer unrelated to backend progress. Geometry cleanup snapped/merged coordinates and shrank overlapping rooms; this made a render look tidy without necessarily preserving the drawing. A single global saved-layout API also had no project identity.

The 3D output was dominated by tall walls, flat surfaces, a dark grid and unrelated report/valuation panels. It was a viewer/demo, not a furnished design workspace. The stated sample area also disagreed with its room polygons.

## Rebuild

Replaced the main upload/editor/studio journey and image-extraction pipeline; retained and repaired useful Three.js/geometry concepts rather than discarding history. The studio now exposes real furniture editing and finishes, source comparison, project portability, and PNG output. All designer geometry remains editable rather than replaced by a generated photograph.

## Real execution evidence

- Production build and TypeScript check pass.
- Frontend: 24 tests pass, including geometry, placement, projects, state, API-error behaviour and autosave.
- Backend: 43 tests pass, including malformed uploads, readiness, model-response validation, jobs, units, opening alignment, geometry precision and bounded correction.
- Headless Chrome: sample → add/rotate/recolour furnishing → wall/floor changes → project download → refresh → retained finish → nonblank PNG → unchanged original-scene import passes with no page errors.
- Real **Redhill** and **Tiong Bahru** PNGs each passed browser upload → live Azure vision → source comparison → backend 3D conversion → PNG/project export. Different upload hashes and different layouts retained.
- Mobile 390×844 screenshot and real external HTTPS sample journey captured. Anonymous preview requests are denied; the personal capability URL opens the studio. This temporary preview is not production authentication/deployment.

The final live checks followed real failures, not only happy-path mocks: external communal stair rejection; omitted printed unit labels; proxy timeout; inferred opening overhang; and binary-float boundary comparison. Fixes preserve errors/ambiguity rather than presenting a canned successful floor plan.

## Limits of the evidence

Two floor plans are not a benchmark or a general accuracy guarantee. AI outputs can vary and still require correction. Tiong Bahru's upper bedroom can be decomposed into multiple sections; the current editor exposes those sections rather than a perfect unified CAD polygon. The comparison demonstrates application redesign and rendering improvements—not an isolated model-capability score.

No claim of production security, commercial interior-design completeness, photorealism, building-code compliance or manufacturer-accurate furniture is made. See README for the practical limitations.
