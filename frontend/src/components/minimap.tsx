"use client";

/**
 * Minimap overlay for the 3D viewer.
 *
 * Draws a top-down SVG of the floor plan with room labels, a live player
 * arrow, and a "current room" indicator — all styled with a polished dark UI.
 */

import { useEffect, useRef, useState } from "react";
import { Map as MapIcon, X } from "lucide-react";
import {
  playerPositionRef,
  playerYawRef,
} from "@/components/first-person-controls";
import type { SceneGraph } from "@/types/scene";

const MAP_W = 260;
const MAP_H = 260;
const PADDING = 16;

const ROOM_FILLS: Record<string, string> = {
  bedroom: "#2e2945",
  living: "#2a3d50",
  dining: "#2a3d50",
  kitchen: "#2d4230",
  bathroom: "#253d4a",
  wc: "#253d4a",
  corridor: "#25252f",
  balcony: "#33301e",
  yard: "#33301e",
  storage: "#2a2a34",
  office: "#2e2945",
};

const ROOM_STROKES: Record<string, string> = {
  bedroom: "#6e5da0",
  living: "#5a8ab0",
  dining: "#5a8ab0",
  kitchen: "#5a9060",
  bathroom: "#5090a0",
  wc: "#5090a0",
  corridor: "#555568",
  balcony: "#8a8050",
  yard: "#8a8050",
  storage: "#555568",
  office: "#6e5da0",
};

/** Abbreviate room label for minimap */
function shortLabel(label: string): string {
  return label
    .replace("Balcony (rear)", "Balcony")
    .replace("Balcony (front)", "Balcony")
    .replace("Bedroom (rear)", "Bed 2")
    .replace("Bedroom (front)", "Bed 1")
    .replace("Living Room", "Living")
    .replace("W.C.", "WC");
}

/** Check which room a world (x, z) position falls in */
function roomAtPosition(
  x: number,
  z: number,
  rooms: SceneGraph["rooms"],
): SceneGraph["rooms"][number] | null {
  for (const room of rooms) {
    const xs = room.polygon.map((p) => p[0]);
    const ys = room.polygon.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    if (x >= minX && x <= maxX && z >= minY && z <= maxY) return room;
  }
  return null;
}

export function Minimap({ scene }: { scene: SceneGraph }) {
  const dotRef = useRef<SVGGElement | null>(null);
  const [open, setOpen] = useState(true);
  const [currentRoom, setCurrentRoom] = useState<string>("Outside");

  // Compute world bounds + scale once per scene
  const bounds = (() => {
    const pts = scene.rooms.flatMap((r) => r.polygon);
    if (pts.length === 0) {
      return { minX: 0, maxX: 10, minY: 0, maxY: 10, scale: 20, w: 200, h: 200 };
    }
    const xs = pts.map((p) => p[0]);
    const ys = pts.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const innerW = MAP_W - PADDING * 2;
    const innerH = MAP_H - PADDING * 2;
    const scale = Math.min(innerW / (maxX - minX || 1), innerH / (maxY - minY || 1));
    const w = (maxX - minX) * scale;
    const h = (maxY - minY) * scale;
    return { minX, maxX, minY, maxY, scale, w, h };
  })();

  // World (x, z) → SVG (px, py)
  const project = (x: number, z: number) => {
    const offX = (MAP_W - bounds.w) / 2;
    const offY = (MAP_H - bounds.h) / 2;
    return {
      px: offX + (x - bounds.minX) * bounds.scale,
      py: offY + (z - bounds.minY) * bounds.scale,
    };
  };

  // Room label centers
  const roomCenters = scene.rooms.map((room) => {
    const xs = room.polygon.map((p) => p[0]);
    const ys = room.polygon.map((p) => p[1]);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    const { px, py } = project(cx, cy);
    const w = (Math.max(...xs) - Math.min(...xs)) * bounds.scale;
    return { room, px, py, w };
  });

  // Animate the player dot + update current room
  useEffect(() => {
    let raf = 0;
    let frameCount = 0;
    const tick = () => {
      const g = dotRef.current;
      if (g) {
        const p = playerPositionRef.current;
        const { px, py } = project(p.x, p.z);
        const deg = 180 - (playerYawRef.current * 180) / Math.PI;
        g.setAttribute("transform", `translate(${px}, ${py}) rotate(${deg})`);

        // Update current room every ~15 frames to avoid excessive re-renders
        frameCount++;
        if (frameCount % 15 === 0) {
          const hit = roomAtPosition(p.x, p.z, scene.rooms);
          const name = hit ? hit.label : "Outside";
          setCurrentRoom((prev) => (prev !== name ? name : prev));
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute bottom-4 right-4 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)]/90 px-3 py-2 text-xs font-medium text-[var(--text-secondary)] backdrop-blur-sm hover:text-[var(--accent)] transition-colors"
        title="Show minimap"
      >
        <MapIcon className="h-3.5 w-3.5" />
        Map
      </button>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#141420]/95 to-[#0E0E18]/95 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent)]/15">
            <MapIcon className="h-3 w-3 text-[var(--accent)]" />
          </div>
          <span className="text-[11px] font-semibold tracking-wide text-white/70 uppercase">
            Floor Plan
          </span>
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md p-0.5 text-white/30 hover:text-white/70 hover:bg-white/5 transition-colors"
          title="Hide"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Map */}
      <div className="p-1">
        <svg
          width={MAP_W}
          height={MAP_H}
          viewBox={`0 0 ${MAP_W} ${MAP_H}`}
          className="block"
          style={{ background: "radial-gradient(ellipse at center, #12121e 0%, #0a0a14 100%)" }}
        >
          {/* Subtle grid lines */}
          <defs>
            <pattern id="miniGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={MAP_W} height={MAP_H} fill="url(#miniGrid)" />

          {/* Room polygons */}
          {scene.rooms.map((room) => {
            const pts = room.polygon
              .map(([x, y]) => {
                const { px, py } = project(x, y);
                return `${px.toFixed(1)},${py.toFixed(1)}`;
              })
              .join(" ");
            const fill = ROOM_FILLS[room.type] || "#2c2c3a";
            const stroke = ROOM_STROKES[room.type] || "#5a5a72";
            return (
              <polygon
                key={room.id}
                points={pts}
                fill={fill}
                stroke={stroke}
                strokeWidth={1.2}
                opacity={0.9}
              />
            );
          })}

          {/* Room labels */}
          {roomCenters.map(({ room, px, py, w }) => {
            const label = shortLabel(room.label);
            const fontSize = Math.max(6.5, Math.min(9, w * 0.13));
            // Skip label if room is too small on screen
            if (w < 28) return null;
            return (
              <text
                key={`label-${room.id}`}
                x={px}
                y={py}
                textAnchor="middle"
                dominantBaseline="central"
                fill="rgba(255,255,255,0.5)"
                fontSize={fontSize}
                fontFamily="system-ui, sans-serif"
                fontWeight="500"
              >
                {label}
              </text>
            );
          })}

          {/* Door markers */}
          {scene.doors.map((d) => {
            const { px, py } = project(d.position[0], d.position[1]);
            return (
              <rect
                key={d.id}
                x={px - 2}
                y={py - 2}
                width={4}
                height={4}
                rx={1}
                fill="#e8b84d"
                opacity={0.7}
              />
            );
          })}

          {/* Player marker with glow */}
          <g ref={dotRef}>
            {/* Glow */}
            <circle r={12} fill="rgba(255,85,119,0.12)" />
            <circle r={7} fill="rgba(255,85,119,0.2)" />
            {/* Direction cone */}
            <polygon
              points="0,-10 5,5 -5,5"
              fill="#ff5577"
              stroke="rgba(255,255,255,0.8)"
              strokeWidth={1}
              strokeLinejoin="round"
            />
            <circle r={2.5} fill="#ffffff" />
          </g>
        </svg>
      </div>

      {/* Footer — current room */}
      <div className="flex items-center gap-2 px-3.5 py-2 border-t border-white/5">
        <div className="h-2 w-2 rounded-full bg-[#ff5577] shadow-[0_0_6px_rgba(255,85,119,0.5)]" />
        <span className="text-[11px] font-medium text-white/80 truncate">
          {currentRoom}
        </span>
      </div>
    </div>
  );
}
