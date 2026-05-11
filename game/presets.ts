import { ShipHull, Point } from '@/components/game/types';
import { makeStarterCompartments } from '@/hooks/useGameEngineInit';
import { generateStructuralBeams } from '@/components/game/editorLogic';

function rectPoints(cx: number, cy: number, w: number, h: number): Point[] {
  return [
    { x: cx - w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy - h / 2 },
    { x: cx + w / 2, y: cy + h / 2 },
    { x: cx - w / 2, y: cy + h / 2 },
  ];
}

const size = 30;

function prepHull(hull: ShipHull): ShipHull {
  hull.decks.forEach((dk, index) => {
    // Only pass compartments that belong to this deck
    const deckCompartments = hull.compartments.filter(c => c.startDeck <= index && c.endDeck >= index);
    const { beams, cells } = generateStructuralBeams(dk.points, deckCompartments, dk.beamPattern || 'SQUARE', dk.beamDensity || 3.0);
    dk.beams = beams;
    dk.cells = cells;
  });
  return hull;
}

export const PRESET_SHIPS: { name: string; hull: ShipHull }[] = [
  {
    name: 'Surveyor Mark I',
    hull: prepHull({
      style: 'STEEL',
      size,
      activeDeckIndex: 0,
      decks: [
        {
          id: 'deck-preset-main',
          level: 0,
          name: 'Main Deck',
          points: [
            {x: 21, y: 0}, {x: 12, y: 3}, {x: 4, y: 9}, {x: -4, y: 9}, 
            {x: -12, y: 5}, {x: -23, y: 6}, {x: -23, y: -6}, {x: -12, y: -5}, 
            {x: -4, y: -9}, {x: 4, y: -9}, {x: 12, y: -3}
          ],
          color: '#444444',
          beamPattern: 'SQUARE',
          beamDensity: 3.0,
          globalHullThickness: 0.5
        }
      ],
      compartments: makeStarterCompartments(size).filter(c => c.startDeck === 0)
    })
  },
  {
    name: 'Industrial Barge',
    hull: prepHull({
        style: 'STEEL',
        size: 30,
        activeDeckIndex: 0,
        decks: [
            {
                id: 'deck-barge-cargo',
                level: 0,
                name: 'Cargo Deck',
                points: [
                  {x: 17, y: 3}, {x: 11, y: 9}, {x: -2, y: 9}, {x: -11, y: 3}, 
                  {x: -11, y: -3}, {x: -2, y: -9}, {x: 11, y: -9}, {x: 17, y: -3}
                ],
                color: '#333333',
                beamPattern: 'SQUARE',
                beamDensity: 2.0,
                globalHullThickness: 0.8
            }
        ],
      compartments: [
        { id: 'b-1', type: 'BRIDGE', x: 14, y: 0, width: 5, height: 4, points: rectPoints(14, 0, 5, 4), startDeck: 0, endDeck: 0, color: '#5577ff' },
        { id: 'm-1', type: 'MINING', x: 8, y: 0, width: 4, height: 4, points: rectPoints(8, 0, 4, 4), startDeck: 0, endDeck: 0, color: '#44ff44' },
        { id: 'r-1', type: 'REACTOR', x: 1, y: 0, width: 6, height: 6, points: rectPoints(1, 0, 6, 6), startDeck: 0, endDeck: 0, color: '#ff9900' },
        { id: 'e-1', type: 'ENGINE', x: -7, y: 0, width: 6, height: 4, points: rectPoints(-7, 0, 6, 4), startDeck: 0, endDeck: 0, color: '#ff5533' },
        { id: 'c-1', type: 'CARGO', x: 2, y: 5.5, width: 6, height: 5, points: rectPoints(2, 5.5, 6, 5), startDeck: 0, endDeck: 0, color: '#886600', pairedWith: 'c-2', pairAxis: 'Y' },
        { id: 'c-2', type: 'CARGO', x: 2, y: -5.5, width: 6, height: 5, points: rectPoints(2, -5.5, 6, 5), startDeck: 0, endDeck: 0, color: '#886600', pairedWith: 'c-1', pairAxis: 'Y' },
      ]
    })
  }
];
