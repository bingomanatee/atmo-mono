import { EARTH_RADIUS } from '@wonderlandlabs/atmo-utils';
import { Vector3 } from 'three';
import { Planet } from './Planet';

describe('Planet', () => {
  let earthPlanet: Planet;
  let largePlanet: Planet;

  beforeEach(() => {
    earthPlanet = new Planet({
      id: 'earth-planet',
      radius: EARTH_RADIUS,
      name: 'Earth Planet',
    });

    largePlanet = new Planet({
      id: 'large-planet',
      radius: EARTH_RADIUS * 1.5,
      name: 'Large Planet',
    });
  });

  describe('constructor', () => {
    it('should create a planet with the given properties', () => {
      expect(earthPlanet.id).toBe('earth-planet');
      expect(earthPlanet.radius).toBe(EARTH_RADIUS);
      expect(earthPlanet.name).toBe('Earth Planet');

      expect(largePlanet.id).toBe('large-planet');
      expect(largePlanet.radius).toBe(EARTH_RADIUS * 1.5);
      expect(largePlanet.name).toBe('Large Planet');
    });

    it('should throw an error if radius is less than 1000km', () => {
      expect(() => {
        new Planet({ id: 'small-planet', radius: 999 });
      }).toThrow('planet radii must be >= 1000km');
    });
  });

  describe('findNearestL0Cell', () => {
    it('should return the correct L0 cell for a position on Earth-sized planet', () => {
      // Test position at 0,0,EARTH_RADIUS (north pole)
      const position = new Vector3(0, EARTH_RADIUS, 0);
      const cell = earthPlanet.findNearestL0Cell(position);
      expect(cell).toBeDefined();
      expect(typeof cell).toBe('string');
      expect(cell.length).toBeGreaterThan(0);
    });

    it('should return the correct L0 cell for a position on larger planet', () => {
      // Test position at 0,0,LARGE_RADIUS (north pole)
      const position = new Vector3(0, EARTH_RADIUS * 1.5, 0);
      const cell = largePlanet.findNearestL0Cell(position);
      expect(cell).toBeDefined();
      expect(typeof cell).toBe('string');
      expect(cell.length).toBeGreaterThan(0);
    });

    it('should return consistent cells for the same position', () => {
      const position = new Vector3(EARTH_RADIUS, 0, 0);
      const cell1 = earthPlanet.findNearestL0Cell(position);
      const cell2 = earthPlanet.findNearestL0Cell(position);
      expect(cell1).toBe(cell2);

      const largePosition = new Vector3(EARTH_RADIUS * 1.5, 0, 0);
      const largeCell1 = largePlanet.findNearestL0Cell(largePosition);
      const largeCell2 = largePlanet.findNearestL0Cell(largePosition);
      expect(largeCell1).toBe(largeCell2);
    });
  });

  describe('getH0CellForPosition', () => {
    it('should return the same cell as findNearestL0Cell for Earth-sized planet', () => {
      const position = new Vector3(0, 0, EARTH_RADIUS);
      const cell1 = earthPlanet.findNearestL0Cell(position);
      const cell2 = earthPlanet.getH0CellForPosition(position);
      expect(cell1).toBe(cell2);
    });

    it('should return the same cell as findNearestL0Cell for larger planet', () => {
      const position = new Vector3(0, 0, EARTH_RADIUS * 1.5);
      const cell1 = largePlanet.findNearestL0Cell(position);
      const cell2 = largePlanet.getH0CellForPosition(position);
      expect(cell1).toBe(cell2);
    });
  });

  describe('toJSON', () => {
    it('should return a plain object with the planet properties', () => {
      const earthJson = earthPlanet.toJSON();
      expect(earthJson).toEqual({
        id: 'earth-planet',
        radius: EARTH_RADIUS,
        name: 'Earth Planet',
      });

      const largeJson = largePlanet.toJSON();
      expect(largeJson).toEqual({
        id: 'large-planet',
        radius: EARTH_RADIUS * 1.5,
        name: 'Large Planet',
      });
    });
  });

  describe('fromJSON', () => {
    it('should create a new Planet instance from JSON data', () => {
      const earthJson = {
        id: 'json-earth',
        radius: EARTH_RADIUS,
        name: 'JSON Earth',
      };
      const newEarthPlanet = Planet.fromJSON(earthJson);
      expect(newEarthPlanet).toBeInstanceOf(Planet);
      expect(newEarthPlanet.id).toBe('json-earth');
      expect(newEarthPlanet.radius).toBe(EARTH_RADIUS);
      expect(newEarthPlanet.name).toBe('JSON Earth');

      const largeJson = {
        id: 'json-large',
        radius: EARTH_RADIUS * 1.5,
        name: 'JSON Large',
      };
      const newLargePlanet = Planet.fromJSON(largeJson);
      expect(newLargePlanet).toBeInstanceOf(Planet);
      expect(newLargePlanet.id).toBe('json-large');
      expect(newLargePlanet.radius).toBe(EARTH_RADIUS * 1.5);
      expect(newLargePlanet.name).toBe('JSON Large');
    });
  });
});
