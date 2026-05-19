
import { BaseRenderer } from './BaseRenderer';
import { Camera } from '../camera';
import { GlobalCoords } from '../../../components/game/types';
import { ASTEROID_CHUNK_SIZE } from '../../world/AsteroidGridManager';
import { SECTOR_SIZE_M } from '../camera';
import { NoiseLUT } from './NoiseLUT';

import * as BABYLON from '@babylonjs/core';
import { CelestialRenderer } from './CelestialRenderer';

export class WorldRenderer extends BaseRenderer {
  private celestialRenderer: CelestialRenderer | null = null;
  private scene: BABYLON.Scene | null = null;
  private noiseTex3D: BABYLON.RawTexture3D | null = null;
  private asteroidRingPool: { mesh: BABYLON.Mesh, mat: BABYLON.ShaderMaterial }[] = [];
  private activeAsteroidRings: { mesh: BABYLON.Mesh, mat: BABYLON.ShaderMaterial }[] = [];
  
  private asteroidThinMesh: BABYLON.Mesh | null = null;
  private maxAsteroidInstances = 4000;
  private asteroidInstanceMatrices: Float32Array = new Float32Array(this.maxAsteroidInstances * 16);
  private asteroidInstanceColors: Float32Array = new Float32Array(this.maxAsteroidInstances * 4);

  constructor(graphics: any, scene?: BABYLON.Scene) {
    super(graphics);
    if (scene) {
       this.scene = scene;
       this.noiseTex3D = NoiseLUT.createNoiseTexture3D(scene, 32);
       this.initAsteroidShader(scene);
       this.initAsteroidThinMesh(scene);
    }
  }

  public setScene(scene: BABYLON.Scene) {
      this.scene = scene;
      if (!this.noiseTex3D) {
          this.noiseTex3D = NoiseLUT.createNoiseTexture3D(scene, 32);
      }
      this.initAsteroidShader(scene);
      this.initAsteroidThinMesh(scene);
  }

  private initAsteroidThinMesh(scene: BABYLON.Scene) {
      if (!this.asteroidThinMesh) {
          const mat = new BABYLON.StandardMaterial("asteroidThinMat", scene);
          mat.disableLighting = true;
          mat.emissiveColor = BABYLON.Color3.White();
          mat.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
          
          // A hexagon or octagon is enough for small asteroids
          this.asteroidThinMesh = BABYLON.MeshBuilder.CreateDisc("asteroidThinMesh", { radius: 1, tessellation: 12 }, scene);
          this.asteroidThinMesh.material = mat;
          this.asteroidThinMesh.renderingGroupId = 1;
          this.asteroidThinMesh.isPickable = false;
          
          this.asteroidThinMesh.thinInstanceSetBuffer("matrix", this.asteroidInstanceMatrices, 16, false);
          this.asteroidThinMesh.thinInstanceSetBuffer("color", this.asteroidInstanceColors, 4, false);
      }
  }

  private initAsteroidShader(scene: BABYLON.Scene) {
      if (!BABYLON.Effect.ShadersStore["asteroidRingVertexShader"]) {
          BABYLON.Effect.ShadersStore["asteroidRingVertexShader"] = `
              precision highp float;
              attribute vec3 position;
              attribute vec2 uv;
              uniform mat4 worldViewProjection;
              varying vec2 vUV;
              void main() {
                  vUV = uv;
                  gl_Position = worldViewProjection * vec4(position, 1.0);
              }
          `;
          
          BABYLON.Effect.ShadersStore["asteroidRingFragmentShader"] = `
              precision highp float;
              precision highp sampler3D;
              varying vec2 vUV;
              uniform sampler3D uNoiseTex3D;
              uniform float uTime;
              uniform float uMinRadius;
              uniform float uMaxRadius;
              uniform float uDensity;
              uniform vec2 uResolution;
              uniform vec2 uRingCenterScreen; 
              uniform vec2 uWorldCenter; 
              uniform vec2 uCameraWorldPos; // Camera position in world meters
              uniform float uCameraAngle;   // Camera rotation angle
              uniform float uZoom;
              uniform int uIsField; 
              
              float sampleNoise(vec3 p) {
                  return textureLod(uNoiseTex3D, p, 0.0).r;
              }
              
              void main() {
                  vec2 pixelCoord = vec2(vUV.x * uResolution.x, uResolution.y - (vUV.y * uResolution.y));
                  vec2 diff = pixelCoord - uRingCenterScreen;
                  
                  // screenR is the distance from the center of the mesh in pixels
                  float screenR = length(diff);
                  
                  if (screenR < uMinRadius || screenR > uMaxRadius) discard;
                  
                  // Map to world coordinates space using uZoom and uCameraAngle
                  // Screen Y is down, world Y is up.
                  float ca = cos(-uCameraAngle);
                  float sa = sin(-uCameraAngle);
                  vec2 screenRel = (pixelCoord - uResolution * 0.5) / uZoom;
                  screenRel.y = -screenRel.y; 
                  
                  vec2 worldPos = uCameraWorldPos + vec2(
                      screenRel.x * ca - screenRel.y * sa,
                      screenRel.x * sa + screenRel.y * ca
                  );
                  
                  // Compute radius in world space for perfect stability against noise
                  vec2 relPos = worldPos - uWorldCenter;
                  float radiusMeters = length(relPos);
                  float screenRadWorld = radiusMeters * uZoom;
                  
                  float alpha = 0.0;
                  float n = 0.0;
                  
                  if (uIsField == 1) {
                      // Generic field: World-stable noise
                      vec3 noisePos = vec3(worldPos * 0.000005, uTime * 0.002);
                      n = sampleNoise(noisePos) * 0.6 + sampleNoise(noisePos * 4.3) * 0.4;
                      
                      float edgeFade = smoothstep(uMaxRadius, uMaxRadius * 0.8, screenRadWorld);
                      if (uMinRadius > 1.0) {
                          edgeFade *= smoothstep(uMinRadius, uMinRadius * 1.2, screenRadWorld);
                      }
                      
                      alpha = smoothstep(0.65, 0.75, n) * edgeFade * uDensity * 0.8;
                  } else {
                      // Circular Ring
                      vec2 relPos = worldPos - uWorldCenter;
                      float angle = atan(relPos.y, relPos.x);
                      float radiusMeters = length(relPos);
                      
                      float distFromMid = abs(screenR - (uMinRadius + uMaxRadius) * 0.5);
                      float halfWidth = (uMaxRadius - uMinRadius) * 0.5;
                      float edgeFade = 1.0 - clamp(distFromMid / halfWidth, 0.0, 1.0);
                      
                      if (uZoom <= 0.01) {
                          n = 0.5;
                          alpha = pow(edgeFade, 1.2) * uDensity * 0.5;
                      } else {
                          vec3 noisePos = vec3(cos(angle) * 8.0, sin(angle) * 8.0, radiusMeters * 0.000005 + uTime * 0.005);
                          n = sampleNoise(noisePos * 0.5) * 0.6 + sampleNoise(noisePos * 3.0) * 0.4;
                          alpha = smoothstep(0.6, 0.8, n) * pow(edgeFade, 1.4) * uDensity;
                      }
                  }
                  
                  if (alpha < 0.05) discard;
                  
                  vec3 color = mix(vec3(0.5, 0.45, 0.4), vec3(0.6, 0.6, 0.65), n);
                  gl_FragColor = vec4(color * alpha, alpha);
              }
          `;
      }
  }

  private getAsteroidRingObj(): { mesh: BABYLON.Mesh, mat: BABYLON.ShaderMaterial } {
      if (this.asteroidRingPool.length > 0) {
          return this.asteroidRingPool.pop()!;
      }
      const mat = new BABYLON.ShaderMaterial(
          "asteroidRingMat",
          this.scene!,
          { vertex: "asteroidRing", fragment: "asteroidRing" },
          {
              attributes: ["position", "uv"],
              uniforms: ["worldViewProjection", "uTime", "uMinRadius", "uMaxRadius", "uDensity", "uQuadSize", "uWorldCenter", "uCameraWorldPos", "uCameraAngle", "uZoom", "uIsField"],
              samplers: ["uNoiseTex3D"],
              needAlphaBlending: true
          }
      );
      mat.backFaceCulling = false;
      mat.disableLighting = true;
      mat.alphaMode = BABYLON.Engine.ALPHA_PREMULTIPLIED; 
      if (this.noiseTex3D) {
          mat.setTexture("uNoiseTex3D", this.noiseTex3D);
      }
      
      const mesh = BABYLON.MeshBuilder.CreatePlane("asteroidRingBase", { size: 2 }, this.scene!);
      mesh.material = mat;
      mesh.renderingGroupId = 0;
      return { mesh, mat };
  }

  public setCelestialRenderer(celestial: CelestialRenderer) {
    this.celestialRenderer = celestial;
  }

  public beginFrame() {
      for (const ring of this.activeAsteroidRings) {
          ring.mesh.isVisible = false;
          this.asteroidRingPool.push(ring);
      }
      this.activeAsteroidRings = [];
  }

  public updateAsteroidInstances(asteroids: any[], camera: Camera, width: number, height: number, now: number, targetId: string | null = null, miningTargetId: string | null = null) {
    const zoom = camera.zoom;
    const isZoomedOut = zoom < 0.05;
    const isVeryZoomedOut = zoom < 0.01;

    const isTactical = zoom < 0.01; 

    const halfW = width / 2;
    const halfH = height / 2;
    const camX = camera.pos.offsetX;
    const camY = camera.pos.offsetY;
    const camSecX = camera.pos.sectorX;
    const camSecY = camera.pos.sectorY;
    const cosA = Math.cos(-camera.angle);
    const sinA = Math.sin(-camera.angle);
    const secSize = Number(SECTOR_SIZE_M);

    const maxAsteroids = Math.min(asteroids.length, this.maxAsteroidInstances);
    let count = 0;
    let thinCount = 0;

    for (let i = 0; i < asteroids.length && count < this.maxAsteroidInstances; i++) {
      const ast = asteroids[i];
      if (ast.depleted) continue;

      if (isVeryZoomedOut && ast.radius < (isTactical ? 200 : 1000)) continue;
      if (isZoomedOut && ast.radius < (isTactical ? 100 : 400)) continue;

      const screenRadius = ast.radius * zoom;
      if (screenRadius < 0.5) continue;

      const dx = Number(ast.sectorX - camSecX) * secSize + (ast.offsetX - camX);
      const dy = Number(ast.sectorY - camSecY) * secSize + (ast.offsetY - camY);
      
      const rotX = dx * cosA - dy * sinA;
      const rotY = dx * sinA + dy * cosA;
      
      const sx = rotX * zoom + halfW;
      const sy = rotY * zoom + halfH;

      if (sx + screenRadius < -50 || sx - screenRadius > width + 50 ||
          sy + screenRadius < -50 || sy - screenRadius > height + 50) {
        continue;
      }

      const isTarget = ast.id === targetId || ast.id === miningTargetId;
      const numColor = this.colorToNumber(ast.color);
      
      const isGlobal = zoom < 0.005;
      let finalRadius = screenRadius;
      if (isTarget && !isGlobal) {
        finalRadius = Math.max(screenRadius, 3.0);
      }
      
      const alpha = Math.min(1.0, Math.max(0, (screenRadius - 0.5) / (5.0 - 0.5)));
      
      // Draw detailed polygons only when close enough
      const isDetailed = zoom > 0.02 && screenRadius > 5.0;
      
      if (isDetailed) {
          count++;
          this.drawAsteroid(ast, null, camera, width, height, isTarget, ast.id === miningTargetId);
      } else if (this.asteroidThinMesh) {
          const r = ((numColor >> 16) & 0xff) / 255.0;
          const g = ((numColor >> 8) & 0xff) / 255.0;
          const b = (numColor & 0xff) / 255.0;
          
          const baseIdx = thinCount * 16;
          this.asteroidInstanceMatrices[baseIdx] = finalRadius;     // m0
          this.asteroidInstanceMatrices[baseIdx + 1] = 0;           // m1
          this.asteroidInstanceMatrices[baseIdx + 2] = 0;           // m2
          this.asteroidInstanceMatrices[baseIdx + 3] = 0;           // m3
          this.asteroidInstanceMatrices[baseIdx + 4] = 0;           // m4
          this.asteroidInstanceMatrices[baseIdx + 5] = finalRadius; // m5
          this.asteroidInstanceMatrices[baseIdx + 6] = 0;           // m6
          this.asteroidInstanceMatrices[baseIdx + 7] = 0;           // m7
          this.asteroidInstanceMatrices[baseIdx + 8] = 0;           // m8
          this.asteroidInstanceMatrices[baseIdx + 9] = 0;           // m9
          this.asteroidInstanceMatrices[baseIdx + 10] = 1;          // m10
          this.asteroidInstanceMatrices[baseIdx + 11] = 0;          // m11
          this.asteroidInstanceMatrices[baseIdx + 12] = sx;         // m12 (x)
          this.asteroidInstanceMatrices[baseIdx + 13] = -sy;        // m13 (y)
          this.asteroidInstanceMatrices[baseIdx + 14] = 2.0;        // m14 (z)
          this.asteroidInstanceMatrices[baseIdx + 15] = 1;          // m15
          
          const colIdx = thinCount * 4;
          this.asteroidInstanceColors[colIdx] = isTarget ? 1.0 : r;
          this.asteroidInstanceColors[colIdx + 1] = isTarget ? 1.0 : g;
          this.asteroidInstanceColors[colIdx + 2] = isTarget ? 0.6 : b;
          this.asteroidInstanceColors[colIdx + 3] = alpha;
          
          if (isTarget) {
              const sz = finalRadius * 1.5;
              this.graphics.moveTo(sx - sz, sy); this.graphics.lineTo(sx - sz/2, sy);
              this.graphics.moveTo(sx + sz, sy); this.graphics.lineTo(sx + sz/2, sy);
              this.graphics.moveTo(sx, sy - sz); this.graphics.lineTo(sx, sy - sz/2);
              this.graphics.moveTo(sx, sy + sz); this.graphics.lineTo(sx, sy + sz/2);
              this.graphics.stroke({ color: 0xff4444, width: 2, alpha: 1 });
          }
          count++;
          thinCount++;
      } else {
          count++;
          this.graphics.circle(sx, sy, finalRadius);
          this.graphics.fill({ color: isTarget ? 0xffffaa : numColor, alpha });
          if (isTarget) {
              const sz = finalRadius * 1.5;
              this.graphics.moveTo(sx - sz, sy); this.graphics.lineTo(sx - sz/2, sy);
              this.graphics.moveTo(sx + sz, sy); this.graphics.lineTo(sx + sz/2, sy);
              this.graphics.moveTo(sx, sy - sz); this.graphics.lineTo(sx, sy - sz/2);
              this.graphics.moveTo(sx, sy + sz); this.graphics.lineTo(sx, sy + sz/2);
              this.graphics.stroke({ color: 0xff4444, width: 2, alpha: 1 });
          }
      }
    }
    
    if (this.asteroidThinMesh) {
        this.asteroidThinMesh.thinInstanceCount = thinCount;
        this.asteroidThinMesh.thinInstanceBufferUpdated("matrix");
        this.asteroidThinMesh.thinInstanceBufferUpdated("color");
        this.asteroidThinMesh.isVisible = thinCount > 0;
    }
  }

  public removeAsteroidInstance(id: string) {
    // Handled by re-rendering
  }

  public clearAllAsteroidInstances() {
    // Handled by Graphics2D clear
  }

  public drawStar(data: any, camera: Camera, width: number, height: number, isGlobal: boolean, now: number) {
    if (this.celestialRenderer && !isGlobal) {
      const handled = this.celestialRenderer.drawCelestial(data, camera, width, height, now / 1000);
      if (handled) return;
    }

    const coords = { 
      sectorX: data.sectorX ?? 0n, 
      sectorY: data.sectorY ?? 0n, 
      offsetX: data.offsetX ?? 0, 
      offsetY: data.offsetY ?? 0 
    };
    const radius = data.starRadius;
    const color = data.starColor;

    const screen = camera.worldToScreen(coords, width, height);
    const screenRadius = radius * camera.zoom;
    const screenX = screen.x;
    const screenY = screen.y;

    if (screenX + screenRadius * 8.0 < 0 || screenX - screenRadius * 8.0 > width ||
        screenY + screenRadius * 8.0 < 0 || screenY - screenRadius * 8.0 > height) {
      return;
    }

    const colorNum = this.colorToNumber(color);

    if (isGlobal) {
      const alpha = Math.min(1, screenRadius * 0.5);
      if (alpha < 0.005) return;
      this.graphics.circle(screenX, screenY, Math.max(1, screenRadius));
      this.graphics.fill({ color: colorNum, alpha });
      return;
    }

    this.drawTacticalMarker(screenX, screenY, colorNum, 5);
  }

  public drawLoot(pos: GlobalCoords, camera: Camera, width: number, height: number) {
    const screen = camera.worldToScreen(pos, width, height);
    if (!screen || screen.x < 0 || screen.x > width || screen.y < 0 || screen.y > height) return;
    
    this.graphics.circle(screen.x, screen.y, 1.5);
    this.graphics.fill({ color: 0xffffff, alpha: 0.8 });
    
    if (camera.zoom > 10) {
      this.graphics.circle(screen.x, screen.y, 3);
      this.graphics.fill({ color: 0xffffff, alpha: 0.2 });
    }
  }

  public drawPlanet(data: any, camera: Camera, width: number, height: number, now: number, lightDir: {x: number, y: number} = {x: 0, y: 0}) {
    if (data.type === 'ASTEROIDS') return; // Skip asteroid zones entirely

    if (this.celestialRenderer) {
      const handled = this.celestialRenderer.drawCelestial(data, camera, width, height, now / 1000, lightDir);
      if (handled) return;
    }

    const coords = { 
      sectorX: data.sectorX ?? 0n, 
      sectorY: data.sectorY ?? 0n, 
      offsetX: data.offsetX ?? 0, 
      offsetY: data.offsetY ?? 0 
    };
    const radius = data.radius;
    const color = data.color;

    const screen = camera.worldToScreen(coords, width, height);
    const screenRadius = radius * camera.zoom;
    const screenX = screen.x;
    const screenY = screen.y;

    if (screenX + screenRadius < -100 || screenX - screenRadius > width + 100 ||
        screenY + screenRadius < -100 || screenY - screenRadius > height + 100) {
      return;
    }

    const alpha = Math.min(1, screenRadius * 1.5);
    if (alpha <= 0.01) return;

    if (screenRadius < 4.0) {
      this.drawTacticalMarker(screenX, screenY, this.colorToNumber(color), 3);
    } else {
      this.drawLargeCircle(screenX, screenY, Math.max(0.5, screenRadius), this.colorToNumber(color), alpha);
    }
  }

  public drawAsteroidRing(
    coords: GlobalCoords,
    minRadius: number,
    maxRadius: number,
    camera: Camera,
    width: number,
    height: number,
    now: number
  ) {
    const screen = camera.worldToScreen(coords, width, height);
    const zoom = camera.zoom;
    const rMin = minRadius * zoom;
    const rMax = maxRadius * zoom;

    if (rMax < 0.5) return;

    // Use GPU shader for fields/belts (Minecraft-seed-map "prediction" style)
    if (this.scene && (Math.abs(maxRadius - minRadius) > 1000 || maxRadius > 1e9)) {
        const ringObj = this.getAsteroidRingObj();
        ringObj.mesh.isVisible = true;

        // Position mesh in the middle of the screen
        ringObj.mesh.position.set(width / 2, -height / 2, 10.0);
        // Scale it exactly to the screen width and height
        ringObj.mesh.scaling.set(width, height, 1);
        
        ringObj.mat.setFloat("uTime", now / 1000);
        ringObj.mat.setFloat("uMinRadius", rMin);
        ringObj.mat.setFloat("uMaxRadius", rMax);
        ringObj.mat.setFloat("uDensity", 0.6);
        ringObj.mat.setFloat("uZoom", zoom);
        ringObj.mat.setFloat("uCameraAngle", camera.angle);
        
        // Pass resolution and ring center
        ringObj.mat.setVector2("uResolution", new BABYLON.Vector2(width, height));
        ringObj.mat.setVector2("uRingCenterScreen", new BABYLON.Vector2(screen.x, screen.y));
        
        // Pass World Center for noise stability
        const worldX = Number(coords.sectorX * BigInt(SECTOR_SIZE_M)) + coords.offsetX;
        const worldY = Number(coords.sectorY * BigInt(SECTOR_SIZE_M)) + coords.offsetY;
        ringObj.mat.setVector2("uWorldCenter", new BABYLON.Vector2(worldX, worldY));

        const camX = Number(camera.pos.sectorX * BigInt(SECTOR_SIZE_M)) + camera.pos.offsetX;
        const camY = Number(camera.pos.sectorY * BigInt(SECTOR_SIZE_M)) + camera.pos.offsetY;
        ringObj.mat.setVector2("uCameraWorldPos", new BABYLON.Vector2(camX, camY));
        
        // In Babylon.js ShaderMaterial doesn't have setBoolean, use setInt
        const isField = minRadius < 1000 ? 1 : 0;
        ringObj.mat.setInt("uIsField", isField); 
        
        this.activeAsteroidRings.push(ringObj);
        return;
    }

    // Standard high-performance vector orbits for single-lines
    this.graphics.circle(screen.x, screen.y, rMax);
    let alpha = Math.min(0.3, rMax / 400);
    this.graphics.stroke({ color: 0x4466aa, width: 1, alpha: Math.max(0.01, alpha) });
  }

  public drawSpaceStation(coords: GlobalCoords, camera: Camera, width: number, height: number, color: string) {
    const screen = camera.worldToScreen(coords, width, height);
    const renderSize = Math.max(4, 1000 * camera.zoom); // Base size 1000m, but keep visible at high zoom

    if (screen.x + renderSize < -100 || screen.x - renderSize > width + 100 ||
        screen.y + renderSize < -100 || screen.y - renderSize > height + 100) {
      return;
    }

    const colorNum = this.colorToNumber(color);
    
    this.graphics.beginPath();
    this.graphics.moveTo(screen.x, screen.y - renderSize);
    this.graphics.lineTo(screen.x + renderSize, screen.y);
    this.graphics.lineTo(screen.x, screen.y + renderSize);
    this.graphics.lineTo(screen.x - renderSize, screen.y);
    this.graphics.closePath();
    this.graphics.fill({ color: colorNum });
    this.graphics.stroke({ color: 0xffffff, width: 1, alpha: 0.5 });
    
    // Draw a small dot in center
    this.graphics.circle(screen.x, screen.y, renderSize * 0.3);
    this.graphics.fill({ color: 0xffffff });
  }

  public drawAsteroid(asteroid: any, cluster: any, camera: Camera, width: number, height: number, isMarked: boolean = false, isMiningTarget: boolean = false) {
    let coords;
    if (asteroid.sectorX !== undefined) {
      coords = {
        sectorX: asteroid.sectorX,
        sectorY: asteroid.sectorY,
        offsetX: asteroid.offsetX,
        offsetY: asteroid.offsetY
      };
    } else {
      coords = {
        sectorX: cluster.sectorX,
        sectorY: cluster.sectorY,
        offsetX: cluster.offsetX + asteroid.rx,
        offsetY: cluster.offsetY + asteroid.ry
      };
    }
    
    const screen = camera.worldToScreen(coords, width, height);
    let screenRadius = asteroid.radius * camera.zoom;

    if (isMarked || isMiningTarget) {
      screenRadius = Math.max(screenRadius, 2);
    } else if (screenRadius < 0.5) {
      return;
    }

    if (screen.x + screenRadius < 0 || screen.x - screenRadius > width ||
        screen.y + screenRadius < 0 || screen.y - screenRadius > height) {
      return;
    }

    const colorNum = this.colorToNumber(asteroid.color);
    
    if (isMiningTarget) {
      this.graphics.circle(screen.x, screen.y, screenRadius * 1.5);
      this.graphics.stroke({ color: 0xff4444, width: 2, alpha: 0.8 });
      // Draw crosshair corners
      const sz = screenRadius * 2;
      this.graphics.moveTo(screen.x - sz, screen.y); this.graphics.lineTo(screen.x - sz/2, screen.y);
      this.graphics.moveTo(screen.x + sz, screen.y); this.graphics.lineTo(screen.x + sz/2, screen.y);
      this.graphics.moveTo(screen.x, screen.y - sz); this.graphics.lineTo(screen.x, screen.y - sz/2);
      this.graphics.moveTo(screen.x, screen.y + sz); this.graphics.lineTo(screen.x, screen.y + sz/2);
      this.graphics.stroke({ color: 0xff4444, width: 1, alpha: 1 });
    }

    if (isMarked) {
      this.graphics.circle(screen.x, screen.y, screenRadius * 1.5);
      this.graphics.fill({ color: 0x00ffcc, alpha: 0.4 });
      this.graphics.circle(screen.x, screen.y, screenRadius);
      this.graphics.fill({ color: 0x00ffcc });
    } else {
      const rng = this.createStaticRNG(asteroid.id);
      const sides = 5 + Math.floor(rng() * 5);
      this.graphics.beginPath();
      this.graphics.moveTo(screen.x + screenRadius, screen.y);
      for (let i = 1; i <= sides; i++) {
        const angle = (i / sides) * Math.PI * 2;
        const r = screenRadius * (0.7 + rng() * 0.4);
        this.graphics.lineTo(screen.x + Math.cos(angle) * r, screen.y + Math.sin(angle) * r);
      }
      this.graphics.closePath();
      this.graphics.fill({ color: colorNum });
      
      // Draw details like craters or highlights
      if (screenRadius > 3) {
        const rng2 = this.createStaticRNG(asteroid.id + "_detail");
        const craterCount = Math.floor(1 + rng2() * 3);
        for(let j=0; j<craterCount; j++) {
           const cx_rel = (rng2() - 0.5) * 1.2;
           const cy_rel = (rng2() - 0.5) * 1.2;
           const cr = screenRadius * (0.1 + rng2() * 0.2);
           this.graphics.circle(screen.x + cx_rel * screenRadius, screen.y + cy_rel * screenRadius, cr);
           this.graphics.fill({ color: 0x000000, alpha: 0.15 });
        }
        // Subtle highlight
        this.graphics.circle(screen.x - screenRadius * 0.3, screen.y - screenRadius * 0.3, screenRadius * 0.2);
        this.graphics.fill({ color: 0xffffff, alpha: 0.1 });
      }
    }
  }

  private drawTacticalMarker(x: number, y: number, colorNum: number, size: number) {
    const outer = size * 1.5;
    const inner = size * 0.4;
    
    this.graphics.beginPath();
    this.graphics.moveTo(x, y - outer);
    this.graphics.lineTo(x + inner, y - inner);
    this.graphics.lineTo(x + outer, y);
    this.graphics.lineTo(x + inner, y + inner);
    this.graphics.lineTo(x, y + outer);
    this.graphics.lineTo(x - inner, y + inner);
    this.graphics.lineTo(x - outer, y);
    this.graphics.lineTo(x - inner, y - inner);
    this.graphics.closePath();
    this.graphics.fill({ color: colorNum, alpha: 0.9 });
  }

  private drawLargeCircle(x: number, y: number, radius: number, color: number, alpha: number = 1) {
    if (radius < 2000) {
      this.graphics.circle(x, y, radius);
    } else {
      const segments = 128;
      const step = (Math.PI * 2) / segments;
      this.graphics.beginPath();
      this.graphics.moveTo(x + radius, y);
      for (let i = 1; i <= segments; i++) {
        this.graphics.lineTo(x + Math.cos(i * step) * radius, y + Math.sin(i * step) * radius);
      }
      this.graphics.closePath();
    }
    this.graphics.fill({ color, alpha });
  }

  public drawGrid(camera: Camera, width: number, height: number, spacing: number) {
    if (!spacing || spacing <= 0 || isNaN(spacing)) return;
    
    const color = 0x1a2a3a;
    const zoom = camera.zoom;
    if (!zoom || zoom <= 0 || isNaN(zoom)) return;

    const diag = Math.hypot(width, height) / zoom;
    
    // Safety check: if we are trying to draw more than 2000 lines, it will most likely
    // cause performance issues or trigger buffer size limits in WebGL / Babylon buffers.
    if (diag / spacing > 2000) return;

    const startX = Math.floor(-diag / 2 / spacing) * spacing;
    const startY = Math.floor(-diag / 2 / spacing) * spacing;
    const endX = -startX;
    const endY = -startY;

    const offsetX = camera.pos.offsetX % spacing;
    const offsetY = camera.pos.offsetY % spacing;

    const cosA = Math.cos(-camera.angle);
    const sinA = Math.sin(-camera.angle);

    for (let x = startX; x <= endX; x += spacing) {
      const rx = x - offsetX;
      const ry1 = startY - offsetY;
      const ry2 = endY - offsetY;
      const rotX1 = rx * cosA - ry1 * sinA;
      const rotY1 = rx * sinA + ry1 * cosA;
      const rotX2 = rx * cosA - ry2 * sinA;
      const rotY2 = rx * sinA + ry2 * cosA;
      this.graphics.moveTo(rotX1 * zoom + width / 2, rotY1 * zoom + height / 2);
      this.graphics.lineTo(rotX2 * zoom + width / 2, rotY2 * zoom + height / 2);
    }

    for (let y = startY; y <= endY; y += spacing) {
      const ry = y - offsetY;
      const rx1 = startX - offsetX;
      const rx2 = endX - offsetX;
      const rotX1 = rx1 * cosA - ry * sinA;
      const rotY1 = rx1 * sinA + ry * cosA;
      const rotX2 = rx2 * cosA - ry * sinA;
      const rotY2 = rx2 * sinA + ry * cosA;
      this.graphics.moveTo(rotX1 * zoom + width / 2, rotY1 * zoom + height / 2);
      this.graphics.lineTo(rotX2 * zoom + width / 2, rotY2 * zoom + height / 2);
    }
    this.graphics.stroke({ color, width: 1 });
  }

  public setApp(app: any) {
     // No-op for Babylon
  }

  private initNoiseMap(scene: BABYLON.Scene) {
     // Removed
  }

  private colorToNumber(color: string): number {
    if (color.startsWith('#')) {
      return parseInt(color.slice(1), 16);
    }
    if (color.startsWith('rgb')) {
      const matches = color.match(/\d+/g);
      if (matches && matches.length >= 3) {
        return (parseInt(matches[0]) << 16) | (parseInt(matches[1]) << 8) | parseInt(matches[2]);
      }
    }
    return 0xcccccc;
  }

  private createStaticRNG(id: string) {
    let seed = 0;
    for (let i = 0; i < id.length; i++) {
      seed = ((seed << 5) - seed) + id.charCodeAt(i);
      seed |= 0;
    }
    return () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  }
}
