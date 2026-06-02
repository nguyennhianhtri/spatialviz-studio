# Build Approach & Considerations

## SpatialViz Studio — 2D-to-3D Spatial Intelligence Platform

---

## Approach

### Why This Problem?

The 2D-to-3D spatial intelligence problem was chosen for three reasons:

1. **Visual wow factor** — uploading a flat floor plan and watching it transform into a walkable 3D environment creates an immediate, visceral demo moment that requires no domain expertise to appreciate. For an executive demo, this beats dashboards.

2. **Regional relevance** — Singapore's HDB (Housing Development Board) manages 1+ million flats. Planning departments across ASEAN review thousands of development proposals annually. This is a real, scaled problem in the region.

3. **AI + 3D convergence** — Vision models (GPT-5) can now reliably interpret architectural drawings and produce structured output. Combined with browser-based 3D rendering (Three.js), this creates a compelling technology integration story without requiring specialized hardware.

### Priorities

- **End-to-end pipeline** over individual feature depth. A complete upload → AI → 3D → interact flow beats a polished but disconnected component.
- **Interactive 3D** over photorealism. An orbit/walkthrough experience demonstrates spatial intelligence better than a static render.
- **AI agent overlay** as the differentiator. The 3D viewer is impressive; the agent that answers "does this meet wheelchair accessibility standards?" makes it transformative.
- **Executive demo polish** — dark theme, smooth animations, progress feedback. Built for C-suite audiences.

---

## Technology Choices & Reasoning

### Cloud Platform Decision

**Used:** Azure (Microsoft AI Foundry, Document Intelligence, Container Apps)
**Why:** Azure provided ready access to pre-provisioned AI services (GPT-5 vision in Singapore, Document Intelligence in East US 2), which let development skip provisioning time and focus entirely on building.

**Important:** This is not an Azure commitment. The architecture is intentionally cloud-portable. Every Azure service has a direct AWS equivalent:

| Azure Service | AWS Equivalent | Swap Complexity |
|---|---|---|
| Azure OpenAI (GPT-5 vision) | Amazon Bedrock (Claude Sonnet 4) | Low — same JSON contract, different SDK |
| Azure Document Intelligence | Amazon Textract | Low — both return layout bounding boxes |
| Microsoft Agent Framework | Strands Agents SDK / Bedrock Agents | Medium — different orchestration patterns |
| Azure Container Apps | AWS App Runner / ECS Fargate | Low — Docker container, same Dockerfile |
| Azure Static Web Apps | AWS Amplify Hosting | Low — Next.js standalone output |
| Azure Blob Storage | Amazon S3 | Trivial |
| Bicep | AWS CDK (TypeScript) | Medium — rewrite IaC layer |

A production AWS deployment would use **Bedrock + Textract + App Runner + Amplify + S3**, keeping the same FastAPI backend and Next.js frontend unchanged.

### Frontend: Next.js 15 + react-three-fiber

- **Next.js 15** — App Router, server components where possible, Turbopack for dev speed. Industry standard for production React apps.
- **react-three-fiber** — React bindings for Three.js. Lets me build 3D scenes with React component patterns rather than imperative WebGL. The ecosystem (@react-three/drei) provides orbit controls, lighting presets, and post-processing out of the box.
- **shadcn/ui + Tailwind CSS 4** — Accessible, composable components that look exec-grade with minimal custom CSS.
- **Framer Motion** — Smooth page transitions and micro-interactions that signal polish.
- **Zustand** — Minimal global state for scene data, view mode, and processing status. No Redux ceremony.

### Backend: FastAPI + Microsoft Agent Framework

- **FastAPI** — Async Python, auto-generated OpenAPI docs, built-in validation via Pydantic. The SceneGraph JSON schema is enforced at the API boundary.
- **Microsoft Agent Framework** — Provides multi-agent orchestration with tool-calling. Three specialized agents (Spatial Analysis, Accessibility, Furniture Advisor) each have focused system prompts and tool access.
  - **AWS equivalent:** Would use **Strands Agents SDK** (open-source, Python, tool-use pattern) or **Bedrock Agents** (managed).

### 3D Rendering: Browser-Based Extrusion (No GPU Required)

A critical design decision: **skip AI-based 3D model generation** (TRELLIS, Hunyuan3D) and use **programmatic extrusion** in the browser instead.

**Why:**
- AI 3D generation requires GPU infrastructure (A10/A100 minimum), and GPU quota in the available Azure subscription was zero.
- An initial attempt to deploy TRELLIS via NVIDIA NIM on Azure AI Foundry failed due to (a) marketplace purchases being blocked on the subscription, and (b) zero A100 quota in all regions.
- Browser-based Three.js extrusion produces clean, interactive 3D geometry in milliseconds with zero cloud cost. The result is more useful for the target user (city planner measuring rooms) than a photorealistic but non-interactive render.

**The tradeoff:** Rooms look like clean architectural models, not photorealistic renders. For the prototype's purpose (spatial understanding, measurement, accessibility analysis), this is actually *better* — less visual noise, clearer information.

**With GPU access available,** the natural next step would be to add TRELLIS-generated furniture assets placed into the extruded rooms, combining architectural accuracy with AI-generated detail.

### AI Pipeline: GPT-5 Vision + Document Intelligence

**Stage 1: Document Intelligence** — Extracts raw layout: text labels, line segments, bounding regions. Works on both scanned PDFs and digital drawings. This handles the "messy input" problem.

**Stage 2: GPT-5 Vision (Structured Output)** — Takes the floor plan image + Doc Intel results, produces a `SceneGraph` JSON with rooms, walls, doors, windows, dimensions, and room types. The structured output mode ensures the JSON schema is always valid.

**Why two stages instead of one?** Document Intelligence is deterministic and cheap — it anchors the dimension text and labels. GPT-5 vision then has ground truth to reason from, dramatically improving accuracy on room boundaries.

---

## Tradeoffs

| Decision | What was gained | What was given up |
|---|---|---|
| SQLite instead of Cosmos/DynamoDB | Zero provisioning, instant dev | No multi-user persistence |
| Pre-built furniture GLBs instead of AI-generated | Instant load, consistent quality | Custom furniture per plan |
| Bicep instead of CDK | Matched existing Azure infra | Not directly AWS-deployable |
| Single FastAPI process instead of microservices | Simple deploy, easy debugging | No independent scaling |
| Browser 3D extrusion instead of GPU 3D gen | Zero infra dependency, millisecond render | Not photorealistic |

---

## Future Work

1. **VR walkthrough with WebXR** — The first-person WASD walkthrough mode is already built with wall collision and proximity-based door opening. The natural next step is wrapping the scene in a WebXR session via `@react-three/xr`. VR controller thumbsticks map directly to the existing movement system; hand tracking replaces proximity triggers for door interaction. This would let housing authority staff walk residents through their future HDB flat in a headset — no app install, just open a URL on a Meta Quest 3 or Vision Pro. Estimated effort: 2-3 days on top of the current prototype.

2. **Richer interior decoration** — Current furniture is procedural geometry (box primitives). A future iteration would integrate a GLB furniture library (Poly Haven CC0 models) for photorealistic sofas, beds, kitchen appliances. Add wall textures (paint, wallpaper, brick), realistic flooring materials (hardwood PBR, tile, carpet), and ceiling-mounted light fixtures that cast proper shadows. An AI decorator agent could suggest arrangements: "Show me this living room in Scandinavian style."

3. **AWS-native deployment** — Rewrite the backend to use Bedrock (Claude Sonnet 4 vision), Textract, Strands Agents, and deploy on App Runner + Amplify. The application logic stays identical.

4. **GPU-accelerated 3D generation** — Deploy TRELLIS or Hunyuan3D on a GPU instance to generate textured furniture meshes and room environments. Integrate as an optional "enhance" button.

5. **Multi-floor support** — Current prototype handles single-floor plans. Would add floor stacking, stairwell detection, and elevator shaft visualization.

6. **Collaborative editing** — Real-time multi-user 3D annotation using WebSocket sync (Yjs/CRDT). Multiple planners reviewing the same proposal simultaneously.

7. **PDF batch processing** — Upload a ZIP of 50 floor plans, get a gallery of 3D models. This is the scale story for housing authorities.

8. **Accessibility compliance engine** — Deep integration with specific building codes (Singapore BCA, Australian NCC) rather than general guidelines.

---

## Interesting Challenges & Solutions

### Challenge 1: Floor Plan Diversity

Floor plans vary wildly — hand-drawn sketches, CAD exports, real estate marketing PDFs, scanned blueprints. A single AI model struggles with all formats.

**Solution:** Two-stage pipeline. Document Intelligence handles format normalization (text extraction, line detection). GPT-5 vision handles semantic understanding (room identification, spatial relationships). This separation of concerns makes the system robust across formats.

### Challenge 2: Accurate Dimensions Without Scale

Many floor plans don't include scale bars. Some have dimensions in millimeters, others in feet.

**Solution:** GPT-5 extracts all visible dimension annotations. If none exist, it estimates based on standard architectural conventions (door width ~0.9m, standard room proportions). The SceneGraph includes a `scale_factor` and `confidence` field so the frontend can show "estimated dimensions" warnings.

### Challenge 3: 3D Without GPUs

The initial plan included NVIDIA TRELLIS for AI-generated 3D assets. The deployment failed on Azure due to marketplace restrictions and zero GPU quota.

**Solution:** Pivoted to browser-based Three.js extrusion. Walls are extruded from 2D polygons, doors are Boolean-subtracted cutouts, windows are translucent panels. The result is architecturally accurate and interactive — which is more useful for spatial analysis than a photorealistic but static render. This "constraint-driven design" actually improved the user experience.

### Challenge 4: Agent Grounding

AI agents answering spatial questions need to reason about geometry, not just text. "Can a wheelchair fit?" requires knowing door widths and turning radii.

**Solution:** The SceneGraph JSON serves as the agent's "knowledge base." The Accessibility agent has tools that compute pathfinding on the room polygon mesh, measure doorway clearances, and check turning circles. Answers reference specific measurements from the scene, not generic guidelines.
