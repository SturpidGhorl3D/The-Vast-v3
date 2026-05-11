import * as BABYLON from '@babylonjs/core';
import { BaseRenderer } from './BaseRenderer';
import { Camera } from '../camera';
import { GlobalCoords } from '../../../components/game/types';

export class CelestialRenderer extends BaseRenderer {
  private scene: BABYLON.Scene;
  private meshPool: { mesh: BABYLON.Mesh, mat: BABYLON.ShaderMaterial }[] = [];
  private activeMeshes: { mesh: BABYLON.Mesh, mat: BABYLON.ShaderMaterial }[] = [];

  constructor(scene: BABYLON.Scene) {
    super(null as any); 
    this.scene = scene;
    
    if (!BABYLON.Effect.ShadersStore["celestialVertexShader"]) {
        BABYLON.Effect.ShadersStore["celestialVertexShader"] = `
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
        
        BABYLON.Effect.ShadersStore["celestialFragmentShader"] = `
            precision highp float;
            varying vec2 vUV;

            uniform vec4 uBaseColor;
            uniform vec3 uScatteringColor;
            uniform float uRadius;
            uniform vec4 uAtmosphereParams; // x: height, y: density, z: humidity, w: isGasGiant
            uniform float uType; // 0: Star, 1: Planet, 2: Satellite
            uniform float uTime;
            uniform float uZoom;
            uniform vec3 uLightDir;
            uniform float uLightIntensity;
            uniform mat3 uAxisTilt;
            uniform float uSurfaceRotation;
            uniform float uCloudRotation;
            uniform float uScale;

            float hash(vec3 p3) {
                vec3 p = fract(p3 * 0.1031);
                p += dot(p, p.yzx + 19.19);
                return fract((p.x + p.y) * p.z);
            }

            float noise(vec3 x) {
                vec3 i = floor(x);
                vec3 f = fract(x);
                f = f * f * (3.0 - 2.0 * f);
            
                float n000 = hash(i + vec3(0.0,0.0,0.0)); float n100 = hash(i + vec3(1.0,0.0,0.0));
                float n010 = hash(i + vec3(0.0,1.0,0.0)); float n110 = hash(i + vec3(1.0,1.0,0.0));
                float n001 = hash(i + vec3(0.0,0.0,1.0)); float n101 = hash(i + vec3(1.0,0.0,1.0));
                float n011 = hash(i + vec3(0.0,1.0,1.0)); float n111 = hash(i + vec3(1.0,1.0,1.0));

                float mixZ0 = mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y);
                float mixZ1 = mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y);
                return mix(mixZ0, mixZ1, f.z);
            }
            
            float fbm(vec3 p) {
                float f = 0.0;
                float w = 0.5;
                for (int i = 0; i < 4; i++) {
                    f += w * noise(p);
                    p *= 2.0;
                    w *= 0.5;
                }
                return f;
            }

            float detailNoise(vec3 p) {
                float f = 0.0;
                float w = 0.5;
                // Optimized detail noise loop locally
                for (int i = 0; i < 2; i++) {
                    f += w * noise(p);
                    p *= 3.5;
                    w *= 0.5;
                }
                return f;
            }

            mat3 rotationY(float angle) {
                float s = sin(angle);
                float c = cos(angle);
                return mat3(c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c);
            }

            void main() {
                vec2 p = vUV * 2.0 - 1.0; 
                float margin = uType == 0.0 ? 8.0 : 2.5; 
                p *= margin; 
                
                float d = length(p);
                bool useLOD = uRadius < 5.0;
                
                // Anti-aliasing width (1 pixel in screen space transformed to uv space)
                float aa = (1.0 / max(uScale, 1.0)) * margin; 

                vec4 finalColor = vec4(0.0);

                if (uType == 0.0) { // STAR
                    float deformation = fbm(vec3(p * 1.5, uTime * 0.05)) * 0.02;
                    float edge = 1.0 + deformation;
                    
                    // Solid body of star (alpha = 1 inside, 0 outside)
                    float coreAlpha = smoothstep(edge + aa, edge - aa, d);
                    
                    // Surface detail
                    float z2 = max(0.0, 1.0 - (d/edge)*(d/edge));
                    vec3 normal = vec3(p/edge, sqrt(z2));
                    float n = fbm(normal * 3.0 + vec3(0.0, uTime * 0.05, 0.0));
                    float flare = fbm(normal * 4.0 - vec3(uTime * 0.03, uTime * 0.03, uTime * 0.03));
                    
                    vec3 coreColor = mix(uBaseColor.rgb, vec3(1.0), 0.4);
                    vec3 colored = mix(coreColor, vec3(1.0), smoothstep(0.3, 0.8, n + flare * 0.2));
                    float centerGlow = clamp(1.0 - (d/edge), 0.0, 1.0);
                    colored = mix(colored, vec3(1.0), pow(centerGlow, 2.5) * 0.6);
                    
                    // Glow & Rays (Additive)
                    float angle = atan(p.y, p.x);
                    float r1 = sin(angle * 3.0 + uTime * 0.05);
                    float r2 = sin(angle * 7.0 - uTime * 0.03);
                    float r3 = sin(angle * 13.0 + uTime * 0.1);
                    
                    float w1 = 10.0 + 5.0 * sin(angle * 5.0);
                    float w2 = 20.0 + 10.0 * sin(angle * 11.0);
                    float w3 = 30.0 + 15.0 * sin(angle * 17.0);
                    
                    float rays = pow(abs(r1), w1) * 0.15 + pow(abs(r2), w2) * 0.1 + pow(abs(r3), w3) * 0.05;
                    rays *= 0.8 + 0.2 * sin(uTime * 0.5);
                    
                    float glowIntensity = exp(-0.8 * max(0.0, d - edge));
                    glowIntensity += rays * exp(-0.5 * max(0.0, d - edge));
                    
                    vec3 outsideGlow = uBaseColor.rgb * glowIntensity;
                    outsideGlow += vec3(1.0, 0.95, 0.9) * rays * glowIntensity * 1.5;
                    outsideGlow *= smoothstep(margin, margin * 0.8, d); // fade out at edge of box
                    
                    // Fade out the glow if the star is very small (LOD effect)
                    // At uRadius = 15.0, full glow. At uRadius = 2.0, glow fades out completely.
                    float glowBlend = smoothstep(2.0, 15.0, uRadius);
                    outsideGlow *= glowBlend;
                    
                    // For very small stars, we ensure there's at least a simple core dot.
                    float rLOD = length(p);
                    float starLOD = max(0.0, 1.0 - pow(abs(p.x), 0.5) - pow(abs(p.y), 0.5));
                    starLOD += exp(-5.0 * rLOD) * 0.5;
                    vec3 colLOD = uBaseColor.rgb * starLOD + vec3(1.0) * pow(starLOD, 3.0);
                    float alphaLOD = smoothstep(aa, -aa, d - 1.0);
                    
                    // Combine core and glow. 
                    vec3 outputRgb = mix(outsideGlow, colored, coreAlpha);
                    
                    // Mix the high-res shader to the low-res LOD
                    outputRgb = mix(colLOD, outputRgb, glowBlend);
                    coreAlpha = mix(alphaLOD, coreAlpha, glowBlend);
                    
                    finalColor = vec4(outputRgb, coreAlpha);
                } else { // PLANET / SATELLITE
                    if (useLOD) {
                        float r = length(p);
                        float star = max(0.0, 1.0 - pow(abs(p.x), 0.7) - pow(abs(p.y), 0.7));
                        star *= exp(-2.0 * r);
                        
                        vec3 col = uBaseColor.rgb * (star + exp(-8.0 * (max(0.0, r - 1.0))) * 0.2);
                        float alpha = smoothstep(aa, -aa, d - 1.0);
                        finalColor = vec4(col, alpha);
                    } else {
                        float surfaceEdge = 1.0;
                        float atmosphereHeight = max(uAtmosphereParams.x, 0.001);
                        float atmosphereDensity = uAtmosphereParams.y;
                        float humidity = uAtmosphereParams.z;
                        float isGasGiant = uAtmosphereParams.w;
                        float cloudEdge = surfaceEdge + atmosphereHeight * 0.25; 

                        vec3 lightDir = normalize(uLightDir);
                        
                        float coreAlpha = smoothstep(surfaceEdge + aa, surfaceEdge - aa, d);
                        float cloudSphereAlpha = smoothstep(cloudEdge + aa, cloudEdge - aa, d);
                        
                        vec3 compRGB = vec3(0.0);
                        float compAlpha = 0.0;
                        
                        // ATMOSPHERE CALCULATION (Glow - Additive)
                        float distFromSurface = max(0.0, d - surfaceEdge);
                        float atmFalloff = exp(-pow(distFromSurface / atmosphereHeight, 1.3) * 4.0);
                        float opticalDepth = atmFalloff * atmosphereDensity;
                        
                        // Calculate lighting scattering taking sphere normal roughly
                        vec3 pSphereNorm = vec3(p, sqrt(max(0.0, 1.0 - min(d*d, 1.0))));
                        if (d > surfaceEdge) pSphereNorm = vec3(p/d, 0.0);
                        float scatterDiff = max(0.0, dot(pSphereNorm, lightDir));
                        
                        // Atmospheric halo color (Additive glow around planet)
                        vec3 atmGlowColor = uScatteringColor * opticalDepth * (scatterDiff * 2.0 + 0.1) * uLightIntensity; 
                        atmGlowColor *= smoothstep(margin, margin * 0.8, d);
                        
                        // SURFACE & GAS GIANT BODY
                        if (coreAlpha > 0.001) {
                            float z2 = max(0.0, 1.0 - min(d * d, 1.0));
                            vec3 normal = vec3(p, sqrt(z2));
                            float diff = max(0.0, dot(normal, lightDir));

                            vec3 wp = uAxisTilt * rotationY(uSurfaceRotation) * normal;
                            vec3 surfaceColor = vec3(0.0);
                            
                            if (isGasGiant > 0.5) {
                                float lat = wp.y;
                                float bandNoise = fbm(vec3(wp.x * 2.5, wp.y * 12.0, wp.z * 2.5) + uTime * 0.01);
                                float bands = sin(lat * 15.0 + bandNoise * 4.0);
                                bands = smoothstep(-0.2, 0.2, bands);
                                
                                vec3 baseCol = uBaseColor.rgb;
                                vec3 bandCol = mix(uBaseColor.rgb, uScatteringColor, 0.4) * 1.5;
                                surfaceColor = mix(baseCol, bandCol, bands);
                                
                                float stormNoise = fbm(wp * 6.0 - uTime * 0.04);
                                float swirl = fbm(wp * 15.0 + stormNoise * 2.0);
                                surfaceColor = mix(surfaceColor, mix(baseCol, bandCol, 0.5), swirl * 0.3);
                                
                                surfaceColor *= (diff * 0.9 + 0.1);
                            } else {
                                float n = fbm(wp * 4.0);
                                float pr = uScale / 2.5; 
                                
                                // Increase detail dynamically but properly clamped
                                float dp1 = clamp((pr - 100.0) / 100.0, 0.0, 1.0);
                                if (dp1 > 0.0) {
                                    n += (detailNoise(wp * 20.0) - 0.45) * 0.3 * dp1;
                                }
                                float dp2 = clamp((pr - 300.0) / 100.0, 0.0, 1.0);
                                if (dp2 > 0.0) {
                                    n += (detailNoise(wp * 60.0) - 0.45) * 0.2 * dp2;
                                }
                                
                                surfaceColor = mix(uBaseColor.rgb * 0.2, uBaseColor.rgb, smoothstep(0.3, 0.7, n));
                                surfaceColor *= (diff * 0.8 + 0.05); // ambient 
                            }
                            
                            // Atmosphere extinction on surface (Rim light)
                            float rim = pow(max(0.0, 1.0 - normal.z), 3.0);
                            surfaceColor = mix(surfaceColor, uScatteringColor * diff, rim * atmosphereDensity * 0.8 * diff);
                            surfaceColor *= uLightIntensity;
                            
                            compRGB = surfaceColor * coreAlpha;
                            compAlpha = coreAlpha;
                        }
                        
                        // CLOUDS (Separate sphere layer over surface and empty space)
                        if (cloudSphereAlpha > 0.001 && isGasGiant < 0.5 && humidity > 0.01) {
                            float dNormCloud = d / cloudEdge;
                            float z2Cloud = max(0.0, 1.0 - min(dNormCloud * dNormCloud, 1.0));
                            vec3 cNormal = vec3(p / cloudEdge, sqrt(z2Cloud));
                            float diffC = max(0.0, dot(cNormal, lightDir));
                            
                            vec3 cp = uAxisTilt * rotationY(uCloudRotation) * cNormal;
                            float cloudNoise = fbm(cp * 5.0 + vec3(uTime * 0.01));
                            
                            float pr = uScale / 2.5; 
                            float dp1 = clamp((pr - 100.0) / 100.0, 0.0, 1.0);
                            if (dp1 > 0.0) {
                                cloudNoise += (detailNoise(cp * 25.0 + vec3(uTime * 0.005)) - 0.45) * 0.35 * dp1;
                            }
                            
                            float cloudA = smoothstep(0.4, 0.7 - humidity * 0.2, cloudNoise) * humidity * cloudSphereAlpha;
                            vec3 cloudColor = vec3(1.0) * (diffC * 0.95 + 0.05) * uLightIntensity;
                            
                            // Composite over surface
                            compRGB = cloudColor * cloudA + compRGB * (1.0 - cloudA);
                            compAlpha = cloudA + compAlpha * (1.0 - cloudA);
                        }
                        
                        // Output is additive glow + composite core
                        finalColor = vec4(compRGB + atmGlowColor, compAlpha);
                    }
                }
                
                // Very tiny alphas/colors mean empty space
                if (finalColor.r < 0.005 && finalColor.g < 0.005 && finalColor.b < 0.005 && finalColor.a < 0.005) discard;
                gl_FragColor = finalColor;
            }
        `;
    }
  }

  public beginFrame() {
      for (const obj of this.activeMeshes) {
          obj.mesh.isVisible = false;
          this.meshPool.push(obj);
      }
      this.activeMeshes = [];
  }
  
  private getMeshObj(): { mesh: BABYLON.Mesh, mat: BABYLON.ShaderMaterial } {
     if (this.meshPool.length > 0) {
         return this.meshPool.pop()!;
     }

     const mat = new BABYLON.ShaderMaterial(
         "celestialMat",
         this.scene,
         {
             vertex: "celestial",
             fragment: "celestial",
         },
         {
             attributes: ["position", "uv"],
             uniforms: [
                 "worldViewProjection",
                 "uBaseColor", "uScatteringColor", "uAtmosphereParams",
                 "uRadius", "uType", "uTime", "uZoom", "uLightDir", "uLightIntensity",
                 "uAxisTilt", "uSurfaceRotation", "uCloudRotation", "uScale"
             ],
             needAlphaBlending: true
         }
     );

     mat.backFaceCulling = false;
     mat.disableLighting = true;
     // CRITICAL: Premultiplied alpha mode for combined occlusion (alpha=1) and additive glow (alpha=0)!
     mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHATESTANDBLEND; 
     mat.alphaMode = BABYLON.Engine.ALPHA_PREMULTIPLIED;

     const mesh = BABYLON.MeshBuilder.CreatePlane("celestialSphere", { size: 1 }, this.scene);
     mesh.material = mat;

     return { mesh, mat };
  }

  public drawCelestial(
    data: any, 
    camera: Camera, 
    width: number, 
    height: number,
    time: number,
    lightDir: {x: number, y: number} = {x: 0, y: 0}
  ): boolean {
    const isStar = !data.type && data.starRadius; 
    const coords = { 
      sectorX: data.sectorX ?? 0n, 
      sectorY: data.sectorY ?? 0n, 
      offsetX: data.offsetX ?? 0, 
      offsetY: data.offsetY ?? 0 
    };
    const radius = isStar ? data.starRadius : data.radius;
    const type = isStar ? 'STAR' : (data.orbitRadius ? 'PLANET' : 'SATELLITE');

    const screen = camera.worldToScreen(coords, width, height);
    const screenRadius = radius * camera.zoom;
    
    if (screenRadius < 4.0) return false;

    const margin = type === 'STAR' ? 8.0 : 2.5;
    let boxSize = screenRadius * margin * 2.0;
    if (boxSize < 16) boxSize = 16;

    if (screen.x + boxSize / 2 < 0 || screen.x - boxSize / 2 > width ||
        screen.y + boxSize / 2 < 0 || screen.y - boxSize / 2 > height) {
      return true;
    }

    const celestialObj = this.getMeshObj();
    this.activeMeshes.push(celestialObj);
    celestialObj.mesh.isVisible = true;

    celestialObj.mesh.position.x = screen.x;
    celestialObj.mesh.position.y = -screen.y; 
    
    celestialObj.mesh.scaling.x = boxSize;
    celestialObj.mesh.scaling.y = boxSize;

    const mat = celestialObj.mat;
    mat.setFloat("uTime", time);
    mat.setFloat("uZoom", camera.zoom);
    mat.setFloat("uRadius", screenRadius);
    mat.setFloat("uScale", boxSize);
    
    const uBaseColor = this.parseColor(data.color || data.starColor || '#ffffff');
    const r = ((uBaseColor.color >> 16) & 0xFF) / 255.0;
    const g = ((uBaseColor.color >> 8) & 0xFF) / 255.0;
    const b = (uBaseColor.color & 0xFF) / 255.0;
    
    mat.setColor4("uBaseColor", new BABYLON.Color4(r, g, b, uBaseColor.alpha));
    mat.setFloat("uType", isStar ? 0.0 : (type === 'PLANET' ? 1.0 : 2.0));
    
    if (type !== 'STAR') {
       const scatter = this.parseColor(data.scatteringColor || '#ffffff');
       mat.setColor3("uScatteringColor", new BABYLON.Color3(
         ((scatter.color >> 16) & 0xFF) / 255.0,
         ((scatter.color >> 8) & 0xFF) / 255.0,
         (scatter.color & 0xFF) / 255.0
       ));

       mat.setVector4("uAtmosphereParams", new BABYLON.Vector4(
         data.atmosphereHeight ?? 0.0,
         data.atmosphereDensity ?? 0.0,
         data.humidity ?? 0.0,
         data.type === 'GAS_GIANT' ? 1.0 : 0.0
       ));

       const tilt = data.axisTilt ?? 0;
       const ct = Math.cos(tilt);
       const st = Math.sin(tilt);
       
       const floatArray = new Float32Array([
           1, 0, 0,
           0, ct, st, 
           0, -st, ct
       ]);
       
       mat.onBind = () => {
           const effect = mat.getEffect();
           if (effect) {
              effect.setMatrix3x3("uAxisTilt", floatArray);
           }
       };
       
       let rotSpeed = data.rotationSpeed ?? 0.03;
       let cloudRotSpeed = data.cloudRotationSpeed ?? 0.05;
       mat.setFloat("uSurfaceRotation", time * rotSpeed);
       mat.setFloat("uCloudRotation", time * cloudRotSpeed);
       
       const camCos = Math.cos(camera.angle);
       const camSin = Math.sin(camera.angle);
       // lightDir is passed as (-orbitX, -orbitY) for planets relative to star.
       const lx = lightDir.x * camCos - lightDir.y * camSin;
       const ly = lightDir.x * camSin + lightDir.y * camCos;
       const len = Math.hypot(lx, ly);
       
       let intensity = 1.0;
       if (len > 0) {
           mat.setVector3("uLightDir", new BABYLON.Vector3(lx / len, ly / len, 0.2));
           const rInAU = len / 149597870700; 
           // 2.0 at star surface, 1.0 at 1 AU, 0.1 at 19 AU, min 0.05 
           intensity = Math.max(0.05, 2.0 / (1.0 + rInAU)); 
       } else {
           mat.setVector3("uLightDir", new BABYLON.Vector3(0, 0, 1));
       }
       mat.setFloat("uLightIntensity", intensity);
    } else {
       mat.setVector4("uAtmosphereParams", new BABYLON.Vector4(1.0, 1.0, 0.0, 0.0));
       mat.setVector3("uLightDir", new BABYLON.Vector3(0, 0, 1));
       mat.setFloat("uLightIntensity", 1.0);
    }

    return true;
  }
}
