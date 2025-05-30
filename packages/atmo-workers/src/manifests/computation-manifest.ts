/**
 * Computation Worker Manifest - Mathematical and scientific computing
 */

import type { WorkerManifest } from '../types';

export const COMPUTATION_WORKER_MANIFEST: WorkerManifest = {
  name: 'computation',
  version: '1.0.0',
  browserWorkerPath: '/workers/computation-worker.js',
  nodeWorkerPath: './workers/computation-worker-node.js',
  maxConcurrentTasks: 5,
  defaultTimeout: 60000, // 1 minute for complex calculations
  initConfig: {
    precision: 'double',
    mathLibrary: 'native',
  },
  actions: [
    {
      actionId: 'MATRIX_MULTIPLY',
      description: 'Multiply two matrices using optimized algorithms',
      retryable: true,
      estimatedDuration: 5000,
      responseType: 'MatrixResult',
      parameters: [
        {
          name: 'matrixA',
          type: 'array',
          required: true,
          description: '2D array representing the first matrix',
          validator: (value: number[][]) => Array.isArray(value) && value.every(row => Array.isArray(row)),
        },
        {
          name: 'matrixB',
          type: 'array',
          required: true,
          description: '2D array representing the second matrix',
          validator: (value: number[][]) => Array.isArray(value) && value.every(row => Array.isArray(row)),
        },
        {
          name: 'algorithm',
          type: 'string',
          required: false,
          defaultValue: 'standard',
          description: 'Algorithm to use: standard, strassen, or parallel',
          validator: (value: string) => ['standard', 'strassen', 'parallel'].includes(value),
        },
      ],
    },
    {
      actionId: 'PRIME_FACTORIZATION',
      description: 'Find prime factors of a large number',
      retryable: true,
      estimatedDuration: 10000,
      responseType: 'PrimeFactorsResult',
      parameters: [
        {
          name: 'number',
          type: 'number',
          required: true,
          description: 'Number to factorize',
          validator: (value: number) => Number.isInteger(value) && value > 1,
        },
        {
          name: 'maxTime',
          type: 'number',
          required: false,
          defaultValue: 30000,
          description: 'Maximum time to spend factorizing (ms)',
          validator: (value: number) => value > 0,
        },
      ],
    },
    {
      actionId: 'FOURIER_TRANSFORM',
      description: 'Compute Fast Fourier Transform of signal data',
      retryable: true,
      estimatedDuration: 3000,
      responseType: 'FFTResult',
      parameters: [
        {
          name: 'signal',
          type: 'array',
          required: true,
          description: 'Array of signal values',
          validator: (value: number[]) => Array.isArray(value) && value.length > 0,
        },
        {
          name: 'inverse',
          type: 'boolean',
          required: false,
          defaultValue: false,
          description: 'Whether to compute inverse FFT',
        },
        {
          name: 'windowFunction',
          type: 'string',
          required: false,
          defaultValue: 'none',
          description: 'Window function to apply: none, hamming, hanning, blackman',
          validator: (value: string) => ['none', 'hamming', 'hanning', 'blackman'].includes(value),
        },
      ],
    },
    {
      actionId: 'MONTE_CARLO_PI',
      description: 'Estimate π using Monte Carlo method',
      retryable: true,
      estimatedDuration: 2000,
      responseType: 'MonteCarloResult',
      parameters: [
        {
          name: 'iterations',
          type: 'number',
          required: true,
          description: 'Number of random points to generate',
          validator: (value: number) => Number.isInteger(value) && value > 0,
        },
        {
          name: 'seed',
          type: 'number',
          required: false,
          description: 'Random seed for reproducible results',
          validator: (value: number) => Number.isInteger(value),
        },
      ],
    },
    {
      actionId: 'SOLVE_LINEAR_SYSTEM',
      description: 'Solve system of linear equations Ax = b',
      retryable: true,
      estimatedDuration: 4000,
      responseType: 'LinearSystemResult',
      parameters: [
        {
          name: 'coefficientMatrix',
          type: 'array',
          required: true,
          description: 'Coefficient matrix A',
          validator: (value: number[][]) => Array.isArray(value) && value.every(row => Array.isArray(row)),
        },
        {
          name: 'constantVector',
          type: 'array',
          required: true,
          description: 'Constant vector b',
          validator: (value: number[]) => Array.isArray(value),
        },
        {
          name: 'method',
          type: 'string',
          required: false,
          defaultValue: 'gaussian',
          description: 'Solution method: gaussian, lu, qr, or iterative',
          validator: (value: string) => ['gaussian', 'lu', 'qr', 'iterative'].includes(value),
        },
      ],
    },
    {
      actionId: 'NUMERICAL_INTEGRATION',
      description: 'Compute definite integral using numerical methods',
      retryable: true,
      estimatedDuration: 3000,
      responseType: 'IntegrationResult',
      parameters: [
        {
          name: 'function',
          type: 'string',
          required: true,
          description: 'Mathematical function as string (e.g., "x^2 + 2*x + 1")',
        },
        {
          name: 'lowerBound',
          type: 'number',
          required: true,
          description: 'Lower integration bound',
        },
        {
          name: 'upperBound',
          type: 'number',
          required: true,
          description: 'Upper integration bound',
        },
        {
          name: 'method',
          type: 'string',
          required: false,
          defaultValue: 'simpson',
          description: 'Integration method: simpson, trapezoidal, or gauss',
          validator: (value: string) => ['simpson', 'trapezoidal', 'gauss'].includes(value),
        },
        {
          name: 'subdivisions',
          type: 'number',
          required: false,
          defaultValue: 1000,
          description: 'Number of subdivisions for accuracy',
          validator: (value: number) => Number.isInteger(value) && value > 0,
        },
      ],
    },
  ],
};

// Response type definitions
export interface MatrixResult {
  type: 'MATRIX_RESULT';
  result: number[][];
  dimensions: { rows: number; cols: number };
  algorithm: string;
  computationTime: number;
}

export interface PrimeFactorsResult {
  type: 'PRIME_FACTORS_RESULT';
  factors: number[];
  originalNumber: number;
  isComplete: boolean;
  computationTime: number;
}

export interface FFTResult {
  type: 'FFT_RESULT';
  real: number[];
  imaginary: number[];
  magnitude: number[];
  phase: number[];
  sampleRate?: number;
}

export interface MonteCarloResult {
  type: 'MONTE_CARLO_RESULT';
  piEstimate: number;
  iterations: number;
  accuracy: number;
  pointsInside: number;
  totalPoints: number;
}

export interface LinearSystemResult {
  type: 'LINEAR_SYSTEM_RESULT';
  solution: number[];
  method: string;
  residual: number;
  conditionNumber?: number;
}

export interface IntegrationResult {
  type: 'INTEGRATION_RESULT';
  value: number;
  error: number;
  method: string;
  subdivisions: number;
  convergence: boolean;
}
