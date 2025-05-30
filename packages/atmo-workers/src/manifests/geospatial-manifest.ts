/**
 * Geospatial Worker Manifest - Geographic and spatial operations
 */

import type { WorkerManifest } from '../types';

export const GEOSPATIAL_WORKER_MANIFEST: WorkerManifest = {
  name: 'geospatial',
  version: '1.0.0',
  browserWorkerPath: '/workers/geospatial-worker.js',
  nodeWorkerPath: './workers/geospatial-worker-node.js',
  maxConcurrentTasks: 6,
  defaultTimeout: 30000,
  initConfig: {
    coordinateSystem: 'WGS84',
    precision: 'high',
  },
  actions: [
    {
      actionId: 'DISTANCE_CALCULATION',
      description: 'Calculate distance between geographic points',
      retryable: true,
      estimatedDuration: 500,
      responseType: 'DistanceResult',
      parameters: [
        {
          name: 'point1',
          type: 'object',
          required: true,
          description: 'First point with lat/lng coordinates',
          validator: (value: any) => value.lat !== undefined && value.lng !== undefined,
        },
        {
          name: 'point2',
          type: 'object',
          required: true,
          description: 'Second point with lat/lng coordinates',
          validator: (value: any) => value.lat !== undefined && value.lng !== undefined,
        },
        {
          name: 'method',
          type: 'string',
          required: false,
          defaultValue: 'haversine',
          description: 'Distance calculation method',
          validator: (value: string) => ['haversine', 'vincenty', 'euclidean'].includes(value),
        },
        {
          name: 'unit',
          type: 'string',
          required: false,
          defaultValue: 'km',
          description: 'Distance unit',
          validator: (value: string) => ['km', 'miles', 'meters', 'feet'].includes(value),
        },
      ],
    },
    {
      actionId: 'POLYGON_CONTAINS_POINT',
      description: 'Check if a point is inside a polygon',
      retryable: true,
      estimatedDuration: 1000,
      responseType: 'ContainmentResult',
      parameters: [
        {
          name: 'point',
          type: 'object',
          required: true,
          description: 'Point to test',
          validator: (value: any) => value.lat !== undefined && value.lng !== undefined,
        },
        {
          name: 'polygon',
          type: 'array',
          required: true,
          description: 'Polygon vertices as array of lat/lng points',
          validator: (value: any[]) => Array.isArray(value) && value.length >= 3,
        },
        {
          name: 'algorithm',
          type: 'string',
          required: false,
          defaultValue: 'ray-casting',
          description: 'Containment algorithm',
          validator: (value: string) => ['ray-casting', 'winding-number'].includes(value),
        },
      ],
    },
    {
      actionId: 'BUFFER_GEOMETRY',
      description: 'Create buffer around geometric features',
      retryable: true,
      estimatedDuration: 3000,
      responseType: 'BufferResult',
      parameters: [
        {
          name: 'geometry',
          type: 'object',
          required: true,
          description: 'GeoJSON geometry to buffer',
        },
        {
          name: 'distance',
          type: 'number',
          required: true,
          description: 'Buffer distance',
          validator: (value: number) => value > 0,
        },
        {
          name: 'unit',
          type: 'string',
          required: false,
          defaultValue: 'meters',
          description: 'Distance unit',
          validator: (value: string) => ['meters', 'km', 'miles', 'feet'].includes(value),
        },
        {
          name: 'segments',
          type: 'number',
          required: false,
          defaultValue: 8,
          description: 'Number of segments for curved edges',
          validator: (value: number) => Number.isInteger(value) && value >= 4 && value <= 64,
        },
      ],
    },
    {
      actionId: 'SPATIAL_INTERSECTION',
      description: 'Find intersection between two geometries',
      retryable: true,
      estimatedDuration: 4000,
      responseType: 'IntersectionResult',
      parameters: [
        {
          name: 'geometry1',
          type: 'object',
          required: true,
          description: 'First GeoJSON geometry',
        },
        {
          name: 'geometry2',
          type: 'object',
          required: true,
          description: 'Second GeoJSON geometry',
        },
        {
          name: 'precision',
          type: 'number',
          required: false,
          defaultValue: 6,
          description: 'Coordinate precision (decimal places)',
          validator: (value: number) => Number.isInteger(value) && value >= 1 && value <= 15,
        },
      ],
    },
    {
      actionId: 'COORDINATE_TRANSFORMATION',
      description: 'Transform coordinates between different projections',
      retryable: true,
      estimatedDuration: 1500,
      responseType: 'TransformationResult',
      parameters: [
        {
          name: 'coordinates',
          type: 'array',
          required: true,
          description: 'Array of coordinates to transform',
          validator: (value: any[]) => Array.isArray(value) && value.length > 0,
        },
        {
          name: 'fromProjection',
          type: 'string',
          required: true,
          description: 'Source projection (EPSG code or proj4 string)',
        },
        {
          name: 'toProjection',
          type: 'string',
          required: true,
          description: 'Target projection (EPSG code or proj4 string)',
        },
      ],
    },
    {
      actionId: 'GENERATE_H3_CELLS',
      description: 'Generate H3 hexagonal cells for a region',
      retryable: true,
      estimatedDuration: 5000,
      responseType: 'H3CellsResult',
      parameters: [
        {
          name: 'geometry',
          type: 'object',
          required: true,
          description: 'GeoJSON geometry to fill with H3 cells',
        },
        {
          name: 'resolution',
          type: 'number',
          required: true,
          description: 'H3 resolution level (0-15)',
          validator: (value: number) => Number.isInteger(value) && value >= 0 && value <= 15,
        },
        {
          name: 'mode',
          type: 'string',
          required: false,
          defaultValue: 'intersecting',
          description: 'Cell selection mode',
          validator: (value: string) => ['intersecting', 'contained', 'covering'].includes(value),
        },
      ],
    },
  ],
};

// Response type definitions
export interface DistanceResult {
  type: 'DISTANCE_RESULT';
  distance: number;
  unit: string;
  method: string;
  point1: { lat: number; lng: number };
  point2: { lat: number; lng: number };
}

export interface ContainmentResult {
  type: 'CONTAINMENT_RESULT';
  contains: boolean;
  algorithm: string;
  point: { lat: number; lng: number };
  polygonVertices: number;
}

export interface BufferResult {
  type: 'BUFFER_RESULT';
  bufferedGeometry: any; // GeoJSON geometry
  originalGeometry: any;
  bufferDistance: number;
  unit: string;
  area?: number;
}

export interface IntersectionResult {
  type: 'INTERSECTION_RESULT';
  intersects: boolean;
  intersection?: any; // GeoJSON geometry
  area?: number;
  length?: number;
  intersectionType: 'point' | 'line' | 'polygon' | 'none';
}

export interface TransformationResult {
  type: 'TRANSFORMATION_RESULT';
  transformedCoordinates: Array<{ x: number; y: number }>;
  fromProjection: string;
  toProjection: string;
  coordinateCount: number;
}

export interface H3CellsResult {
  type: 'H3_CELLS_RESULT';
  cells: string[]; // H3 cell IDs
  resolution: number;
  mode: string;
  cellCount: number;
  coverage: {
    area: number;
    unit: string;
  };
}
