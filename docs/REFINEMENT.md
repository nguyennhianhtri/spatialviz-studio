# SpatialViz continuous product refinement

## Mandate
The owner authorised ongoing improvements following the SolutionBoss / OmniAgent solutioning pattern. The acceptance criterion is **a genuinely attractive, recognisably Singapore HDB/condo design experience**, not merely a green build. The owner explicitly rejected generic Western-apartment results. Read `docs/SINGAPORE-DESIGN.md`: local carpentry, cooling, utility spaces, compact proportions and real-plan openings must drive the actual 3D output. Locality is not a label or colour swap. Do not invent balconies/yards/shelters absent from the plan. Current output remains a starting point, not final visual quality.

## Loop
One canonical writer. Read current operator state, Git and newest user feedback first. Inspect the actual rendered output and one real user journey. Pick one high-impact bounded change, implement it, obtain independent read-only review, verify the changed behaviour and actual resulting image, then publish a verified candidate. Record evidence and next priority. Do not keep producing plans/reports instead of improvements. If there is no useful justified work, stay quiet.

### Scheduled execution: durable author/reviewer hand-off
The scheduled runtime runs delegate_task synchronously. A reviewer terminal invocation previously failed to return despite a 60-second tool timeout, holding the parent until its inactivity watchdog fired. The same test completed in under a second outside that path; this was not evidence of a model-provider outage. Scheduled cycles therefore **must not use delegate_task or spawn nested agents/CLIs**. The tool allowlist excludes delegation.

Use fresh scheduler sessions for the two roles: an `implement` cycle produces the narrow candidate, focused tests and before/after PNGs, sets `phase: review`, and returns; the next fresh cycle is the independent reviewer. A `review` cycle reads the exact frozen source/evidence without rewriting it, closes named blockers, verifies the focused behavior, and commits/packages accepted work. If correction is needed, record precise blockers and return to `phase: implement`; do not wait on an in-process child. This preserves reviewer separation without a blocking nested runtime. Never call a new review necessary merely because an already-completed review did not run a redundant test.

Each tool command must have an explicit bound and explicit runtime PATH. Keep tests/read-only inspections below 90 seconds, builds/browser acceptance below 240 seconds, and checkpoint between operations. A failed tool call is a checkpointed blocker, not a reason to run a chain of new probes. Raw exports contain base64 images: parse and print only required geometry/metadata, never dump them into context. Finish a coherent stage and return; do not pad the cycle with new features. Retain error artifacts and recover only after the previous run is proven terminated.

A reviewer saying “passes tests” is not visual acceptance. Keep a fixed plan/camera/material comparison where isolating render quality, plus a separate product-default view. Never silently replace the plan or repaint the exported image to claim progress. Preserve original source and comparison evidence.

## Ranked priorities
1. **Visual quality:** richer physically plausible materials/textures, softer believable lighting, furniture/decor with real detail/proportions, thoughtful HDB/condo furnishing arrangements. The current procedural furniture and palette are not a ceiling. Consider freely licensed self-contained assets with recorded licences; no paid library or hidden runtime CDN dependency.
2. **Designer interaction:** intentional placement with visible clearance/selection, reliable drag/rotate/duplicate/size, easy room-level customisation, coherent groups for L-shaped rooms. Protect manual furnishings when room layouts change; make destructive design replacement explicit. Avoid a sprawling settings panel.
3. **Plan fidelity:** stop approximate room fragments reading as duplicate rooms, preserve openings/scale and make uncertain geometry easy to correct. Test varied actual plans, not only the sample. No demo fallback or claims of survey accuracy.
4. **Continuity and release:** complete project round-trip and project-library behaviour, preserve source and customisation, recover before retry. Replace temporary-preview dependence with a supported durable private release path only within approved hosting/cost boundaries; do not call an expiring link a permanent deployment.
5. New evidence-backed polish discovered from actual use. No filler features, valuation/chat distractions, ceremonial audits or arbitrary score chasing.

## Working contract
- Owner/operator state is external to the app under `~/.hermes/state/spatialviz-refinement/`; it must never become a customer-runtime dependency.
- Checkpoint tag `checkpoint/spatialviz-2026-09-11-studio-v2` is immutable. Current working branch starts at `rebuild/studio-v2`; original `main` is retained pending integration. Follow actual Git state if later merged.
- Claim before editing, yield to foreground work. No detached coding writers or parallel commits. Reviewers are read-only. An abandoned claim requires proof the old run ended, not a time-only eviction.
- Preserve dirty files not owned by the cycle. Never force reset or clean the shared tree.
- Build in an isolated candidate directory/worktree, not over a running standalone server's `.next` directory. Only one implementation writer; isolation is for build/release safety, not parallel branches.
- Prefer focused deterministic tests. One full regression at the final boundary. Visual changes require a fresh actual PNG and independent visual critique. Behaviour changes need a red-capable test.
- At most one live extraction canary per cycle, four per SGT day, recorded before invocation. Maximum two simultaneous inference requests; each extraction can itself call the model twice. Reuse captured scenes for rendering iterations. Do not bypass preview call caps.
- No new subscriptions, billable services, domains, scaling increases, provider changes, package-policy bypass or protected control-plane changes. Only approved feeds/pinned existing runtimes. Azure identity and existing vision deployment are operator supplied, not embedded credentials.
- Scheduled sessions do not control local services. If release requires a gated lifecycle action, preserve a verified immutable candidate and report the exact release gate once. Never claim a source commit is already live. Do not tamper with the private preview capability/expiry to sidestep this.
- Never post to LinkedIn automatically; preserve evidence for the owner's own post. No anonymous exposure of floor plans, credentials or personal project data.

## Receipts and communication
Keep the live state short: claim, current priority, accepted source, actual live version if known, canary budget and recent evidence pointers. Full historical receipts are separate files. Notify only a visible verified improvement or a new actionable blocker, with a screenshot when it helps. No routine test-count spam or repeated stale warnings. The owner's latest direction always supersedes the backlog.
