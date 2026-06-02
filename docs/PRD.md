# Product Requirements Document: SpatialViz Studio

## 2D-to-3D Spatial Intelligence Platform

---

## 1. Problem Statement

Government agencies and property developers make decisions about buildings using 2D floor plans. These flat drawings cannot convey sightlines, spatial flow, furniture fit, or how a space feels at scale. Creating 3D models requires specialized CAD software, trained operators, and days of manual work per building.

**Target users:** City planners reviewing proposals, facilities managers planning renovations, housing authorities showing residents apartment layouts before construction.

**Key pain point:** A housing authority managing thousands of layouts or a planning department reviewing hundreds of proposals cannot produce 3D visualizations at scale with current workflows.

---

## 2. Solution Overview

**SpatialViz Studio** is a web application where a user uploads a 2D floor plan (PNG/JPG/PDF) and receives an interactive 3D visualization within seconds. The platform combines AI-powered floor plan understanding with real-time 3D rendering, augmented by an intelligent agent layer that provides spatial analysis, accessibility audits, and furniture-fit recommendations.

### Demo Narrative (10-min CEO walkthrough)

1. **Before slide** — current state: 3-5 days per 3D model, $2,000 per building, backlog of 400 proposals
2. **Upload** — drag a Singapore HDB floor plan into the app
3. **AI Processing** (~20s) — watch the progress: OCR/vision reading the plan → structured room graph → 3D extrusion
4. **Interactive 3D** — orbit, walk through, measure, toggle day/night lighting
5. **Agent Q&A** — ask: "Does this layout meet wheelchair accessibility?" / "Where should the sofa go in the living room?"
6. **Furniture placement** — drag-drop from a library, auto-fit suggestions
7. **Export** — download .glb for stakeholder sharing
8. **After slide** — 20 seconds per model, $0.05 per plan, 400 proposals reviewed in one afternoon

---

## 3. Functional Requirements

### 3.1 Floor Plan Upload & Processing

| ID | Requirement | Priority |
|----|------------|----------|
| F1 | Accept PNG, JPG, PDF floor plan uploads up to 20MB | P0 |
| F2 | Azure Document Intelligence extracts layout structure (walls, text, dimensions) | P0 |
| F3 | GPT-5 vision analyzes floor plan → structured SceneGraph JSON (rooms, walls, doors, windows, dimensions) | P0 |
| F4 | Processing status shown as animated progress stepper | P0 |
| F5 | Store uploaded plans and generated scenes in Azure Blob Storage | P1 |

### 3.2 Interactive 3D Visualization

| ID | Requirement | Priority |
|----|------------|----------|
| F6 | Render 3D extruded model from SceneGraph JSON using Three.js / react-three-fiber | P0 |
| F7 | Orbit controls (rotate, pan, zoom) | P0 |
| F8 | First-person walkthrough mode (WASD + mouse look) | P0 |
| F9 | Toggle between top-down 2D view and 3D perspective | P1 |
| F10 | Day/night lighting toggle with real shadow casting | P1 |
| F11 | Click room to see label, area (m²), suggested use | P0 |
| F12 | Measurement tool (click two points → distance in meters) | P1 |
| F13 | Export scene as .glb file | P1 |

### 3.3 AI Agent Layer (Planner Copilot)

| ID | Requirement | Priority |
|----|------------|----------|
| F14 | Chat panel alongside 3D view for natural language Q&A | P0 |
| F15 | Spatial Analysis agent: room dimensions, total area, room count summary | P0 |
| F16 | Accessibility agent: wheelchair path analysis, doorway width checks, grab-bar placement | P0 |
| F17 | Furniture Advisor agent: suggest furniture placement based on room type and dimensions | P1 |
| F18 | Sightline agent: analyze visibility from entry points, window views | P2 |

### 3.4 Furniture Library

| ID | Requirement | Priority |
|----|------------|----------|
| F19 | Pre-built GLB furniture asset library (sofa, bed, table, chair, desk — ~20 items) | P1 |
| F20 | Drag-drop furniture onto rooms in 3D view | P1 |
| F21 | Auto-snap furniture to walls/corners | P2 |

### 3.5 Gallery / History

| ID | Requirement | Priority |
|----|------------|----------|
| F22 | Gallery page showing previously processed floor plans with thumbnails | P1 |
| F23 | Click to re-open any past visualization | P1 |

---

## 4. Non-Functional Requirements

| ID | Requirement |
|----|------------|
| NF1 | Floor plan → 3D render in <30 seconds for typical residential plan |
| NF2 | Frontend loads in <3 seconds on broadband |
| NF3 | Mobile-responsive layout (view-only on mobile, full interaction on desktop) |
| NF4 | Executive-grade UI polish: dark theme, smooth animations, professional typography |

---

## 5. Technical Architecture

> **Cloud platform note:** This prototype runs on Azure, but the architecture is
> designed to be **cloud-portable** — every Azure service used has a direct AWS
> equivalent. The service mapping below shows how this would translate to a
> production AWS deployment.

### 5.0 Azure ↔ AWS Service Mapping

| Capability | Azure (used in prototype) | AWS Equivalent | Migration Notes |
|---|---|---|---|
| LLM (vision + text) | Azure OpenAI / AI Foundry (GPT-5) | **Amazon Bedrock** (Claude Sonnet 4, Nova) | Same structured-output JSON contract; swap SDK |
| Document layout extraction | Azure Document Intelligence | **Amazon Textract** (AnalyzeDocument Layout) | Both return bounding boxes + text; Textract has native table extraction |
| Agent orchestration | Microsoft Agent Framework | **Amazon Bedrock Agents** or **Strands Agents SDK** | Strands is closest 1:1; Bedrock Agents for managed hosting |
| Object storage | Azure Blob Storage | **Amazon S3** | Direct swap |
| Container compute | Azure Container Apps | **AWS App Runner** or **ECS Fargate** | App Runner for simplicity; Fargate for more control |
| Static frontend hosting | Azure Static Web Apps | **AWS Amplify Hosting** or **CloudFront + S3** | Amplify has built-in CI/CD like SWA |
| IaC | Bicep | **AWS CDK** or **CloudFormation** | CDK (TypeScript) would be the natural choice |
| 3D model generation (optional) | HuggingFace TRELLIS endpoint | **Amazon Bedrock** (if model available) or same HF endpoint | Model-agnostic REST call |
| Content safety | Azure AI Content Safety | **Amazon Bedrock Guardrails** | Both offer input/output filtering |
| Secrets management | Azure Key Vault | **AWS Secrets Manager** | Direct swap |

### 5.1 Frontend
- **Framework:** Next.js 15 (App Router)
- **3D Engine:** react-three-fiber + @react-three/drei
- **UI Components:** shadcn/ui + Tailwind CSS 4
- **Animations:** Framer Motion
- **State:** Zustand
- *Cloud-agnostic — no Azure/AWS dependencies in frontend code*

### 5.2 Backend
- **Framework:** FastAPI (Python 3.12) — *portable across any cloud*
- **Agent Orchestration:** Microsoft Agent Framework (azure-ai-projects SDK)
  - **AWS equivalent:** Strands Agents SDK or Bedrock Agents
- **AI Models:**
  - GPT-5 / GPT-4.1 vision (Azure AI Foundry) — floor plan understanding + structured output
    - **AWS equivalent:** Claude Sonnet 4 via Bedrock (supports vision + structured output)
  - Azure Document Intelligence — layout extraction
    - **AWS equivalent:** Amazon Textract AnalyzeDocument
- **Storage:** Azure Blob Storage → **AWS: S3**
- **Database:** SQLite (prototype) — scene metadata + chat history

### 5.3 Infrastructure
- **Compute:** Azure Container Apps (backend) + Azure Static Web Apps (frontend)
  - **AWS equivalent:** App Runner / ECS Fargate + Amplify Hosting
- **AI Services:** Existing Foundry deployments (`az-singapore-openai`, `rg-docintel-resource-6739`)
- **IaC:** Bicep templates → **AWS equivalent: CDK (TypeScript)**
- **Region:** eastus2 (primary), southeastasia (OpenAI endpoint)
  - **AWS equivalent:** us-east-1 + ap-southeast-1

### 5.4 Data Flow

```
User uploads floor plan (PNG/PDF)
        │
        ▼
┌─────────────────────────────────────────┐
│ FastAPI Backend (Container Apps)         │
│                                         │
│ 1. Azure Doc Intelligence → raw layout  │
│ 2. GPT-5 vision → SceneGraph JSON       │
│ 3. Store in Blob + SQLite               │
│ 4. Return SceneGraph to frontend        │
└─────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────┐
│ Next.js Frontend (Static Web Apps)      │
│                                         │
│ 1. Parse SceneGraph JSON                │
│ 2. Three.js extrudes walls, floors      │
│ 3. Render interactive 3D scene          │
│ 4. Agent chat panel → FastAPI websocket │
└─────────────────────────────────────────┘
```

---

## 6. SceneGraph JSON Schema (Contract)

```json
{
  "metadata": {
    "source_file": "hdb-4room.png",
    "total_area_sqm": 93.0,
    "scale_factor": 0.01,
    "floor_height_m": 2.8
  },
  "rooms": [
    {
      "id": "room_1",
      "label": "Living Room",
      "type": "living",
      "area_sqm": 25.5,
      "polygon": [[0,0],[6,0],[6,4.25],[0,4.25]],
      "floor_material": "wood_light",
      "wall_color": "#F5F5DC"
    }
  ],
  "walls": [
    {
      "id": "wall_1",
      "start": [0, 0],
      "end": [6, 0],
      "thickness_m": 0.15,
      "height_m": 2.8
    }
  ],
  "doors": [
    {
      "id": "door_1",
      "position": [3, 0],
      "width_m": 0.9,
      "wall_id": "wall_1",
      "type": "hinged"
    }
  ],
  "windows": [
    {
      "id": "window_1",
      "position": [1.5, 4.25],
      "width_m": 1.2,
      "height_m": 1.4,
      "sill_height_m": 0.9,
      "wall_id": "wall_3"
    }
  ],
  "furniture": []
}
```

---

## 7. Synthetic Data

- 5 sample floor plans (Singapore HDB 3-room, 4-room, 5-room; condo unit; office layout)
- Pre-generated SceneGraph JSON for each (for offline/demo mode)
- 20 furniture GLB assets from Poly Haven / Sketchfab CC0

---

## 8. Build Milestones

| Phase | Focus | Deliverable |
|-------|-------|------------|
| 1 | Foundation | Project scaffold, SceneGraph schema, GPT-5 vision prompt, basic Three.js renderer |
| 2 | Core pipeline | End-to-end: upload → Doc Intel → GPT-5 → SceneGraph → 3D render |
| 3 | 3D polish + agents | Walkthrough mode, lighting, measurement tool, Planner Copilot chat |
| 4 | UX + furniture + gallery | Executive-grade UI, furniture drag-drop, gallery page, export |
| 5 | Demo prep | Seed data, happy-path hardening, architecture doc, walkthrough recording |

---

## 9. Success Criteria

- [ ] Upload a floor plan → see interactive 3D in <30s
- [ ] Walk through the 3D model in first-person
- [ ] Ask the AI agent a spatial question and get a grounded answer
- [ ] Export .glb
- [ ] A non-technical exec can self-navigate the demo without guidance

---

## 10. Future Roadmap

### 10.1 VR Walkthrough Integration

The current first-person walkthrough mode (WASD + mouse look) is the foundation for a **VR-native experience**. The natural next step:

- **WebXR integration** — react-three-fiber supports WebXR out of the box via `@react-three/xr`. The existing scene, collision detection, and proximity-based door opening would work unchanged inside a VR headset.
- **Target devices** — Meta Quest 3, Apple Vision Pro, HTC Vive. Browser-based WebXR means no app installation — users put on a headset and open a URL.
- **Use case** — Housing authority staff walk residents through their future HDB flat *before construction*. A city planner reviews a development proposal spatially, not on paper. A facilities manager walks a renovation plan with stakeholders without visiting the site.
- **Implementation path** — Add `<XR>` wrapper to the Canvas, map VR controller thumbsticks to the existing movement system, and use hand tracking for door interaction instead of proximity triggers. Estimated effort: 2-3 days on top of current prototype.

### 10.2 Enhanced Interior Decoration & Realism

Current furniture is procedurally generated (geometric primitives). Future enhancements:

- **GLB furniture library** — Import high-quality 3D furniture models from Poly Haven / Sketchfab (CC0 licensed). Beds, sofas, dining tables, kitchen appliances with proper materials and textures.
- **AI-suggested interior design** — Use the room type and dimensions to suggest furniture arrangements, color schemes, and décor styles. "Show me this living room in Scandinavian style" or "Japanese minimalist."
- **Wall textures and paint** — Apply realistic wall textures (brick, wallpaper, paint colors) instead of flat colors. Let users toggle between different finishes.
- **Lighting fixtures** — Ceiling lights, floor lamps, pendant lights that cast realistic shadows and affect room ambiance in day/night modes.
- **Material library** — Flooring options (hardwood, tile, marble, carpet) applied per room with proper PBR materials.
