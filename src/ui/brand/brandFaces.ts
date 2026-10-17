// The brand "faces" are the logo specimens the motion engine animates. Their geometry lives in the
// approved Design prototype as an asset (`Design/assets/brand-faces.json`), served at
// `/assets/brand-faces.json` in development and emitted into the build, so the lab fetches it rather
// than bundling the coordinate data into the application source.

interface BrandFaceBase {
  id: string;
  name: string;
  grid: number;
}

/** A face drawn as a grid of square cells; animated with horizontal row bursts and an RGB split. */
export interface PixelBrandFace extends BrandFaceBase {
  type: "pixel";
  /** Side length of the drawn region inside the 256px canvas; defaults to 160 when absent. */
  extent?: number;
  /** When present, each cell's third coordinate indexes this palette; otherwise a theme colour. */
  palette?: string[];
  /** Cells as [column, row] or [column, row, paletteIndex]. */
  pixels: number[][];
}

/** A face drawn as filled triangles; animated with a smooth palette cycle over eight seconds. */
export interface SegmentedBrandFace extends BrandFaceBase {
  type: "segmented";
  palette: string[];
  polygons: { points: number[][]; color: string }[];
}

export type BrandFace = PixelBrandFace | SegmentedBrandFace;

let facesRequest: Promise<BrandFace[]> | null = null;

/** The brand faces, fetched once per page load and shared by every logo that draws one. */
export function loadBrandFaces(): Promise<BrandFace[]> {
  if (facesRequest === null) {
    facesRequest = fetch("/assets/brand-faces.json").then(async (response) => {
      if (!response.ok) {
        throw new Error(`Brand faces request failed with status ${response.status}`);
      }
      return (await response.json()) as BrandFace[];
    });
    // A failed request is not cached, so the next logo to mount tries again.
    facesRequest.catch(() => {
      facesRequest = null;
    });
  }
  return facesRequest;
}

/** The still drawing of a face — the frame before the motion starts, and the browser tab's icon. */
export function stillMarkAddress(faceId: string): string {
  return `/assets/raccoon-${faceId}.svg`;
}

/**
 * Hangs the chosen face on the tab. `index.html` names the Mask, which paints the first frame and a
 * page that failed to boot; this replaces it as soon as the stored choice is read.
 */
export function showMarkInTab(faceId: string): void {
  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (icon !== null) {
    icon.href = stillMarkAddress(faceId);
  }
}
