import { create } from "zustand";
import type { SceneGraph } from "@/types/scene";

/* ── Types for the 2D editor extraction data ─────────────────────────── */

export interface ExtractedDimension {
  value_mm: number;
  orientation: "horizontal" | "vertical";
  side: "top" | "bottom" | "left" | "right" | "interior";
  cx: number;
  cy: number;
  rel_x: number;
  rel_y: number;
}

export interface ExtractedRoomLabel {
  name: string;
  cx: number;
  cy: number;
  rel_x: number;
  rel_y: number;
  quadrant: string;
}

export interface ExtractionResult {
  dimensions: ExtractedDimension[];
  room_labels: ExtractedRoomLabel[];
  page_width: number;
  page_height: number;
  image_base64: string;
  image_mime: string;
  processing_time_ms: number;
  cu_time_ms?: number;
  inference_time_ms?: number;
  /** GPT-5 inferred layout from CU data + image */
  inferred_layout?: {
    rooms: {
      id: string;
      name: string;
      type: string;
      x_mm: number;
      y_mm: number;
      width_mm: number;
      height_mm: number;
      merge_group?: string;
    }[];
    doors: {
      id: string;
      x_mm: number;
      y_mm: number;
      width_mm: number;
      type: string;
      orientation?: string;
    }[];
    windows: {
      id: string;
      x_mm: number;
      y_mm: number;
      width_mm: number;
      orientation?: string;
    }[];
    overall_width_mm: number;
    overall_height_mm: number;
  };
}

/** A room rectangle in the 2D editor (mm coordinates) */
export interface EditorRoom {
  id: string;
  name: string;
  type: string;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  height_mm: number;
  merge_group?: string;
}

/** A door in the 2D editor (mm coordinates, on a wall edge) */
export interface EditorDoor {
  id: string;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  type: "hinged" | "sliding" | "main_entrance";
  /** 0 = horizontal (on top/bottom wall), 90 = vertical (on left/right wall) */
  rotation: number;
}

/** A window in the 2D editor (mm coordinates, on an exterior edge) */
export interface EditorWindow {
  id: string;
  x_mm: number;
  y_mm: number;
  width_mm: number;
  /** 0 = horizontal (on top/bottom wall), 90 = vertical (on left/right wall) */
  rotation: number;
}

/* ── Store ────────────────────────────────────────────────────────────── */

interface SceneState {
  // Flow stage: "upload" → "editor" → "viewer"
  stage: "upload" | "editor" | "viewer";

  // Extraction data (from CU)
  extraction: ExtractionResult | null;

  // 2D editor state
  editorRooms: EditorRoom[];
  editorDoors: EditorDoor[];
  editorWindows: EditorWindow[];
  selectedEditorItem: string | null;

  // 3D viewer state
  scene: SceneGraph | null;
  isProcessing: boolean;
  processingStep: string;
  selectedRoom: string | null;
  viewMode: "orbit" | "walkthrough" | "topdown";
  dayMode: "day" | "night";

  // Actions
  setExtraction: (data: ExtractionResult) => void;
  setEditorRooms: (rooms: EditorRoom[]) => void;
  setEditorDoors: (doors: EditorDoor[]) => void;
  setEditorWindows: (windows: EditorWindow[]) => void;
  updateEditorRoom: (id: string, updates: Partial<EditorRoom>) => void;
  removeEditorRoom: (id: string) => void;
  addEditorDoor: (door: EditorDoor) => void;
  updateEditorDoor: (id: string, updates: Partial<EditorDoor>) => void;
  removeEditorDoor: (id: string) => void;
  addEditorWindow: (win: EditorWindow) => void;
  updateEditorWindow: (id: string, updates: Partial<EditorWindow>) => void;
  removeEditorWindow: (id: string) => void;
  selectEditorItem: (id: string | null) => void;
  setStage: (stage: "upload" | "editor" | "viewer") => void;
  setScene: (scene: SceneGraph) => void;
  setProcessing: (processing: boolean, step?: string) => void;
  selectRoom: (roomId: string | null) => void;
  setViewMode: (mode: "orbit" | "walkthrough" | "topdown") => void;
  setDayMode: (mode: "day" | "night") => void;
  reset: () => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  stage: "upload",
  extraction: null,
  editorRooms: [],
  editorDoors: [],
  editorWindows: [],
  selectedEditorItem: null,
  scene: null,
  isProcessing: false,
  processingStep: "",
  selectedRoom: null,
  viewMode: "orbit",
  dayMode: "day",

  setExtraction: (extraction) =>
    set({ extraction, stage: "editor", isProcessing: false, processingStep: "" }),
  setEditorRooms: (editorRooms) => set({ editorRooms }),
  setEditorDoors: (editorDoors) => set({ editorDoors }),
  setEditorWindows: (editorWindows) => set({ editorWindows }),
  updateEditorRoom: (id, updates) =>
    set((s) => ({
      editorRooms: s.editorRooms.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    })),
  removeEditorRoom: (id) =>
    set((s) => ({ editorRooms: s.editorRooms.filter((r) => r.id !== id) })),
  addEditorDoor: (door) =>
    set((s) => ({ editorDoors: [...s.editorDoors, door] })),
  updateEditorDoor: (id, updates) =>
    set((s) => ({
      editorDoors: s.editorDoors.map((d) =>
        d.id === id ? { ...d, ...updates } : d
      ),
    })),
  removeEditorDoor: (id) =>
    set((s) => ({ editorDoors: s.editorDoors.filter((d) => d.id !== id) })),
  addEditorWindow: (win) =>
    set((s) => ({ editorWindows: [...s.editorWindows, win] })),
  updateEditorWindow: (id, updates) =>
    set((s) => ({
      editorWindows: s.editorWindows.map((w) =>
        w.id === id ? { ...w, ...updates } : w
      ),
    })),
  removeEditorWindow: (id) =>
    set((s) => ({ editorWindows: s.editorWindows.filter((w) => w.id !== id) })),
  selectEditorItem: (selectedEditorItem) => set({ selectedEditorItem }),
  setStage: (stage) => set({ stage }),
  setScene: (scene) =>
    set({ scene, stage: "viewer", isProcessing: false, processingStep: "" }),
  setProcessing: (isProcessing, processingStep = "") =>
    set({ isProcessing, processingStep }),
  selectRoom: (selectedRoom) => set({ selectedRoom }),
  setViewMode: (viewMode) => set({ viewMode }),
  setDayMode: (dayMode) => set({ dayMode }),
  reset: () =>
    set({
      stage: "upload",
      extraction: null,
      editorRooms: [],
      editorDoors: [],
      editorWindows: [],
      selectedEditorItem: null,
      scene: null,
      isProcessing: false,
      processingStep: "",
      selectedRoom: null,
      viewMode: "orbit",
      dayMode: "day",
    }),
}));
