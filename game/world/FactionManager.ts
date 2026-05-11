import { Faction, FactionRelation } from '../engine/types';
import { createRNG } from './utils';
import { generateProceduralHull } from '../systems/proceduralShipGenerator';
import { SPECIES_TRAITS } from '@/components/game/speciesTypes';

export class FactionManager {
    private factions: Map<string, Faction> = new Map();

    constructor() {
        this.initializeDefaultFactions();
    }

    private initializeDefaultFactions() {
        this.registerFaction({
            id: 'PLAYER',
            name: 'Независимый Капитан',
            relationToPlayer: FactionRelation.FRIENDLY,
            color: '#00ffcc',
            isPlayer: true,
            discoveredByPlayer: true
        });

        // Pirates will remain as a default hostile faction
        this.registerFaction({
            id: 'PIRATES',
            name: 'Багровые Корсары',
            description: 'Безжалостные рейдеры и наемники, рыщущие на окраинах обитаемого космоса.',
            relationToPlayer: FactionRelation.HOSTILE,
            color: '#ff4444',
            discoveredByPlayer: false,
            ideology: {
                foreignPolicy: 0.8,
                values: -0.5,
                aliens: -0.9,
                power: 0.7,
                social: 0.9,
                economy: 1.0,
                ecology: 1.0
            },
            perks: [
                { id: 'scavengers', name: 'Мародёры', description: 'Извлекают больше ресурсов из обломков.', isPositive: true },
                { id: 'disorganized', name: 'Дезертирство', description: 'Штрафы к бою при скоплении флота.', isPositive: false }
            ],
            blueprints: []
        });
    }

    public generateProceduralFactions(seed: string, count: number) {
        const rng = createRNG(seed + '-factions');
        
        const prefixes = ['Объединённые', 'Священные', 'Великие', 'Демократические', 'Торговые', 'Технократические', 'Независимые', 'Звёздные', 'Корпоративные', 'Высшие'];
        const roots = ['Государства', 'Миры', 'Колонии', 'Синдикаты', 'Империи', 'Республики', 'Доминионы', 'Федерации', 'Альянсы', 'Конклавы'];
        const suffixes = ['Ориона', 'Андромеды', 'Сириуса', 'Центавра', 'Веги', 'Сектора 7', 'Рубикона', 'Омеги', 'Альтаира', 'Бетельгейзе'];
        
        for (let i = 0; i < count; i++) {
            const r = rng();
            const r2 = rng();
            const r3 = rng();
            
            const name = `${prefixes[Math.floor(r * prefixes.length)]} ${roots[Math.floor(r2 * roots.length)]} ${suffixes[Math.floor(r3 * suffixes.length)]}`;
            
            // Generate vibrant color
            const hue = Math.floor(rng() * 360);
            const color = `hsl(${hue}, 80%, 60%)`;

            // Random traits
            const traits: string[] = [];
            const traitCount = 1 + Math.floor(rng() * 3);
            for (let j = 0; j < traitCount; j++) {
                const trait = SPECIES_TRAITS[Math.floor(rng() * SPECIES_TRAITS.length)];
                if (!traits.includes(trait.id)) traits.push(trait.id);
            }

            const shipType = ['CRYSTALLID', 'BIOMECHANICAL', 'ORGANIC', 'STANDARD'][Math.floor(rng() * 4)] as any;
            
            // Generate basic blueprints (Fighter, Corvette, Destroyer ideas)
            const blueprints = [
                generateProceduralHull(`PROC_FACTION_${i}`, shipType, Math.floor(rng() * 100000)),
                generateProceduralHull(`PROC_FACTION_${i}`, shipType, Math.floor(rng() * 100000))
            ];
            
            this.registerFaction({
                id: `PROC_FACTION_${i}`,
                name: name,
                relationToPlayer: FactionRelation.NEUTRAL,
                color: color,
                discoveredByPlayer: false,
                species: {
                    id: `S_PROC_${i}`,
                    name: 'Неизвестно',
                    pluralName: 'Неизвестные',
                    adjective: 'неизвестный',
                    portraitDataUrl: null,
                    speciesClass: ['SILICOID', 'ORGANIC', 'MACHINE', 'SOLID_LIGHT', 'GAS_DWELLER'][Math.floor(rng() * 5)],
                    environment: ['OCEAN', 'DESERT', 'TUNDRA', 'TROPICAL', 'CONTINENTAL', 'ARID', 'ALPINE', 'SAVANNAH'][Math.floor(rng() * 8)],
                    organization: ['INDIVIDUAL', 'MULTI_HIVEMIND', 'PSEUDO_HIVEMIND', 'TRUE_HIVEMIND'][Math.floor(rng() * 4)],
                    traits: traits,
                    shipType: shipType,
                    creatureType: ['BIPEDAL', 'QUADRUPEDAL', 'AVIARY', 'AQUATIC', 'AMORPHOUS', 'INSECTOID'][Math.floor(rng() * 6)],
                    averageSizeMeters: (0.5 + rng() * 3).toFixed(1)
                },
                ideology: {
                    foreignPolicy: rng() * 2 - 1,
                    values: rng() * 2 - 1,
                    aliens: rng() * 2 - 1,
                    power: rng() * 2 - 1,
                    social: rng() * 2 - 1,
                    economy: rng() * 2 - 1,
                    ecology: rng() * 2 - 1
                },
                blueprints: blueprints
            });
        }
    }

    public registerFaction(faction: Faction) {
        this.factions.set(faction.id, faction);
    }

    public discoverFaction(id: string) {
        const faction = this.factions.get(id);
        if (faction && !faction.discoveredByPlayer) {
            faction.discoveredByPlayer = true;
        }
    }

    public getFaction(id: string): Faction | undefined {
        return this.factions.get(id);
    }

    public getAllFactions(): Faction[] {
        return Array.from(this.factions.values());
    }

    public getRelation(factionIdA: string, factionIdB: string): FactionRelation {
        if (factionIdA === factionIdB) return FactionRelation.FRIENDLY;
        
        let fa = this.factions.get(factionIdA);
        let fb = this.factions.get(factionIdB);

        if (!fa || !fb) return FactionRelation.NEUTRAL;

        // Simplify for now: If either is hostile to player, they are hostile to the player.
        // If A is player, return B's relation to player.
        if (fa.isPlayer) return fb.relationToPlayer;
        if (fb.isPlayer) return fa.relationToPlayer;

        // Pirates hate everyone
        if (factionIdA === 'PIRATES' || factionIdB === 'PIRATES') return FactionRelation.HOSTILE;

        return FactionRelation.NEUTRAL;
    }
}

export const globalFactionManager = new FactionManager();
