"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import type { SceneGraph, RoomDef } from "@/types/scene";
import type { DerivedEdge, DoorPlacement, WindowPlacement, DerivedScene } from "@/lib/geometry-engine";
import { useSceneStore } from "@/store/scene-store";
import { playerPositionRef, playerDirRef, playerKeysRef } from "@/components/first-person-controls";

// ─── Colors ───
const ROOM_FLOOR: Record<string, string> = {
  living: "#B89B72",
  bedroom: "#C4A880",
  kitchen: "#C8C0B0",
  bathroom: "#B8C8D0",
  wc: "#B8C8D0",
  dining: "#B89B72",
  corridor: "#A8A090",
  balcony: "#909080",
  yard: "#909080",
  storage: "#989088",
  office: "#B8A890",
};

// ─── Room Floor + Label ───
export function RoomFloor({
  room,
  isSelected,
  onSelect,
}: {
  room: RoomDef;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const shape = useMemo(() => {
    const s = new THREE.Shape();
    const pts = room.polygon;
    if (pts.length < 3) return s;
    s.moveTo(pts[0][0], -pts[0][1]);
    for (let i = 1; i < pts.length; i++) {
      s.lineTo(pts[i][0], -pts[i][1]);
    }
    s.closePath();
    return s;
  }, [room.polygon]);

  const center = useMemo(() => {
    const cx = room.polygon.reduce((s, p) => s + p[0], 0) / room.polygon.length;
    const cz = room.polygon.reduce((s, p) => s + p[1], 0) / room.polygon.length;
    return [cx, cz] as [number, number];
  }, [room.polygon]);

  const floorColor = ROOM_FLOOR[room.type] || "#C0C0C0";

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color={floorColor} side={THREE.DoubleSide} roughness={0.75} metalness={0.02} />
      </mesh>

      {/* Floor edge/trim — subtle darker border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color="#6B6358" side={THREE.DoubleSide} transparent opacity={0.08} />
      </mesh>

      {/* Ceiling (skip for balconies — they're open-air) */}
      {room.type !== "balcony" && room.type !== "yard" && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 2.79, 0]}>
          <shapeGeometry args={[shape]} />
          <meshStandardMaterial color="#FAFAFA" side={THREE.DoubleSide} transparent opacity={0.2} roughness={0.95} />
        </mesh>
      )}

      {/* Label */}
      <Html position={[center[0], 0.05, center[1]]} center distanceFactor={12} style={{ pointerEvents: "none" }}>
        <div className="rounded-md bg-black/70 px-2.5 py-1 text-xs text-white whitespace-nowrap backdrop-blur-sm shadow-lg border border-white/10">
          <span className="font-medium">{room.label}</span>
          <span className="ml-1.5 opacity-70">{room.area_sqm}m²</span>
        </div>
      </Html>

      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <shapeGeometry args={[shape]} />
          <meshStandardMaterial color="#6366f1" transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// ─── Derived Wall (from geometry engine) ───
export function DerivedWall({
  edge,
  allDoorPlacements = [],
  allWindowPlacements = [],
}: {
  edge: DerivedEdge;
  allDoorPlacements?: DoorPlacement[];
  allWindowPlacements?: WindowPlacement[];
}) {
  const length = edge.length;
  if (length < 0.05) return null;

  const midX = edge.midpoint.x;
  const midZ = edge.midpoint.y;
  const wallHeight = 2.8;
  const isExterior = edge.type === "exterior";
  const wallColor = isExterior ? "#E0DCD0" : "#F0ECE4";
  const halfLen = length / 2;
  const thick = edge.thickness;

  // ── Balcony exterior: render a ~1m parapet + railing bars instead of a full wall ──
  if (edge.isBalconyExterior) {
    const parapetH = 1.0;
    const railH = 0.05;

    // Wall axis unit vector for projecting doors/windows
    const bax = edge.end.x - edge.start.x;
    const baz = edge.end.y - edge.start.y;
    const bwLen = Math.hypot(bax, baz);
    const bux = bwLen > 0 ? bax / bwLen : 1;
    const buz = bwLen > 0 ? baz / bwLen : 0;

    // Collect door openings on this edge (full-height gaps in the parapet)
    const doorGaps: { center: number; halfW: number }[] = [];
    for (const dp of allDoorPlacements) {
      const dpx = dp.edge.start.x + dp.t * (dp.edge.end.x - dp.edge.start.x);
      const dpz = dp.edge.start.y + dp.t * (dp.edge.end.y - dp.edge.start.y);
      const relX = dpx - edge.start.x;
      const relZ = dpz - edge.start.y;
      const perpDist = Math.abs(relX * (-buz) + relZ * bux);
      if (perpDist > thick + 0.15) continue;
      const projT = (relX * bux + relZ * buz) / bwLen;
      if (projT < -0.05 || projT > 1.05) continue;
      const localX = (projT - 0.5) * length;
      doorGaps.push({ center: localX, halfW: dp.door.width_m / 2 + 0.05 });
    }

    // Collect window positions on this edge (will become railing-integrated glass panels)
    const winPositions: { center: number; halfW: number }[] = [];
    for (const wp of allWindowPlacements) {
      const wpx = wp.edge.start.x + wp.t * (wp.edge.end.x - wp.edge.start.x);
      const wpz = wp.edge.start.y + wp.t * (wp.edge.end.y - wp.edge.start.y);
      const relX = wpx - edge.start.x;
      const relZ = wpz - edge.start.y;
      const perpDist = Math.abs(relX * (-buz) + relZ * bux);
      if (perpDist > thick + 0.15) continue;
      const projT = (relX * bux + relZ * buz) / bwLen;
      if (projT < -0.05 || projT > 1.05) continue;
      const localX = (projT - 0.5) * length;
      winPositions.push({ center: localX, halfW: wp.window.width_m / 2 + 0.02 });
    }

    // Build parapet segments — split by door gaps
    const sortedGaps = [...doorGaps].sort((a, b) => a.center - b.center);
    const parapetSegs: { x: number; w: number }[] = [];
    let cursor = -halfLen - thick / 2;
    for (const gap of sortedGaps) {
      const gapLeft = gap.center - gap.halfW;
      const gapRight = gap.center + gap.halfW;
      const segW = gapLeft - cursor;
      if (segW > 0.02) {
        parapetSegs.push({ x: cursor + segW / 2, w: segW });
      }
      cursor = gapRight;
    }
    const remainW = halfLen + thick / 2 - cursor;
    if (remainW > 0.02) {
      parapetSegs.push({ x: cursor + remainW / 2, w: remainW });
    }

    // Check if a local x falls inside a window zone
    const isInWindow = (lx: number) =>
      winPositions.some((wp) => lx >= wp.center - wp.halfW && lx <= wp.center + wp.halfW);

    // Check if a local x falls inside a door gap
    const isInDoorGap = (lx: number) =>
      sortedGaps.some((g) => lx >= g.center - g.halfW && lx <= g.center + g.halfW);

    const numBars = Math.max(2, Math.round(length / 0.15));

    return (
      <group position={[midX, 0, midZ]} rotation={[0, -edge.angle, 0]}>
        {/* Parapet wall segments (with door gaps cut out) */}
        {parapetSegs.map((seg, i) => (
          <group key={`seg-${i}`}>
            <mesh position={[seg.x, parapetH / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[seg.w, parapetH, thick]} />
              <meshStandardMaterial color="#C8C0B0" roughness={0.9} />
            </mesh>
            {/* Cap */}
            <mesh position={[seg.x, parapetH + 0.015, 0]} castShadow>
              <boxGeometry args={[seg.w + 0.04, 0.03, thick + 0.04]} />
              <meshStandardMaterial color="#D8D0C0" roughness={0.6} />
            </mesh>
            {/* Top rail */}
            <mesh position={[seg.x, parapetH + railH + 0.04, 0]} castShadow>
              <boxGeometry args={[seg.w, railH, 0.04]} />
              <meshStandardMaterial color="#707070" metalness={0.6} roughness={0.3} />
            </mesh>
          </group>
        ))}

        {/* Window glass panels integrated into the railing */}
        {winPositions.map((wp, i) => (
          <group key={`win-${i}`}>
            {/* Glass panel from parapet top to rail top */}
            <mesh position={[wp.center, parapetH + railH / 2 + 0.03, 0]}>
              <boxGeometry args={[wp.halfW * 2, railH + 0.02, 0.02]} />
              <meshStandardMaterial
                color="#88CCEE"
                transparent
                opacity={0.3}
                metalness={0.1}
                roughness={0.05}
              />
            </mesh>
            {/* Glass panel below parapet — louvered window look */}
            <mesh position={[wp.center, parapetH * 0.55, 0]}>
              <boxGeometry args={[wp.halfW * 2, parapetH * 0.7, 0.01]} />
              <meshStandardMaterial
                color="#A8DDEE"
                transparent
                opacity={0.2}
                metalness={0.1}
                roughness={0.05}
              />
            </mesh>
          </group>
        ))}

        {/* Vertical railing bars — skip bars inside door gaps */}
        {Array.from({ length: numBars }, (_, i) => {
          const t = (i + 0.5) / numBars;
          const localX = -halfLen + t * length;
          if (isInDoorGap(localX)) return null;
          return (
            <mesh key={i} position={[localX, parapetH + 0.03, 0]} castShadow>
              <boxGeometry args={[0.015, railH * 2 + 0.04, 0.015]} />
              <meshStandardMaterial color="#707070" metalness={0.6} roughness={0.3} />
            </mesh>
          );
        })}
      </group>
    );
  }

  // Wall axis unit vector and normal
  const ax = edge.end.x - edge.start.x;
  const az = edge.end.y - edge.start.y;
  const wLen = Math.hypot(ax, az);
  const ux = wLen > 0 ? ax / wLen : 1;
  const uz = wLen > 0 ? az / wLen : 0;

  // Build openings by projecting ALL doors/windows onto this wall's axis
  const openings: { localCenter: number; halfW: number; bottomY: number; topY: number }[] = [];

  // Check each door — project its world position onto this wall
  for (const dp of allDoorPlacements) {
    // Door world position
    const dpx = dp.edge.start.x + dp.t * (dp.edge.end.x - dp.edge.start.x);
    const dpz = dp.edge.start.y + dp.t * (dp.edge.end.y - dp.edge.start.y);

    // Perpendicular distance from door to this wall's line
    const relX = dpx - edge.start.x;
    const relZ = dpz - edge.start.y;
    const perpDist = Math.abs(relX * (-uz) + relZ * ux);

    // Only cut if door is very close to this wall (within wall thickness + small margin)
    if (perpDist > thick + 0.15) continue;

    // Project along wall axis to get local t
    const projT = (relX * ux + relZ * uz) / wLen;
    // Must fall within the wall's extent
    if (projT < -0.05 || projT > 1.05) continue;

    const localX = (projT - 0.5) * length;
    const hw = dp.door.width_m / 2 + 0.03;
    openings.push({ localCenter: localX, halfW: hw, bottomY: 0, topY: 2.15 });
  }

  // Check each window
  for (const wp of allWindowPlacements) {
    const wpx = wp.edge.start.x + wp.t * (wp.edge.end.x - wp.edge.start.x);
    const wpz = wp.edge.start.y + wp.t * (wp.edge.end.y - wp.edge.start.y);

    const relX = wpx - edge.start.x;
    const relZ = wpz - edge.start.y;
    const perpDist = Math.abs(relX * (-uz) + relZ * ux);

    if (perpDist > thick + 0.15) continue;

    const projT = (relX * ux + relZ * uz) / wLen;
    if (projT < -0.05 || projT > 1.05) continue;

    const localX = (projT - 0.5) * length;
    const hw = wp.window.width_m / 2 + 0.03;
    openings.push({
      localCenter: localX,
      halfW: hw,
      bottomY: wp.window.sill_height_m,
      topY: wp.window.sill_height_m + wp.window.height_m,
    });
  }

  // Sort openings left to right
  openings.sort((a, b) => a.localCenter - b.localCenter);

  // Merge overlapping openings
  const merged: typeof openings = [];
  for (const op of openings) {
    const last = merged[merged.length - 1];
    if (last && op.localCenter - op.halfW < last.localCenter + last.halfW + 0.05) {
      // Overlapping — extend the last one
      const newRight = Math.max(last.localCenter + last.halfW, op.localCenter + op.halfW);
      const newLeft = Math.min(last.localCenter - last.halfW, op.localCenter - op.halfW);
      last.localCenter = (newLeft + newRight) / 2;
      last.halfW = (newRight - newLeft) / 2;
      last.bottomY = Math.min(last.bottomY, op.bottomY);
      last.topY = Math.max(last.topY, op.topY);
    } else {
      merged.push({ ...op });
    }
  }

  // Generate wall segments and headers around openings
  const segments: { x: number; y: number; w: number; h: number }[] = [];

  if (merged.length === 0) {
    segments.push({ x: 0, y: wallHeight / 2, w: length + thick, h: wallHeight });
  } else {
    let cursor = -halfLen - thick / 2;

    for (const op of merged) {
      const opLeft = op.localCenter - op.halfW;
      const opRight = op.localCenter + op.halfW;

      const segW = opLeft - cursor;
      if (segW > 0.02) {
        segments.push({ x: cursor + segW / 2, y: wallHeight / 2, w: segW, h: wallHeight });
      }

      const headerH = wallHeight - op.topY;
      if (headerH > 0.02) {
        segments.push({ x: op.localCenter, y: op.topY + headerH / 2, w: op.halfW * 2, h: headerH });
      }

      if (op.bottomY > 0.05) {
        segments.push({ x: op.localCenter, y: op.bottomY / 2, w: op.halfW * 2, h: op.bottomY });
      }

      cursor = opRight;
    }

    const rightEdge = halfLen + thick / 2;
    const remainW = rightEdge - cursor;
    if (remainW > 0.02) {
      segments.push({ x: cursor + remainW / 2, y: wallHeight / 2, w: remainW, h: wallHeight });
    }
  }

  return (
    <group position={[midX, 0, midZ]} rotation={[0, -edge.angle, 0]}>
      {segments.map((seg, i) => (
        <mesh key={i} position={[seg.x, seg.y, 0]} castShadow receiveShadow>
          <boxGeometry args={[seg.w, seg.h, thick]} />
          <meshStandardMaterial color={wallColor} roughness={0.85} />
        </mesh>
      ))}
      {merged.length === 0 ? (
        <>
          <mesh position={[0, 0.04, thick / 2 + 0.005]} castShadow>
            <boxGeometry args={[length + thick, 0.08, 0.015]} />
            <meshStandardMaterial color="#8B7D6B" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.04, -(thick / 2 + 0.005)]} castShadow>
            <boxGeometry args={[length + thick, 0.08, 0.015]} />
            <meshStandardMaterial color="#8B7D6B" roughness={0.7} />
          </mesh>
        </>
      ) : (
        segments
          .filter((s) => s.y < 1 && s.h > wallHeight - 0.1)
          .map((seg, i) => (
            <group key={`bb-${i}`}>
              <mesh position={[seg.x, 0.04, thick / 2 + 0.005]} castShadow>
                <boxGeometry args={[seg.w, 0.08, 0.015]} />
                <meshStandardMaterial color="#8B7D6B" roughness={0.7} />
              </mesh>
              <mesh position={[seg.x, 0.04, -(thick / 2 + 0.005)]} castShadow>
                <boxGeometry args={[seg.w, 0.08, 0.015]} />
                <meshStandardMaterial color="#8B7D6B" roughness={0.7} />
              </mesh>
            </group>
          ))
      )}
      {isExterior && (
        <>
          <mesh position={[0, wallHeight - 0.02, thick / 2 + 0.005]}>
            <boxGeometry args={[length + thick, 0.04, 0.012]} />
            <meshStandardMaterial color="#D8D0C0" roughness={0.6} />
          </mesh>
          <mesh position={[0, wallHeight - 0.02, -(thick / 2 + 0.005)]}>
            <boxGeometry args={[length + thick, 0.04, 0.012]} />
            <meshStandardMaterial color="#D8D0C0" roughness={0.6} />
          </mesh>
        </>
      )}
    </group>
  );
}

// ─── Door on Derived Edge ───
const DOOR_OPEN_DISTANCE = 2.0; // meters — door starts opening
const DOOR_OPEN_SPEED = 3.0; // radians per second

export function DerivedDoor({ placement }: { placement: DoorPlacement }) {
  const { door, edge, t } = placement;
  const viewMode = useSceneStore((s) => s.viewMode);

  const px = edge.start.x + t * (edge.end.x - edge.start.x);
  const pz = edge.start.y + t * (edge.end.y - edge.start.y);
  const doorHeight = 2.1;
  const isMain = door.type === "main_entrance";

  // Animated door opening — requires: close + looking at + press E to toggle
  const panelRef = useRef<THREE.Group>(null);
  const openAngleRef = useRef(0);
  const isOpenRef = useRef(false);
  const ePressedLastFrame = useRef(false);

  useFrame((_, delta) => {
    if (!panelRef.current) return;
    if (viewMode !== "walkthrough") {
      // Reset door when not in walk mode
      if (openAngleRef.current > 0) {
        openAngleRef.current = Math.max(0, openAngleRef.current - DOOR_OPEN_SPEED * delta);
        panelRef.current.rotation.y = openAngleRef.current;
      }
      isOpenRef.current = false;
      return;
    }

    const playerPos = playerPositionRef.current;
    const doorPos = new THREE.Vector3(px, 1, pz);
    const dist = playerPos.distanceTo(doorPos);

    // Check if player is close AND looking directly at the door
    const isClose = dist < DOOR_OPEN_DISTANCE;
    let isLooking = false;
    if (isClose) {
      const toDoor = new THREE.Vector3(px - playerPos.x, 0, pz - playerPos.z).normalize();
      const lookDir = playerDirRef.current;
      const dot = toDoor.x * lookDir.x + toDoor.z * lookDir.z;
      isLooking = dot > 0.85; // within ~30° cone (strict)
    }

    // Toggle on E press (edge-triggered, not held)
    const eDown = playerKeysRef.current.has("e");
    if (eDown && !ePressedLastFrame.current && isClose && isLooking) {
      isOpenRef.current = !isOpenRef.current;
    }
    ePressedLastFrame.current = eDown;

    const targetAngle = isOpenRef.current ? Math.PI / 2 : 0;

    if (openAngleRef.current < targetAngle) {
      openAngleRef.current = Math.min(targetAngle, openAngleRef.current + DOOR_OPEN_SPEED * delta);
    } else if (openAngleRef.current > targetAngle) {
      openAngleRef.current = Math.max(targetAngle, openAngleRef.current - DOOR_OPEN_SPEED * delta);
    }

    panelRef.current.rotation.y = openAngleRef.current;
  });

  const halfW = (door.width_m - 0.04) / 2;

  return (
    <group position={[px, 0, pz]} rotation={[0, -edge.angle, 0]}>
      {/* Door frame — open frame with left jamb, right jamb, and header */}
      {/* Left jamb */}
      <mesh position={[-(door.width_m / 2 + 0.025), doorHeight / 2, 0]} castShadow>
        <boxGeometry args={[0.05, doorHeight, edge.thickness + 0.06]} />
        <meshStandardMaterial color={isMain ? "#4A3528" : "#7B6B5A"} roughness={0.6} />
      </mesh>
      {/* Right jamb */}
      <mesh position={[(door.width_m / 2 + 0.025), doorHeight / 2, 0]} castShadow>
        <boxGeometry args={[0.05, doorHeight, edge.thickness + 0.06]} />
        <meshStandardMaterial color={isMain ? "#4A3528" : "#7B6B5A"} roughness={0.6} />
      </mesh>
      {/* Top header */}
      <mesh position={[0, doorHeight + 0.02, 0]} castShadow>
        <boxGeometry args={[door.width_m + 0.1, 0.06, edge.thickness + 0.06]} />
        <meshStandardMaterial color={isMain ? "#4A3528" : "#7B6B5A"} roughness={0.6} />
      </mesh>
      {/* Door panel — pivots from left edge */}
      <group ref={panelRef} position={[-halfW, 0, 0]}>
        <mesh position={[halfW, doorHeight / 2, 0.02]} castShadow>
          <boxGeometry args={[door.width_m - 0.04, doorHeight - 0.04, 0.04]} />
          <meshStandardMaterial color={isMain ? "#5C4030" : "#A08870"} roughness={0.5} metalness={0.02} />
        </mesh>
        {/* Panel detail — inset rectangles */}
        <mesh position={[halfW, doorHeight * 0.65, 0.045]}>
          <boxGeometry args={[door.width_m - 0.16, doorHeight * 0.3, 0.005]} />
          <meshStandardMaterial color={isMain ? "#503828" : "#947860"} roughness={0.6} />
        </mesh>
        <mesh position={[halfW, doorHeight * 0.3, 0.045]}>
          <boxGeometry args={[door.width_m - 0.16, doorHeight * 0.3, 0.005]} />
          <meshStandardMaterial color={isMain ? "#503828" : "#947860"} roughness={0.6} />
        </mesh>
        {/* Handle */}
        <mesh position={[halfW + door.width_m / 2 - 0.1, 1.0, 0.06]} castShadow>
          <boxGeometry args={[0.025, 0.12, 0.04]} />
          <meshStandardMaterial color="#C8C0B0" metalness={0.85} roughness={0.15} />
        </mesh>
        {/* Handle plate */}
        <mesh position={[halfW + door.width_m / 2 - 0.1, 1.0, 0.05]}>
          <boxGeometry args={[0.05, 0.2, 0.01]} />
          <meshStandardMaterial color="#B0A898" metalness={0.7} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

// ─── Window on Derived Edge ───
export function DerivedWindow({ placement }: { placement: WindowPlacement }) {
  const { window: win, edge, t } = placement;

  // Skip rendering standalone window frames on balcony exterior edges —
  // those are integrated into the railing by the DerivedWall component.
  if (edge.isBalconyExterior) return null;

  const px = edge.start.x + t * (edge.end.x - edge.start.x);
  const pz = edge.start.y + t * (edge.end.y - edge.start.y);
  const cy = win.sill_height_m + win.height_m / 2;

  return (
    <group position={[px, cy, pz]} rotation={[0, -edge.angle, 0]}>
      {/* Frame — 4 pieces around the opening */}
      {/* Left frame */}
      <mesh position={[-(win.width_m / 2 + 0.015), 0, 0]}>
        <boxGeometry args={[0.035, win.height_m + 0.06, edge.thickness + 0.04]} />
        <meshStandardMaterial color="#C0C0C0" metalness={0.3} roughness={0.5} />
      </mesh>
      {/* Right frame */}
      <mesh position={[(win.width_m / 2 + 0.015), 0, 0]}>
        <boxGeometry args={[0.035, win.height_m + 0.06, edge.thickness + 0.04]} />
        <meshStandardMaterial color="#C0C0C0" metalness={0.3} roughness={0.5} />
      </mesh>
      {/* Top frame */}
      <mesh position={[0, (win.height_m / 2 + 0.015), 0]}>
        <boxGeometry args={[win.width_m + 0.06, 0.035, edge.thickness + 0.04]} />
        <meshStandardMaterial color="#C0C0C0" metalness={0.3} roughness={0.5} />
      </mesh>
      {/* Bottom frame */}
      <mesh position={[0, -(win.height_m / 2 + 0.015), 0]}>
        <boxGeometry args={[win.width_m + 0.06, 0.035, edge.thickness + 0.04]} />
        <meshStandardMaterial color="#C0C0C0" metalness={0.3} roughness={0.5} />
      </mesh>
      {/* Left pane glass */}
      <mesh position={[-win.width_m / 4, 0, 0]}>
        <boxGeometry args={[win.width_m / 2 - 0.04, win.height_m - 0.06, 0.01]} />
        <meshPhysicalMaterial
          color="#88C8E8"
          transparent
          opacity={0.25}
          roughness={0.05}
          metalness={0.1}
          transmission={0.6}
        />
      </mesh>
      {/* Right pane glass */}
      <mesh position={[win.width_m / 4, 0, 0]}>
        <boxGeometry args={[win.width_m / 2 - 0.04, win.height_m - 0.06, 0.01]} />
        <meshPhysicalMaterial
          color="#88C8E8"
          transparent
          opacity={0.25}
          roughness={0.05}
          metalness={0.1}
          transmission={0.6}
        />
      </mesh>
      {/* Center divider */}
      <mesh>
        <boxGeometry args={[0.025, win.height_m - 0.02, 0.03]} />
        <meshStandardMaterial color="#B0B0B0" metalness={0.4} />
      </mesh>
      {/* Horizontal divider */}
      <mesh>
        <boxGeometry args={[win.width_m - 0.02, 0.025, 0.03]} />
        <meshStandardMaterial color="#B0B0B0" metalness={0.4} />
      </mesh>
      {/* Window sill */}
      <mesh position={[0, -win.height_m / 2 - 0.02, 0.1]}>
        <boxGeometry args={[win.width_m + 0.12, 0.04, 0.18]} />
        <meshStandardMaterial color="#D8D0C4" roughness={0.7} />
      </mesh>
    </group>
  );
}

// ─── Procedural Furniture — door/window-aware placement ───

/** Find which edges of a room's bounding box have doors/windows near them */
function classifyRoomEdges(
  room: RoomDef,
  doors: { position: [number, number] }[],
  windows: { position: [number, number] }[]
) {
  const minX = Math.min(...room.polygon.map((p) => p[0]));
  const maxX = Math.max(...room.polygon.map((p) => p[0]));
  const minZ = Math.min(...room.polygon.map((p) => p[1]));
  const maxZ = Math.max(...room.polygon.map((p) => p[1]));
  const tol = 0.3; // tolerance for edge detection

  const doorEdges = new Set<string>();
  const windowEdges = new Set<string>();

  for (const d of doors) {
    const [dx, dz] = d.position;
    if (dx >= minX - tol && dx <= maxX + tol && dz >= minZ - tol && dz <= maxZ + tol) {
      if (Math.abs(dz - minZ) < tol) doorEdges.add("top");
      if (Math.abs(dz - maxZ) < tol) doorEdges.add("bottom");
      if (Math.abs(dx - minX) < tol) doorEdges.add("left");
      if (Math.abs(dx - maxX) < tol) doorEdges.add("right");
    }
  }
  for (const w of windows) {
    const [wx, wz] = w.position;
    if (wx >= minX - tol && wx <= maxX + tol && wz >= minZ - tol && wz <= maxZ + tol) {
      if (Math.abs(wz - minZ) < tol) windowEdges.add("top");
      if (Math.abs(wz - maxZ) < tol) windowEdges.add("bottom");
      if (Math.abs(wx - minX) < tol) windowEdges.add("left");
      if (Math.abs(wx - maxX) < tol) windowEdges.add("right");
    }
  }

  // Best wall = no door, no window (for placing large furniture against)
  const allEdges = ["top", "bottom", "left", "right"] as const;
  const freeWalls = allEdges.filter((e) => !doorEdges.has(e) && !windowEdges.has(e));
  const bestWall = freeWalls[0] || "bottom";

  return { doorEdges, windowEdges, bestWall, freeWalls };
}

/** Simple plant in a pot */
function Plant({ position, size = 0.3 }: { position: [number, number, number]; size?: number }) {
  return (
    <group position={position}>
      {/* Pot */}
      <mesh position={[0, size * 0.3, 0]} castShadow>
        <cylinderGeometry args={[size * 0.35, size * 0.25, size * 0.6, 8]} />
        <meshStandardMaterial color="#8B6F4E" roughness={0.9} />
      </mesh>
      {/* Soil */}
      <mesh position={[0, size * 0.6, 0]}>
        <cylinderGeometry args={[size * 0.3, size * 0.3, 0.04, 8]} />
        <meshStandardMaterial color="#3D2B1F" />
      </mesh>
      {/* Foliage */}
      <mesh position={[0, size * 1.1, 0]} castShadow>
        <sphereGeometry args={[size * 0.5, 8, 6]} />
        <meshStandardMaterial color="#3A7D44" roughness={0.8} />
      </mesh>
      <mesh position={[size * 0.15, size * 1.3, size * 0.1]} castShadow>
        <sphereGeometry args={[size * 0.3, 6, 5]} />
        <meshStandardMaterial color="#4A8D54" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Small rug on floor */
function Rug({ position, width, depth, color }: { position: [number, number, number]; width: number; depth: number; color: string }) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

/** Nightstand / bedside table */
function Nightstand({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[0.4, 0.5, 0.35]} />
        <meshStandardMaterial color="#6B5040" roughness={0.7} />
      </mesh>
      {/* Lamp */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.15, 6]} />
        <meshStandardMaterial color="#C0C0C0" metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.68, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 0.12, 8]} />
        <meshStandardMaterial color="#F5E6D3" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** Bookshelf */
function Bookshelf({ position, rotation = 0, width = 0.8 }: { position: [number, number, number]; rotation?: number; width?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[width, 1.8, 0.3]} />
        <meshStandardMaterial color="#8B7355" roughness={0.7} />
      </mesh>
      {/* Books */}
      {[0.3, 0.7, 1.1, 1.5].map((y, i) => (
        <mesh key={i} position={[0, y, 0.02]} castShadow>
          <boxGeometry args={[width - 0.06, 0.02, 0.26]} />
          <meshStandardMaterial color="#7B6B5A" />
        </mesh>
      ))}
      {/* Colored book spines */}
      {[
        { x: -0.15, y: 0.45, h: 0.2, color: "#C0392B" },
        { x: 0.0, y: 0.45, h: 0.22, color: "#2980B9" },
        { x: 0.15, y: 0.45, h: 0.18, color: "#27AE60" },
        { x: -0.1, y: 0.85, h: 0.2, color: "#8E44AD" },
        { x: 0.1, y: 0.85, h: 0.24, color: "#D4AC0D" },
      ].map((b, i) => (
        <mesh key={`b${i}`} position={[b.x, b.y, 0.03]} castShadow>
          <boxGeometry args={[0.06, b.h, 0.2]} />
          <meshStandardMaterial color={b.color} />
        </mesh>
      ))}
    </group>
  );
}

/** Wall-mounted mirror */
function Mirror({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[0.5, 0.7, 0.03]} />
        <meshStandardMaterial color="#E8E8E8" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0, 1.5, -0.02]}>
        <boxGeometry args={[0.54, 0.74, 0.02]} />
        <meshStandardMaterial color="#6B5040" />
      </mesh>
    </group>
  );
}

/** Flush-mount ceiling light */
function CeilingLight({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* Base plate */}
      <mesh position={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.03, 16]} />
        <meshStandardMaterial color="#E0E0E0" metalness={0.3} roughness={0.4} />
      </mesh>
      {/* Frosted shade */}
      <mesh position={[0, -0.06, 0]}>
        <cylinderGeometry args={[0.15, 0.18, 0.06, 16]} />
        <meshStandardMaterial color="#FFFEF0" transparent opacity={0.85} emissive="#FFF5E0" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

/** Framed wall art / picture */
function WallArt({ position, rotation = 0 }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Frame */}
      <mesh position={[0, 1.55, 0]} castShadow>
        <boxGeometry args={[0.52, 0.42, 0.025]} />
        <meshStandardMaterial color="#5C4535" roughness={0.6} />
      </mesh>
      {/* Canvas / artwork */}
      <mesh position={[0, 1.55, 0.014]}>
        <boxGeometry args={[0.44, 0.34, 0.005]} />
        <meshStandardMaterial color="#C8D8C0" roughness={0.9} />
      </mesh>
      {/* Abstract brushstroke accent */}
      <mesh position={[-0.06, 1.58, 0.018]}>
        <boxGeometry args={[0.18, 0.08, 0.003]} />
        <meshStandardMaterial color="#7B8FA0" roughness={0.8} />
      </mesh>
      <mesh position={[0.08, 1.52, 0.018]}>
        <boxGeometry args={[0.12, 0.14, 0.003]} />
        <meshStandardMaterial color="#A08060" roughness={0.8} />
      </mesh>
    </group>
  );
}

export function RoomFurniture({ room, scene }: { room: RoomDef; scene: SceneGraph }) {
  // Skip furniture for the smaller part of a merge_group (avoid double stoves etc.)
  if (room.merge_group) {
    const groupRooms = scene.rooms.filter((r) => r.merge_group === room.merge_group);
    if (groupRooms.length > 1) {
      const largest = groupRooms.reduce((a, b) => (a.area_sqm >= b.area_sqm ? a : b));
      if (room.id !== largest.id) return null;
    }
  }

  const minX = Math.min(...room.polygon.map((p) => p[0]));
  const maxX = Math.max(...room.polygon.map((p) => p[0]));
  const minZ = Math.min(...room.polygon.map((p) => p[1]));
  const maxZ = Math.max(...room.polygon.map((p) => p[1]));
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const w = maxX - minX;
  const h = maxZ - minZ;

  const wallInset = 0.25;
  const iMinX = minX + wallInset;
  const iMaxX = maxX - wallInset;
  const iMinZ = minZ + wallInset;
  const iMaxZ = maxZ - wallInset;
  const iw = iMaxX - iMinX;
  const ih = iMaxZ - iMinZ;

  const { bestWall, freeWalls, windowEdges } = useMemo(
    () => classifyRoomEdges(room, scene.doors || [], scene.windows || []),
    [room, scene.doors, scene.windows]
  );

  // Skip furniture for very tiny rooms, but allow small WC/bathroom
  const isWetRoom = room.type === "wc" || room.type === "bathroom";
  if (!isWetRoom && (iw < 0.8 || ih < 0.8)) return null;
  if (isWetRoom && (iw < 0.4 || ih < 0.4)) return null;

  // Helper: get position on a wall edge
  const wallPos = (wall: string, offsetAlong: number, offsetFromWall: number): [number, number, number] => {
    switch (wall) {
      case "top": return [iMinX + offsetAlong * iw, 0, iMinZ + offsetFromWall];
      case "bottom": return [iMinX + offsetAlong * iw, 0, iMaxZ - offsetFromWall];
      case "left": return [iMinX + offsetFromWall, 0, iMinZ + offsetAlong * ih];
      case "right": return [iMaxX - offsetFromWall, 0, iMinZ + offsetAlong * ih];
      default: return [cx, 0, cz];
    }
  };

  const wallRot = (wall: string): number => {
    switch (wall) {
      case "top": return 0;
      case "bottom": return Math.PI;
      case "left": return Math.PI / 2;
      case "right": return -Math.PI / 2;
      default: return 0;
    }
  };

  switch (room.type) {
    case "living": {
      // Sofa against best free wall, coffee table in front, plant in corner
      const sofaW = Math.min(iw * 0.55, 2.0);
      return (
        <group>
          {/* Sofa */}
          <group position={wallPos(bestWall, 0.5, 0.4)} rotation={[0, wallRot(bestWall), 0]}>
            <mesh position={[0, 0.2, 0]} castShadow>
              <boxGeometry args={[sofaW, 0.4, 0.8]} />
              <meshStandardMaterial color="#6B5B4F" />
            </mesh>
            <mesh position={[0, 0.5, -0.3]} castShadow>
              <boxGeometry args={[sofaW, 0.3, 0.2]} />
              <meshStandardMaterial color="#5C4D42" />
            </mesh>
            {/* Armrests */}
            <mesh position={[-sofaW / 2, 0.32, 0]} castShadow>
              <boxGeometry args={[0.1, 0.24, 0.7]} />
              <meshStandardMaterial color="#5C4D42" />
            </mesh>
            <mesh position={[sofaW / 2, 0.32, 0]} castShadow>
              <boxGeometry args={[0.1, 0.24, 0.7]} />
              <meshStandardMaterial color="#5C4D42" />
            </mesh>
            {/* Cushions */}
            <mesh position={[-sofaW / 4, 0.42, 0.05]} castShadow>
              <boxGeometry args={[sofaW / 2.5, 0.08, 0.55]} />
              <meshStandardMaterial color="#7D6D5F" />
            </mesh>
            <mesh position={[sofaW / 4, 0.42, 0.05]} castShadow>
              <boxGeometry args={[sofaW / 2.5, 0.08, 0.55]} />
              <meshStandardMaterial color="#7D6D5F" />
            </mesh>
          </group>

          {/* Coffee table — same rotation as sofa so it's parallel */}
          <group position={wallPos(bestWall, 0.5, 1.3)} rotation={[0, wallRot(bestWall), 0]}>
            <mesh position={[0, 0.22, 0]} castShadow>
              <boxGeometry args={[0.9, 0.04, 0.5]} />
              <meshStandardMaterial color="#A08060" />
            </mesh>
            {/* Table legs */}
            {[[-0.38, -0.18], [0.38, -0.18], [-0.38, 0.18], [0.38, 0.18]].map(([lx, lz], i) => (
              <mesh key={i} position={[lx, 0.1, lz]} castShadow>
                <boxGeometry args={[0.04, 0.2, 0.04]} />
                <meshStandardMaterial color="#8B7355" />
              </mesh>
            ))}
          </group>

          {/* TV cabinet on opposite wall if free */}
          {freeWalls.length > 1 && (
            <group position={wallPos(freeWalls[1] || "top", 0.5, 0.2)} rotation={[0, wallRot(freeWalls[1] || "top") + Math.PI, 0]}>
              <mesh position={[0, 0.25, 0]} castShadow>
                <boxGeometry args={[1.2, 0.5, 0.4]} />
                <meshStandardMaterial color="#4A3B30" />
              </mesh>
              {/* TV screen */}
              <mesh position={[0, 0.85, -0.15]} castShadow>
                <boxGeometry args={[0.9, 0.55, 0.03]} />
                <meshStandardMaterial color="#1A1A1A" />
              </mesh>
            </group>
          )}

          {/* Rug under coffee table */}
          <Rug position={[cx, 0.02, cz]} width={Math.min(iw * 0.5, 2)} depth={Math.min(ih * 0.4, 1.5)} color="#8B7D6B" />

          {/* Ceiling light */}
          <CeilingLight position={[cx, 2.75, cz]} />

          {/* Wall art */}
          {freeWalls.length > 1 && (
            <WallArt position={wallPos(freeWalls.length > 2 ? freeWalls[2] : bestWall, 0.7, 0.02)} rotation={wallRot(freeWalls.length > 2 ? freeWalls[2] : bestWall) + Math.PI} />
          )}
        </group>
      );
    }

    case "bedroom": {
      // Bed against best wall, nightstands on either side, bookshelf on another free wall
      const bedW = Math.min(iw * 0.6, 1.6);
      const bedD = Math.min(ih * 0.65, 2.0);
      return (
        <group>
          {/* Bed frame + mattress */}
          <group position={wallPos(bestWall, 0.5, bedD / 2)} rotation={[0, wallRot(bestWall), 0]}>
            {/* Frame */}
            <mesh position={[0, 0.15, 0]} castShadow>
              <boxGeometry args={[bedW, 0.3, bedD]} />
              <meshStandardMaterial color="#6B5040" />
            </mesh>
            {/* Mattress */}
            <mesh position={[0, 0.35, 0.02]} castShadow>
              <boxGeometry args={[bedW - 0.06, 0.15, bedD - 0.06]} />
              <meshStandardMaterial color="#E8E0D0" />
            </mesh>
            {/* Headboard */}
            <mesh position={[0, 0.6, -bedD / 2 + 0.03]} castShadow>
              <boxGeometry args={[bedW, 0.6, 0.06]} />
              <meshStandardMaterial color="#5C4535" />
            </mesh>
            {/* Pillows */}
            <mesh position={[-bedW / 4, 0.46, -bedD / 2 + 0.35]} castShadow>
              <boxGeometry args={[bedW / 2.5, 0.08, 0.35]} />
              <meshStandardMaterial color="#F5F0E8" />
            </mesh>
            <mesh position={[bedW / 4, 0.46, -bedD / 2 + 0.35]} castShadow>
              <boxGeometry args={[bedW / 2.5, 0.08, 0.35]} />
              <meshStandardMaterial color="#F5F0E8" />
            </mesh>
            {/* Duvet */}
            <mesh position={[0, 0.44, 0.3]} castShadow>
              <boxGeometry args={[bedW - 0.1, 0.06, bedD * 0.5]} />
              <meshStandardMaterial color="#A0B4C8" />
            </mesh>
          </group>

          {/* Nightstands */}
          <Nightstand position={wallPos(bestWall, 0.5 - (bedW / 2 + 0.35) / iw, 0.25)} rotation={wallRot(bestWall)} />
          <Nightstand position={wallPos(bestWall, 0.5 + (bedW / 2 + 0.35) / iw, 0.25)} rotation={wallRot(bestWall)} />

          {/* Ceiling light */}
          <CeilingLight position={[cx, 2.75, cz]} />

          {/* Wardrobe on a free wall */}
          {freeWalls.length > 1 && (
            <group position={wallPos(freeWalls[1], 0.4, 0.3)} rotation={[0, wallRot(freeWalls[1]) + Math.PI, 0]}>
              <mesh position={[0, 1.0, 0]} castShadow>
                <boxGeometry args={[1.2, 2.0, 0.55]} />
                <meshStandardMaterial color="#7B6B5A" />
              </mesh>
              {/* Door line */}
              <mesh position={[0, 1.0, 0.28]}>
                <boxGeometry args={[0.02, 1.9, 0.01]} />
                <meshStandardMaterial color="#6B5B4A" />
              </mesh>
              {/* Handles */}
              <mesh position={[-0.08, 1.0, 0.29]} castShadow>
                <boxGeometry args={[0.02, 0.1, 0.03]} />
                <meshStandardMaterial color="#C0C0C0" metalness={0.8} />
              </mesh>
              <mesh position={[0.08, 1.0, 0.29]} castShadow>
                <boxGeometry args={[0.02, 0.1, 0.03]} />
                <meshStandardMaterial color="#C0C0C0" metalness={0.8} />
              </mesh>
            </group>
          )}

          {/* Small rug beside bed */}
          <Rug position={wallPos(bestWall, 0.5, bedD + 0.3)} width={bedW * 0.8} depth={0.6} color="#9B8B7B" />

          {/* Plant in corner away from door */}
          {/* Ceiling light */}
          <CeilingLight position={[cx, 2.75, cz]} />
        </group>
      );
    }

    case "kitchen": {
      // Counter on best wall (L-shaped if space allows)
      const counterLen = Math.min(iw - 0.2, 2.8);
      return (
        <group>
          {/* Main counter */}
          <group position={wallPos(bestWall, 0.5, 0.3)} rotation={[0, wallRot(bestWall) + Math.PI, 0]}>
            {/* Counter top */}
            <mesh position={[0, 0.88, 0]} castShadow>
              <boxGeometry args={[counterLen, 0.04, 0.6]} />
              <meshStandardMaterial color="#808080" metalness={0.1} />
            </mesh>
            {/* Cabinets below */}
            <mesh position={[0, 0.42, 0]} castShadow>
              <boxGeometry args={[counterLen, 0.84, 0.58]} />
              <meshStandardMaterial color="#F5F0E8" />
            </mesh>
            {/* Cabinet handles */}
            {Array.from({ length: Math.floor(counterLen / 0.5) }, (_, i) => (
              <mesh key={i} position={[(-counterLen / 2 + 0.3) + i * 0.5, 0.55, 0.3]} castShadow>
                <boxGeometry args={[0.08, 0.02, 0.03]} />
                <meshStandardMaterial color="#C0C0C0" metalness={0.8} />
              </mesh>
            ))}
            {/* Sink */}
            <mesh position={[counterLen * 0.25, 0.87, 0]} castShadow>
              <boxGeometry args={[0.5, 0.08, 0.4]} />
              <meshStandardMaterial color="#B0B0B0" metalness={0.4} />
            </mesh>
            {/* Stove/hob */}
            <mesh position={[-counterLen * 0.25, 0.9, 0]}>
              <boxGeometry args={[0.55, 0.02, 0.5]} />
              <meshStandardMaterial color="#2A2A2A" />
            </mesh>
            {/* Burner rings */}
            {[[-0.12, -0.1], [0.12, -0.1], [-0.12, 0.1], [0.12, 0.1]].map(([bx, bz], i) => (
              <mesh key={`burn${i}`} position={[-counterLen * 0.25 + bx, 0.915, bz]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.04, 0.06, 16]} />
                <meshStandardMaterial color="#444" />
              </mesh>
            ))}
          </group>

          {/* Upper cabinets (wall-mounted) */}
          <group position={wallPos(bestWall, 0.5, 0.2)} rotation={[0, wallRot(bestWall) + Math.PI, 0]}>
            <mesh position={[0, 1.9, 0]} castShadow>
              <boxGeometry args={[counterLen * 0.8, 0.6, 0.3]} />
              <meshStandardMaterial color="#F0EBE0" />
            </mesh>
          </group>

          {/* Ceiling light */}
          <CeilingLight position={[cx, 2.75, cz]} />

          {/* Fridge on another wall */}
          {freeWalls.length > 1 && (
            <group position={wallPos(freeWalls[1], 0.15, 0.35)} rotation={[0, wallRot(freeWalls[1]) + Math.PI, 0]}>
              {/* Fridge body — stainless steel look */}
              <mesh position={[0, 0.9, 0]} castShadow>
                <boxGeometry args={[0.7, 1.85, 0.68]} />
                <meshStandardMaterial color="#C8CCD0" metalness={0.35} roughness={0.25} />
              </mesh>
              {/* Top door */}
              <mesh position={[0, 1.4, 0.341]}>
                <boxGeometry args={[0.66, 0.85, 0.005]} />
                <meshStandardMaterial color="#D0D4D8" metalness={0.3} roughness={0.2} />
              </mesh>
              {/* Bottom door */}
              <mesh position={[0, 0.5, 0.341]}>
                <boxGeometry args={[0.66, 0.95, 0.005]} />
                <meshStandardMaterial color="#D0D4D8" metalness={0.3} roughness={0.2} />
              </mesh>
              {/* Divider line */}
              <mesh position={[0, 0.94, 0.345]}>
                <boxGeometry args={[0.68, 0.025, 0.008]} />
                <meshStandardMaterial color="#A0A0A0" metalness={0.5} />
              </mesh>
              {/* Top handle */}
              <mesh position={[0.25, 1.25, 0.36]} castShadow>
                <boxGeometry args={[0.02, 0.2, 0.035]} />
                <meshStandardMaterial color="#999" metalness={0.8} roughness={0.15} />
              </mesh>
              {/* Bottom handle */}
              <mesh position={[0.25, 0.6, 0.36]} castShadow>
                <boxGeometry args={[0.02, 0.2, 0.035]} />
                <meshStandardMaterial color="#999" metalness={0.8} roughness={0.15} />
              </mesh>
              {/* Water/ice dispenser (top door) */}
              <mesh position={[-0.08, 1.35, 0.348]}>
                <boxGeometry args={[0.15, 0.12, 0.006]} />
                <meshStandardMaterial color="#888" metalness={0.4} roughness={0.3} />
              </mesh>
            </group>
          )}
        </group>
      );
    }

    case "bathroom": {
      if (iw < 0.8 || ih < 0.8) return null;
      return (
        <group>
          {/* Toilet */}
          <group position={wallPos(bestWall, 0.3, 0.3)} rotation={[0, wallRot(bestWall), 0]}>
            {/* Bowl */}
            <mesh position={[0, 0.2, 0]} castShadow>
              <boxGeometry args={[0.38, 0.4, 0.55]} />
              <meshStandardMaterial color="#F5F5F5" />
            </mesh>
            {/* Tank */}
            <mesh position={[0, 0.4, -0.22]} castShadow>
              <boxGeometry args={[0.35, 0.35, 0.15]} />
              <meshStandardMaterial color="#F0F0F0" />
            </mesh>
            {/* Seat */}
            <mesh position={[0, 0.42, 0.05]} castShadow>
              <boxGeometry args={[0.36, 0.03, 0.4]} />
              <meshStandardMaterial color="#FAFAFA" />
            </mesh>
          </group>

          {/* Sink + vanity on different wall */}
          <group position={wallPos(freeWalls[1] || "left", 0.5, 0.25)} rotation={[0, wallRot(freeWalls[1] || "left") + Math.PI, 0]}>
            {/* Vanity cabinet */}
            <mesh position={[0, 0.35, 0]} castShadow>
              <boxGeometry args={[0.6, 0.7, 0.45]} />
              <meshStandardMaterial color="#F0EBE0" />
            </mesh>
            {/* Basin */}
            <mesh position={[0, 0.72, 0.02]} castShadow>
              <boxGeometry args={[0.5, 0.06, 0.4]} />
              <meshStandardMaterial color="#F8F8F8" />
            </mesh>
            {/* Faucet */}
            <mesh position={[0, 0.82, -0.12]} castShadow>
              <boxGeometry args={[0.04, 0.14, 0.04]} />
              <meshStandardMaterial color="#C0C0C0" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.88, -0.04]} castShadow>
              <boxGeometry args={[0.04, 0.04, 0.2]} />
              <meshStandardMaterial color="#C0C0C0" metalness={0.8} roughness={0.2} />
            </mesh>
          </group>

          {/* Mirror above sink */}
          <Mirror
            position={wallPos(freeWalls[1] || "left", 0.5, 0.02)}
            rotation={wallRot(freeWalls[1] || "left") + Math.PI}
          />

          {/* Shower area (if room is big enough) */}
          {iw > 1.5 && ih > 1.5 && (
            <group position={wallPos(freeWalls[2] || bestWall, 0.8, 0.45)} rotation={[0, wallRot(freeWalls[2] || bestWall), 0]}>
              {/* Shower tray */}
              <mesh position={[0, 0.03, 0]} receiveShadow>
                <boxGeometry args={[0.9, 0.06, 0.9]} />
                <meshStandardMaterial color="#E8E8E8" roughness={0.3} />
              </mesh>
              {/* Glass partition */}
              <mesh position={[-0.45, 1.0, 0]} castShadow>
                <boxGeometry args={[0.01, 1.9, 0.88]} />
                <meshPhysicalMaterial color="#E8F0F8" transparent opacity={0.15} roughness={0.05} transmission={0.7} />
              </mesh>
              {/* Glass frame */}
              <mesh position={[-0.45, 1.95, 0]}>
                <boxGeometry args={[0.02, 0.02, 0.9]} />
                <meshStandardMaterial color="#C0C0C0" metalness={0.8} roughness={0.2} />
              </mesh>
              {/* Shower head pipe */}
              <mesh position={[0, 1.5, -0.4]} castShadow>
                <boxGeometry args={[0.025, 0.9, 0.025]} />
                <meshStandardMaterial color="#C0C0C0" metalness={0.85} roughness={0.15} />
              </mesh>
              {/* Shower head */}
              <mesh position={[0, 1.95, -0.3]} castShadow rotation={[0.3, 0, 0]}>
                <cylinderGeometry args={[0.08, 0.06, 0.02, 12]} />
                <meshStandardMaterial color="#B8B8B8" metalness={0.8} roughness={0.15} />
              </mesh>
              {/* Shower controls */}
              <mesh position={[0, 1.1, -0.42]} castShadow>
                <cylinderGeometry args={[0.035, 0.035, 0.04, 8]} />
                <meshStandardMaterial color="#C0C0C0" metalness={0.85} roughness={0.15} />
              </mesh>
            </group>
          )}

          {/* Towel rack */}
          {freeWalls.length > 2 && (
            <group position={wallPos(freeWalls[2] || bestWall, 0.3, 0.06)} rotation={[0, wallRot(freeWalls[2] || bestWall) + Math.PI, 0]}>
              <mesh position={[0, 1.2, 0]} castShadow>
                <boxGeometry args={[0.5, 0.02, 0.06]} />
                <meshStandardMaterial color="#C0C0C0" metalness={0.7} roughness={0.2} />
              </mesh>
              {/* Towel */}
              <mesh position={[0, 1.0, 0.04]} castShadow>
                <boxGeometry args={[0.45, 0.35, 0.02]} />
                <meshStandardMaterial color="#F0F5FF" roughness={0.95} />
              </mesh>
            </group>
          )}

          {/* Bath mat */}
          <Rug position={wallPos(freeWalls[1] || "left", 0.5, 0.5)} width={0.5} depth={0.35} color="#A8B8C8" />
        </group>
      );
    }

    case "wc": {
      if (iw < 0.4 || ih < 0.4) return null;
      // Scale toilet to fit narrow WCs
      const ts = Math.min(1, iw / 0.7, ih / 0.7);
      return (
        <group>
          {/* Toilet */}
          <group position={wallPos(bestWall, 0.5, 0.25)} rotation={[0, wallRot(bestWall), 0]}>
            {/* Bowl base */}
            <mesh position={[0, 0.12 * ts, 0.05]} castShadow>
              <cylinderGeometry args={[0.15 * ts, 0.13 * ts, 0.24 * ts, 12]} />
              <meshStandardMaterial color="#F5F5F5" roughness={0.3} />
            </mesh>
            {/* Bowl rim */}
            <mesh position={[0, 0.26 * ts, 0.05]} castShadow>
              <cylinderGeometry args={[0.17 * ts, 0.16 * ts, 0.04 * ts, 12]} />
              <meshStandardMaterial color="#FAFAFA" roughness={0.2} />
            </mesh>
            {/* Tank */}
            <mesh position={[0, 0.32 * ts, -0.18 * ts]} castShadow>
              <boxGeometry args={[0.28 * ts, 0.3 * ts, 0.12 * ts]} />
              <meshStandardMaterial color="#F0F0F0" roughness={0.3} />
            </mesh>
            {/* Tank lid */}
            <mesh position={[0, 0.48 * ts, -0.18 * ts]} castShadow>
              <boxGeometry args={[0.3 * ts, 0.03, 0.14 * ts]} />
              <meshStandardMaterial color="#FAFAFA" roughness={0.2} />
            </mesh>
            {/* Seat */}
            <mesh position={[0, 0.29 * ts, 0.05]} castShadow>
              <boxGeometry args={[0.3 * ts, 0.02, 0.36 * ts]} />
              <meshStandardMaterial color="#FAFAFA" roughness={0.2} />
            </mesh>
            {/* Flush button */}
            <mesh position={[0, 0.50 * ts, -0.18 * ts]} castShadow>
              <cylinderGeometry args={[0.025, 0.025, 0.02, 8]} />
              <meshStandardMaterial color="#C0C0C0" metalness={0.8} roughness={0.15} />
            </mesh>
          </group>

          {/* Toilet paper holder */}
          <group position={wallPos(bestWall, 0.8, 0.08)} rotation={[0, wallRot(bestWall) + Math.PI, 0]}>
            <mesh position={[0, 0.65, 0]} castShadow>
              <boxGeometry args={[0.12, 0.04, 0.08]} />
              <meshStandardMaterial color="#C0C0C0" metalness={0.7} roughness={0.2} />
            </mesh>
            {/* Roll */}
            <mesh position={[0, 0.65, 0.05]} castShadow rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 0.08, 12]} />
              <meshStandardMaterial color="#F5F0E8" roughness={0.9} />
            </mesh>
          </group>

          {/* Small wall-mounted sink */}
          {freeWalls.length > 1 && (
            <group position={wallPos(freeWalls[1], 0.5, 0.18)} rotation={[0, wallRot(freeWalls[1]) + Math.PI, 0]}>
              {/* Sink basin */}
              <mesh position={[0, 0.78, 0]} castShadow>
                <boxGeometry args={[0.38, 0.08, 0.28]} />
                <meshStandardMaterial color="#F5F5F5" roughness={0.2} />
              </mesh>
              {/* Faucet */}
              <mesh position={[0, 0.88, -0.08]} castShadow>
                <boxGeometry args={[0.03, 0.12, 0.03]} />
                <meshStandardMaterial color="#C0C0C0" metalness={0.85} roughness={0.15} />
              </mesh>
              <mesh position={[0, 0.93, -0.02]} castShadow>
                <boxGeometry args={[0.03, 0.03, 0.15]} />
                <meshStandardMaterial color="#C0C0C0" metalness={0.85} roughness={0.15} />
              </mesh>
            </group>
          )}
        </group>
      );
    }

    case "dining": {
      // Dining table + chairs
      const tableW = Math.min(iw * 0.5, 1.4);
      const tableD = Math.min(ih * 0.4, 0.9);
      return (
        <group>
          {/* Table */}
          <group position={[cx, 0, cz]}>
            <mesh position={[0, 0.38, 0]} castShadow>
              <boxGeometry args={[tableW, 0.04, tableD]} />
              <meshStandardMaterial color="#8B7355" />
            </mesh>
            {/* Legs */}
            {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([lx, lz], i) => (
              <mesh key={i} position={[lx * (tableW / 2 - 0.06), 0.18, lz * (tableD / 2 - 0.06)]} castShadow>
                <boxGeometry args={[0.05, 0.36, 0.05]} />
                <meshStandardMaterial color="#7B6545" />
              </mesh>
            ))}
          </group>

          {/* Chairs */}
          {[[-1, 0], [1, 0], [0, -1], [0, 1]].map(([dx, dz], i) => {
            const chairX = cx + dx * (tableW / 2 + 0.3);
            const chairZ = cz + dz * (tableD / 2 + 0.3);
            if (chairX < iMinX + 0.15 || chairX > iMaxX - 0.15 || chairZ < iMinZ + 0.15 || chairZ > iMaxZ - 0.15) return null;
            return (
              <group key={i} position={[chairX, 0, chairZ]} rotation={[0, Math.atan2(-dx, -dz), 0]}>
                <mesh position={[0, 0.22, 0]} castShadow>
                  <boxGeometry args={[0.4, 0.04, 0.4]} />
                  <meshStandardMaterial color="#A09080" />
                </mesh>
                <mesh position={[0, 0.55, -0.18]} castShadow>
                  <boxGeometry args={[0.38, 0.5, 0.04]} />
                  <meshStandardMaterial color="#A09080" />
                </mesh>
              </group>
            );
          })}

          <CeilingLight position={[cx, 2.75, cz]} />
        </group>
      );
    }

    case "yard":
    case "balcony": {
      return (
        <group>

          {/* Drying rack */}
          {ih > 1.2 && (
            <group position={[cx, 0, cz]}>
              {/* Frame */}
              <mesh position={[-0.4, 0.6, 0]} castShadow>
                <boxGeometry args={[0.03, 1.2, 0.03]} />
                <meshStandardMaterial color="#B0B0B0" metalness={0.5} />
              </mesh>
              <mesh position={[0.4, 0.6, 0]} castShadow>
                <boxGeometry args={[0.03, 1.2, 0.03]} />
                <meshStandardMaterial color="#B0B0B0" metalness={0.5} />
              </mesh>
              {/* Bars */}
              {[0.5, 0.7, 0.9, 1.1].map((y, i) => (
                <mesh key={i} position={[0, y, 0]} castShadow>
                  <boxGeometry args={[0.78, 0.015, 0.015]} />
                  <meshStandardMaterial color="#C0C0C0" metalness={0.5} />
                </mesh>
              ))}
            </group>
          )}
        </group>
      );
    }

    case "corridor": {
      return (
        <group>
          {/* Shoe cabinet near door */}
          {freeWalls.length > 0 && (
            <group position={wallPos(freeWalls[0], 0.3, 0.2)} rotation={[0, wallRot(freeWalls[0]) + Math.PI, 0]}>
              <mesh position={[0, 0.4, 0]} castShadow>
                <boxGeometry args={[0.8, 0.8, 0.35]} />
                <meshStandardMaterial color="#7B6B5A" />
              </mesh>
            </group>
          )}
          <CeilingLight position={[cx, 2.75, cz]} />
        </group>
      );
    }

    case "storage": {
      return (
        <group>
          <Bookshelf position={wallPos(bestWall, 0.3, 0.2)} rotation={wallRot(bestWall) + Math.PI} width={Math.min(iw * 0.6, 1.0)} />
          {freeWalls.length > 1 && (
            <Bookshelf position={wallPos(freeWalls[1], 0.5, 0.2)} rotation={wallRot(freeWalls[1]) + Math.PI} width={Math.min(iw * 0.5, 0.8)} />
          )}
        </group>
      );
    }

    default:
      return null;
  }
}
