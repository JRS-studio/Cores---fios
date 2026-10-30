import type { NailSpot } from './types';

export type DemoPhoto = { uri: string; nails: NailSpot[] };

// A página de teste (versão web) pode injetar uma foto real de demonstração, com as unhas
// já marcadas, em `globalThis.__CORES_DEMO_PHOTO__`. Sem ela, o app usa a mão ilustrada.
export function getDemoPhoto(): DemoPhoto | null {
  return (globalThis as { __CORES_DEMO_PHOTO__?: DemoPhoto }).__CORES_DEMO_PHOTO__ ?? null;
}
