
import { GameEngine } from './GameEngine';

export class InputManager {
  private engine: GameEngine;
  public keys: Set<string> = new Set();

  constructor(engine: GameEngine) {
    this.engine = engine;
    this.init();
  }

  private init() {
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    window.addEventListener('keyup', this.handleKeyUp.bind(this));
    window.addEventListener('mousedown', this.handleMouseDown.bind(this), { capture: true });
    window.addEventListener('mouseup', this.handleMouseUp.bind(this), { capture: true });
    window.addEventListener('mousemove', this.handleMouseMove.bind(this), { capture: true });
    window.addEventListener('pointerdown', this.handleMouseDown.bind(this), { capture: true });
    window.addEventListener('pointerup', this.handleMouseUp.bind(this), { capture: true });
    window.addEventListener('pointermove', this.handleMouseMove.bind(this), { capture: true });
    window.addEventListener('contextmenu', e => e.preventDefault(), { capture: true });
  }

  private handleMouseMove(e: MouseEvent | PointerEvent) {
    if (!this.engine.renderer || !this.engine.renderer.canvas) return;
    const rect = this.engine.renderer.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    (this.engine as any).mouseScreenX = x;
    (this.engine as any).mouseScreenY = y;
    const worldPos = this.engine.camera.screenToWorld(x, y, this.engine.renderer.width, this.engine.renderer.height);
    this.engine.mouseWorld = worldPos;
  }

  private handleMouseDown(e: MouseEvent | PointerEvent) {
    if (this.engine.renderer && this.engine.renderer.canvas && e.target !== this.engine.renderer.canvas) {
        return;
    }
    if (e.button === 0) this.keys.add('LMB');
    if (e.button === 2) this.keys.add('RMB');
  }

  private handleMouseUp(e: MouseEvent | PointerEvent) {
    if (e.button === 0) this.keys.delete('LMB');
    if (e.button === 2) this.keys.delete('RMB');
  }

  private handleKeyDown(e: KeyboardEvent) {
    this.keys.add(e.code);
    
    if (e.code === 'Escape') {
      this.engine.setPaused(!this.engine.isPaused);
    }
    
    // Cycle view modes
    if (e.code === 'KeyG') {
      this.cycleViewMode();
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    this.keys.delete(e.code);
  }

  private cycleViewMode() {
    const modes: ('LOCAL' | 'TACTICAL' | 'STRATEGIC')[] = ['LOCAL', 'TACTICAL', 'STRATEGIC'];
    const currentIndex = modes.indexOf(this.engine.viewMode as any);
    const nextIndex = (currentIndex + 1) % modes.length;
    this.engine.switchViewMode(modes[nextIndex]);
  }

  public isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  public destroy() {
    // bind(this) creates new references! The listeners can't actually be removed easily this way.
    // In a future refactor, we should store bound functions.
  }
}
