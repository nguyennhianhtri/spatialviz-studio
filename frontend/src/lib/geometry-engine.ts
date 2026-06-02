"use client";

/**
 * Geometry Engine — derives walls from room polygons using edge adjacency.
 * 
 * Instead of rendering GPT-5's walls independently (which causes gaps and misalignment),
 * this engine extracts edges from room polygons, detects shared edges between adjacent rooms,
 * and generates geometrically consistent wall geometry.
 * 
 * Algorithm:
 * 1. Snap all polygon vertices to a grid (5cm) to handle AI imprecision
 * 2. Extract edges from each room polygon
 * 3. Build edge adjacency map (shared edges = interior walls)
 * 4. Generate wall geometry with proper corner joints
 * 5. Place doors/windows by projecting onto nearest wall edge
 */

import type { SceneGraph, RoomDef, DoorDef, WindowDef } from "@/types/scene";

const SNAP_GRID = 0.1; // 10cm snap grid (matches backend post-processing)
const EDGE_TOLERANCE = 0.25; // 25cm tolerance for edge matching (was 15cm)
const EXTERIOR_THICKNESS = 0.2;
const INTERIOR_THICKNESS = 0.12;
const WALL_HEIGHT = 2.8;

// ─── Types ───
interface Point2D {
  x: number;
  y: number;
}

interface DerivedEdge {
  start: Point2D;
  end: Point2D;
  rooms: string[];
  type: "exterior" | "interior";
  thickness: number;
  length: number;
  angle: number;
  midpoint: Point2D;
  /** True if this is an exterior edge of a balcony room (render as half-wall + railing). */
  isBalconyExterior: boolean;
}

interface DoorPlacement {
  door: DoorDef;
  edge: DerivedEdge;
  t: number; // parameter along edge [0,1]
}

interface WindowPlacement {
  window: WindowDef;
  edge: DerivedEdge;
  t: number;
}

export interface DerivedScene {
  edges: DerivedEdge[];
  doors: DoorPlacement[];
  windows: WindowPlacement[];
}

// ─── Utility Functions ───

function snap(v: number): number {
  return Math.round(v / SNAP_GRID) * SNAP_GRID;
}

function snapPoint(p: [number, number]): Point2D {
  return { x: snap(p[0]), y: snap(p[1]) };
}

function dist(a: Point2D, b: Point2D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function pointsClose(a: Point2D, b: Point2D, tol: number = EDGE_TOLERANCE): boolean {
  return dist(a, b) < tol;
}

function canonicalKey(a: Point2D, b: Point2D): string {
  // Always store smaller point first for consistent hashing
  if (a.x < b.x || (a.x === b.x && a.y < b.y)) {
    return `${a.x.toFixed(2)},${a.y.toFixed(2)}-${b.x.toFixed(2)},${b.y.toFixed(2)}`;
  }
  return `${b.x.toFixed(2)},${b.y.toFixed(2)}-${a.x.toFixed(2)},${a.y.toFixed(2)}`;
}

function edgeLength(a: Point2D, b: Point2D): number {
  return dist(a, b);
}

function edgeAngle(a: Point2D, b: Point2D): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function edgeMidpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function projectPointOnEdge(p: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  return Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
}

function pointToEdgeDist(p: Point2D, a: Point2D, b: Point2D): number {
  const t = projectPointOnEdge(p, a, b);
  const proj = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
  return dist(p, proj);
}

// ─── Edge Matching with Tolerance ───
// Two edges from different rooms may not have exactly the same coordinates.
// We match edges that are close enough (both endpoints within tolerance).

function edgesMatch(e1Start: Point2D, e1End: Point2D, e2Start: Point2D, e2End: Point2D): boolean {
  // Try both orientations
  return (
    (pointsClose(e1Start, e2Start) && pointsClose(e1End, e2End)) ||
    (pointsClose(e1Start, e2End) && pointsClose(e1End, e2Start))
  );
}

// ─── Collinear Overlap Detection (for merge_group partial edges) ───

/** Project a point onto the axis-aligned line through the edge, return the scalar parameter */
function projectOntoLine(p: Point2D, lineStart: Point2D, lineDir: Point2D, lineLen: number): number {
  return ((p.x - lineStart.x) * lineDir.x + (p.y - lineStart.y) * lineDir.y) / lineLen;
}

/** Check if two edges are collinear (same line) and overlapping */
function areEdgesCollinearOverlapping(a: DerivedEdge, b: DerivedEdge): boolean {
  // Check if they're on the same infinite line by testing perpendicular distance
  const adx = a.end.x - a.start.x;
  const ady = a.end.y - a.start.y;
  const aLen = Math.hypot(adx, ady);
  if (aLen < 0.01) return false;
  const nx = -ady / aLen;
  const ny = adx / aLen;
  // Perp distance of b's endpoints to line through a
  const d1 = Math.abs((b.start.x - a.start.x) * nx + (b.start.y - a.start.y) * ny);
  const d2 = Math.abs((b.end.x - a.start.x) * nx + (b.end.y - a.start.y) * ny);
  if (d1 > EDGE_TOLERANCE || d2 > EDGE_TOLERANCE) return false;

  // Project b onto a's axis and check for overlap
  const t1 = ((b.start.x - a.start.x) * adx + (b.start.y - a.start.y) * ady) / (aLen * aLen);
  const t2 = ((b.end.x - a.start.x) * adx + (b.end.y - a.start.y) * ady) / (aLen * aLen);
  const tMin = Math.min(t1, t2);
  const tMax = Math.max(t1, t2);
  // Overlap exists if the ranges [0,1] and [tMin,tMax] intersect
  return tMax > 0.01 && tMin < 0.99;
}

/** Compute the overlapping subsegment of two collinear edges (in world coordinates) */
function computeOverlap(a: DerivedEdge, b: DerivedEdge): { start: Point2D; end: Point2D } | null {
  const adx = a.end.x - a.start.x;
  const ady = a.end.y - a.start.y;
  const aLen2 = adx * adx + ady * ady;
  if (aLen2 < 0.001) return null;

  // Project all 4 endpoints onto a's axis
  const tA0 = 0;
  const tA1 = 1;
  const tB0 = ((b.start.x - a.start.x) * adx + (b.start.y - a.start.y) * ady) / aLen2;
  const tB1 = ((b.end.x - a.start.x) * adx + (b.end.y - a.start.y) * ady) / aLen2;

  const tBMin = Math.min(tB0, tB1);
  const tBMax = Math.max(tB0, tB1);
  const oStart = Math.max(tA0, tBMin);
  const oEnd = Math.min(tA1, tBMax);
  if (oEnd - oStart < 0.01) return null;

  return {
    start: { x: snap(a.start.x + oStart * adx), y: snap(a.start.y + oStart * ady) },
    end: { x: snap(a.start.x + oEnd * adx), y: snap(a.start.y + oEnd * ady) },
  };
}

/** Subtract a subsegment from an edge, returning 0-2 remnant edges */
function subtractSegment(
  edge: DerivedEdge,
  segStart: Point2D,
  segEnd: Point2D,
): DerivedEdge[] {
  const adx = edge.end.x - edge.start.x;
  const ady = edge.end.y - edge.start.y;
  const aLen2 = adx * adx + ady * ady;
  if (aLen2 < 0.001) return [];

  const tS = ((segStart.x - edge.start.x) * adx + (segStart.y - edge.start.y) * ady) / aLen2;
  const tE = ((segEnd.x - edge.start.x) * adx + (segEnd.y - edge.start.y) * ady) / aLen2;
  const tMin = Math.min(tS, tE);
  const tMax = Math.max(tS, tE);

  const remnants: DerivedEdge[] = [];

  // Left remnant: edge start → overlap start
  if (tMin > 0.02) {
    const s = edge.start;
    const e = { x: snap(edge.start.x + tMin * adx), y: snap(edge.start.y + tMin * ady) };
    remnants.push({
      ...edge,
      start: s,
      end: e,
      length: edgeLength(s, e),
      angle: edgeAngle(s, e),
      midpoint: edgeMidpoint(s, e),
    });
  }

  // Right remnant: overlap end → edge end
  if (tMax < 0.98) {
    const s = { x: snap(edge.start.x + tMax * adx), y: snap(edge.start.y + tMax * ady) };
    const e = edge.end;
    remnants.push({
      ...edge,
      start: s,
      end: e,
      length: edgeLength(s, e),
      angle: edgeAngle(s, e),
      midpoint: edgeMidpoint(s, e),
    });
  }

  return remnants;
}

// ─── Main Engine ───

export function deriveSceneGeometry(scene: SceneGraph): DerivedScene {
  // Phase 1: Snap all vertices
  const snappedRooms = scene.rooms.map((room) => ({
    ...room,
    snappedPolygon: room.polygon.map(snapPoint),
  }));

  // Phase 2: Extract all edges
  interface RawEdge {
    start: Point2D;
    end: Point2D;
    roomId: string;
  }

  const allEdges: RawEdge[] = [];
  for (const room of snappedRooms) {
    const pts = room.snappedPolygon;
    for (let i = 0; i < pts.length; i++) {
      const start = pts[i];
      const end = pts[(i + 1) % pts.length];
      allEdges.push({ start, end, roomId: room.id });
    }
  }

  // Phase 3: Build adjacency map with tolerance-based matching
  const derivedEdges: DerivedEdge[] = [];
  const matched = new Set<number>();

  // Build a merge-group lookup: roomId → merge_group (if set)
  const mergeGroupOf: Record<string, string | undefined> = {};
  for (const room of scene.rooms) {
    mergeGroupOf[room.id] = room.merge_group || undefined;
  }

  for (let i = 0; i < allEdges.length; i++) {
    if (matched.has(i)) continue;

    const edge = allEdges[i];
    const rooms = [edge.roomId];

    // Find matching edges from other rooms
    for (let j = i + 1; j < allEdges.length; j++) {
      if (matched.has(j)) continue;
      if (allEdges[j].roomId === edge.roomId) continue;

      if (edgesMatch(edge.start, edge.end, allEdges[j].start, allEdges[j].end)) {
        rooms.push(allEdges[j].roomId);
        matched.add(j);
      }
    }

    matched.add(i);

    // If all rooms on this edge share the same merge_group, skip the edge
    // entirely (no wall between merged rooms).
    if (rooms.length >= 2) {
      const groups = rooms.map((r) => mergeGroupOf[r]).filter(Boolean);
      if (groups.length === rooms.length && new Set(groups).size === 1) {
        continue; // skip — these rooms are merged
      }
    }

    const type = rooms.length >= 2 ? "interior" : "exterior";
    const thickness = type === "exterior" ? EXTERIOR_THICKNESS : INTERIOR_THICKNESS;

    // Check if this exterior edge borders a balcony room
    const roomTypesOf: Record<string, string> = {};
    for (const room of scene.rooms) {
      roomTypesOf[room.id] = room.type;
    }
    const isBalconyExterior =
      type === "exterior" &&
      rooms.some((r) => roomTypesOf[r] === "balcony" || roomTypesOf[r] === "yard");

    derivedEdges.push({
      start: edge.start,
      end: edge.end,
      rooms,
      type,
      thickness,
      length: edgeLength(edge.start, edge.end),
      angle: edgeAngle(edge.start, edge.end),
      midpoint: edgeMidpoint(edge.start, edge.end),
      isBalconyExterior,
    });
  }

  // Phase 3b: Remove edges that overlap collinear edges from the same merge_group.
  // This handles L-shaped merged rooms where two rects share a PARTIAL edge
  // (e.g. room A has edge x=8.5 y=0→5.4, room B has edge x=8.5 y=3.4→5.4 —
  //  the subsegment 3.4→5.4 is shared but edgesMatch missed it because endpoints differ).
  const edgesToRemove = new Set<number>();
  for (let i = 0; i < derivedEdges.length; i++) {
    if (edgesToRemove.has(i)) continue;
    const ei = derivedEdges[i];
    if (ei.rooms.length !== 1) continue; // only check exterior edges (unmatched)
    const groupI = mergeGroupOf[ei.rooms[0]];
    if (!groupI) continue;

    for (let j = i + 1; j < derivedEdges.length; j++) {
      if (edgesToRemove.has(j)) continue;
      const ej = derivedEdges[j];
      if (ej.rooms.length !== 1) continue;
      const groupJ = mergeGroupOf[ej.rooms[0]];
      if (groupJ !== groupI) continue;
      if (ej.rooms[0] === ei.rooms[0]) continue; // same room — not a shared edge

      // Check if the two edges are collinear and overlapping
      if (!areEdgesCollinearOverlapping(ei, ej)) continue;

      // Compute the overlapping subsegment
      const overlap = computeOverlap(ei, ej);
      if (!overlap) continue;

      // Remove both original edges and replace with non-overlapping remnants
      edgesToRemove.add(i);
      edgesToRemove.add(j);

      // Add remnant segments (parts that don't overlap) as new edges
      for (const orig of [ei, ej]) {
        const remnants = subtractSegment(orig, overlap.start, overlap.end);
        for (const rem of remnants) {
          if (rem.length < 0.05) continue;
          derivedEdges.push(rem);
        }
      }
      break; // edge i is consumed
    }
  }

  // Filter out removed edges
  const finalEdges = derivedEdges.filter((_, idx) => !edgesToRemove.has(idx));
  // Replace derivedEdges array in-place for downstream phases
  derivedEdges.length = 0;
  derivedEdges.push(...finalEdges);

  // Phase 4: Place doors on nearest edges
  const doorPlacements: DoorPlacement[] = [];
  for (const door of scene.doors) {
    const doorPos: Point2D = { x: door.position[0], y: door.position[1] };

    let bestEdge = derivedEdges[0];
    let bestDist = Infinity;
    for (const edge of derivedEdges) {
      const d = pointToEdgeDist(doorPos, edge.start, edge.end);
      if (d < bestDist) {
        bestDist = d;
        bestEdge = edge;
      }
    }

    const t = projectPointOnEdge(doorPos, bestEdge.start, bestEdge.end);
    doorPlacements.push({ door, edge: bestEdge, t });
  }

  // Phase 5: Place windows on nearest edges
  const windowPlacements: WindowPlacement[] = [];
  for (const win of scene.windows) {
    const winPos: Point2D = { x: win.position[0], y: win.position[1] };

    let bestEdge = derivedEdges[0];
    let bestDist = Infinity;
    for (const edge of derivedEdges) {
      const d = pointToEdgeDist(winPos, edge.start, edge.end);
      if (d < bestDist) {
        bestDist = d;
        bestEdge = edge;
      }
    }

    const t = projectPointOnEdge(winPos, bestEdge.start, bestEdge.end);
    windowPlacements.push({ window: win, edge: bestEdge, t });
  }

  return { edges: derivedEdges, doors: doorPlacements, windows: windowPlacements };
}
