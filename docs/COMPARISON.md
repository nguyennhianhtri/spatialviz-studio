# Before / after comparison methodology

## Preserved baseline

The original repository snapshot is the initial commit `acf9fd9`. Its unmodified app source was run in a separate directory. Because the original production build has a type-export error, historical capture used Next's webpack development server, not a claimed successful production build.

For the renderer comparison, the original explicit `/api/demo-scene` response was fulfilled with the exact `DEMO_SCENE` dictionary from that same commit. This is a **controlled renderer fixture**, not a successful image extraction. The baseline upload screen and actual WebGL view were captured at 1440×1000, device scale 1, headless Chrome/SwiftShader.

The rebuilt app imported the exact same original SceneGraph through its real project-import UI. Its default dollhouse view was captured with labels off and the inspector closed. Before and after use the same underlying layout and browser viewport, but the camera fitting/cutaway/lighting/furnishing algorithms deliberately differ. This is a product-default comparison, **not pixel-identical camera calibration**. No new floor plan was substituted for a more flattering result.

## Separate real-upload evidence

Redhill and Tiong Bahru were additionally uploaded through the rebuilt UI to the actual Azure vision deployment. Their original images, source hashes, extraction responses, generated SceneGraphs, reviewed UI captures, rendered PNGs and portable projects are retained in the private evidence bundle. Do not label these as original-versus-new extraction-accuracy tests: the old model pipeline was not re-established on the original credentials.

## LinkedIn framing

Suggested accurate framing: **“Rebuilding an older AI prototype into an editable home-design experience.”** Show the same-layout rendering comparison, then the furnishing/finish controls and a real-upload result.

Avoid claims that this proves a numerical jump between model generations, that the outputs are photorealistic, or that the app replaces professional renovation drawings. The result combines stronger agent-led engineering, a redesigned product flow, repaired geometry, better rendering and real verification. Original model identity and original authoring time were not established in this session.

Screenshot compositing only places the actual captured images beside one another, fits them within panels, and adds labels. It does not repaint the rendered interiors.
