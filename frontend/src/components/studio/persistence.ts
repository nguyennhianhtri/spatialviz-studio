export const PROJECT_STORAGE_KEY = 'spatialviz.studio.project.v1';
type ProjectStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function readLocalProject(storage: ProjectStorage): string | null { return storage.getItem(PROJECT_STORAGE_KEY); }
/** Deliberately let quota/access failures reach the UI; never claim a save succeeded. */
export function writeLocalProject(storage: ProjectStorage, project: string): void { storage.setItem(PROJECT_STORAGE_KEY, project); }
