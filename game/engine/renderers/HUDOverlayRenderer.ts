
import { BaseRenderer } from './BaseRenderer';

export class HUDOverlayRenderer extends BaseRenderer {
  public drawManualCrosshair(screenPos: {x: number, y: number}, color: string = '#00ffff') {
    const { color: colorNum } = this.parseColor(color);
    const time = Date.now() * 0.002;
    const pulse = Math.sin(time * 2) * 1.5;
    const size = 12 + pulse; // Reduced size
    
    // 8-pointed star-cross
    this.graphics.beginPath();
    this.graphics.moveTo(screenPos.x - size, screenPos.y);
    this.graphics.lineTo(screenPos.x + size, screenPos.y);
    this.graphics.moveTo(screenPos.x, screenPos.y - size);
    this.graphics.lineTo(screenPos.x, screenPos.y + size);
    
    // Diagonals (shorter)
    const dSize = size * 0.4; // Was 0.7
    this.graphics.moveTo(screenPos.x - dSize, screenPos.y - dSize);
    this.graphics.lineTo(screenPos.x + dSize, screenPos.y + dSize);
    this.graphics.moveTo(screenPos.x + dSize, screenPos.y - dSize);
    this.graphics.lineTo(screenPos.x - dSize, screenPos.y + dSize);
    
    this.graphics.stroke({ color: colorNum, width: 1.5, alpha: 0.8 });
    
    // Glow
    this.graphics.stroke({ color: colorNum, width: 4, alpha: 0.2 });

    // Arcs
    const arcRadius = size + 6;
    const arcAngle = 0.5;
    
    this.graphics.beginPath();
    // Left arc
    this.graphics.moveTo(
      screenPos.x + Math.cos(Math.PI - arcAngle) * arcRadius,
      screenPos.y + Math.sin(Math.PI - arcAngle) * arcRadius
    );
    this.graphics.arc(screenPos.x, screenPos.y, arcRadius, Math.PI - arcAngle, Math.PI + arcAngle);
    
    // Right arc
    this.graphics.moveTo(
      screenPos.x + Math.cos(-arcAngle) * arcRadius,
      screenPos.y + Math.sin(-arcAngle) * arcRadius
    );
    this.graphics.arc(screenPos.x, screenPos.y, arcRadius, -arcAngle, arcAngle);
    
    this.graphics.stroke({ color: colorNum, width: 1.2, alpha: 0.6 });
  }

  public drawRelativeFirePoint(screenPos: {x: number, y: number}, shipScreenPos: {x: number, y: number}, color: string = '#00ffff') {
    const { color: colorNum } = this.parseColor(color);
    
    // Calculate angle from ship to point
    const dx = screenPos.x - shipScreenPos.x;
    const dy = screenPos.y - shipScreenPos.y;
    const angle = Math.atan2(dy, dx);
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const radius = 15;
    const arcSpan = 0.8;
    
    // Draw arc at the point facing away from ship
    this.graphics.beginPath();
    this.graphics.moveTo(
      screenPos.x + Math.cos(angle - arcSpan) * radius,
      screenPos.y + Math.sin(angle - arcSpan) * radius
    );
    this.graphics.arc(screenPos.x, screenPos.y, radius, angle - arcSpan, angle + arcSpan);
    this.graphics.stroke({ color: colorNum, width: 2, alpha: 0.8 });

    // Draw triangle at the tip of the arc pointing away
    const triSize = 8;
    const triTipX = screenPos.x + Math.cos(angle) * (radius + triSize);
    const triTipY = screenPos.y + Math.sin(angle) * (radius + triSize);
    const triBase1X = screenPos.x + Math.cos(angle - 0.4) * radius;
    const triBase1Y = screenPos.y + Math.sin(angle - 0.4) * radius;
    const triBase2X = screenPos.x + Math.cos(angle + 0.4) * radius;
    const triBase2Y = screenPos.y + Math.sin(angle + 0.4) * radius;

    this.graphics.moveTo(triTipX, triTipY);
    this.graphics.lineTo(triBase1X, triBase1Y);
    this.graphics.lineTo(triBase2X, triBase2Y);
    this.graphics.closePath();
    this.graphics.fill({ color: colorNum, alpha: 0.8 });

    // Connecting line (dashed-ish or dim)
    this.graphics.beginPath();
    this.graphics.moveTo(shipScreenPos.x, shipScreenPos.y);
    this.graphics.lineTo(screenPos.x, screenPos.y);
    this.graphics.stroke({ color: colorNum, width: 1, alpha: 0.3 });
  }

  public drawMiningBeam(from: {x: number, y: number}, to: {x: number, y: number}, color: string = '#44ff44') {
    const { color: colorNum, alpha } = this.parseColor(color);
    const time = Date.now() * 0.005;
    const jitter = Math.sin(time) * 2;
    
    // Outer glow
    this.graphics.beginPath();
    this.graphics.moveTo(from.x, from.y);
    this.graphics.lineTo(to.x, to.y);
    this.graphics.stroke({ color: colorNum, width: 6 + jitter, alpha: 0.3 });
    
    // Core
    this.graphics.beginPath();
    this.graphics.moveTo(from.x, from.y);
    this.graphics.lineTo(to.x, to.y);
    this.graphics.stroke({ color: 0xffffff, width: 1.5, alpha: 0.9 });
    
    // Spark particles at target
    this.graphics.beginPath();
    for (let i = 0; i < 4; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 8;
      const rx = Math.cos(angle) * dist;
      const ry = Math.sin(angle) * dist;
      const size = 1 + Math.random() * 2;
      this.graphics.circle(to.x + rx, to.y + ry, size);
      this.graphics.fill({ color: 0xffffff, alpha: 0.8 });
    }
  }

  public drawCombatLock(screenPos: {x: number, y: number}, progress: number, color: string = '#ff4444') {
    const { color: colorNum } = this.parseColor(color);
    const radius = 30;
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.PI * 2 * progress);

    // Background circle
    this.graphics.beginPath();
    this.graphics.moveTo(screenPos.x + radius, screenPos.y);
    this.graphics.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
    this.graphics.stroke({ color: colorNum, width: 1, alpha: 0.2 });

    // Progress arc
    if (progress > 0) {
      this.graphics.beginPath();
      this.graphics.moveTo(screenPos.x + Math.cos(startAngle) * radius, screenPos.y + Math.sin(startAngle) * radius);
      this.graphics.arc(screenPos.x, screenPos.y, radius, startAngle, endAngle);
      this.graphics.stroke({ color: colorNum, width: 4, alpha: 0.8 });
    }

    // Crosshair
    const s = 15;
    this.graphics.beginPath();
    this.graphics.moveTo(screenPos.x - s, screenPos.y);
    this.graphics.lineTo(screenPos.x + s, screenPos.y);
    this.graphics.moveTo(screenPos.x, screenPos.y - s);
    this.graphics.lineTo(screenPos.x, screenPos.y + s);
    this.graphics.stroke({ color: colorNum, width: 1, alpha: 0.5 });
  }

  public drawTargetIndicator(screenPos: {x: number, y: number}, color: string = '#ff4444', isSelected: boolean = false) {
    const { color: colorNum } = this.parseColor(color);
    const size = isSelected ? 12 : 8;
    
    this.graphics.beginPath();
    this.graphics.moveTo(screenPos.x, screenPos.y - size);
    this.graphics.lineTo(screenPos.x + size, screenPos.y);
    this.graphics.lineTo(screenPos.x, screenPos.y + size);
    this.graphics.lineTo(screenPos.x - size, screenPos.y);
    this.graphics.closePath();
    
    if (isSelected) {
        this.graphics.stroke({ color: colorNum, width: 2, alpha: 1 });
        this.graphics.fill({ color: colorNum, alpha: 0.3 });
    } else {
        this.graphics.stroke({ color: colorNum, width: 1, alpha: 0.6 });
    }
  }
}
