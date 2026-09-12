import type { EditorRoom, EditorDoor, EditorWindow, ExtractionResult } from '../../store/scene-store';
import type { SceneGraph } from '../../types/scene';
export interface ProjectData {
  version: 1;
  projectName: string;
  sourceKind: 'upload' | 'sample';
  stage: 'upload' | 'editor' | 'viewer';
  extraction: ExtractionResult | null;
  editorRooms: EditorRoom[];
  editorDoors: EditorDoor[];
  editorWindows: EditorWindow[];
  scene: SceneGraph | null;
  sceneDirty: boolean;
  stylePreset: 'warm' | 'soft' | 'mono';
  showFurniture: boolean;
  cutaway: boolean;
  showLabels: boolean;
}
export function serializeProject(data: Omit<ProjectData, 'version'>): string {
  const {projectName, sourceKind, stage, extraction, editorRooms, editorDoors, editorWindows, scene, sceneDirty, stylePreset, showFurniture, cutaway, showLabels} = data;
  return JSON.stringify({version:1, projectName, sourceKind, stage, extraction, editorRooms, editorDoors, editorWindows, scene, sceneDirty, stylePreset, showFurniture, cutaway, showLabels});
}
export function parseProject(text: string): ProjectData {
  if (text.length > 30 * 1024 * 1024) throw new Error('Project is too large (30 MB maximum).');
  const data = JSON.parse(text);
  const fail = () => { throw new Error('This is not a valid SpatialViz project (version 1).'); };
  const num = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1000000;
  if (!data || data.version !== 1 || typeof data.projectName !== 'string' || !['upload','sample'].includes(data.sourceKind)) fail();
  if (!['upload','editor','viewer'].includes(data.stage)) fail();
  for (const key of ['editorRooms','editorDoors','editorWindows']) {
    const items = data[key];
    if (!Array.isArray(items) || items.length > 500) fail();
    const ids = new Set();
    for (const item of items) {
      if (!item || typeof item.id !== 'string' || ids.has(item.id) || !num(item.x_mm) || !num(item.y_mm) || !num(item.width_mm) || item.width_mm <= 0) fail();
      ids.add(item.id);
      if (key === 'editorRooms' && (typeof item.name !== 'string' || typeof item.type !== 'string' || !num(item.height_mm) || item.height_mm <= 0)) fail();
      if (key !== 'editorRooms' && !num(item.rotation)) fail();
    }
  }
  if (data.extraction && (typeof data.extraction.image_base64 !== 'string' || !['image/png','image/jpeg','image/webp'].includes(data.extraction.image_mime))) fail();
  if (data.scene) {
    const s = data.scene;
    if (!s.metadata || !num(s.metadata.floor_height_m) || !num(s.metadata.total_area_sqm)) fail();
    for (const key of ['rooms','walls','doors','windows','furniture']) if (!Array.isArray(s[key]) || s[key].length > 5000) fail();
    for (const r of s.rooms) if (!r || typeof r.id !== 'string' || typeof r.label !== 'string' || typeof r.type !== 'string' || !num(r.area_sqm) || !Array.isArray(r.polygon) || r.polygon.length < 3 || r.polygon.length > 500 || r.polygon.some((p: unknown[]) => !Array.isArray(p) || p.length !== 2 || !p.every(num))) fail();
    for (const d of [...s.doors,...s.windows]) if (!Array.isArray(d.position) || d.position.length !== 2 || !d.position.every(num) || !num(d.width_m) || d.width_m <= 0) fail();
  }
  if (data.stage === 'viewer' && !data.scene) fail();
  return JSON.parse(serializeProject({ ...data, stylePreset: ['warm','soft','mono'].includes(data.stylePreset) ? data.stylePreset : 'warm', showFurniture: data.showFurniture !== false, cutaway: data.cutaway !== false, showLabels: data.showLabels !== false, sceneDirty: !!data.sceneDirty }));
}
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export function validateFloorPlanFile(file: { name: string; type: string; size: number }): string | null {
  if (!file.size) return 'This file is empty. Choose a floor plan with content.';
  if (file.size > MAX_FILE_BYTES) return 'Choose a file smaller than 20 MB.';
  if (file.type === 'application/pdf') return 'Export the PDF floor plan as a PNG or JPG first.';
  if (!['image/png', 'image/jpeg'].includes(file.type)) return 'Use a PNG or JPG floor plan.';
  return null;
}
