"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Plus,
  Trash2,
  DoorOpen,
  SquareIcon,
  ArrowLeft,
  Image as ImageIcon,
  Maximize2,
  Save,
} from "lucide-react";
import { useSceneStore } from "@/store/scene-store";
import type {
  EditorRoom,
  EditorDoor,
  EditorWindow,
  ExtractionResult,
} from "@/store/scene-store";
import toast from "react-hot-toast";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/* ── Room type options ──────────────────────────────────────────────── */
const ROOM_TYPES = [
  "bedroom",
  "living",
  "kitchen",
  "bathroom",
  "wc",
  "dining",
  "corridor",
  "balcony",
  "yard",
  "storage",
];

const TYPE_COLORS: Record<string, string> = {
  bedroom: "#6366f1",
  living: "#f59e0b",
  kitchen: "#10b981",
  bathroom: "#3b82f6",
  wc: "#3b82f6",
  dining: "#f59e0b",
  corridor: "#9ca3af",
  balcony: "#84cc16",
  yard: "#a3e635",
  storage: "#78716c",
};

/* ── Helpers ────────────────────────────────────────────────────────── */
function inferRoomType(name: string): string {
  const n = name.toUpperCase();
  if (n.includes("BED")) return "bedroom";
  if (n.includes("LIVING") || n.includes("LOUNGE")) return "living";
  if (n.includes("KITCHEN")) return "kitchen";
  if (n.includes("BATH")) return "bathroom";
  if (n === "WC" || n === "W.C.") return "wc";
  if (n.includes("DINING")) return "dining";
  if (n.includes("CORR")) return "corridor";
  if (n.includes("BALCON")) return "balcony";
  if (n.includes("YARD")) return "yard";
  if (n.includes("STORE")) return "storage";
  return "living";
}

/* ── 2D Canvas Renderer ─────────────────────────────────────────────── */

type DragMode =
  | { type: "move-room"; id: string; startX: number; startY: number; origX: number; origY: number }
  | { type: "resize-room"; id: string; handle: string; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number }
  | { type: "move-door"; id: string; startX: number; startY: number; origX: number; origY: number }
  | { type: "move-window"; id: string; startX: number; startY: number; origX: number; origY: number }
  | { type: "pan"; startX: number; startY: number; origOx: number; origOy: number }
  | null;

const HANDLE_SIZE_PX = 8;
const SNAP_MM = 50;
const snap = (v: number) => Math.round(v / SNAP_MM) * SNAP_MM;

interface CanvasProps {
  rooms: EditorRoom[];
  doors: EditorDoor[];
  windows: EditorWindow[];
  selectedId: string | null;
  onSelectItem: (id: string | null) => void;
  onUpdateRoom: (id: string, u: Partial<EditorRoom>) => void;
  onUpdateDoor: (id: string, u: Partial<EditorDoor>) => void;
  onUpdateWindow: (id: string, u: Partial<EditorWindow>) => void;
  onRotateItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
}

function FloorPlanCanvas({
  rooms,
  doors,
  windows,
  selectedId,
  onSelectItem,
  onUpdateRoom,
  onUpdateDoor,
  onUpdateWindow,
  onRotateItem,
  onDeleteItem,
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 40, y: 40 });
  const [cursor, setCursor] = useState("default");
  const dragRef = useRef<DragMode>(null);

  const bounds = useCallback(() => {
    if (rooms.length === 0) return { minX: 0, minY: 0, maxX: 8000, maxY: 6000 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const r of rooms) {
      minX = Math.min(minX, r.x_mm);
      minY = Math.min(minY, r.y_mm);
      maxX = Math.max(maxX, r.x_mm + r.width_mm);
      maxY = Math.max(maxY, r.y_mm + r.height_mm);
    }
    return { minX, minY, maxX, maxY };
  }, [rooms]);

  const fitToView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { minX, minY, maxX, maxY } = bounds();
    const w = maxX - minX || 8000;
    const h = maxY - minY || 6000;
    const pad = 80;
    const sx = (el.clientWidth - pad * 2) / w;
    const sy = (el.clientHeight - pad * 2) / h;
    const s = Math.min(sx, sy, 0.15);
    setScale(s);
    setOffset({
      x: (el.clientWidth - w * s) / 2 - minX * s,
      y: (el.clientHeight - h * s) / 2 - minY * s,
    });
  }, [bounds]);

  useEffect(() => { fitToView(); }, [rooms.length, fitToView]);

  // Snap a point to the nearest room wall edge (for drag-and-drop)
  const snapItemToWall = useCallback(
    (px: number, py: number, roomList: EditorRoom[]): { x: number; y: number; rot: number } => {
      let bestDist = Infinity;
      let bestX = px;
      let bestY = py;
      let bestRot = 0;

      for (const r of roomList) {
        const rx1 = r.x_mm, rx2 = r.x_mm + r.width_mm;
        const ry1 = r.y_mm, ry2 = r.y_mm + r.height_mm;
        const margin = 500; // snap within 500mm of a wall

        // Top edge (horizontal)
        if (px >= rx1 && px <= rx2) {
          const d = Math.abs(py - ry1);
          if (d < bestDist && d < margin) {
            bestDist = d; bestX = px; bestY = ry1; bestRot = 0;
          }
        }
        // Bottom edge (horizontal)
        if (px >= rx1 && px <= rx2) {
          const d = Math.abs(py - ry2);
          if (d < bestDist && d < margin) {
            bestDist = d; bestX = px; bestY = ry2; bestRot = 0;
          }
        }
        // Left edge (vertical)
        if (py >= ry1 && py <= ry2) {
          const d = Math.abs(px - rx1);
          if (d < bestDist && d < margin) {
            bestDist = d; bestX = rx1; bestY = py; bestRot = 90;
          }
        }
        // Right edge (vertical)
        if (py >= ry1 && py <= ry2) {
          const d = Math.abs(px - rx2);
          if (d < bestDist && d < margin) {
            bestDist = d; bestX = rx2; bestY = py; bestRot = 90;
          }
        }
      }

      return { x: Math.round(bestX), y: Math.round(bestY), rot: bestRot };
    },
    []
  );

  const toCanvas = useCallback(
    (mm_x: number, mm_y: number) => ({
      x: mm_x * scale + offset.x,
      y: mm_y * scale + offset.y,
    }),
    [scale, offset]
  );

  const toMm = useCallback(
    (px_x: number, px_y: number) => ({
      x_mm: (px_x - offset.x) / scale,
      y_mm: (px_y - offset.y) / scale,
    }),
    [scale, offset]
  );

  // ── Drawing ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Grid
    ctx.strokeStyle = "#1E1E2E";
    ctx.lineWidth = 0.5;
    const gridMm = 1000;
    const { minX, minY, maxX, maxY } = bounds();
    for (let gx = Math.floor(minX / gridMm) * gridMm; gx <= maxX + gridMm; gx += gridMm) {
      const p = toCanvas(gx, 0);
      ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, rect.height); ctx.stroke();
    }
    for (let gy = Math.floor(minY / gridMm) * gridMm; gy <= maxY + gridMm; gy += gridMm) {
      const p = toCanvas(0, gy);
      ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(rect.width, p.y); ctx.stroke();
    }

    // Rooms
    for (const room of rooms) {
      const tl = toCanvas(room.x_mm, room.y_mm);
      const w = room.width_mm * scale;
      const h = room.height_mm * scale;
      const color = TYPE_COLORS[room.type] || "#6366f1";
      const isSel = room.id === selectedId;

      ctx.fillStyle = isSel ? color + "40" : color + "20";
      ctx.fillRect(tl.x, tl.y, w, h);
      ctx.strokeStyle = isSel ? color : color + "80";
      ctx.lineWidth = isSel ? 2.5 : 1.5;
      ctx.strokeRect(tl.x, tl.y, w, h);

      const fontSize = Math.max(10, Math.min(14, w / 8));
      ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = "#E0E0E0";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(room.name, tl.x + w / 2, tl.y + h / 2 - fontSize * 0.6);

      const dimFs = Math.max(8, fontSize * 0.75);
      ctx.font = `400 ${dimFs}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = "#A0A0A0";
      ctx.fillText(`${(room.width_mm / 1000).toFixed(1)}m × ${(room.height_mm / 1000).toFixed(1)}m`, tl.x + w / 2, tl.y + h / 2 + fontSize * 0.4);
      ctx.fillText(`${((room.width_mm * room.height_mm) / 1e6).toFixed(1)} m²`, tl.x + w / 2, tl.y + h / 2 + fontSize * 1.2);

      // Resize handles (when selected)
      if (isSel) {
        const hs = HANDLE_SIZE_PX;
        ctx.fillStyle = color;
        // corners
        for (const [hx, hy] of [[tl.x, tl.y], [tl.x + w, tl.y], [tl.x, tl.y + h], [tl.x + w, tl.y + h]]) {
          ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
        }
        // edge midpoints
        ctx.fillStyle = color + "80";
        for (const [hx, hy] of [[tl.x + w / 2, tl.y], [tl.x + w / 2, tl.y + h], [tl.x, tl.y + h / 2], [tl.x + w, tl.y + h / 2]]) {
          ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
        }
      }
    }

    // Doors
    for (const door of doors) {
      const p = toCanvas(door.x_mm, door.y_mm);
      const dw = door.width_mm * scale;
      const isSel = door.id === selectedId;
      const rot = door.rotation || 0;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((rot * Math.PI) / 180);

      ctx.fillStyle = isSel ? "#F59E0B" : "#F59E0B80";
      ctx.fillRect(-dw / 2, -3, dw, 6);

      ctx.strokeStyle = isSel ? "#F59E0B" : "#F59E0B60";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(-dw / 2, 0, dw, -Math.PI / 2, 0);
      ctx.stroke();

      if (dw > 20) {
        ctx.font = "500 9px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#F59E0B";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("D", 0, -5);
      }

      // Rotation indicator when selected
      if (isSel) {
        ctx.strokeStyle = "#F59E0B";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, dw / 2 + 8, 0, Math.PI * 0.6);
        ctx.stroke();
        // arrowhead
        const ax = (dw / 2 + 8) * Math.cos(Math.PI * 0.6);
        const ay = (dw / 2 + 8) * Math.sin(Math.PI * 0.6);
        ctx.fillStyle = "#F59E0B";
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - 5, ay - 3);
        ctx.lineTo(ax - 2, ay + 4);
        ctx.fill();
      }

      ctx.restore();
    }

    // Windows
    for (const win of windows) {
      const p = toCanvas(win.x_mm, win.y_mm);
      const ww = win.width_mm * scale;
      const isSel = win.id === selectedId;
      const rot = win.rotation || 0;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((rot * Math.PI) / 180);

      ctx.fillStyle = isSel ? "#38BDF8" : "#38BDF880";
      ctx.fillRect(-ww / 2, -2, ww, 4);

      ctx.strokeStyle = isSel ? "#38BDF8" : "#38BDF860";
      ctx.lineWidth = 0.8;
      for (let i = 0; i < ww; i += 6) {
        ctx.beginPath();
        ctx.moveTo(-ww / 2 + i, -4);
        ctx.lineTo(-ww / 2 + i + 3, 4);
        ctx.stroke();
      }

      if (ww > 20) {
        ctx.font = "500 9px Inter, system-ui, sans-serif";
        ctx.fillStyle = "#38BDF8";
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.fillText("W", 0, -5);
      }

      if (isSel) {
        ctx.strokeStyle = "#38BDF8";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, ww / 2 + 8, 0, Math.PI * 0.6);
        ctx.stroke();
      }

      ctx.restore();
    }
  }, [rooms, doors, windows, selectedId, scale, offset, toCanvas, bounds]);

  // ── Hit-testing with resize handles ──
  const hitTest = useCallback(
    (px_x: number, px_y: number): { id: string; handle?: string } | null => {
      const { x_mm, y_mm } = toMm(px_x, px_y);
      const hMm = HANDLE_SIZE_PX / scale / 2 + 100; // tolerance in mm

      // Check resize handles on selected room first
      const selRoom = rooms.find((r) => r.id === selectedId);
      if (selRoom) {
        const rx = selRoom.x_mm, ry = selRoom.y_mm;
        const rw = selRoom.width_mm, rh = selRoom.height_mm;
        const handles: [number, number, string][] = [
          [rx, ry, "nw"], [rx + rw, ry, "ne"], [rx, ry + rh, "sw"], [rx + rw, ry + rh, "se"],
          [rx + rw / 2, ry, "n"], [rx + rw / 2, ry + rh, "s"], [rx, ry + rh / 2, "w"], [rx + rw, ry + rh / 2, "e"],
        ];
        for (const [hx, hy, handle] of handles) {
          if (Math.abs(x_mm - hx) < hMm && Math.abs(y_mm - hy) < hMm) {
            return { id: selRoom.id, handle };
          }
        }
      }

      // Doors
      for (const d of doors) {
        const halfW = d.width_mm / 2;
        const tol = 300;
        if (Math.abs(x_mm - d.x_mm) < halfW + tol && Math.abs(y_mm - d.y_mm) < tol) {
          return { id: d.id };
        }
      }
      // Windows
      for (const w of windows) {
        const halfW = w.width_mm / 2;
        const tol = 300;
        if (Math.abs(x_mm - w.x_mm) < halfW + tol && Math.abs(y_mm - w.y_mm) < tol) {
          return { id: w.id };
        }
      }
      // Rooms (body)
      for (const r of rooms) {
        if (x_mm >= r.x_mm && x_mm <= r.x_mm + r.width_mm &&
            y_mm >= r.y_mm && y_mm <= r.y_mm + r.height_mm) {
          return { id: r.id };
        }
      }
      return null;
    },
    [rooms, doors, windows, toMm, selectedId, scale]
  );

  // ── Cursor based on hover ──
  const updateCursor = useCallback(
    (px_x: number, px_y: number) => {
      const hit = hitTest(px_x, px_y);
      if (!hit) { setCursor("default"); return; }
      if (hit.handle) {
        const cursorMap: Record<string, string> = {
          nw: "nw-resize", ne: "ne-resize", sw: "sw-resize", se: "se-resize",
          n: "n-resize", s: "s-resize", w: "w-resize", e: "e-resize",
        };
        setCursor(cursorMap[hit.handle] || "move");
      } else if (rooms.find((r) => r.id === hit.id)) {
        setCursor("move");
      } else {
        setCursor("grab");
      }
    },
    [hitTest, rooms]
  );

  // ── Mouse handlers ──
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px_x = e.clientX - rect.left;
      const px_y = e.clientY - rect.top;

      // Middle mouse or space+left = pan
      if (e.button === 1) {
        dragRef.current = { type: "pan", startX: px_x, startY: px_y, origOx: offset.x, origOy: offset.y };
        return;
      }

      const hit = hitTest(px_x, px_y);
      onSelectItem(hit?.id ?? null);

      if (!hit) {
        // Start panning on empty space
        dragRef.current = { type: "pan", startX: px_x, startY: px_y, origOx: offset.x, origOy: offset.y };
        return;
      }

      if (hit.handle) {
        const room = rooms.find((r) => r.id === hit.id)!;
        dragRef.current = {
          type: "resize-room", id: hit.id, handle: hit.handle,
          startX: px_x, startY: px_y,
          origX: room.x_mm, origY: room.y_mm, origW: room.width_mm, origH: room.height_mm,
        };
        return;
      }

      const room = rooms.find((r) => r.id === hit.id);
      if (room) {
        dragRef.current = { type: "move-room", id: hit.id, startX: px_x, startY: px_y, origX: room.x_mm, origY: room.y_mm };
        return;
      }

      const door = doors.find((d) => d.id === hit.id);
      if (door) {
        dragRef.current = { type: "move-door", id: hit.id, startX: px_x, startY: px_y, origX: door.x_mm, origY: door.y_mm };
        return;
      }

      const win = windows.find((w) => w.id === hit.id);
      if (win) {
        dragRef.current = { type: "move-window", id: hit.id, startX: px_x, startY: px_y, origX: win.x_mm, origY: win.y_mm };
      }
    },
    [hitTest, onSelectItem, rooms, doors, windows, offset]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const px_x = e.clientX - rect.left;
      const px_y = e.clientY - rect.top;

      if (!dragRef.current) {
        updateCursor(px_x, px_y);
        return;
      }

      const drag = dragRef.current;
      const dxPx = px_x - drag.startX;
      const dyPx = px_y - drag.startY;
      const dxMm = dxPx / scale;
      const dyMm = dyPx / scale;

      switch (drag.type) {
        case "pan":
          setOffset({ x: drag.origOx + dxPx, y: drag.origOy + dyPx });
          break;

        case "move-room":
          onUpdateRoom(drag.id, {
            x_mm: snap(drag.origX + dxMm),
            y_mm: snap(drag.origY + dyMm),
          });
          break;

        case "resize-room": {
          const h = drag.handle;
          let { origX: nx, origY: ny, origW: nw, origH: nh } = drag;

          if (h.includes("e")) nw = snap(drag.origW + dxMm);
          if (h.includes("s")) nh = snap(drag.origH + dyMm);
          if (h.includes("w")) { nx = snap(drag.origX + dxMm); nw = snap(drag.origW - dxMm); }
          if (h.includes("n")) { ny = snap(drag.origY + dyMm); nh = snap(drag.origH - dyMm); }

          if (nw < 200) nw = 200;
          if (nh < 200) nh = 200;

          onUpdateRoom(drag.id, { x_mm: nx, y_mm: ny, width_mm: nw, height_mm: nh });
          break;
        }

        case "move-door": {
          const rawX = snap(drag.origX + dxMm);
          const rawY = snap(drag.origY + dyMm);
          const snapped = snapItemToWall(rawX, rawY, rooms);
          onUpdateDoor(drag.id, { x_mm: snapped.x, y_mm: snapped.y, rotation: snapped.rot });
          break;
        }

        case "move-window": {
          const rawX = snap(drag.origX + dxMm);
          const rawY = snap(drag.origY + dyMm);
          const snapped = snapItemToWall(rawX, rawY, rooms);
          onUpdateWindow(drag.id, { x_mm: snapped.x, y_mm: snapped.y, rotation: snapped.rot });
          break;
        }
      }
    },
    [scale, onUpdateRoom, onUpdateDoor, onUpdateWindow, updateCursor]
  );

  const handleMouseUp = useCallback(() => { dragRef.current = null; }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.max(0.01, Math.min(0.5, scale * factor));
      setOffset({
        x: mx - (mx - offset.x) * (newScale / scale),
        y: my - (my - offset.y) * (newScale / scale),
      });
      setScale(newScale);
    },
    [scale, offset]
  );

  // Keyboard: R to rotate, Delete/Backspace to delete selected item
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!selectedId) return;
      if (e.key === "r" || e.key === "R") {
        onRotateItem(selectedId);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // Don't delete if user is typing in an input
        if ((e.target as HTMLElement)?.tagName === "INPUT" || (e.target as HTMLElement)?.tagName === "SELECT") return;
        e.preventDefault();
        onDeleteItem(selectedId);
        onSelectItem(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedId, onRotateItem, onDeleteItem, onSelectItem]);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        className="h-full w-full"
        style={{ cursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
      <div className="absolute top-3 right-3 flex gap-1">
        <button
          onClick={fitToView}
          className="rounded-lg bg-[var(--bg-card)] border border-[var(--border)] p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          title="Fit to view"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
      {selectedId && (doors.find(d => d.id === selectedId) || windows.find(w => w.id === selectedId)) && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg bg-[var(--bg-card)]/90 backdrop-blur border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
          Press <kbd className="mx-1 px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] font-mono">R</kbd> to rotate
          · <kbd className="mx-1 px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] font-mono">Del</kbd> to delete
        </div>
      )}
      {selectedId && rooms.find(r => r.id === selectedId) && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-lg bg-[var(--bg-card)]/90 backdrop-blur border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--text-secondary)]">
          Drag to move · Drag handles to resize
          · <kbd className="mx-1 px-1.5 py-0.5 rounded bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] font-mono">Del</kbd> to delete
        </div>
      )}
    </div>
  );
}

/* ── Property Panel (right sidebar) ─────────────────────────────────── */

function PropertyPanel({
  rooms,
  doors,
  windows,
  selectedId,
  onUpdateRoom,
  onRemoveRoom,
  onUpdateDoor,
  onRemoveDoor,
  onAddDoor,
  onUpdateWindow,
  onRemoveWindow,
  onAddWindow,
  onSelect,
  onRotateItem,
}: {
  rooms: EditorRoom[];
  doors: EditorDoor[];
  windows: EditorWindow[];
  selectedId: string | null;
  onUpdateRoom: (id: string, u: Partial<EditorRoom>) => void;
  onRemoveRoom: (id: string) => void;
  onUpdateDoor: (id: string, u: Partial<EditorDoor>) => void;
  onRemoveDoor: (id: string) => void;
  onAddDoor: () => void;
  onUpdateWindow: (id: string, u: Partial<EditorWindow>) => void;
  onRemoveWindow: (id: string) => void;
  onAddWindow: () => void;
  onSelect: (id: string | null) => void;
  onRotateItem: (id: string) => void;
}) {
  const selectedRoom = rooms.find((r) => r.id === selectedId);
  const selectedDoor = doors.find((d) => d.id === selectedId);
  const selectedWindow = windows.find((w) => w.id === selectedId);

  return (
    <div className="flex flex-col gap-4 overflow-y-auto p-4">
      {/* Room list */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
          Rooms ({rooms.length})
        </h3>
        <div className="flex flex-col gap-1">
          {rooms.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelect(r.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                r.id === selectedId
                  ? "bg-[var(--accent)]/20 text-[var(--accent)]"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"
              }`}
            >
              <div
                className="h-3 w-3 rounded-sm"
                style={{ backgroundColor: TYPE_COLORS[r.type] || "#6366f1" }}
              />
              <span className="flex-1 truncate">{r.name}</span>
              <span className="text-xs opacity-60">
                {((r.width_mm * r.height_mm) / 1e6).toFixed(1)}m²
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected room properties */}
      {selectedRoom && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Room Properties</h3>
            <button
              onClick={() => onRemoveRoom(selectedRoom.id)}
              className="text-red-400 hover:text-red-300"
              title="Remove room"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <label className="text-xs text-[var(--text-secondary)]">
              Name
              <input
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                value={selectedRoom.name}
                onChange={(e) =>
                  onUpdateRoom(selectedRoom.id, { name: e.target.value })
                }
              />
            </label>
            <label className="text-xs text-[var(--text-secondary)]">
              Type
              <select
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                value={selectedRoom.type}
                onChange={(e) =>
                  onUpdateRoom(selectedRoom.id, { type: e.target.value })
                }
              >
                {ROOM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-[var(--text-secondary)]">
                Width (mm)
                <input
                  type="number"
                  step={100}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                  value={selectedRoom.width_mm}
                  onChange={(e) =>
                    onUpdateRoom(selectedRoom.id, {
                      width_mm: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                Height (mm)
                <input
                  type="number"
                  step={100}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                  value={selectedRoom.height_mm}
                  onChange={(e) =>
                    onUpdateRoom(selectedRoom.id, {
                      height_mm: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-[var(--text-secondary)]">
                X (mm)
                <input
                  type="number"
                  step={100}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                  value={selectedRoom.x_mm}
                  onChange={(e) =>
                    onUpdateRoom(selectedRoom.id, {
                      x_mm: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="text-xs text-[var(--text-secondary)]">
                Y (mm)
                <input
                  type="number"
                  step={100}
                  className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                  value={selectedRoom.y_mm}
                  onChange={(e) =>
                    onUpdateRoom(selectedRoom.id, {
                      y_mm: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Selected door properties */}
      {selectedDoor && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Door Properties</h3>
            <button
              onClick={() => onRemoveDoor(selectedDoor.id)}
              className="text-red-400 hover:text-red-300"
              title="Remove door"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <label className="text-xs text-[var(--text-secondary)]">
              Type
              <select
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                value={selectedDoor.type}
                onChange={(e) =>
                  onUpdateDoor(selectedDoor.id, {
                    type: e.target.value as EditorDoor["type"],
                  })
                }
              >
                <option value="hinged">Hinged</option>
                <option value="sliding">Sliding</option>
                <option value="main_entrance">Main Entrance</option>
              </select>
            </label>
            <label className="text-xs text-[var(--text-secondary)]">
              Width (mm)
              <input
                type="number"
                step={50}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                value={selectedDoor.width_mm}
                onChange={(e) =>
                  onUpdateDoor(selectedDoor.id, {
                    width_mm: Number(e.target.value),
                  })
                }
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onRotateItem(selectedDoor.id)}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
              >
                Rotate 90°
              </button>
              <span className="text-xs text-[var(--text-secondary)] opacity-60">
                {selectedDoor.rotation || 0}°
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] italic">
              Drag to move · Press R to rotate
            </p>
          </div>
        </div>
      )}

      {/* Selected window properties */}
      {selectedWindow && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Window Properties</h3>
            <button
              onClick={() => onRemoveWindow(selectedWindow.id)}
              className="text-red-400 hover:text-red-300"
              title="Remove window"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <div className="flex flex-col gap-3">
            <label className="text-xs text-[var(--text-secondary)]">
              Width (mm)
              <input
                type="number"
                step={100}
                className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-sm text-[var(--text-primary)]"
                value={selectedWindow.width_mm}
                onChange={(e) =>
                  onUpdateWindow(selectedWindow.id, {
                    width_mm: Number(e.target.value),
                  })
                }
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onRotateItem(selectedWindow.id)}
                className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
              >
                Rotate 90°
              </button>
              <span className="text-xs text-[var(--text-secondary)] opacity-60">
                {selectedWindow.rotation || 0}°
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] italic">
              Drag to move · Press R to rotate
            </p>
          </div>
        </div>
      )}

      {/* Add door / window buttons */}
      <div className="flex flex-col gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
          Doors &amp; Windows
        </h3>
        <div className="flex gap-2">
          <button
            onClick={onAddDoor}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
          >
            <DoorOpen className="h-3.5 w-3.5" />
            Add Door
          </button>
          <button
            onClick={onAddWindow}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
          >
            <SquareIcon className="h-3.5 w-3.5" />
            Add Window
          </button>
        </div>
        {/* Door/window list */}
        <div className="flex flex-col gap-1">
          {doors.map((d) => (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${
                d.id === selectedId
                  ? "bg-amber-500/20 text-amber-400"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"
              }`}
            >
              <DoorOpen className="h-3 w-3" />
              <span>
                Door ({d.type}) — {d.width_mm}mm
              </span>
            </button>
          ))}
          {windows.map((w) => (
            <button
              key={w.id}
              onClick={() => onSelect(w.id)}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs transition-colors ${
                w.id === selectedId
                  ? "bg-sky-500/20 text-sky-400"
                  : "text-[var(--text-secondary)] hover:bg-[var(--bg-card)]"
              }`}
            >
              <SquareIcon className="h-3 w-3" />
              <span>Window — {w.width_mm}mm</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Main Editor Component ──────────────────────────────────────────── */

export function FloorPlanEditor() {
  const {
    extraction,
    editorRooms,
    editorDoors,
    editorWindows,
    selectedEditorItem,
    setEditorRooms,
    setEditorDoors,
    setEditorWindows,
    updateEditorRoom,
    removeEditorRoom,
    addEditorDoor,
    updateEditorDoor,
    removeEditorDoor,
    addEditorWindow,
    updateEditorWindow,
    removeEditorWindow,
    selectEditorItem,
    setScene,
    setStage,
    setProcessing,
    reset,
  } = useSceneStore();

  const [showRefImage, setShowRefImage] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize editor from GPT-5 inferred layout (or fallback to naive heuristic)
  useEffect(() => {
    if (!extraction || editorRooms.length > 0) return;

    const layout = extraction.inferred_layout;

    // If GPT-5 inferred layout is available, use it directly
    if (layout && layout.rooms && layout.rooms.length > 0) {
      const rooms: EditorRoom[] = layout.rooms.map((r, i) => ({
        id: r.id || `room_${i + 1}`,
        name: r.name,
        type: r.type || inferRoomType(r.name),
        x_mm: r.x_mm,
        y_mm: r.y_mm,
        width_mm: r.width_mm,
        height_mm: r.height_mm,
        ...(r.merge_group ? { merge_group: r.merge_group } : {}),
      }));

      setEditorRooms(rooms);

      // Snap a door/window position to the nearest room wall edge
      // Also ensures it doesn't sit at a wall intersection (corner)
      const snapToWall = (
        px: number,
        py: number,
        orientation?: string,
        itemWidth: number = 900,
      ): { x_mm: number; y_mm: number; rotation: number } => {
        let bestDist = Infinity;
        let bestX = px;
        let bestY = py;
        let bestRot = 0;
        let bestWallStart = 0;
        let bestWallEnd = 0;
        let bestIsHorizontal = true;

        for (const r of rooms) {
          const rx1 = r.x_mm;
          const rx2 = r.x_mm + r.width_mm;
          const ry1 = r.y_mm;
          const ry2 = r.y_mm + r.height_mm;

          // Top edge
          if (px >= rx1 - 100 && px <= rx2 + 100) {
            const d = Math.abs(py - ry1);
            if (d < bestDist) {
              bestDist = d; bestX = px; bestY = ry1; bestRot = 0;
              bestWallStart = rx1; bestWallEnd = rx2; bestIsHorizontal = true;
            }
          }
          // Bottom edge
          if (px >= rx1 - 100 && px <= rx2 + 100) {
            const d = Math.abs(py - ry2);
            if (d < bestDist) {
              bestDist = d; bestX = px; bestY = ry2; bestRot = 0;
              bestWallStart = rx1; bestWallEnd = rx2; bestIsHorizontal = true;
            }
          }
          // Left edge
          if (py >= ry1 - 100 && py <= ry2 + 100) {
            const d = Math.abs(px - rx1);
            if (d < bestDist) {
              bestDist = d; bestX = rx1; bestY = py; bestRot = 90;
              bestWallStart = ry1; bestWallEnd = ry2; bestIsHorizontal = false;
            }
          }
          // Right edge
          if (py >= ry1 - 100 && py <= ry2 + 100) {
            const d = Math.abs(px - rx2);
            if (d < bestDist) {
              bestDist = d; bestX = rx2; bestY = py; bestRot = 90;
              bestWallStart = ry1; bestWallEnd = ry2; bestIsHorizontal = false;
            }
          }
        }

        // Use GPT-5 orientation if provided
        if (orientation === "vertical") bestRot = 90;
        else if (orientation === "horizontal") bestRot = 0;

        // Clamp position within wall span, keeping door away from corners
        // A door shouldn't be within half its width of any perpendicular wall
        const halfW = itemWidth / 2;
        const margin = halfW + 100; // keep 100mm from corners

        if (bestIsHorizontal) {
          // Horizontal wall: clamp X within [wallStart+margin, wallEnd-margin]
          bestX = Math.max(bestWallStart + margin, Math.min(bestWallEnd - margin, bestX));

          // Check if door position is near any perpendicular (vertical) wall
          for (const r of rooms) {
            const vWalls = [r.x_mm, r.x_mm + r.width_mm];
            for (const vx of vWalls) {
              if (Math.abs(bestX - vx) < margin) {
                // Push away from this vertical wall
                bestX = bestX < vx ? vx - margin : vx + margin;
              }
            }
          }
          bestX = Math.max(bestWallStart + margin, Math.min(bestWallEnd - margin, bestX));
        } else {
          // Vertical wall: clamp Y within [wallStart+margin, wallEnd-margin]
          bestY = Math.max(bestWallStart + margin, Math.min(bestWallEnd - margin, bestY));

          // Check if door position is near any perpendicular (horizontal) wall
          for (const r of rooms) {
            const hWalls = [r.y_mm, r.y_mm + r.height_mm];
            for (const hy of hWalls) {
              if (Math.abs(bestY - hy) < margin) {
                bestY = bestY < hy ? hy - margin : hy + margin;
              }
            }
          }
          bestY = Math.max(bestWallStart + margin, Math.min(bestWallEnd - margin, bestY));
        }

        return { x_mm: Math.round(bestX), y_mm: Math.round(bestY), rotation: bestRot };
      };

      // Set doors from inference — snap each to nearest wall
      if (layout.doors && layout.doors.length > 0) {
        const doors: EditorDoor[] = layout.doors.map((d, i) => {
          const snapped = snapToWall(d.x_mm, d.y_mm, (d as any).orientation, d.width_mm || 900);
          return {
            id: d.id || `door_${i + 1}`,
            x_mm: snapped.x_mm,
            y_mm: snapped.y_mm,
            width_mm: d.width_mm || 900,
            type: (d.type as EditorDoor["type"]) || "hinged",
            rotation: snapped.rotation,
          };
        });
        setEditorDoors(doors);
      }

      // Set windows from inference — snap each to nearest wall
      if (layout.windows && layout.windows.length > 0) {
        const wins: EditorWindow[] = layout.windows.map((w, i) => {
          const snapped = snapToWall(w.x_mm, w.y_mm, (w as any).orientation, w.width_mm || 1200);
          return {
            id: w.id || `win_${i + 1}`,
            x_mm: snapped.x_mm,
            y_mm: snapped.y_mm,
            width_mm: w.width_mm || 1200,
            rotation: snapped.rotation,
          };
        });
        setEditorWindows(wins);
      }

      return;
    }

    // Fallback: naive heuristic from CU data only (no GPT-5)
    const rooms: EditorRoom[] = [];
    const labels = extraction.room_labels;
    const dims = extraction.dimensions;

    const hDims = dims.filter((d) => d.orientation === "horizontal");
    const vDims = dims.filter((d) => d.orientation === "vertical");

    const topDims = hDims.filter((d) => d.side === "top");
    const bottomDims = hDims.filter((d) => d.side === "bottom");

    const totalW =
      bottomDims.reduce((s, d) => s + d.value_mm, 0) ||
      topDims.reduce((s, d) => s + d.value_mm, 0) ||
      Math.max(...hDims.map((d) => d.value_mm), 8000);

    const totalH =
      Math.max(...vDims.map((d) => d.value_mm), 0) || 6000;

    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const type = inferRoomType(label.name);
      let width_mm = totalW / 2;
      let height_mm = totalH / 2;

      const closeH = hDims
        .map((d) => ({ ...d, dist: Math.abs(d.rel_y - label.rel_y) }))
        .sort((a, b) => a.dist - b.dist);
      if (closeH.length > 0 && closeH[0].dist < 0.3) {
        width_mm = closeH[0].value_mm;
      }

      const closeV = vDims
        .map((d) => ({
          ...d,
          dist:
            Math.abs(d.rel_x - label.rel_x) +
            Math.abs(d.rel_y - label.rel_y),
        }))
        .sort((a, b) => a.dist - b.dist);
      if (closeV.length > 0 && closeV[0].dist < 0.5) {
        height_mm = closeV[0].value_mm;
      }

      if (width_mm >= totalW * 0.9) width_mm = totalW / 2;
      if (height_mm >= totalH * 0.9) height_mm = totalH / 2;

      const x_mm = label.rel_x * totalW - width_mm / 2;
      const y_mm = label.rel_y * totalH - height_mm / 2;

      rooms.push({
        id: `room_${i + 1}`,
        name: label.name,
        type,
        x_mm: Math.max(0, Math.round(x_mm / 50) * 50),
        y_mm: Math.max(0, Math.round(y_mm / 50) * 50),
        width_mm: Math.round(width_mm / 50) * 50,
        height_mm: Math.round(height_mm / 50) * 50,
      });
    }

    setEditorRooms(rooms);
  }, [extraction, editorRooms.length, setEditorRooms, setEditorDoors, setEditorWindows]);

  // Rotate a door or window by 90 degrees
  const handleRotateItem = useCallback(
    (id: string) => {
      const door = editorDoors.find((d) => d.id === id);
      if (door) {
        updateEditorDoor(id, { rotation: ((door.rotation || 0) + 90) % 360 });
        return;
      }
      const win = editorWindows.find((w) => w.id === id);
      if (win) {
        updateEditorWindow(id, { rotation: ((win.rotation || 0) + 90) % 360 });
      }
    },
    [editorDoors, editorWindows, updateEditorDoor, updateEditorWindow]
  );

  // Delete any selected item (room, door, or window)
  const handleDeleteItem = useCallback(
    (id: string) => {
      if (editorRooms.find((r) => r.id === id)) {
        removeEditorRoom(id);
      } else if (editorDoors.find((d) => d.id === id)) {
        removeEditorDoor(id);
      } else if (editorWindows.find((w) => w.id === id)) {
        removeEditorWindow(id);
      }
    },
    [editorRooms, editorDoors, editorWindows, removeEditorRoom, removeEditorDoor, removeEditorWindow]
  );

  // Add door at center of layout
  const handleAddDoor = useCallback(() => {
    if (editorRooms.length === 0) return;
    const centerX =
      editorRooms.reduce((s, r) => s + r.x_mm + r.width_mm / 2, 0) /
      editorRooms.length;
    const centerY =
      editorRooms.reduce((s, r) => s + r.y_mm + r.height_mm / 2, 0) /
      editorRooms.length;

    const door: EditorDoor = {
      id: `door_${Date.now()}`,
      x_mm: Math.round(centerX / 50) * 50,
      y_mm: Math.round(centerY / 50) * 50,
      width_mm: 900,
      type: "hinged",
      rotation: 0,
    };
    addEditorDoor(door);
    selectEditorItem(door.id);
    toast.success("Door added — drag to position");
  }, [editorRooms, addEditorDoor, selectEditorItem]);

  // Add window at exterior
  const handleAddWindow = useCallback(() => {
    if (editorRooms.length === 0) return;
    const maxX = Math.max(...editorRooms.map((r) => r.x_mm + r.width_mm));
    const centerY =
      editorRooms.reduce((s, r) => s + r.y_mm + r.height_mm / 2, 0) /
      editorRooms.length;

    const win: EditorWindow = {
      id: `win_${Date.now()}`,
      x_mm: maxX,
      y_mm: Math.round(centerY / 50) * 50,
      width_mm: 1200,
      rotation: 0,
    };
    addEditorWindow(win);
    selectEditorItem(win.id);
    toast.success("Window added — drag to position");
  }, [editorRooms, addEditorWindow, selectEditorItem]);

  // Save the refined layout so subsequent uploads start from this state
  const handleSave = useCallback(async () => {
    if (editorRooms.length === 0) {
      toast.error("Nothing to save");
      return;
    }
    setIsSaving(true);
    try {
      const overallW = Math.max(
        ...editorRooms.map((r) => r.x_mm + r.width_mm)
      );
      const overallH = Math.max(
        ...editorRooms.map((r) => r.y_mm + r.height_mm)
      );
      const body = {
        rooms: editorRooms.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          x_mm: r.x_mm,
          y_mm: r.y_mm,
          width_mm: r.width_mm,
          height_mm: r.height_mm,
          ...(r.merge_group ? { merge_group: r.merge_group } : {}),
        })),
        doors: editorDoors.map((d) => ({
          id: d.id,
          x_mm: d.x_mm,
          y_mm: d.y_mm,
          width_mm: d.width_mm,
          type: d.type,
          orientation: d.rotation === 90 ? "vertical" : "horizontal",
        })),
        windows: editorWindows.map((w) => ({
          id: w.id,
          x_mm: w.x_mm,
          y_mm: w.y_mm,
          width_mm: w.width_mm,
          orientation: w.rotation === 90 ? "vertical" : "horizontal",
        })),
        overall_width_mm: overallW,
        overall_height_mm: overallH,
      };
      const res = await fetch(`${API_URL}/api/save-layout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Save failed");
      toast.success("Layout saved — next upload will use this");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }, [editorRooms, editorDoors, editorWindows]);

  // Generate 3D from confirmed layout
  const handleGenerate = useCallback(async () => {
    if (editorRooms.length === 0) {
      toast.error("Add at least one room");
      return;
    }

    setIsGenerating(true);
    setProcessing(true, "Generating 3D model...");

    try {
      const overallW = Math.max(
        ...editorRooms.map((r) => r.x_mm + r.width_mm)
      );
      const overallH = Math.max(
        ...editorRooms.map((r) => r.y_mm + r.height_mm)
      );

      const body = {
        rooms: editorRooms.map((r) => ({
          name: r.name,
          type: r.type,
          x_mm: r.x_mm,
          y_mm: r.y_mm,
          width_mm: r.width_mm,
          height_mm: r.height_mm,
          ...(r.merge_group ? { merge_group: r.merge_group } : {}),
        })),
        doors: editorDoors.map((d) => ({
          x_mm: d.x_mm,
          y_mm: d.y_mm,
          width_mm: d.width_mm,
          type: d.type,
        })),
        windows: editorWindows.map((w) => ({
          x_mm: w.x_mm,
          y_mm: w.y_mm,
          width_mm: w.width_mm,
        })),
        overall_width_mm: overallW,
        overall_height_mm: overallH,
        source_file: extraction?.image_mime === "image/png" ? "upload.png" : "upload.jpg",
      };

      const res = await fetch(`${API_URL}/api/generate-3d`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Server error" }));
        throw new Error(err.detail || "Generation failed");
      }

      const data = await res.json();
      setScene(data.scene);
      toast.success(
        `3D model generated — ${data.total_area_sqm} m²`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
      setProcessing(false);
    } finally {
      setIsGenerating(false);
    }
  }, [
    editorRooms,
    editorDoors,
    editorWindows,
    extraction,
    setScene,
    setProcessing,
  ]);

  if (!extraction) return null;

  return (
    <div className="flex h-full w-full">
      {/* Left: Reference image */}
      {showRefImage && (
        <div className="flex w-[320px] flex-shrink-0 flex-col border-r border-[var(--border)] bg-[var(--bg-secondary)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-[var(--text-secondary)]" />
              <span className="text-sm font-medium">Reference</span>
            </div>
            <button
              onClick={() => setShowRefImage(false)}
              className="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Hide
            </button>
          </div>
          <div className="flex-1 overflow-auto p-3">
            <img
              src={`data:${extraction.image_mime};base64,${extraction.image_base64}`}
              alt="Uploaded floor plan"
              className="w-full rounded-lg border border-[var(--border)]"
            />
            <div className="mt-3 text-xs text-[var(--text-secondary)] space-y-1">
              <p>
                <strong>Dimensions found:</strong> {extraction.dimensions.length}
              </p>
              <p>
                <strong>Room labels:</strong>{" "}
                {extraction.room_labels.map((r) => r.name).join(", ")}
              </p>
              <p>
                <strong>Page:</strong> {extraction.page_width} × {extraction.page_height} px
              </p>
              {extraction.inferred_layout && (
                <>
                  <hr className="border-[var(--border)] my-2" />
                  <p className="text-[var(--accent)]">
                    <strong>GPT-5 inferred:</strong>{" "}
                    {(() => {
                      const bedrooms = extraction.inferred_layout.rooms.filter((r: { type: string }) => r.type === "bedroom").length;
                      return `${bedrooms + 1}-room flat (${bedrooms} bedrooms)`;
                    })()}
                  </p>
                  <p>
                    <strong>Overall:</strong>{" "}
                    {extraction.inferred_layout.overall_width_mm} ×{" "}
                    {extraction.inferred_layout.overall_height_mm} mm
                  </p>
                </>
              )}
              {extraction.cu_time_ms && (
                <p className="mt-1 opacity-60">
                  CU: {(extraction.cu_time_ms / 1000).toFixed(1)}s |
                  GPT-5: {((extraction.inference_time_ms || 0) / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Center: 2D Canvas */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-2">
          <div className="flex items-center gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            {!showRefImage && (
              <button
                onClick={() => setShowRefImage(true)}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--accent)] transition-colors"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Show Reference
              </button>
            )}
            <span className="text-xs text-[var(--text-secondary)]">
              {(() => {
                const bedrooms = editorRooms.filter((r) => r.type === "bedroom").length;
                return `${bedrooms + 1}-room flat (${bedrooms} bedrooms)`;
              })()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving || editorRooms.length === 0}
              className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-2 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 transition-all"
              title="Save this refined layout — next upload will start from here"
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save
                </>
              )}
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || editorRooms.length === 0}
              className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-[var(--accent)]/25 hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {isGenerating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Generating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Generate 3D
                </>
              )}
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 bg-[#0D0D14]">
          <FloorPlanCanvas
            rooms={editorRooms}
            doors={editorDoors}
            windows={editorWindows}
            selectedId={selectedEditorItem}
            onSelectItem={selectEditorItem}
            onUpdateRoom={updateEditorRoom}
            onUpdateDoor={updateEditorDoor}
            onUpdateWindow={updateEditorWindow}
            onRotateItem={handleRotateItem}
            onDeleteItem={handleDeleteItem}
          />
        </div>
      </div>

      {/* Right: Property panel */}
      <div className="w-[280px] flex-shrink-0 border-l border-[var(--border)] bg-[var(--bg-secondary)] overflow-y-auto">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <span className="text-sm font-semibold">Properties</span>
        </div>
        <PropertyPanel
          rooms={editorRooms}
          doors={editorDoors}
          windows={editorWindows}
          selectedId={selectedEditorItem}
          onUpdateRoom={updateEditorRoom}
          onRemoveRoom={removeEditorRoom}
          onUpdateDoor={updateEditorDoor}
          onRemoveDoor={removeEditorDoor}
          onAddDoor={handleAddDoor}
          onUpdateWindow={updateEditorWindow}
          onRemoveWindow={removeEditorWindow}
          onAddWindow={handleAddWindow}
          onSelect={selectEditorItem}
          onRotateItem={handleRotateItem}
        />
      </div>
    </div>
  );
}
