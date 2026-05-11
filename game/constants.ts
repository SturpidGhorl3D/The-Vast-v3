export const GAME_VERSION = "Alpha 1.12.1_01";

/**
 * One world unit = 1 meter. Star systems sit on a coarse grid for generation / discovery.
 */
export const SYSTEM_GRID_SPACING_M = 10_000_000_000;

export const EDITOR_MIN_VIEWPORT_M = 15;
export const EDITOR_MAX_VIEWPORT_FACTOR = 200;

export const GLOBAL_MIN_VIEWPORT_M = 1_000_000_000;   // 1 M km — closest zoom in global
export const GLOBAL_MAX_VIEWPORT_M = 9.46e15 * 75;      // 75 LY — most zoomed out global

// ── Tactical view zoom range ─────────────────────────────────────────
export const TACTICAL_MIN_VIEWPORT_M   = 1_000;              // 1 km — most zoomed in
export const TACTICAL_MAX_VIEWPORT_M   = 1.5e11 * 45;        // 45 AU — most zoomed out tactical

// ── Local view radar range ───────────────────────────────────────────
export const LOCAL_RADAR_BASE = 500;

export const LOCAL_ORBIT_DRAW_RADIUS_M = 1_200_000_000_000;
export const LOCAL_FLIGHT_MAX_VIEWPORT_M = 50_000_000_000_000;

export const LIGHT_YEAR_M = 9.46e15;
export const AU_M = 149_597_870_700;
export const SECTOR_SIZE_M = 10_000_000_000; // 10 billion meters per sector

export const PLAYER_CURRENT_SYSTEM_RADIUS_M  = 150 * AU_M;
export const PLAYER_DISCOVER_SYSTEM_RADIUS_M = 1 * LIGHT_YEAR_M;

// Stars
export const STAR_RADIUS_MIN_M =   80_000_000;
export const STAR_RADIUS_MAX_M =  900_000_000;

// Planets
export const PLANET_RADIUS_MIN_M =   2_000_000;
export const PLANET_RADIUS_MAX_M =  70_000_000;
export const PLANET_ORBIT_BASE_M  =  40_000_000_000; // 40 billion m = 4 sectors
export const PLANET_ORBIT_STEP_M  =  20_000_000_000; // 20 billion m = 2 sectors

// ── Movement ─────────────────────────────────────────────────────────
// Base acceleration with NO engine rooms (emergency micro-thrusters).
// Very small — engines provide the real thrust via thrustMult.
// Drag 0.985/frame → terminal = accel / 0.015.  60fps.
// Starter ship (2× ENGINE @0.5 → thrustMult=2): accel = 0.8×2 = 1.6
//   terminal ≈ 107 m/frame → 6.4 km/s — reasonable sub-light
export const SHIP_ACCEL_NORMAL    = 0.8;

// Throttle ramp-up rate — fraction per frame the thrust builds toward 1.0.
// At 0.025/frame @ 60fps it takes ~1.6 s to reach full thrust.
export const SHIP_ACCEL_RAMP_RATE  = 0.025;
// Warp thrust builds a bit faster
export const SHIP_WARP_RAMP_RATE   = 0.04;

// Turn speed — only effective when GYRO compartments present.
// turnMult = sum(gyroConfig.turnBonus) — base is 0 (no gyro = no turn).
// Angular drag 0.82/frame → terminal = SHIP_TURN_SPEED × turnMult / 0.18
// With 1 GYRO (turnBonus 1.0): terminal = 0.003 × 1 / 0.18 = 0.017 rad/frame
//   ≈ 1 rad/s ≈ 57°/s — full rotation ~6 s. Comfortable.
export const SHIP_TURN_SPEED     = 0.003;

// Speed caps
export const SHIP_MAX_SPEED_NORMAL = 500_000;       // 500 km/frame safety cap
export const SHIP_MAX_SPEED_WARP   = 100_000_000;   // warp thrust cap

// Warp thrust multiplier (Tab key, requires WARP_ENGINE compartment)
export const WARP_ACCEL_MULT      = 300;

/** Warp jump cooldown and jump radius */
export const WARP_COOLDOWN_MS    = 30_000;
export const WARP_JUMP_RADIUS_M  = SYSTEM_GRID_SPACING_M * 40;

/** UI accent colour */
export const ACCENT_COLOR = '#00d4ff';

// ─── Build cost constants ────────────────────────────────────────────
export const HULL_IRON_PER_M3       = 2.4;
export const HULL_TITANIUM_PER_M3   = 2.4;
export const ARMOR_TITANIUM_PER_M3  = 5.0;
export const ARMOR_IRON_PER_M3      = 1.0;
export const PERIMETER_THICKNESS    = 0.5; // meters
export const PERIMETER_IRON_PER_M3  = 3.0; // Iron density for perimeter
export const PERIMETER_TITANIUM_PER_M3 = 1.0; // Titanium density for perimeter
export const COMPARTMENT_IRON_PER_M3   = 1.2;
export const COMPARTMENT_TITANIUM_PER_M3 = 0.4;
export const BEAM_IRON_COST = 50; // flat cost per beam
export const BUILD_ANIM_DURATION_MS = 6_000;
export const BUILD_SCAFFOLD_RATIO   = 0.35;

// ─── Hull damage ─────────────────────────────────────────────────────
export const HULL_DURABILITY_PER_M = 10;
export const HULL_DEFORM_THRESHOLD = 0.4;

// ─── Asteroid clusters ───────────────────────────────────────────────
export const ASTEROID_CLUSTER_RADIUS_MIN_M  = 1_500_000_000;
export const ASTEROID_CLUSTER_RADIUS_MAX_M  = 8_000_000_000;
export const DEEP_SPACE_CLUSTER_RADIUS_MIN_M = 800_000_000;
export const DEEP_SPACE_CLUSTER_RADIUS_MAX_M = 3_000_000_000;

// ─── Resource Mining & Cargo ─────────────────────────────────────────
export const CARGO_BASE_CAPACITY_PER_M3 = 1.0; // 1 ton per m3
export const CARGO_UPGRADE_EFFICIENCY_STEP = 0.5; // +50% per level
export const MINING_BEAM_RANGE_DEFAULT = 1500;
export const MINING_BEAM_RATE_DEFAULT = 5.0;
export const ASTEROID_RESPAWN_TIME_MS = 4 * 60 * 60 * 1000; // 4 hours
export const CHUNK_SIZE_M = 5_000_000_000; // 5M km chunks for asteroid simulation

// ─── World Generation ───────────────────────────────────────────────
export const MACRO_CELL_SIZE = 9.46e16; // 10 LY macro cells
export const CLUSTER_RADIUS_CELLS = 100; // Galaxy radius in macro cells
export const MIN_STAR_DIST = 9.46e15 * 2; // 2 LY minimum distance between stars

// ─── Compartment base configs ────────────────────────────────────────
export const DEFAULT_REACTOR_POWER         = 100;
export const DEFAULT_ENGINE_THRUST_BONUS   = 0.5;
export const DEFAULT_GYRO_TURN_BONUS       = 1.0;  // sum of these = turnMult (base 0)
export const DEFAULT_MACHINERY_REPAIR_RATE = 1.0;
export const DEFAULT_FABRIC_HULL_POOL      = 50;
export const DEFAULT_WEAPON_DAMAGE         = 25;
export const DEFAULT_WEAPON_RANGE          = 2_000;
export const DEFAULT_WEAPON_ROF            = 2.0;
export const DEFAULT_WEAPON_SPEED          = 800;
