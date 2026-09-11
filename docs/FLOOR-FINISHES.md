# Floor finish materials

The floor renderer uses original, locally generated Three.js data textures. No third-party assets, image models, packages, HDR downloads or CDN requests are required. These are procedural architectural materials, not photographs or a claim of photorealism.

- Oak: staggered 1.2 m boards, 180 mm width, tonal variation and longitudinal grain. Natural/smoked tint remains controlled by the existing finish choice.
- Ivory tile: 600 mm tiles with narrow recessed joints and restrained surface variation.
- Warm concrete: continuous mottled finish with no tile grout.
- Albedo uses sRGB; bump and roughness data stay linear. Relief is intentionally subtle. Shared mipmapped maps are cached for only three surface families.
- World-metre UVs avoid stretching when room dimensions change and keep materials aligned across adjacent fragments.
- Explicit chosen materials override room-use defaults. A kitchen may now display the oak finish the user selected. This is a visual design choice, not a wet-area product suitability claim.

## Verification without running a service

From the repository root, with an existing approved Playwright/Pillow Python runtime:

```
python -m scripts.verify_floor_finishes --frontend /absolute/candidate/frontend --fixture /absolute/captured-real-project.spatialviz.json --out /absolute/private-evidence --journey
python -m scripts.verify_studio --frontend /absolute/candidate/frontend --out /absolute/private-regression
```

The frontend must already be built in isolation. The general studio verifier expects `matched-comparison.spatialviz.json` in its output directory; supply the existing captured fixture rather than regenerating a plan. Test evidence and user projects remain private and are not committed.

Playwright routes the actual prerendered HTML, JS and CSS from that build into an isolated browser context. It starts no HTTP service and does not fabricate API responses. Unexpected backend calls fail. This proves client rendering/customisation/export, not live extraction or a deployed release.

For comparisons use the same fixture, viewport, focus action, style and daylight settings. Product-default views are separately named. The focused journey chooses all four kitchen finishes and checks changed PNG pixels, unchanged source geometry/furniture, saved-copy round-trip and refresh restore. Run `npm test` and `npm run typecheck` in `frontend` as the final regression boundary.
