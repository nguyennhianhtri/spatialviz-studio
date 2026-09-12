import { create } from "zustand";
import { useDesignStore } from "./design-store";
import { catalog, furnishRoom } from "../lib/interior-design";
import { carryLayoutInteriors } from "../lib/layout-interiors";
import { parseProject, serializeProject } from "../components/studio/project";
import { SAMPLE_SCENE } from "../components/studio/sample-fixture";
import { sampleLayout } from "../components/studio/sample";
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
  warnings?: string[];
  source_hash?: string;
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

type LayoutSnapshot = {editorRooms: EditorRoom[]; editorDoors: EditorDoor[]; editorWindows: EditorWindow[]};
interface SceneState {
  past: LayoutSnapshot[];
  future: LayoutSnapshot[];
  undo: () => void;
  redo: () => void;
  projectName: string;
  sourceKind: "upload" | "sample";
  sceneDirty: boolean;
  stylePreset: "warm" | "soft" | "mono";
  showFurniture: boolean;
  cutaway: boolean;
  showLabels: boolean;
  setAppearance: (updates: Partial<Pick<SceneState, "stylePreset" | "showFurniture" | "cutaway" | "showLabels">>) => void;
  setProjectName: (name: string) => void;
  exportProject: () => string;
  importProject: (text: string) => void;
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
  loadSample: () => void;
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
  setScene: (scene: SceneGraph) => string | null;
  setProcessing: (processing: boolean, step?: string) => void;
  selectRoom: (roomId: string | null) => void;
  setViewMode: (mode: "orbit" | "walkthrough" | "topdown") => void;
  setDayMode: (mode: "day" | "night") => void;
  reset: () => void;
}

const initial = () => ({
  stage: "upload" as const, projectName: "Untitled space", sourceKind: "upload" as const,
  extraction: null, editorRooms: [], editorDoors: [], editorWindows: [], selectedEditorItem: null,
  scene: null, sceneDirty: false, isProcessing: false, processingStep: "", selectedRoom: null,
  viewMode: "orbit" as const, dayMode: "day" as const, stylePreset: "warm" as const,
  showFurniture: true, cutaway: true, showLabels: false, past: [], future: [],
});
const snapshot = (s: SceneState): LayoutSnapshot => ({editorRooms:s.editorRooms, editorDoors:s.editorDoors, editorWindows:s.editorWindows});
export const useSceneStore = create<SceneState>((set, get) => {
  const edit = (updates: Partial<LayoutSnapshot>) => set(s => ({...updates, past:[...s.past.slice(-49), snapshot(s)], future:[], sceneDirty:true}));
  return {
    ...initial(),
    setAppearance: updates => set(updates),
    setProjectName: projectName => set({projectName}),
    exportProject: () => serializeProject(get()),
    importProject: text => {const project = parseProject(text); set({...initial(), ...project});},
    undo: () => {const s = get(); if (!s.past.length) return; set({...s.past[s.past.length-1], past:s.past.slice(0,-1), future:[snapshot(s),...s.future], sceneDirty:true, selectedEditorItem:null});},
    redo: () => {const s = get(); if (!s.future.length) return; set({...s.future[0], future:s.future.slice(1), past:[...s.past,snapshot(s)], sceneDirty:true, selectedEditorItem:null});},
    loadSample: () => set({...initial(), ...sampleLayout(), scene:structuredClone(SAMPLE_SCENE), stage:'viewer', projectName:'The courtyard apartment', sourceKind:'sample'}),
    setExtraction: extraction => {
      const layout = extraction.inferred_layout;
      set({extraction, stage:'editor', isProcessing:false, processingStep:'', sourceKind:'upload', scene:null, sceneDirty:true, past:[], future:[], selectedRoom:null, selectedEditorItem:null,
        editorRooms:layout?.rooms ?? [],
        editorDoors:(layout?.doors ?? []).map(d=>({id:d.id,x_mm:d.x_mm,y_mm:d.y_mm,width_mm:d.width_mm,type:['hinged','sliding','main_entrance'].includes(d.type)?d.type as EditorDoor['type']:'hinged',rotation:d.orientation === 'vertical'?90:0})),
        editorWindows:(layout?.windows ?? []).map(w=>({id:w.id,x_mm:w.x_mm,y_mm:w.y_mm,width_mm:w.width_mm,rotation:w.orientation === 'vertical'?90:0})),
      });
    },
    setEditorRooms: editorRooms => edit({editorRooms}),
    setEditorDoors: editorDoors => edit({editorDoors}),
    setEditorWindows: editorWindows => edit({editorWindows}),
    updateEditorRoom: (id, updates) => edit({editorRooms:get().editorRooms.map(r => r.id === id ? {...r,...updates} : r)}),
    removeEditorRoom: id => edit({editorRooms:get().editorRooms.filter(r=>r.id !== id)}),
    addEditorDoor: door => edit({editorDoors:[...get().editorDoors,door]}),
    updateEditorDoor: (id, updates) => edit({editorDoors:get().editorDoors.map(d=>d.id === id ? {...d,...updates} : d)}),
    removeEditorDoor: id => edit({editorDoors:get().editorDoors.filter(d=>d.id !== id)}),
    addEditorWindow: win => edit({editorWindows:[...get().editorWindows,win]}),
    updateEditorWindow: (id, updates) => edit({editorWindows:get().editorWindows.map(w=>w.id === id ? {...w,...updates} : w)}),
    removeEditorWindow: id => edit({editorWindows:get().editorWindows.filter(w=>w.id !== id)}),
    selectEditorItem: selectedEditorItem => set({selectedEditorItem}),
    setStage: stage => set({stage}),
    setScene: scene => {
      const previous=get().scene;
      if(previous){
        useDesignStore.getState().initialize(previous);
        const design=useDesignStore.getState();
        const {items,finishes,conflicts}=carryLayoutInteriors(design,previous,scene);
        if(conflicts.length){
          const names=conflicts.slice(0,5).map(item=>`${previous.rooms.find(r=>r.id===item.roomId)?.label||item.roomId}: ${catalog.find(c=>c.kind===item.kind)?.name||item.kind}`);
          return `Your furnishings are safe. These pieces no longer fit the corrected rooms: ${names.join('; ')}${conflicts.length>5?`; and ${conflicts.length-5} more`:''}. Adjust the plan, or return to your previous 3D design to move or remove them, then retry.`;
        }
        if(!design.load({items,finishes},scene))return 'Your furnishings are safe. Could not apply this layout; the previous 3D design is unchanged.';
      }else{
        // New extraction/editor-only project: no continuity with the last design.
        useDesignStore.getState().load({items:scene.rooms.flatMap(r=>furnishRoom(r,scene.doors)),finishes:{}},scene);
      }
      set({scene, stage:"viewer", sceneDirty:false, isProcessing:false, processingStep:""});
      return null;
    },
    setProcessing: (isProcessing, processingStep="") => set({isProcessing,processingStep}),
    selectRoom: selectedRoom => set({selectedRoom}),
    setViewMode: viewMode => set({viewMode}),
    setDayMode: dayMode => set({dayMode}),
    reset: () => set(initial()),
  };
});
