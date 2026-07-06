
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
  
  private orbitThinMesh: BABYLON.Mesh | null = null;
  private maxOrbitInstances = 2000;
  private orbitInstanceMatrices: Float32Array = new Float32Array(this.maxOrbitInstances * 16);
  private orbitInstanceColors: Float32Array = new Float32Array(this.maxOrbitInstances * 4);
  private orbitInstanceParams: Float32Array = new Float32Array(this.maxOrbitInstances * 4);
  private orbitInstanceCenters: Float32Array = new Float32Array(this.maxOrbitInstances * 2);
  private orbitThinCount = 0;

  private asteroidThinMesh: BABYLON.Mesh | null = null;
  private maxAsteroidInstances = 4000;
  private asteroidInstanceMatrices: Float32Array = new Float32Array(this.maxAsteroidInstances * 16);
  private asteroidInstanceColors: Float32Array = new Float32Array(this.maxAsteroidInstances * 4);

  private densityMesh: BABYLON.Mesh | null = null;
  private densityTexture: BABYLON.RawTexture | null = null;
  private densityBuffer: Uint8Array | null = null;
  private densityRes = 32;
  private lastDensityUpdate = 0;
  private lastDensityCamPos = { x: 0, y: 0 };
  private lastDensityZoom = 0;

  constructor(graphics: any, scene?: BABYLON.Scene) {
    super(graphics);
    if (scene) {
       this.scene = scene;
       this.noiseTex3D = NoiseLUT.createNoiseTexture3D(scene, 32);
       this.initAsteroidShader(scene);
       this.initAsteroidThinMesh(scene);
       this.initDensityOverlay(scene);
    }
  }

  private initDensityOverlay(scene: BABYLON.Scene) {
      if (!this.densityMesh) {
          const res = this.densityRes;
          // Use RGBA for maximum compatibility across WebGL/WebGPU
          this.densityBuffer = new Uint8Array(res * res * 4);
          this.densityTexture = new BABYLON.RawTexture(
              this.densityBuffer,
              res,
              res,
              BABYLON.Engine.TEXTUREFORMAT_RGBA,
              scene,
              false,
              false,
              BABYLON.Texture.BILINEAR_SAMPLINGMODE
          );

          BABYLON.Effect.ShadersStore["densityVertexShader"] = `
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

          BABYLON.Effect.ShadersStore["densityFragmentShader"] = `
              precision highp float;
              varying vec2 vUV;
              uniform sampler2D uDensityTex;
              uniform vec3 uColor;

              void main() {
                  vec4 sampled = texture2D(uDensityTex, vUV);
                  float density = sampled.a;
                  
                  if (density <= 0.005) discard;
                  
                  // Увеличиваем видимость низких плотностей (0.01+), чтобы дымка 
                  // визуально совпадала с зоной генерации астероидов.
                  float alpha = pow(density, 0.4) * 0.25;
                  vec3 col = mix(uColor, vec3(0.55, 0.62, 0.7), pow(density, 0.5) * 0.6);
                  gl_FragColor = vec4(col, alpha);
              }
          `;

          const mat = new BABYLON.ShaderMaterial("densityMat", scene, {
              vertex: "density",
              fragment: "density"
          }, {
              attributes: ["position", "uv"],
              uniforms: ["worldViewProjection", "uColor"],
              samplers: ["uDensityTex"],
              needAlphaBlending: true
          });
          
          mat.setVector3("uColor", new BABYLON.Vector3(0.35, 0.41, 0.48));
          mat.setTexture("uDensityTex", this.densityTexture);
          mat.backFaceCulling = false;
          mat.alphaMode = BABYLON.Engine.ALPHA_COMBINE;

          this.densityMesh = BABYLON.MeshBuilder.CreatePlane("densityOverlay", { size: 1 }, scene);
          this.densityMesh.material = mat;
          this.densityMesh.renderingGroupId = 0;
          this.densityMesh.isPickable = false;
          this.densityMesh.isVisible = false;
      }
  }

  public hideAsteroidFieldDensity() {
      if (this.densityMesh) {
          this.densityMesh.isVisible = false;
      }
  }

  /**
   * Отрисовывает аналитическую "дымку" плотности астероидов.
   * Вместо перебора тысяч объектов, мы вычисляем плотность поля для каждого пикселя
   * сетки `densityRes` x `densityRes`, создавая эффект туманности/скопления.
   * 
   * Оптимизации:
   * 1. Низкое разрешение сетки (32x32) снижает нагрузку на CPU.
   * 2. Адаптивный троттлинг (20мс+) предотвращает лаги при быстром перемещении.
   * 3. Расчет в мировых координатах обеспечивает стабильность при зуме и повороте.
   */
  public drawAsteroidFieldDensity(gridManager: any, camera: Camera, currentSystem: any, width: number, height: number, now: number) {
      if (!this.densityMesh || !this.scene) return;

      const camWorldX = Number(camera.pos.sectorX * BigInt(SECTOR_SIZE_M)) + camera.pos.offsetX;
      const camWorldY = Number(camera.pos.sectorY * BigInt(SECTOR_SIZE_M)) + camera.pos.offsetY;

      // Throttle CPU-based density evaluation to avoid running it every frame and blocking UI
      const distPassed = Math.hypot(camWorldX - this.lastDensityCamPos.x, camWorldY - this.lastDensityCamPos.y);
      const zoomRatio = Math.abs(camera.zoom - this.lastDensityZoom) / (camera.zoom + 0.0001);
      
      const timePassed = now - this.lastDensityUpdate;
      let deservesUpdate = false;
      
      // Much shorter 20ms throttle for highly fluid updates now that resolution is 32x32
      if (timePassed > 20) {
          if (timePassed > 300 || distPassed > (width * 0.005 / camera.zoom) || zoomRatio > 0.005) {
              deservesUpdate = true;
          }
      }
      
      if (deservesUpdate) {
          this.lastDensityUpdate = now;
          this.lastDensityCamPos = { x: camWorldX, y: camWorldY };
          this.lastDensityZoom = camera.zoom;
          
          const res = this.densityRes;
          const ca = Math.cos(camera.angle);
          const sa = Math.sin(camera.angle);
          
          const widthHalf = width * 0.5;
          const heightHalf = height * 0.5;
          const zoomRecip = 1.0 / camera.zoom;
          
          const worldInfo = { currentSystem };
          
          for (let y = 0; y < res; y++) {
              const vFraction = y / (res - 1);
              const screenY = (1.0 - vFraction) * height;
              const rotY = screenY - heightHalf;
              
              for (let x = 0; x < res; x++) {
                  const uFraction = x / (res - 1);
                  const screenX = uFraction * width;
                  const rotX = screenX - widthHalf;
                  
                  const relX = (rotX * ca - rotY * sa) * zoomRecip;
                  const relY = (rotX * sa + rotY * ca) * zoomRecip;
                  
                  const pWorldX = camWorldX + relX;
                  const pWorldY = camWorldY + relY;
                  
                  const resObj = gridManager.getAsteroidFieldStrength(pWorldX, pWorldY, worldInfo);
                  const dens = resObj.density;
                  
                  const idx = (y * res + x) * 4;
                  if (this.densityBuffer) {
                      this.densityBuffer[idx]     = 95;
                      this.densityBuffer[idx + 1] = 110;
                      this.densityBuffer[idx + 2] = 125;
                      this.densityBuffer[idx + 3] = Math.min(255, Math.floor(dens * 255));
                  }
              }
          }
          if (this.densityTexture && this.densityBuffer) {
              this.densityTexture.update(this.densityBuffer);
          }
      }

      this.densityMesh.isVisible = true;
      this.densityMesh.position.set(width / 2, -height / 2, 20.0);
      this.densityMesh.scaling.set(width, height, 1);
  }

  public setScene(scene: BABYLON.Scene) {
      this.scene = scene;
      if (!this.noiseTex3D) {
          this.noiseTex3D = NoiseLUT.createNoiseTexture3D(scene, 32);
      }
      this.initAsteroidShader(scene);
      this.initAsteroidThinMesh(scene);
      this.initOrbitThinMesh(scene);
  }

  private initOrbitThinMesh(scene: BABYLON.Scene) {
      if (!this.orbitThinMesh) {
          const mat = new BABYLON.ShaderMaterial("orbitThinMat", scene, {
              vertex: "orbitInst",
              fragment: "orbitInst"
          }, {
              attributes: ["position", "uv", "matrix", "color", "instanceParams", "instanceCenter"],
              uniforms: ["worldViewProjection", "uCameraAngle", "uZoom"],
              needAlphaBlending: true
          });
          
          mat.backFaceCulling = false;
          mat.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
          
          this.orbitThinMesh = BABYLON.MeshBuilder.CreatePlane("orbitThinMesh", { size: 1.0 }, scene);
          this.orbitThinMesh.material = mat;
          this.orbitThinMesh.renderingGroupId = 0;
          this.orbitThinMesh.isPickable = false;
          this.orbitThinMesh.isVisible = false;
          
          this.orbitThinMesh.thinInstanceSetBuffer("matrix", this.orbitInstanceMatrices, 16, false);
          this.orbitThinMesh.thinInstanceSetBuffer("color", this.orbitInstanceColors, 4, false);
          this.orbitThinMesh.thinInstanceSetBuffer("instanceParams", this.orbitInstanceParams, 4, false);
          this.orbitThinMesh.thinInstanceSetBuffer("instanceCenter", this.orbitInstanceCenters, 2, false);
      }
  }

  private initAsteroidThinMesh(scene: BABYLON.Scene) {
      if (!this.asteroidThinMesh) {
          // Use a ShaderMaterial instead of StandardMaterial for textured look
          const mat = new BABYLON.ShaderMaterial("asteroidThinMat", scene, {
              vertex: "asteroid",
              fragment: "asteroid"
          }, {
              attributes: ["position", "uv", "matrix", "color"],
              uniforms: ["worldViewProjection", "uTime", "uNoiseTex3D"],
              samplers: ["uNoiseTex3D"],
              needAlphaBlending: true
          });
          
          if (this.noiseTex3D) {
              mat.setTexture("uNoiseTex3D", this.noiseTex3D);
          }
          mat.backFaceCulling = false;
          mat.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
          
          // Use a Quad for thin instances to handle procedural texture
          this.asteroidThinMesh = BABYLON.MeshBuilder.CreatePlane("asteroidThinMesh", { size: 2.4 }, scene);
          this.asteroidThinMesh.material = mat;
          this.asteroidThinMesh.renderingGroupId = 1;
          this.asteroidThinMesh.isPickable = false;
          this.asteroidThinMesh.isVisible = false;
          
          this.asteroidThinMesh.thinInstanceSetBuffer("matrix", this.asteroidInstanceMatrices, 16, false);
          this.asteroidThinMesh.thinInstanceSetBuffer("color", this.asteroidInstanceColors, 4, false);
      }
  }

  private initAsteroidShader(scene: BABYLON.Scene) {
      if (!BABYLON.Effect.ShadersStore["asteroidVertexShader"]) {
          BABYLON.Effect.ShadersStore["asteroidVertexShader"] = `
              precision highp float;
              attribute vec3 position;
              attribute vec2 uv;
              attribute mat4 matrix;
              attribute vec4 color;
              
              uniform mat4 worldViewProjection;
              varying vec2 vUV;
              varying vec4 vColor;
              varying vec2 vPos;

              void main() {
                  vUV = uv;
                  vColor = color;
                  vPos = position.xy;
                  gl_Position = worldViewProjection * matrix * vec4(position, 1.0);
              }
          `;
          
          BABYLON.Effect.ShadersStore["asteroidFragmentShader"] = `
              precision highp float;
              precision highp sampler3D;
              varying vec2 vUV;
              varying vec4 vColor;
              varying vec2 vPos;
              uniform sampler3D uNoiseTex3D;
              uniform float uTime;
              
              float noise(vec3 x) {
                  return textureLod(uNoiseTex3D, x, 0.0).r;
              }

              void main() {
                  vec2 p = vUV * 2.0 - 1.0;
                  float d = length(p);
                  
                  // Procedural Rock Shape (SDF + Noise)
                  // Use vColor.a as a hash for variety if needed
                  float n = noise(vec3(p * 0.8, vColor.a * 10.0));
                  float rockShape = d - (0.8 + n * 0.25);
                  
                  if (rockShape > 0.0) discard;
                  
                  // Rock Texture / Surface
                  float detail = noise(vec3(p * 2.5, vColor.a * 5.0)) * 0.6 + noise(vec3(p * 8.0, vColor.a)) * 0.4;
                  vec3 rockColor = vColor.rgb * (0.6 + detail * 0.4);
                  
                  // Rim highlight / Shade
                  float rim = 1.0 - d;
                  rockColor += vec3(1.0) * pow(max(0.0, rim - 0.2), 3.0) * 0.2;
                  rockColor -= vec3(1.0) * pow(max(0.0, 0.8 - rim), 2.0) * 0.15;

                  gl_FragColor = vec4(rockColor, 1.0);
              }
          `;
      }
      
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
              varying vec2 vUV;
              uniform float uMinRadius;  // in screen pixels
              uniform float uMaxRadius;  // in screen pixels
              uniform float uDensity;
              uniform vec2 uWorldCenter; 
              uniform float uCameraAngle;
              uniform float uZoom;
              uniform int uIsField; 
              
              vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
              float snoise(vec2 v){
                const vec4 C = vec4(0.211324865, 0.366025403, -0.577350269, 0.024390243);
                vec2 i  = floor(v + dot(v, C.yy) );
                vec2 x0 = v -   i + dot(i, C.xx);
                vec2 i1;
                i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                vec4 x12 = x0.xyxy + C.xxzz;
                x12.xy -= i1;
                i = mod(i, 289.0);
                vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
                vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                m = m*m; m = m*m;
                vec3 x = 2.0 * fract(p * C.www) - 1.0;
                vec3 h = abs(x) - 0.5;
                vec3 ox = floor(x + 0.5);
                vec3 a0 = x - ox;
                m *= 1.792842914 - 0.8537347209 * (a0*a0 + h*h);
                vec3 g;
                g.x  = a0.x  * x0.x  + h.x  * x0.y;
                g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                return 130.0 * dot(m, g);
              }
              
              void main() {
                  float sizePx = uMaxRadius * 2.0;
                  float screenDx = (vUV.x - 0.5) * sizePx;
                  float screenDy = (0.5 - vUV.y) * sizePx;
                  
                  float ca = cos(uCameraAngle); 
                  float sa = sin(uCameraAngle); 
                  vec2 relWorld = vec2(
                      screenDx * ca - screenDy * sa,
                      screenDx * sa + screenDy * ca
                  ) / uZoom;
                  
                  vec2 worldPos = uWorldCenter + relWorld;
                  float screenRad = length(vec2(screenDx, screenDy));
                  
                  if (screenRad < uMinRadius || screenRad > uMaxRadius) discard;
                  
                  float baseNoise = (snoise(worldPos * 1e-10) + 1.0) * 0.5;
                  float alpha = 0.0;
                  
                  if (uIsField == 1) {
                      float edgeFade = smoothstep(uMaxRadius, uMaxRadius * 0.8, screenRad);
                      if (uMinRadius > 1.0) {
                          edgeFade *= smoothstep(uMinRadius, uMinRadius * 1.2, screenRad);
                      }
                      
                      float threshold = 0.45;
                      if (baseNoise >= threshold) {
                         float f = (baseNoise - threshold) / (1.0 - threshold);
                         alpha = f * edgeFade * uDensity * 0.8;
                      }
                  } else {
                      float distFromMid = abs(screenRad - (uMinRadius + uMaxRadius) * 0.5);
                      float halfWidth = (uMaxRadius - uMinRadius) * 0.5;
                      float edgeFade = 1.0 - clamp(distFromMid / halfWidth, 0.0, 1.0);
                      
                      float detailNoise = (snoise(worldPos * 8e-10) + 1.0) * 0.5;
                      alpha = pow(edgeFade, 1.3) * uDensity;
                      if (detailNoise > 0.4) alpha *= 1.5;
                      if (uZoom > 0.01) {
                          float microNoise = (snoise(worldPos * 5e-8) + 1.0) * 0.5;
                          alpha *= smoothstep(0.3, 0.7, microNoise);
                      }
                  }
                  
                  if (alpha < 0.02) discard;
                  
                  vec3 color = mix(vec3(0.5, 0.45, 0.4), vec3(0.6, 0.6, 0.65), baseNoise);
                  gl_FragColor = vec4(color * alpha, alpha);
              }
          `;
      }
      
      if (!BABYLON.Effect.ShadersStore["orbitInstVertexShader"]) {
          BABYLON.Effect.ShadersStore["orbitInstVertexShader"] = `
              precision highp float;
              attribute vec3 position;
              attribute vec2 uv;
              attribute mat4 matrix;
              attribute vec4 color;
              attribute vec4 instanceParams;
              attribute vec2 instanceCenter;
              
              uniform mat4 worldViewProjection;
              varying vec2 vUV;
              varying vec4 vColor;
              varying vec4 vParams;
              varying vec2 vWorldCenter;

              void main() {
                  vUV = uv;
                  vColor = color;
                  vParams = instanceParams;
                  vWorldCenter = instanceCenter;
                  gl_Position = worldViewProjection * matrix * vec4(position, 1.0);
              }
          `;
          
          BABYLON.Effect.ShadersStore["orbitInstFragmentShader"] = `
              precision highp float;
              varying vec2 vUV;
              varying vec4 vColor;
              varying vec4 vParams;
              varying vec2 vWorldCenter;
              uniform float uCameraAngle;
              uniform float uZoom;

              vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
              float snoise(vec2 v){
                const vec4 C = vec4(0.211324865, 0.366025403, -0.577350269, 0.024390243);
                vec2 i  = floor(v + dot(v, C.yy) );
                vec2 x0 = v -   i + dot(i, C.xx);
                vec2 i1;
                i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
                vec4 x12 = x0.xyxy + C.xxzz;
                x12.xy -= i1;
                i = mod(i, 289.0);
                vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
                vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
                m = m*m; m = m*m;
                vec3 x = 2.0 * fract(p * C.www) - 1.0;
                vec3 h = abs(x) - 0.5;
                vec3 ox = floor(x + 0.5);
                vec3 a0 = x - ox;
                m *= 1.792842914 - 0.8537347209 * (a0*a0 + h*h);
                vec3 g;
                g.x  = a0.x  * x0.x  + h.x  * x0.y;
                g.yz = a0.yz * x12.xz + h.yz * x12.yw;
                return 130.0 * dot(m, g);
              }

              void main() {
                  float rMinNorm = vParams.x;
                  float rMaxNorm = vParams.y; // 0.5
                  float isField = vParams.z;
                  float rMax = vParams.w;
                  
                  vec2 p = vUV - 0.5;
                  float dist = length(p);
                  
                  if (dist > rMaxNorm || dist < rMinNorm) discard;
                  
                  float alpha = vColor.a;
                  if (isField > 0.5) {
                      vec2 screenRel = p * (rMax * 2.0);
                      float ca = cos(uCameraAngle);
                      float sa = sin(uCameraAngle);
                      vec2 worldRot = vec2(
                          screenRel.x * ca - screenRel.y * sa,
                          screenRel.x * sa + screenRel.y * ca
                      ) / uZoom;
                      vec2 worldPos = vWorldCenter + worldRot;

                      float baseNoise = (snoise(worldPos * 1e-10) + 1.0) * 0.5;
                      float threshold = 0.45;
                      float ringAlpha = 0.0;
                      if (baseNoise >= threshold) {
                         ringAlpha = (baseNoise - threshold) / (1.0 - threshold);
                      }
                      float edgeFade = smoothstep(rMaxNorm, rMaxNorm * 0.8, dist);
                      if (rMinNorm > 0.01) edgeFade *= smoothstep(rMinNorm, rMinNorm * 1.2, dist);
                      alpha *= ringAlpha * edgeFade;
                  } else {
                      // Lines: smooth edges
                      // Pixel width in UV coordinates
                      float edgeWidth = 0.75 / (rMax * 2.0); 
                      float edgeFade = smoothstep(rMaxNorm, rMaxNorm - edgeWidth, dist);
                      if (rMinNorm > 0.0) {
                          edgeFade *= smoothstep(rMinNorm, rMinNorm + edgeWidth, dist);
                      }
                      alpha *= edgeFade;
                  }
                  
                  if (alpha < 0.01) discard;
                  gl_FragColor = vec4(vColor.rgb * alpha, alpha);
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
              uniforms: ["worldViewProjection", "uMinRadius", "uMaxRadius", "uDensity", "uWorldCenter", "uCameraAngle", "uZoom", "uIsField"],
              needAlphaBlending: true
          }
      );
      mat.backFaceCulling = false;
      mat.alphaMode = BABYLON.Engine.ALPHA_PREMULTIPLIED; 
      
      const mesh = BABYLON.MeshBuilder.CreatePlane("asteroidRingBase", { size: 1 }, this.scene!);
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
      this.orbitThinCount = 0;
  }

  public updateAsteroidInstances(asteroids: any[], camera: Camera, width: number, height: number, now: number, targetId: string | null = null, miningTargetId: string | null = null) {
    const zoom = camera.zoom;
    const isZoomedOut = zoom < 0.05;
    const isVeryZoomedOut = zoom < 0.01;
    const isTactical = zoom < 0.01; 

    // Finalize Orbit Instances first
    if (this.orbitThinMesh) {
        this.orbitThinMesh.thinInstanceCount = this.orbitThinCount;
        this.orbitThinMesh.thinInstanceBufferUpdated("matrix");
        this.orbitThinMesh.thinInstanceBufferUpdated("color");
        this.orbitThinMesh.thinInstanceBufferUpdated("instanceParams");
        this.orbitThinMesh.thinInstanceBufferUpdated("instanceCenter");
        this.orbitThinMesh.isVisible = this.orbitThinCount > 0;
        
        const mat = this.orbitThinMesh.material as BABYLON.ShaderMaterial;
        mat.setFloat("uCameraAngle", camera.angle);
        mat.setFloat("uZoom", zoom);
    }

    const halfW = width / 2;
    const halfH = height / 2;
    const camX = camera.pos.offsetX;
    const camY = camera.pos.offsetY;
    const camSecX = camera.pos.sectorX;
    const camSecY = camera.pos.sectorY;
    const cosA = Math.cos(-camera.angle);
    const sinA = Math.sin(-camera.angle);
    const secSize = Number(SECTOR_SIZE_M);

    let thinCount = 0;

    for (let i = 0; i < asteroids.length && thinCount < this.maxAsteroidInstances; i++) {
        const ast = asteroids[i];
        if (ast.depleted) continue;

        const dx = Number(ast.sectorX - camSecX) * secSize + (ast.offsetX - camX);
        const dy = Number(ast.sectorY - camSecY) * secSize + (ast.offsetY - camY);
        
        const screenRadius = ast.radius * zoom;
        
        const rotX = dx * cosA - dy * sinA;
        const rotY = dx * sinA + dy * cosA;
        const sx = rotX * zoom + halfW;
        const sy = rotY * zoom + halfH;

        // Reverted culling logic
        const cullMargin = Math.max(screenRadius * 1.5, width, height); 
        if (sx + cullMargin < 0 || sx - cullMargin > width ||
            sy + cullMargin < 0 || sy - cullMargin > height) {
            continue;
        }

        const isTarget = ast.id === targetId || ast.id === miningTargetId;
        const numColor = this.colorToNumber(ast.color);
        
        // Reverted threshold for high-quality drawing
        if (screenRadius > 0.5) {
            this.drawAsteroid(ast, null, camera, width, height, isTarget, ast.id === miningTargetId);
        } else if (this.asteroidThinMesh) {
            const r = ((numColor >> 16) & 0xff) / 255.0;
            const g = ((numColor >> 8) & 0xff) / 255.0;
            const b = (numColor & 0xff) / 255.0;
            
            // Adjust to screen dimensions that Babylon expects
            const screenRadCapped = Math.max(0.5, screenRadius);
            const bX = sx;
            const bY = -sy;
            
            const baseIdx = thinCount * 16;
            this.asteroidInstanceMatrices[baseIdx] = screenRadCapped;     
            this.asteroidInstanceMatrices[baseIdx + 5] = screenRadCapped; 
            this.asteroidInstanceMatrices[baseIdx + 10] = 1;         
            this.asteroidInstanceMatrices[baseIdx + 12] = bX;        
            this.asteroidInstanceMatrices[baseIdx + 13] = bY;       
            this.asteroidInstanceMatrices[baseIdx + 14] = 2.0;       
            this.asteroidInstanceMatrices[baseIdx + 15] = 1;         
            
            const colBase = thinCount * 4;
            this.asteroidInstanceColors[colBase] = r;
            this.asteroidInstanceColors[colBase + 1] = g;
            this.asteroidInstanceColors[colBase + 2] = b;
            this.asteroidInstanceColors[colBase + 3] = (ast.id.charCodeAt(0) % 100) / 100.0;
            
            thinCount++;
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
      this.drawAsteroidRing(coords, 0, radius, camera, width, height, now, color, alpha);
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
      this.drawAsteroidRing(coords, 0, radius, camera, width, height, now, color, alpha);
    }
  }

  public drawAsteroidRing(
    coords: GlobalCoords,
    minRadius: number,
    maxRadius: number,
    camera: Camera,
    width: number,
    height: number,
    now: number,
    color: any = 0x4466aa,
    alphaOverride: number | null = null
  ) {
    const zoom = camera.zoom;
    const rMin = minRadius * zoom;
    const rMax = maxRadius * zoom;

    if (rMax < 0.5) return;

    const isArea = Math.abs(maxRadius - minRadius) > 10;
    
    // High-precision vector lines for thin paths/orbits to avoid massive float32 rounding-error jitter on large scales.
    if (!isArea) {
      // Calculate smooth segments based on radius on screen to keep performance ultra-high.
      const segments = Math.max(32, Math.min(128, Math.floor(rMax * 0.1)));
      
      const colorData = this.parseColor(color);
      const ringColor = colorData.color;
      const alpha = alphaOverride !== null ? alphaOverride : Math.min(0.3, rMax / 400);
      if (alpha <= 0.005) return;

      const camSecX = camera.pos.sectorX;
      const camSecY = camera.pos.sectorY;
      const camX = camera.pos.offsetX;
      const camY = camera.pos.offsetY;
      const secSize = Number(SECTOR_SIZE_M);
      
      // Calculate position relative to camera in meters using dynamic float64.
      const baseX = Number(coords.sectorX - camSecX) * secSize + (coords.offsetX - camX);
      const baseY = Number(coords.sectorY - camSecY) * secSize + (coords.offsetY - camY);

      const cosA = Math.cos(-camera.angle);
      const sinA = Math.sin(-camera.angle);
      const halfW = width / 2;
      const halfH = height / 2;

      // Only draw chunks of the line that are in or close to the viewport (float32 precision boundary)
      const margin = Math.max(width, height) * 0.8;
      
      this.graphics.beginPath();
      
      let lastPointInside = false;
      let hasStartedPath = false;

      // Draw segments in high double-precision and project
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        const wx = baseX + Math.cos(theta) * maxRadius;
        const wy = baseY + Math.sin(theta) * maxRadius;
        
        // Orthographic projection to screenspace
        const rotX = wx * cosA - wy * sinA;
        const rotY = wx * sinA + wy * cosA;
        const sx = rotX * zoom + halfW;
        const sy = rotY * zoom + halfH;

        const isInside = (sx >= -margin && sx <= width + margin && sy >= -margin && sy <= height + margin);

        if (isInside) {
          if (!hasStartedPath || !lastPointInside) {
            this.graphics.moveTo(sx, sy);
            hasStartedPath = true;
          } else {
            this.graphics.lineTo(sx, sy);
          }
        } else {
          // Keep a contiguous line through viewport edges
          if (lastPointInside) {
            this.graphics.lineTo(sx, sy);
          }
        }
        lastPointInside = isInside;
      }

      this.graphics.stroke({ color: ringColor, width: 1.0, alpha: alpha });
      return;
    }

    // Performance optimization: Move wide asteroid fields to instanced GPU rendering
    if (this.orbitThinMesh && this.orbitThinCount < this.maxOrbitInstances) {
        const camSecX = camera.pos.sectorX;
        const camSecY = camera.pos.sectorY;
        const camX = camera.pos.offsetX;
        const camY = camera.pos.offsetY;
        const secSize = Number(SECTOR_SIZE_M);

        const dx = Number(coords.sectorX - camSecX) * secSize + (coords.offsetX - camX);
        const dy = Number(coords.sectorY - camSecY) * secSize + (coords.offsetY - camY);
        
        // Culling
        const halfW = width / 2;
        const halfH = height / 2;
        const cosA = Math.cos(-camera.angle);
        const sinA = Math.sin(-camera.angle);
        const rotX = dx * cosA - dy * sinA;
        const rotY = dx * sinA + dy * cosA;
        const sx = rotX * zoom + halfW;
        const sy = rotY * zoom + halfH;
        
        if (sx + rMax < 0 || sx - rMax > width || sy + rMax < 0 || sy - rMax > height) return;

        // Babylon Orthographic camera uses 0,0 as center.
        const bX = sx;
        const bY = -sy;

        const baseIdx = this.orbitThinCount * 16;
        const scale = rMax * 2;
        this.orbitInstanceMatrices[baseIdx] = scale;
        this.orbitInstanceMatrices[baseIdx + 5] = scale;
        this.orbitInstanceMatrices[baseIdx + 10] = 1;
        this.orbitInstanceMatrices[baseIdx + 12] = bX;
        this.orbitInstanceMatrices[baseIdx + 13] = bY;
        this.orbitInstanceMatrices[baseIdx + 14] = 10.0; // depth
        this.orbitInstanceMatrices[baseIdx + 15] = 1;

        const colIdx = this.orbitThinCount * 4;
        const colorData = this.parseColor(color);
        let ringColor = colorData.color;
        let alpha = alphaOverride !== null ? alphaOverride : (isArea ? 0.6 : Math.min(0.3, rMax / 400));
        
        this.orbitInstanceColors[colIdx] = ((ringColor >> 16) & 0xff) / 255;
        this.orbitInstanceColors[colIdx + 1] = ((ringColor >> 8) & 0xff) / 255;
        this.orbitInstanceColors[colIdx + 2] = (ringColor & 0xff) / 255;
        this.orbitInstanceColors[colIdx + 3] = alpha;

        const paramIdx = this.orbitThinCount * 4;
        const innerNorm = isArea ? (rMin / scale) : Math.max(0.01, 0.5 - (1.5 / scale));
        this.orbitInstanceParams[paramIdx] = innerNorm;
        this.orbitInstanceParams[paramIdx + 1] = 0.5;          // Normalized outer radius (fixed 0.5 for Plane)
        this.orbitInstanceParams[paramIdx + 2] = isArea ? 1 : 0; // Type: 1 = Field, 0 = Line
        this.orbitInstanceParams[paramIdx + 3] = rMax;         // Raw max radius for zoom scaling logic

        const centerIdx = this.orbitThinCount * 2;
        const worldX = Number(coords.sectorX * BigInt(SECTOR_SIZE_M)) + coords.offsetX;
        const worldY = Number(coords.sectorY * BigInt(SECTOR_SIZE_M)) + coords.offsetY;
        this.orbitInstanceCenters[centerIdx] = worldX;
        this.orbitInstanceCenters[centerIdx + 1] = worldY;
        
        this.orbitThinCount++;
        return;
    }

    // Fallback if instances full (unlikely)
    this.graphics.circle(camera.worldToScreen(coords, width, height).x, camera.worldToScreen(coords, width, height).y, rMax);
    this.graphics.stroke({ color: 0x4466aa, width: 1, alpha: 0.2 });
  }

  public drawAsteroidChunk(coords: GlobalCoords, radius: number, camera: Camera, width: number, height: number) {
    // Polygon-based chunk rendering removed in favor of the analytical density haze overlay.
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

    if (screen.x + screenRadius * 4 < -50 || screen.x - screenRadius * 4 > width + 50 ||
        screen.y + screenRadius * 4 < -50 || screen.y - screenRadius * 4 > height + 50) {
      return;
    }

    const colorNum = this.colorToNumber(asteroid.color);
    const rng = this.createStaticRNG(asteroid.id);
    
    // Draw "textured" rock body using overlapping shapes and shading
    if (screenRadius > 4.0) {
        const sides = 8 + Math.floor(rng() * 6);
        
        // Background shadow (larger, offset)
        this.graphics.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const jitter = 0.82 + 0.18 * rng(); 
            this.graphics.lineTo(screen.x + Math.cos(angle) * screenRadius * jitter, screen.y + Math.sin(angle) * screenRadius * jitter);
        }
        this.graphics.closePath();
        this.graphics.fill({ color: 0x000000, alpha: 0.3 });

        // Main colored body
        this.graphics.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const jitter = 0.88 + 0.12 * rng(); 
            this.graphics.lineTo(screen.x + Math.cos(angle) * screenRadius * 0.95 * jitter, screen.y + Math.sin(angle) * screenRadius * 0.95 * jitter);
        }
        this.graphics.closePath();
        this.graphics.fill({ color: colorNum });

        // Highlight/Reflection (simulates texture/surface)
        this.graphics.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const jitter = 0.8 + 0.2 * rng(); 
            this.graphics.lineTo(screen.x - screenRadius*0.2 + Math.cos(angle) * screenRadius * 0.4 * jitter, screen.y - screenRadius*0.2 + Math.sin(angle) * screenRadius * 0.4 * jitter);
        }
        this.graphics.closePath();
        this.graphics.fill({ color: 0xffffff, alpha: 0.1 });

        // Details / craters (only if big enough to see)
        if (screenRadius > 8.0) {
            const dct = Math.floor(3 + rng() * 4);
            for(let j=0; j<dct; j++) {
                const cx = screen.x + (rng()-0.5)*screenRadius*1.2;
                const cy = screen.y + (rng()-0.5)*screenRadius*1.2;
                const cr = screenRadius*(0.1+rng()*0.15);
                this.graphics.circle(cx, cy, cr);
                this.graphics.fill({ color: 0x000000, alpha: 0.15 });
            }
        }
    } else if (screenRadius > 0.5) {
        // Fast, high-contrast, perfectly visible clean circles for zoomed-out details
        // Slightly bigger to make them genuinely discernable on screen
        const renderRad = Math.max(1.8, screenRadius);
        this.graphics.circle(screen.x, screen.y, renderRad);
        this.graphics.fill({ color: colorNum });
    }

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
      this.graphics.fill({ color: 0x00ffcc, alpha: 0.3 }); // Lower alpha so we see the body
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

  public drawGrid(camera: Camera, width: number, height: number, spacing: number) {
    if (!spacing || spacing <= 0 || isNaN(spacing)) return;
    
    const color = 0x333333;
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



  public createStaticRNG(id: string) {
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
