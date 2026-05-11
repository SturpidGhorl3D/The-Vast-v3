import * as BABYLON from '@babylonjs/core';
import earcut from 'earcut';

export class Graphics2D {
  private scene: BABYLON.Scene;
  private mesh: BABYLON.Mesh;
  private lineMesh: BABYLON.Mesh;
  
  private positions: number[] = [];
  private indices: number[] = [];
  private colors: number[] = [];
  
  private linePositions: number[] = [];
  private lineIndices: number[] = [];
  private lineColors: number[] = [];
  
  private path: {x: number, y: number}[] = [];
  private zIndex: number = 0;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;
    
    this.mesh = new BABYLON.Mesh("graphics2D", scene);
    this.mesh.hasVertexAlpha = true;
    
    const mat = new BABYLON.StandardMaterial("graphics2DMat", scene);
    mat.emissiveColor = BABYLON.Color3.White();
    mat.disableLighting = true;
    mat.backFaceCulling = false;
    mat.useVertexColors = true;
    mat.hasAlpha = true;
    mat.useAlphaFromColors = true;
    mat.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
    mat.transparencyMode = BABYLON.Material.MATERIAL_ALPHABLEND;
    mat.disableDepthWrite = true;
    mat.needDepthPrePass = false;
    
    this.mesh.material = mat;
  }

  public clear() {
    this.positions.length = 0;
    this.indices.length = 0;
    this.colors.length = 0;
    
    this.path.length = 0;
    this.zIndex = 0;
  }

  public beginPath() {
    this.path.length = 0;
  }

  public moveTo(x: number, y: number) {
    if (this.path.length > 0 && this.path[this.path.length-1].x === x && this.path[this.path.length-1].y === y) return;
    this.path = [{x, y}];
  }

  public lineTo(x: number, y: number) {
    this.path.push({x, y});
  }

  public closePath() {
    if (this.path.length > 2) {
      if (this.path[this.path.length-1].x !== this.path[0].x || this.path[this.path.length-1].y !== this.path[0].y) {
        this.path.push({x: this.path[0].x, y: this.path[0].y});
      }
    }
  }

  public fill({ color, alpha = 1 }: { color: number, alpha?: number }) {
    if (this.path.length < 3) return;
    
    const r = ((color >> 16) & 0xff) / 255.0;
    const g = ((color >> 8) & 0xff) / 255.0;
    const b = (color & 0xff) / 255.0;
    
    const baseIndex = this.positions.length / 3;
    const flatPath = [];
    for (let i = 0; i < this.path.length; i++) {
        flatPath.push(this.path[i].x, this.path[i].y);
        this.positions.push(this.path[i].x, -this.path[i].y, this.zIndex);
        this.colors.push(r, g, b, alpha);
    }
    
    const triangles = earcut(flatPath);
    for (let i = 0; i < triangles.length; i++) {
        this.indices.push(baseIndex + triangles[i]);
    }
    
    this.zIndex -= 0.0001; // Depth sorting
  }

    public stroke({ color, width = 1, alpha = 1 }: { color: number, width?: number, alpha?: number }) {
        if (this.path.length < 2) return;
        
        const r = ((color >> 16) & 0xff) / 255.0;
        const g = ((color >> 8) & 0xff) / 255.0;
        const b = (color & 0xff) / 255.0;
        const halfW = width / 2;
        const segments = halfW > 10 ? 16 : 8;

        for (let i = 0; i < this.path.length - 1; i++) {
            const p1 = this.path[i];
            const p2 = this.path[i+1];
            
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const len = Math.sqrt(dx*dx + dy*dy);
            if (len === 0) continue;
            
            const nx = (-dy / len) * halfW;
            const ny = (dx / len) * halfW;
            
            const baseIndex = this.positions.length / 3;
            
            this.positions.push(p1.x + nx, -(p1.y + ny), this.zIndex);
            this.positions.push(p1.x - nx, -(p1.y - ny), this.zIndex);
            this.positions.push(p2.x + nx, -(p2.y + ny), this.zIndex);
            this.positions.push(p2.x - nx, -(p2.y - ny), this.zIndex);
            
            for (let j = 0; j < 4; j++) this.colors.push(r, g, b, alpha);
            
            this.indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
            this.indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 2);

            // Joint / Cap at p1
            const j1 = this.positions.length / 3;
            this.positions.push(p1.x, -p1.y, this.zIndex);
            this.colors.push(r, g, b, alpha);
            for(let s = 0; s <= segments; s++) {
                const theta = (s / segments) * Math.PI * 2;
                this.positions.push(p1.x + Math.cos(theta)*halfW, -(p1.y + Math.sin(theta)*halfW), this.zIndex);
                this.colors.push(r, g, b, alpha);
                if(s > 0) this.indices.push(j1, j1 + s, j1 + s + 1);
            }

            // Joint / Cap at final p2
            if (i === this.path.length - 2) {
                const j2 = this.positions.length / 3;
                this.positions.push(p2.x, -p2.y, this.zIndex);
                this.colors.push(r, g, b, alpha);
                for(let s = 0; s <= segments; s++) {
                    const theta = (s / segments) * Math.PI * 2;
                    this.positions.push(p2.x + Math.cos(theta)*halfW, -(p2.y + Math.sin(theta)*halfW), this.zIndex);
                    this.colors.push(r, g, b, alpha);
                    if(s > 0) this.indices.push(j2, j2 + s, j2 + s + 1);
                }
            }
        }
        
        this.zIndex -= 0.0001;
    }

  public circle(x: number, y: number, radius: number) {
    this.beginPath();
    const segments = radius > 100 ? 64 : (radius > 20 ? 32 : 16);
    for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        this.lineTo(x + Math.cos(theta) * radius, y + Math.sin(theta) * radius);
    }
    this.closePath();
  }

  public arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, anticlockwise: boolean = false) {
    const segments = radius > 100 ? 64 : (radius > 20 ? 32 : 16);
    let diff = endAngle - startAngle;
    if (diff < 0 && !anticlockwise) diff += Math.PI * 2;
    const steps = Math.max(1, Math.ceil(segments * (Math.abs(diff) / (Math.PI * 2))));
    
    for (let i = 0; i <= steps; i++) {
        const step = i / steps;
        const theta = anticlockwise ? startAngle - step * Math.abs(diff) : startAngle + step * Math.abs(diff);
        this.lineTo(x + Math.cos(theta) * radius, y + Math.sin(theta) * radius);
    }
  }

  public rect(x: number, y: number, w: number, h: number) {
    this.beginPath();
    this.moveTo(x, y);
    this.lineTo(x + w, y);
    this.lineTo(x + w, y + h);
    this.lineTo(x, y + h);
    this.closePath();
  }

  public update() {
    if (this.positions.length > 0) {
        const vertexData = new BABYLON.VertexData();
        vertexData.positions = this.positions;
        vertexData.indices = this.indices;
        vertexData.colors = this.colors;
        const normals: number[] = [];
        BABYLON.VertexData.ComputeNormals(this.positions, this.indices, normals);
        vertexData.normals = normals;
        vertexData.applyToMesh(this.mesh, true);
        this.mesh.isVisible = true;
    } else {
        this.mesh.isVisible = false;
    }
  }
}
