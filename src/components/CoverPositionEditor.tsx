import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import { Crop, RotateCcw, Save, X } from 'lucide-react';
import { coverDragOverflow, coverFrameStyle } from '../lib/coverFrame';
import type { CoverFitMode } from '../lib/coverFrame';

type Props = {
  imageUrl: string;
  plantName: string;
  initialX: number;
  initialY: number;
  initialZoom: number;
  initialFit: CoverFitMode;
  saving: boolean;
  error: string;
  onCancel: () => void;
  onSave: (x: number, y: number, zoom: number, fit: CoverFitMode) => void;
};

type PointerStart = { pointerId: number; clientX: number; clientY: number; x: number; y: number };
const clamp = (value: number, min: number, max: number) => Math.round(Math.max(min, Math.min(max, Number.isFinite(value) ? value : min)));

/** Editor sem cortes permanentes: posicao, zoom e modo de exibicao ficam no Supabase.
 * A previa 3:2 usa o mesmo estilo e proporcao da capa no cartao da colecao. */
export default function CoverPositionEditor({ imageUrl, plantName, initialX, initialY, initialZoom, initialFit, saving, error, onCancel, onSave }: Props) {
  const [x, setX] = useState(clamp(initialX, 0, 100));
  const [y, setY] = useState(clamp(initialY, 0, 100));
  const [zoom, setZoom] = useState(clamp(initialZoom, 100, 400));
  const [fit, setFit] = useState<CoverFitMode>(initialFit === 'contain' ? 'contain' : 'cover');
  const stageRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragging = useRef<PointerStart | null>(null);

  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (saving || fit === 'contain' || event.button !== 0) return;
    dragging.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x, y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = dragging.current;
    const stage = stageRef.current;
    const image = imageRef.current;
    if (!start || start.pointerId !== event.pointerId || !stage || !image?.naturalWidth || !image?.naturalHeight) return;
    const { x: overflowX, y: overflowY } = coverDragOverflow(
      stage.clientWidth, stage.clientHeight, image.naturalWidth, image.naturalHeight, zoom,
    );
    if (overflowX > 0.5) setX(clamp(start.x - (event.clientX - start.clientX) * 100 / overflowX, 0, 100));
    if (overflowY > 0.5) setY(clamp(start.y - (event.clientY - start.clientY) * 100 / overflowY, 0, 100));
  }

  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    if (dragging.current?.pointerId !== event.pointerId) return;
    dragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return <section className="mori-cover-editor" role="dialog" aria-modal="true" aria-labelledby="mori-cover-title">
    <button className="modal-close" type="button" disabled={saving} aria-label="Fechar ajuste de capa" onClick={onCancel}><X size={19}/></button>
    <span className="eyebrow">PERSONALIZAR CAPA</span>
    <h2 id="mori-cover-title"><Crop size={22}/> Ajustar enquadramento</h2>
    <p>Escolha quanto da foto de <strong>{plantName}</strong> aparecerá na coleção. A fotografia original será preservada.</p>
    <div className="mori-cover-modes" role="group" aria-label="Modo de exibição da capa">
      <button type="button" aria-pressed={fit === 'cover'} className={fit === 'cover' ? 'selected' : ''} disabled={saving} onClick={() => setFit('cover')}>Preencher e ajustar</button>
      <button type="button" aria-pressed={fit === 'contain'} className={fit === 'contain' ? 'selected' : ''} disabled={saving} onClick={() => setFit('contain')}>Mostrar foto inteira</button>
    </div>
    <div ref={stageRef} className={`mori-cover-stage${fit === 'contain' ? ' mori-cover-stage-whole' : ''}`} role="img" aria-label="Prévia 3 por 2 da capa, igual ao cartão da coleção."
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
      <img ref={imageRef} src={imageUrl} alt={`Prévia da foto de capa de ${plantName}`} draggable={false}
        style={coverFrameStyle({x, y, zoom, fit})}/>
      <span className="mori-cover-stage-hint">{fit === 'contain' ? 'Fotografia completa, sem cortes' : 'Arraste para reposicionar'}</span>
    </div>
    {fit === 'cover' ? <>
      <div className="mori-cover-sliders">
        <label>Posição horizontal: <strong>{x}%</strong> <input type="range" min="0" max="100" step="1" value={x} disabled={saving} onChange={event => setX(Number(event.target.value))}/></label>
        <label>Posição vertical: <strong>{y}%</strong> <input type="range" min="0" max="100" step="1" value={y} disabled={saving} onChange={event => setY(Number(event.target.value))}/></label>
      </div>
      <div className="mori-cover-presets" role="group" aria-label="Alinhamento vertical rapido">
        <span>Mostrar:</span>
        <button type="button" disabled={saving} onClick={() => setY(0)}>Topo</button>
        <button type="button" disabled={saving} onClick={() => setY(50)}>Meio</button>
        <button type="button" disabled={saving} onClick={() => setY(100)}>Base da foto</button>
      </div>
      <label className="mori-cover-zoom">Aproximação <strong>{zoom}%</strong>
        <input type="range" min="100" max="400" step="5" value={zoom} disabled={saving} onChange={event => setZoom(Number(event.target.value))}/>
      </label>
    </> : <p className="mori-cover-footnote">A foto inteira ficará visível na coleção. Se a proporção da foto for diferente da capa, aparecerão margens ao redor.</p>}
    {fit === 'cover' && <div className="mori-cover-footnote">Se a árvore estiver na parte inferior da fotografia, comece por <strong>Base da foto</strong> e ajuste o zoom. Também é possível arrastar ou usar os dois controles de posição. O cartão mostrará exatamente esta prévia.</div>}
    {error && <p className="live-message live-error" role="alert">{error}</p>}
    <div className="mori-cover-actions">
      <button type="button" className="button button-outline" disabled={saving} onClick={() => { setX(50); setY(50); setZoom(100); }}><RotateCcw size={16}/> Redefinir</button>
      <button type="button" className="button button-outline" disabled={saving} onClick={onCancel}>Cancelar</button>
      <button type="button" className="button button-primary" disabled={saving} onClick={() => onSave(x, y, fit === 'contain' ? 100 : zoom, fit)}><Save size={16}/> {saving ? 'Salvando...' : 'Salvar capa'}</button>
    </div>
  </section>;
}
