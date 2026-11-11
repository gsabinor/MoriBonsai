import type { CSSProperties } from 'react';

export type CoverFitMode = 'cover' | 'contain';
export type CoverFrame = { x: number; y: number; zoom: number; fit: CoverFitMode };

const limit = (value: number | undefined, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/**
 * Um unico enquadramento para editor, colecao e dashboard.
 *
 * A imagem ocupa (zoom)% da largura/altura da capa. O deslocamento e
 * calculado sobre a area excedente, e o object-position percorre a sobra
 * interna do proprio object-fit:cover. Assim x/y=0 mostram o inicio e
 * x/y=100 mostram o final da foto, inclusive com zoom alto.
 *
 * NAO combinar transform:scale/transform-origin: eles alteram a geometria
 * do arraste e faziam a capa parecer presa na parte superior.
 */
export function coverFrameStyle(frame?: Partial<CoverFrame>): CSSProperties {
  const x = limit(frame?.x, 0, 100, 50);
  const y = limit(frame?.y, 0, 100, 50);
  const fit: CoverFitMode = frame?.fit === 'contain' ? 'contain' : 'cover';
  const zoom = fit === 'contain' ? 100 : limit(frame?.zoom, 100, 400, 100);

  return {
    position: 'absolute',
    display: 'block',
    width: `${zoom}%`,
    height: `${zoom}%`,
    maxWidth: 'none',
    maxHeight: 'none',
    left: `${(100 - zoom) * x / 100}%`,
    top: `${(100 - zoom) * y / 100}%`,
    objectFit: fit,
    objectPosition: fit === 'contain' ? 'center' : `${x}% ${y}%`,
    transform: 'none',
  };
}

/**
 * Quanto a imagem, depois de ajustada para cobrir a area e de aplicar zoom,
 * excede o tamanho visivel. Usado pelo arraste para converter pixels em %.
 */
export function coverDragOverflow(
  stageWidth: number, stageHeight: number, naturalWidth: number, naturalHeight: number, zoom: number,
) {
  if (stageWidth <= 0 || stageHeight <= 0 || naturalWidth <= 0 || naturalHeight <= 0) {
    return { x: 0, y: 0 };
  }
  const scale = Math.max(stageWidth / naturalWidth, stageHeight / naturalHeight) * limit(zoom, 100, 400, 100) / 100;
  return {
    x: Math.max(0, naturalWidth * scale - stageWidth),
    y: Math.max(0, naturalHeight * scale - stageHeight),
  };
}
