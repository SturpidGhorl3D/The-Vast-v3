
'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { CreaturePart, CreaturePartNode } from './types';

interface PortraitCanvasProps {
  parts: CreaturePart[];
  selectedPartId: string;
  editorMode: 'VIEW' | 'SHAPE' | 'JOINTS';
  jointsSubMode: 'ANCHOR' | 'JOINT';
  camera: { x: number, y: number, zoom: number };
  onCameraChange: (cam: { x: number, y: number, zoom: number }) => void;
  onUpdatePart?: (id: string, updates: Partial<CreaturePart>) => void;
}

const textureCache: Record<string, HTMLImageElement> = {};
const getTexture = (dataUrl: string) => {
    if (!dataUrl) return null;
    if (!textureCache[dataUrl]) {
        const img = new Image();
        img.src = dataUrl;
        textureCache[dataUrl] = img;
    }
    return textureCache[dataUrl];
};

export function PortraitCanvas({
  parts,
  selectedPartId,
  editorMode,
  jointsSubMode,
  camera,
  onCameraChange,
  onUpdatePart
}: PortraitCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef(0);
  const verletStateRef = useRef<Record<string, Array<{ worldX: number, worldY: number, vx: number, vy: number }>>>({});
  const lastTimeRef = useRef<{time: number}>({time: 0});

  const getScreenToWorld = useCallback((sx: number, sy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const cx = canvas.width / 2;
    const cy = Math.max(canvas.height / 2, canvas.height * 0.4);
    
    // Reverse transform
    let x = (sx - rect.left - cx) / camera.zoom - camera.x;
    let y = (sy - rect.top - cy) / camera.zoom - camera.y;
    return { x, y };
  }, [camera]);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
      }
    };
    handleResize();
    const ro = new ResizeObserver(handleResize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const computeTransforms = useCallback((time: number, isEditing: boolean) => {
    const cache: Record<string, { x: number, y: number, rotation: number }> = {};
    const localRots: Record<string, number> = {};
    
    let dt = 0.016; 
    
    parts.forEach(p => {
       const getAnimRot = (type: string, speed: number, amp: number, phase: number) => {
          if (type === 'SKELETAL' || type === 'DEFORMATION') {
             return (Math.sin(time * speed + phase) * amp) * Math.PI / 180;
          }
          return 0;
       };

       let rot = p.rotation * Math.PI / 180;
       if (!isEditing && p.animSpeed > 0) {
           let mainRot = getAnimRot(p.animType, p.animSpeed, p.animAmplitude, p.animPhase);
           
           if (p.secondaryAnimType && p.secondaryAnimType !== 'NONE' && p.animMixFactor !== undefined) {
              let secRot = getAnimRot(p.secondaryAnimType, p.animSpeed, p.animAmplitude, p.animPhase + Math.PI / 2);
              mainRot = mainRot * (1 - p.animMixFactor) + secRot * p.animMixFactor;
           }
           rot += mainRot;
       }
       
       if (p.minRotation !== undefined || p.maxRotation !== undefined) {
           const min = (p.minRotation ?? -180) * Math.PI / 180;
           const max = (p.maxRotation ?? 180) * Math.PI / 180;
           rot = Math.max(min, Math.min(max, rot));
       }
       localRots[p.id] = rot;
    });

    const getTransformWithRots = (id: string, rots: Record<string, number>, c: Record<string, {x: number, y: number, rotation: number}>) => {
      if (c[id]) return c[id];
      const part = parts.find(p => p.id === id);
      if (!part) return { x: 0, y: 0, rotation: 0 };
      
      const radLocalRot = rots[id] || 0;

      if (!part.parentId) {
         c[id] = { x: 0, y: 0, rotation: radLocalRot };
         return c[id];
      }
      
      const parentTransform = getTransformWithRots(part.parentId, rots, c);
      const parentPart = parts.find(p => p.id === part.parentId);
      if (!parentPart) {
         c[id] = { x: 0, y: 0, rotation: radLocalRot };
         return c[id];
      }
      
      const cos = Math.cos(parentTransform.rotation);
      const sin = Math.sin(parentTransform.rotation);
      const dx = part.attachX - parentPart.anchorX;
      const dy = part.attachY - parentPart.anchorY;
      
      const attachGlobalX = parentTransform.x + (dx * cos - dy * sin);
      const attachGlobalY = parentTransform.y + (dx * sin + dy * cos);
      
      c[id] = { x: attachGlobalX, y: attachGlobalY, rotation: parentTransform.rotation + radLocalRot };
      return c[id];
    };

    parts.forEach(p => getTransformWithRots(p.id, localRots, cache));

    // IK CCD
    if (!isEditing) {
      const ikTargets = parts.filter(p => (p.animType === 'IK' || p.secondaryAnimType === 'IK') && p.ikTargetX !== undefined && p.ikTargetY !== undefined);
      for (const targetPart of ikTargets) {
          const weight = targetPart.ikWeight ?? 1;
          const chain: string[] = [];
          let cur: CreaturePart | undefined = targetPart;
          let depth = 0;
          while (cur && cur.parentId && depth < 3) {
              chain.push(cur.id);
              cur = parts.find(p => p.id === cur!.parentId);
              if (cur && cur.type === 'TORSO') break;
              depth++;
          }
          
          for (let iter = 0; iter < 3; iter++) {
              for (const boneId of chain) {
                  for (let key in cache) delete cache[key];
                  const targetTransform = getTransformWithRots(targetPart.id, localRots, cache);
                  const boneTransform = getTransformWithRots(boneId, localRots, cache);
                  
                  const tipDx = (targetPart.width / 2) - targetPart.anchorX;
                  const tipDy = targetPart.height - targetPart.anchorY;
                  const targetCos = Math.cos(targetTransform.rotation);
                  const targetSin = Math.sin(targetTransform.rotation);
                  
                  const tipGlobalX = targetTransform.x + (tipDx * targetCos - tipDy * targetSin);
                  const tipGlobalY = targetTransform.y + (tipDx * targetSin + tipDy * targetCos);

                  const angleToTip = Math.atan2(tipGlobalY - boneTransform.y, tipGlobalX - boneTransform.x);
                  const angleToTarget = Math.atan2(targetPart.ikTargetY! - boneTransform.y, targetPart.ikTargetX! - boneTransform.x);
                  
                  let angleDiff = angleToTarget - angleToTip;
                  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
                  
                  localRots[boneId] += angleDiff * weight;
                  // clamp
                  const p = parts.find(px => px.id === boneId);
                  if (p && (p.minRotation !== undefined || p.maxRotation !== undefined)) {
                      const min = (p.minRotation ?? -180) * Math.PI / 180;
                      const max = (p.maxRotation ?? 180) * Math.PI / 180;
                      localRots[boneId] = Math.max(min, Math.min(max, localRots[boneId]));
                  }
              }
          }
      }
      for (let key in cache) delete cache[key];
      parts.forEach(p => getTransformWithRots(p.id, localRots, cache));

      // Verlet & Adaptation
      parts.forEach(part => {
          const isVerlet = part.physicsMode === 'VERLET';
          const isAdapted = part.physicsMode === 'RIGID' && (part.verletAdaptationWeight ?? 0) > 0;
          
          if (isVerlet || isAdapted) {
              const weight = isAdapted ? (part.verletAdaptationWeight ?? 0) : 1;
              const segments = part.verletSegments ?? (isAdapted ? 3 : 6);
              const gravityVal = part.verletGravity ?? 0.5;
              const damping = part.verletDamping ?? 0.9;
              const stiffness = part.verletStiffness ?? 0.8;
              
              if (!verletStateRef.current[part.id] || verletStateRef.current[part.id].length !== segments + 1) {
                  const vNodes: any[] = [];
                  for(let i=0; i <= segments; i++) {
                      const ratio = i / segments;
                      const lx = (part.width/2 - part.anchorX);
                      const ly = (part.height * ratio - part.anchorY);
                      const t = cache[part.id];
                      vNodes.push({ 
                        worldX: t.x + (lx * Math.cos(t.rotation) - ly * Math.sin(t.rotation)),
                        worldY: t.y + (lx * Math.sin(t.rotation) + ly * Math.cos(t.rotation)),
                        vx: 0, vy: 0 
                      });
                  }
                  verletStateRef.current[part.id] = vNodes;
              }

              const vNodes = verletStateRef.current[part.id];
              for (let i = 1; i < vNodes.length; i++) {
                  let fy = (part.verletGravityEnabled !== false) ? gravityVal * 1500 : 0;
                  if (part.verletWiggleEnabled) {
                      const t = time * (part.verletWigglePulse ?? 2) + (part.animPhase ?? 0);
                      const amp = (part.verletWiggleAmplitude ?? 50) * (i / segments);
                      if (part.verletWiggleType === 'SWAY') vNodes[i].vx += Math.sin(t) * amp * 10 * dt;
                      else if (part.verletWiggleType === 'WRIGGLE') vNodes[i].vx += Math.sin(t + i * 0.5) * amp * 15 * dt;
                      else if (part.verletWiggleType === 'TWITCH') {
                         const raw = Math.sin(t * 4 + i * 0.2);
                         if (raw > 0.95) vNodes[i].vx += (Math.random() - 0.5) * amp * 200 * dt;
                      }
                  }
                  vNodes[i].vy += fy * dt;
                  vNodes[i].worldX += vNodes[i].vx * dt;
                  vNodes[i].worldY += vNodes[i].vy * dt;
                  vNodes[i].vx *= damping;
                  vNodes[i].vy *= damping;
              }

              if (part.verletIKEnabled && part.ikTargetX !== undefined && part.ikTargetY !== undefined) {
                  const last = vNodes[vNodes.length - 1];
                  const ikForce = 150 * dt;
                  last.vx += (part.ikTargetX - last.worldX) * ikForce;
                  last.vy += (part.ikTargetY - last.worldY) * ikForce;
              }

              vNodes[0].worldX = cache[part.id].x;
              vNodes[0].worldY = cache[part.id].y;

              const segLen = (isAdapted ? part.height / 3 / segments : part.height / segments);
              const jointLimit = (part.verletJointLimit ?? 30) * Math.PI / 180;

              for (let iter = 0; iter < 10; iter++) {
                  // Angular constraints (Joint Limits)
                  for (let i = 1; i < vNodes.length; i++) {
                      const p1 = vNodes[i-1];
                      const p2 = vNodes[i];
                      
                      // Angle of current segment
                      const currentAngle = Math.atan2(p2.worldY - p1.worldY, p2.worldX - p1.worldX);
                      
                      // Reference angle (parent rotation for first segment, previous segment for others)
                      let refAngle = cache[part.id].rotation + Math.PI/2;
                      if (i > 1) {
                          const p0 = vNodes[i-2];
                          refAngle = Math.atan2(p1.worldY - p0.worldY, p1.worldX - p0.worldX);
                      }

                      let diff = currentAngle - refAngle;
                      while (diff > Math.PI) diff -= Math.PI * 2;
                      while (diff < -Math.PI) diff += Math.PI * 2;

                      if (Math.abs(diff) > jointLimit) {
                          const clampedAngle = refAngle + Math.sign(diff) * jointLimit;
                          p2.worldX = p1.worldX + Math.cos(clampedAngle) * segLen;
                          p2.worldY = p1.worldY + Math.sin(clampedAngle) * segLen;
                      }
                  }

                  // Distance constraints
                  for (let i = 1; i < vNodes.length; i++) {
                      const p1 = vNodes[i-1];
                      const p2 = vNodes[i];
                      const dx = p2.worldX - p1.worldX;
                      const dy = p2.worldY - p1.worldY;
                      const dist = Math.sqrt(dx * dx + dy * dy);
                      if (dist > 0) {
                          const diff = (segLen - dist) / dist * stiffness;
                          const ox = dx * diff;
                          const oy = dy * diff;
                          if (i === 1) { p2.worldX += ox; p2.worldY += oy; }
                          else { p1.worldX -= ox * 0.5; p1.worldY -= oy * 0.5; p2.worldX += ox * 0.5; p2.worldY += oy * 0.5; }
                      }
                  }
              }
              
              if (vNodes.length > 1) {
                  const verletRot = Math.atan2(vNodes[1].worldY - vNodes[0].worldY, vNodes[1].worldX - vNodes[0].worldX) - Math.PI/2;
                  if (isAdapted) {
                     // Blend between Skeletal/IK rotation and Verlet-induced rotation
                     const currentRot = cache[part.id].rotation;
                     cache[part.id].rotation = currentRot * (1 - weight) + verletRot * weight;
                  } else {
                     cache[part.id].rotation = verletRot;
                  }
              }
          }
      });
    }
    return cache;
  }, [parts]);

  const drawCreature = useCallback((time: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const isEditing = editorMode !== 'VIEW';
    const transforms = computeTransforms(time, isEditing);

    const cx = canvas.width / 2;
    const cy = Math.max(canvas.height / 2, canvas.height * 0.4);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(camera.x, camera.y);
    
    // Boundary Frame
    const fw = 240, fh = 320;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(-fw/2, -fh/2, fw, fh);
    ctx.setLineDash([]);

    const sorted = [...parts].sort((a,b) => a.zIndex - b.zIndex);
    sorted.forEach(part => {
       const t = transforms[part.id];
       const isDeform = part.animType === 'DEFORMATION' && !isEditing;
       const deformFactor = isDeform ? 1 + (Math.sin(time * (part.animSpeed || 2) + (part.animPhase || 0)) * ((part.animAmplitude || 10) / 100)) : 1;

       const isVerlet = part.physicsMode === 'VERLET' && verletStateRef.current[part.id] && !isEditing;
       const vNodes = isVerlet ? verletStateRef.current[part.id] : null;

       ctx.save();
       
       if (isVerlet && vNodes) {
          // Flexible Verlet Rendering
          const path = new Path2D();
          
          // Function to get radius at ratio t [0..1]
          const getRadius = (ratio: number) => {
             const sortedNodes = [...part.nodes].sort((a,b) => a.y - b.y);
             if (sortedNodes.length === 0) return 10;
             if (ratio <= sortedNodes[0].y) return sortedNodes[0].radius;
             if (ratio >= sortedNodes[sortedNodes.length-1].y) return sortedNodes[sortedNodes.length-1].radius;
             
             for (let i = 0; i < sortedNodes.length - 1; i++) {
                const n1 = sortedNodes[i];
                const n2 = sortedNodes[i+1];
                if (ratio >= n1.y && ratio <= n2.y) {
                   const tLocal = (ratio - n1.y) / (n2.y - n1.y);
                   return n1.radius + (n2.radius - n1.radius) * tLocal;
                }
             }
             return sortedNodes[0].radius;
          };

          for (let i = 0; i < vNodes.length; i++) {
             const p = vNodes[i];
             const rad = getRadius(i / (vNodes.length - 1));
             path.moveTo(p.worldX + rad, p.worldY);
             path.arc(p.worldX, p.worldY, rad, 0, Math.PI * 2);
             
             if (i < vNodes.length - 1) {
                const pNext = vNodes[i+1];
                const radNext = getRadius((i + 1) / (vNodes.length - 1));
                
                const angle = Math.atan2(pNext.worldY - p.worldY, pNext.worldX - p.worldX);
                const p1x = p.worldX + Math.cos(angle + Math.PI/2) * rad;
                const p1y = p.worldY + Math.sin(angle + Math.PI/2) * rad;
                const p2x = p.worldX + Math.cos(angle - Math.PI/2) * rad;
                const p2y = p.worldY + Math.sin(angle - Math.PI/2) * rad;
                
                const p3x = pNext.worldX + Math.cos(angle - Math.PI/2) * radNext;
                const p3y = pNext.worldY + Math.sin(angle - Math.PI/2) * radNext;
                const p4x = pNext.worldX + Math.cos(angle + Math.PI/2) * radNext;
                const p4y = pNext.worldY + Math.sin(angle + Math.PI/2) * radNext;
                
                path.moveTo(p1x, p1y);
                path.lineTo(p2x, p2y);
                path.lineTo(p3x, p3y);
                path.lineTo(p4x, p4y);
                path.closePath();
             }
          }

          if(!part.hideBaseShape) { 
             ctx.fillStyle = part.color; 
             ctx.fill(path); 
          }
          
          if (part.id === selectedPartId) {
             ctx.strokeStyle = '#3b82f6';
             ctx.lineWidth = 2;
             ctx.stroke(path);
          }
       } else {
          // Rigid Drawing (Existing logic)
          ctx.translate(t.x, t.y);
          ctx.rotate(t.rotation);
          
          if (isDeform) {
             ctx.scale(deformFactor, deformFactor);
          }
          
          ctx.translate(-part.anchorX, -part.anchorY);
   
          const path = new Path2D();
          part.nodes.forEach((n, i) => {
             const nx = n.x * part.width;
             const ny = n.y * part.height;
             path.arc(nx, ny, n.radius, 0, Math.PI * 2);
             if (i < part.nodes.length - 1) {
                const next = part.nodes[i+1];
                const nextx = next.x * part.width;
                const nexty = next.y * part.height;
                const angle = Math.atan2(nexty - ny, nextx - nx);
                path.moveTo(nx + Math.cos(angle + Math.PI/2) * n.radius, ny + Math.sin(angle + Math.PI/2) * n.radius);
                path.lineTo(nx + Math.cos(angle - Math.PI/2) * n.radius, ny + Math.sin(angle - Math.PI/2) * n.radius);
                path.lineTo(nextx + Math.cos(angle - Math.PI/2) * next.radius, nexty + Math.sin(angle - Math.PI/2) * next.radius);
                path.lineTo(nextx + Math.cos(angle + Math.PI/2) * next.radius, nexty + Math.sin(angle + Math.PI/2) * next.radius);
                path.closePath();
             }
          });
   
          if(!part.hideBaseShape) { ctx.fillStyle = part.color; ctx.fill(path); }
          if(part.customTexture) {
             const img = getTexture(part.customTexture);
             if(img && img.complete) ctx.drawImage(img, 0, 0, part.width, part.height);
          }
   
          if (part.id === selectedPartId) {
             ctx.strokeStyle = '#3b82f6';
             ctx.lineWidth = 2;
             ctx.stroke(path);
          }
       }
       ctx.restore();
    });

    // Draw IK Targets
    if (editorMode === 'JOINTS') {
       parts.forEach(p => {
          if ((p.animType === 'IK' || p.secondaryAnimType === 'IK') && p.ikTargetX !== undefined && p.ikTargetY !== undefined) {
             const isSelected = p.id === selectedPartId;
             ctx.save();
             ctx.translate(cx, cy);
             ctx.scale(camera.zoom, camera.zoom);
             ctx.translate(camera.x, camera.y);
             
             ctx.beginPath();
             ctx.arc(p.ikTargetX, p.ikTargetY, 6 / camera.zoom, 0, Math.PI * 2);
             ctx.fillStyle = isSelected ? '#3b82f6' : 'rgba(59, 130, 246, 0.5)';
             ctx.fill();
             ctx.strokeStyle = 'white';
             ctx.lineWidth = 1 / camera.zoom;
             ctx.stroke();
             
             // Shadow line to part
             const t = transforms[p.id];
             if (t) {
                ctx.beginPath();
                ctx.moveTo(t.x, t.y);
                ctx.lineTo(p.ikTargetX, p.ikTargetY);
                ctx.setLineDash([2/camera.zoom, 2/camera.zoom]);
                ctx.strokeStyle = isSelected ? 'rgba(59, 130, 246, 0.8)' : 'rgba(255,255,255,0.2)';
                ctx.stroke();
             }
             ctx.restore();
          }
       });
    }

    ctx.restore();
  }, [parts, selectedPartId, computeTransforms, camera, editorMode]);

  useEffect(() => {
    let frame: number;
    const loop = () => {
      timeRef.current += 0.05;
      drawCreature(timeRef.current);
      frame = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(frame);
  }, [drawCreature]);

  const [isPanning, setIsPanning] = useState(false);
  const [lastPan, setLastPan] = useState({ x: 0, y: 0 });
  const [dragState, setDragState] = useState<{ 
    type: 'NODE' | 'ANCHOR' | 'ATTACH' | 'IK_TARGET' | 'PART_MOVE' | null; 
    id?: string;
    startX?: number;
    startY?: number;
    startValX?: number;
    startValY?: number;
  }>({ type: null });

  const [pointers, setPointers] = useState<Record<number, { x: number, y: number }>>({});
  const [initialPinchDist, setInitialPinchDist] = useState<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { x: wx, y: wy } = getScreenToWorld(e.clientX, e.clientY);
    
    // Check for IK Target drag
    if (editorMode === 'JOINTS') {
       const hitPart = parts.find(p => {
          if ((p.animType === 'IK' || p.secondaryAnimType === 'IK') && p.ikTargetX !== undefined && p.ikTargetY !== undefined) {
             const dist = Math.sqrt(Math.pow(p.ikTargetX - wx, 2) + Math.pow(p.ikTargetY - wy, 2));
             return dist < 12 / camera.zoom;
          }
          return false;
       });

       if (hitPart) {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragState({ 
            type: 'IK_TARGET', 
            id: hitPart.id,
            startX: wx,
            startY: wy,
            startValX: hitPart.ikTargetX,
            startValY: hitPart.ikTargetY
          });
          return;
       }
    }

    // Add pointer to tracking
    const newPointers = { ...pointers, [e.pointerId]: { x: e.clientX, y: e.clientY } };
    setPointers(newPointers);

    const pointerCount = Object.keys(newPointers).length;
    
    if (pointerCount === 2) {
      const p1 = Object.values(newPointers)[0];
      const p2 = Object.values(newPointers)[1];
      const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      setInitialPinchDist(dist);
      return;
    }

    if (e.button === 0 || e.pointerType === 'touch') {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsPanning(true);
      setLastPan({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const newPointers = { ...pointers, [e.pointerId]: { x: e.clientX, y: e.clientY } };
    setPointers(newPointers);

    const pointerIds = Object.keys(newPointers);
    if (pointerIds.length === 2 && initialPinchDist !== null) {
      const p1 = newPointers[Number(pointerIds[0])];
      const p2 = newPointers[Number(pointerIds[1])];
      const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      
      const delta = dist / initialPinchDist;
      const zoomFactor = (delta - 1) * 0.05;
      onCameraChange({ ...camera, zoom: Math.min(Math.max(0.2, camera.zoom + zoomFactor), 5) });
      return;
    }

    if (dragState.type === 'IK_TARGET' && dragState.id && onUpdatePart) {
       const { x: wx, y: wy } = getScreenToWorld(e.clientX, e.clientY);
       onUpdatePart(dragState.id, {
          ikTargetX: wx,
          ikTargetY: wy
       });
       return;
    }

    if (isPanning) {
      const dx = (e.clientX - lastPan.x) / camera.zoom;
      const dy = (e.clientY - lastPan.y) / camera.zoom;
      onCameraChange({ ...camera, x: camera.x + dx, y: camera.y + dy });
      setLastPan({ x: e.clientX, y: e.clientY });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsPanning(false);
    setDragState({ type: null });
    
    const newPointers = { ...pointers };
    delete newPointers[e.pointerId];
    setPointers(newPointers);
    
    if (Object.keys(newPointers).length < 2) {
      setInitialPinchDist(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    const zoomFactor = -e.deltaY * 0.001;
    onCameraChange({ ...camera, zoom: Math.min(Math.max(0.2, camera.zoom + zoomFactor), 5) });
  };

  return (
    <div ref={containerRef} className="w-full h-full relative bg-neutral-950 overflow-hidden">
      <canvas 
        ref={canvasRef} 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onContextMenu={e => e.preventDefault()}
        className="block w-full h-full touch-none" 
        style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
      />
    </div>
  );
}
