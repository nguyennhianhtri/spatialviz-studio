"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import { useSceneStore } from "@/store/scene-store";
import type { SceneGraph, RoomDef, WallDef, DoorDef, WindowDef } from "@/types/scene";

// ─── Color palette ───
const FLOOR_COLORS: Record<string, string> = {
  wood_light: "#C4A882",
  wood_dark: "#8B6914",
  tile_white: "#D4D4D4",
  carpet: "#7B8A6E",
  concrete: "#A0A0A0",
};

const ROOM_FLOOR: Record<string, string> = {
  living: "#C4A882",
  bedroom: "#C9B896",
  kitchen: "#D0CCC0",
  bathroom: "#C8D0D8",
  dining: "#C4A882",
  corridor: "#B8B0A0",
  balcony: "#A8A098",
  storage: "#A0A098",
  office: "#C4B8A0",
};

// ─── Procedural Furniture ───
function ProceduralSofa({ position, rotation }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation || 0, 0]}>
      {/* Base */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[1.8, 0.4, 0.8]} />
        <meshStandardMaterial color="#6B5B4F" />
      </mesh>
      {/* Backrest */}
      <mesh position={[0, 0.5, -0.3]} castShadow>
        <boxGeometry args={[1.8, 0.3, 0.2]} />
        <meshStandardMaterial color="#5C4D42" />
      </mesh>
      {/* Left arm */}
      <mesh position={[-0.85, 0.35, 0]} castShadow>
        <boxGeometry args={[0.1, 0.3, 0.8]} />
        <meshStandardMaterial color="#5C4D42" />
      </mesh>
      {/* Right arm */}
      <mesh position={[0.85, 0.35, 0]} castShadow>
        <boxGeometry args={[0.1, 0.3, 0.8]} />
        <meshStandardMaterial color="#5C4D42" />
      </mesh>
      {/* Cushions */}
      <mesh position={[-0.4, 0.42, 0.05]} castShadow>
        <boxGeometry args={[0.7, 0.08, 0.6]} />
        <meshStandardMaterial color="#8B7D6B" />
      </mesh>
      <mesh position={[0.4, 0.42, 0.05]} castShadow>
        <boxGeometry args={[0.7, 0.08, 0.6]} />
        <meshStandardMaterial color="#8B7D6B" />
      </mesh>
    </group>
  );
}

function ProceduralBed({ position, rotation }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation || 0, 0]}>
      {/* Mattress */}
      <mesh position={[0, 0.3, 0]} castShadow>
        <boxGeometry args={[1.5, 0.25, 2.0]} />
        <meshStandardMaterial color="#E8E0D0" />
      </mesh>
      {/* Frame */}
      <mesh position={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[1.6, 0.24, 2.1]} />
        <meshStandardMaterial color="#6B5040" />
      </mesh>
      {/* Headboard */}
      <mesh position={[0, 0.6, -1.0]} castShadow>
        <boxGeometry args={[1.6, 0.7, 0.08]} />
        <meshStandardMaterial color="#5C4535" />
      </mesh>
      {/* Pillow L */}
      <mesh position={[-0.35, 0.46, -0.7]} castShadow>
        <boxGeometry args={[0.5, 0.1, 0.35]} />
        <meshStandardMaterial color="#F0F0F0" />
      </mesh>
      {/* Pillow R */}
      <mesh position={[0.35, 0.46, -0.7]} castShadow>
        <boxGeometry args={[0.5, 0.1, 0.35]} />
        <meshStandardMaterial color="#F0F0F0" />
      </mesh>
    </group>
  );
}

function ProceduralTable({ position, rotation }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation || 0, 0]}>
      {/* Tabletop */}
      <mesh position={[0, 0.74, 0]} castShadow>
        <boxGeometry args={[1.2, 0.04, 0.8]} />
        <meshStandardMaterial color="#A08060" />
      </mesh>
      {/* Legs */}
      {[[-0.5, 0, -0.3], [0.5, 0, -0.3], [-0.5, 0, 0.3], [0.5, 0, 0.3]].map((pos, i) => (
        <mesh key={i} position={[pos[0], 0.37, pos[2]]} castShadow>
          <boxGeometry args={[0.04, 0.74, 0.04]} />
          <meshStandardMaterial color="#8B7050" />
        </mesh>
      ))}
    </group>
  );
}

function ProceduralChair({ position, rotation }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation || 0, 0]}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <boxGeometry args={[0.4, 0.04, 0.4]} />
        <meshStandardMaterial color="#8B7050" />
      </mesh>
      <mesh position={[0, 0.7, -0.18]} castShadow>
        <boxGeometry args={[0.4, 0.5, 0.04]} />
        <meshStandardMaterial color="#8B7050" />
      </mesh>
      {[[-0.16, 0, -0.16], [0.16, 0, -0.16], [-0.16, 0, 0.16], [0.16, 0, 0.16]].map((pos, i) => (
        <mesh key={i} position={[pos[0], 0.22, pos[2]]} castShadow>
          <boxGeometry args={[0.03, 0.44, 0.03]} />
          <meshStandardMaterial color="#7A6040" />
        </mesh>
      ))}
    </group>
  );
}

function ProceduralToilet({ position, rotation }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation || 0, 0]}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[0.4, 0.4, 0.55]} />
        <meshStandardMaterial color="#F0F0F0" />
      </mesh>
      <mesh position={[0, 0.42, -0.15]} castShadow>
        <boxGeometry args={[0.38, 0.06, 0.5]} />
        <meshStandardMaterial color="#E8E8E8" />
      </mesh>
      <mesh position={[0, 0.5, -0.35]} castShadow>
        <boxGeometry args={[0.38, 0.25, 0.1]} />
        <meshStandardMaterial color="#F0F0F0" />
      </mesh>
    </group>
  );
}

function ProceduralSink({ position, rotation }: { position: [number, number, number]; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation || 0, 0]}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[0.6, 0.04, 0.45]} />
        <meshStandardMaterial color="#E0E0E0" />
      </mesh>
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[0.45, 0.12, 0.35]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[0, 0.2, -0.15]} castShadow>
        <boxGeometry args={[0.55, 0.4, 0.1]} />
        <meshStandardMaterial color="#D0D0D0" />
      </mesh>
    </group>
  );
}

function ProceduralKitchenCounter({ position, rotation, width = 2.0 }: { position: [number, number, number]; rotation?: number; width?: number }) {
  return (
    <group position={position} rotation={[0, rotation || 0, 0]}>
      <mesh position={[0, 0.44, 0]} castShadow>
        <boxGeometry args={[width, 0.04, 0.6]} />
        <meshStandardMaterial color="#808080" />
      </mesh>
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[width, 0.4, 0.58]} />
        <meshStandardMaterial color="#F5F0E8" />
      </mesh>
    </group>
  );
}

// ─── Room Component ───
export function RoomMesh({
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

  const floorColor = ROOM_FLOOR[room.type] || FLOOR_COLORS[room.floor_material] || "#C0C0C0";

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Floor with slight elevation */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color={floorColor} side={THREE.DoubleSide} roughness={0.8} />
      </mesh>

      {/* Ceiling (subtle, slightly transparent) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 2.79, 0]}>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color="#F8F8F8" side={THREE.DoubleSide} transparent opacity={0.3} />
      </mesh>

      {/* Room label */}
      <Html
        position={[center[0], 0.05, center[1]]}
        center
        distanceFactor={12}
        style={{ pointerEvents: "none" }}
      >
        <div className="rounded-md bg-black/70 px-2.5 py-1 text-xs text-white whitespace-nowrap backdrop-blur-sm shadow-lg border border-white/10">
          <span className="font-medium">{room.label}</span>
          <span className="ml-1.5 opacity-70">{room.area_sqm}m²</span>
        </div>
      </Html>

      {/* Selection highlight */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <shapeGeometry args={[shape]} />
          <meshStandardMaterial color="#6366f1" transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

// ─── Wall Component ───
export function WallMesh({ wall }: { wall: WallDef }) {
  const length = Math.sqrt(
    (wall.end[0] - wall.start[0]) ** 2 + (wall.end[1] - wall.start[1]) ** 2
  );
  const angle = Math.atan2(wall.end[1] - wall.start[1], wall.end[0] - wall.start[0]);
  const midX = (wall.start[0] + wall.end[0]) / 2;
  const midZ = (wall.start[1] + wall.end[1]) / 2;

  return (
    <mesh
      position={[midX, wall.height_m / 2, midZ]}
      rotation={[0, -angle, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[length, wall.height_m, wall.thickness_m]} />
      <meshStandardMaterial color="#E8E4DC" roughness={0.9} />
    </mesh>
  );
}

// ─── Door Component ───
// Door position is a point on the wall line. We need to project it onto the wall
// and place the door geometry centered on the wall's thickness.
export function DoorMesh({ door, walls }: { door: DoorDef; walls: WallDef[] }) {
  const wall = walls.find((w) => w.id === door.wall_id);
  if (!wall) return null;

  // Wall direction and normal
  const dx = wall.end[0] - wall.start[0];
  const dz = wall.end[1] - wall.start[1];
  const wallLen = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);

  // Project door position onto wall line to find the nearest point on the wall
  const t = Math.max(0, Math.min(1,
    ((door.position[0] - wall.start[0]) * dx + (door.position[1] - wall.start[1]) * dz) / (wallLen * wallLen)
  ));
  const projX = wall.start[0] + t * dx;
  const projZ = wall.start[1] + t * dz;

  const doorHeight = 2.1;

  return (
    <group position={[projX, 0, projZ]} rotation={[0, -angle, 0]}>
      {/* Door frame */}
      <mesh position={[0, doorHeight / 2, 0]}>
        <boxGeometry args={[door.width_m + 0.08, doorHeight + 0.04, wall.thickness_m + 0.04]} />
        <meshStandardMaterial color="#7B6B5A" roughness={0.7} />
      </mesh>
      {/* Door panel */}
      <mesh position={[0, doorHeight / 2, 0.02]}>
        <boxGeometry args={[door.width_m - 0.04, doorHeight - 0.04, 0.04]} />
        <meshStandardMaterial color={door.type === "main_entrance" ? "#5C4030" : "#A08870"} roughness={0.6} />
      </mesh>
      {/* Door handle */}
      <mesh position={[door.width_m / 2 - 0.12, 1.0, 0.05]}>
        <boxGeometry args={[0.03, 0.12, 0.04]} />
        <meshStandardMaterial color="#C0C0C0" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

// ─── Window Component ───
export function WindowMesh({ win, walls }: { win: WindowDef; walls: WallDef[] }) {
  const wall = walls.find((w) => w.id === win.wall_id);
  if (!wall) return null;

  // Project window position onto wall line
  const dx = wall.end[0] - wall.start[0];
  const dz = wall.end[1] - wall.start[1];
  const wallLen = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dz, dx);

  const t = Math.max(0, Math.min(1,
    ((win.position[0] - wall.start[0]) * dx + (win.position[1] - wall.start[1]) * dz) / (wallLen * wallLen)
  ));
  const projX = wall.start[0] + t * dx;
  const projZ = wall.start[1] + t * dz;

  return (
    <group position={[projX, win.sill_height_m + win.height_m / 2, projZ]} rotation={[0, -angle, 0]}>
      {/* Window frame */}
      <mesh>
        <boxGeometry args={[win.width_m + 0.06, win.height_m + 0.06, wall.thickness_m + 0.04]} />
        <meshStandardMaterial color="#D0D0D0" roughness={0.5} />
      </mesh>
      {/* Glass panes */}
      <mesh position={[-win.width_m / 4, 0, 0]}>
        <boxGeometry args={[win.width_m / 2 - 0.04, win.height_m - 0.06, 0.02]} />
        <meshStandardMaterial color="#A0D4F0" transparent opacity={0.3} roughness={0.1} />
      </mesh>
      <mesh position={[win.width_m / 4, 0, 0]}>
        <boxGeometry args={[win.width_m / 2 - 0.04, win.height_m - 0.06, 0.02]} />
        <meshStandardMaterial color="#A0D4F0" transparent opacity={0.3} roughness={0.1} />
      </mesh>
      {/* Center divider */}
      <mesh>
        <boxGeometry args={[0.03, win.height_m - 0.02, 0.04]} />
        <meshStandardMaterial color="#C0C0C0" />
      </mesh>
      {/* Sill */}
      <mesh position={[0, -win.height_m / 2 - 0.02, 0.08]}>
        <boxGeometry args={[win.width_m + 0.1, 0.04, 0.15]} />
        <meshStandardMaterial color="#E0DCD0" />
      </mesh>
    </group>
  );
}

// ─── Auto-place furniture based on room type ───
export function RoomFurniture({ room }: { room: RoomDef }) {
  const cx = room.polygon.reduce((s, p) => s + p[0], 0) / room.polygon.length;
  const cz = room.polygon.reduce((s, p) => s + p[1], 0) / room.polygon.length;

  // Compute room bounding box
  const minX = Math.min(...room.polygon.map(p => p[0]));
  const maxX = Math.max(...room.polygon.map(p => p[0]));
  const minZ = Math.min(...room.polygon.map(p => p[1]));
  const maxZ = Math.max(...room.polygon.map(p => p[1]));
  const w = maxX - minX;
  const h = maxZ - minZ;

  // Inset from walls so furniture sits against them, not floating
  const pad = 0.3;

  switch (room.type) {
    case "living":
      return (
        <group>
          {/* Sofa against far wall, facing INWARD (toward center/table) */}
          <ProceduralSofa position={[cx, 0, maxZ - pad - 0.4]} rotation={Math.PI} />
          {/* Coffee table in front of sofa */}
          <ProceduralTable position={[cx, 0, maxZ - pad - 1.6]} />
        </group>
      );
    case "bedroom":
      return (
        <group>
          {w >= h ? (
            /* Wide room: bed headboard against minX wall, facing +X */
            <ProceduralBed position={[minX + pad + 1.0, 0, cz]} rotation={-Math.PI / 2} />
          ) : (
            /* Tall room: bed headboard against maxZ wall, facing -Z */
            <ProceduralBed position={[cx, 0, maxZ - pad - 1.0]} rotation={Math.PI} />
          )}
        </group>
      );
    case "kitchen":
      return (
        <group>
          {/* Counter along the longest wall */}
          {w >= h ? (
            <ProceduralKitchenCounter position={[cx, 0, maxZ - pad]} width={Math.min(w - 0.8, 3.0)} />
          ) : (
            <ProceduralKitchenCounter position={[maxX - pad, 0, cz]} width={Math.min(h - 0.8, 3.0)} />
          )}
        </group>
      );
    case "dining":
      return (
        <group>
          <ProceduralTable position={[cx, 0, cz]} />
          <ProceduralChair position={[cx - 0.5, 0, cz + 0.55]} rotation={Math.PI} />
          <ProceduralChair position={[cx + 0.5, 0, cz + 0.55]} rotation={Math.PI} />
          <ProceduralChair position={[cx - 0.5, 0, cz - 0.55]} />
          <ProceduralChair position={[cx + 0.5, 0, cz - 0.55]} />
        </group>
      );
    case "bathroom":
      return (
        <group>
          {/* Toilet against wall farthest from door (usually maxZ) */}
          <ProceduralToilet position={[cx - w * 0.2, 0, maxZ - pad - 0.3]} rotation={Math.PI} />
          {/* Sink on adjacent wall */}
          <ProceduralSink position={[cx + w * 0.2, 0, maxZ - pad - 0.3]} rotation={Math.PI} />
        </group>
      );
    case "office":
      return (
        <group>
          <ProceduralTable position={[cx, 0, minZ + pad + 0.4]} />
          <ProceduralChair position={[cx, 0, minZ + pad + 1.0]} rotation={Math.PI} />
        </group>
      );
    default:
      return null;
  }
}
