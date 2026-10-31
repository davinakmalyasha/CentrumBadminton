export type AnchorRect = { top: number; left: number; right: number; bottom: number };
export type Viewport = { width: number; height: number };
export type PanelBox = { top: number; left: number; width: number; height: number };

export type PlacePanelOptions = {
  maxWidth: number;
  maxHeight: number;
  gap?: number;
  margin?: number;
  minHeight?: number;
};

export function placePanel(
  anchor: AnchorRect,
  viewport: Viewport,
  options: PlacePanelOptions,
): PanelBox {
  const { maxWidth, maxHeight, gap = 8, margin = 12, minHeight = 280 } = options;

  const width = Math.min(maxWidth, viewport.width - margin * 2);
  const left = Math.min(
    Math.max(anchor.right - width, margin),
    Math.max(viewport.width - width - margin, margin),
  );
  const top = anchor.bottom + gap;
  const height = Math.max(
    minHeight,
    Math.min(maxHeight, viewport.height - top - margin),
  );

  return { top, left, width, height };
}