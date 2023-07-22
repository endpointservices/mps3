export interface Manifest {
  version: number;
}

export const isManifest = (obj: any): obj is Manifest => {
    return obj.version !== undefined && typeof obj.version === 'number';
}
