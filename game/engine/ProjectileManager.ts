
import { Entity } from './ecs';

const MAX_PROJECTILES = 100000;

export class ProjectileManager {
    // Data Layout: Structure of Arrays (SoA) for cache locality
    private active = new Uint8Array(MAX_PROJECTILES);
    private posX = new Float64Array(MAX_PROJECTILES);
    private posY = new Float64Array(MAX_PROJECTILES);
    private velX = new Float32Array(MAX_PROJECTILES);
    private velY = new Float32Array(MAX_PROJECTILES);
    private damage = new Float32Array(MAX_PROJECTILES);
    private distanceTraveled = new Float32Array(MAX_PROJECTILES);
    private range = new Float32Array(MAX_PROJECTILES);
    private ownerId = new Int32Array(MAX_PROJECTILES);
    private batteryType = new Uint8Array(MAX_PROJECTILES); // 0=MAIN, 1=SECONDARY, 2=DEFENCE
    private projType = new Uint8Array(MAX_PROJECTILES); // 0=BALLISTIC, 1=BEAM, 2=HOMING
    
    private firstAvailableIndex = 0;
    private count = 0;

    constructor() {}

    /**
     * Spawns a projectile in world coordinates.
     */
    public spawn(
        worldX: number, 
        worldY: number, 
        vx: number, 
        vy: number, 
        dmg: number, 
        rng: number, 
        owner: Entity,
        bType: number = 0,
        pType: number = 0
    ) {
        if (this.count >= MAX_PROJECTILES) return;
        
        let index = this.firstAvailableIndex;
        // Search for slot
        for (let i = 0; i < 100; i++) { // Adaptive linear search
            let checkIdx = (index + i) % MAX_PROJECTILES;
            if (this.active[checkIdx] === 0) {
                index = checkIdx;
                break;
            }
        }
        
        if (this.active[index] !== 0) {
            // Full scan if pool is very full
            index = this.active.indexOf(0);
            if (index === -1) return;
        }

        this.active[index] = 1;
        this.posX[index] = worldX;
        this.posY[index] = worldY;
        this.velX[index] = vx;
        this.velY[index] = vy;
        this.damage[index] = dmg;
        this.distanceTraveled[index] = 0;
        this.range[index] = rng;
        this.ownerId[index] = owner;
        this.batteryType[index] = bType;
        this.projType[index] = pType;
        
        this.count++;
        this.firstAvailableIndex = (index + 1) % MAX_PROJECTILES;
        return index;
    }

    public deactivate(index: number) {
        if (this.active[index] === 1) {
            this.active[index] = 0;
            this.count--;
            if (index < this.firstAvailableIndex) {
                this.firstAvailableIndex = index;
            }
        }
    }

    public getActiveCount() { return this.count; }
    
    // Low-level access for renderer/systems (DOD style)
    public getActiveArray() { return this.active; }
    public getPosX() { return this.posX; }
    public getPosY() { return this.posY; }
    public getVelX() { return this.velX; }
    public getVelY() { return this.velY; }
    public getRange() { return this.range; }
    public getDistanceTraveled() { return this.distanceTraveled; }
    public getOwnerId() { return this.ownerId; }
    public getDamage() { return this.damage; }
    public getBatteryType() { return this.batteryType; }
    public getProjType() { return this.projType; }
}
