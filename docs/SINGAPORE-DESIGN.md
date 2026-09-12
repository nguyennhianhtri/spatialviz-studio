# Singapore interior direction

## Owner correction
The owner rejected a generic apartment that could be anywhere in the West. Singapore HDB/condo visual authenticity is a primary output requirement, not a UI-label change. Local specificity must live in the actual rendered carpentry, cooling, utility spaces, materials, proportions and furniture arrangement.

## Reference vocabulary
Inspected local designer references, not copied assets:
- Qanvast / MET Interior, La Fiesta living room: https://qanvast.com/sg/photos/la-fiesta-living-room-165184 — fitted TV feature wall, compact living arrangement, split-unit air-con, low-profile fan, full-height glazing.
- Qanvast, Boon Lay Grove Block 183C: https://qanvast.com/sg/photos/boon-lay-grove-block-183c-living-room-110398 — tiled living/dining, floating TV console, ceiling fan, wall-mounted air-con, restrained fitted cabinetry.
- https://www.prdt.com.sg/services/bto-renovation/ — local renovation vocabulary: kitchen worktops, wardrobes, study nooks, TV consoles, shoe cabinets, vinyl/porcelain and lighting.
- https://thomsonreno.com.sg/hdb-bto-renovation/ — entry shoe cabinetry, fitted wardrobes/kitchens and cooling planning.

Photos were viewed for general spatial/material principles only. They are not bundled into the app or reused as textures. All new meshes are original procedural geometry with no paid assets or external runtime requests.

## First implemented design proposals
- **HDB warm:** pale living-room tile, warm bedroom timber, light laminate carpentry, muted sage fitted kitchen, shoe cabinet, built-in TV feature wall, split AC, low-profile fans, washing machine and ceiling drying rack where the source includes a yard.
- **Condo contemporary:** quieter stone/concrete living palette, darker bedroom timber/carpentry, graphite kitchen, built-in TV feature wall, entry storage and living fan, concealed stacked laundry where a yard exists.
- Eight editable local fittings: built-in TV wall, shoe cabinet, fitted kitchen with upper cabinets/hood/sink/hob, washer, laundry tower, overhead drying rack, wall AC and ceiling fan.
- Whole-home proposals are explicit, confirmed and undoable. They preserve uploaded scene geometry exactly. Existing projects do not silently change.
- New wall units use room-edge placement and avoid mapped opening spans. Small rooms may omit items rather than force them through a wall. Sofa direction is updated when the TV wall moves.

## Honest limits and next useful work
These are two local renovation starting points, not a claim that all HDBs or condos share one style. They are not discovered appliances, a renovation approval or a services-installation plan. Ceilings and some walls are removed in cutaway views, so mounted fixtures can look unsupported. Drawings without balconies, yards or bomb shelters must not gain them just to look Singaporean.

Next improvements should work toward coherent fitted carpentry and realistic openings/curtains, a useful room-level presentation view, condo balcony furnishing only where drawn, and multiple grounded local design languages. Do not retreat to generic kit furniture, add a skyline/flag as a substitute for interiors, or simply retint the same model. Preserve manual design edits, doorway circulation and the real uploaded layout.

## Verification
`frontend/tests/singapore-design.test.cjs` checks rendered-kind vocabulary, differing proposals, source immutability, portable exports, undo/redo, mounting/opening constraints and sofa/TV orientation. `scripts/verify_singapore_design.py` exercises the real compiled app against a captured uploaded plan through both profile buttons, cancel, source preservation, PNG/project exports, undo/redo, reload and import. Evidence stays in private operator storage, not this public repository.
