/**
 * Image Processing Worker Manifest - Image manipulation and analysis
 */

import type { WorkerManifest } from '../types';

export const IMAGE_PROCESSING_WORKER_MANIFEST: WorkerManifest = {
  name: 'image-processing',
  version: '1.0.0',
  browserWorkerPath: '/workers/image-processing-worker.js',
  nodeWorkerPath: './workers/image-processing-worker-node.js',
  maxConcurrentTasks: 4,
  defaultTimeout: 60000,
  initConfig: {
    maxImageSize: '50MB',
    supportedFormats: ['jpeg', 'png', 'webp', 'gif'],
  },
  actions: [
    {
      actionId: 'RESIZE_IMAGE',
      description: 'Resize image to specified dimensions',
      retryable: true,
      estimatedDuration: 3000,
      responseType: 'ImageResizeResult',
      parameters: [
        {
          name: 'imageData',
          type: 'string',
          required: true,
          description: 'Base64 encoded image data',
        },
        {
          name: 'width',
          type: 'number',
          required: true,
          description: 'Target width in pixels',
          validator: (value: number) => Number.isInteger(value) && value > 0 && value <= 8192,
        },
        {
          name: 'height',
          type: 'number',
          required: true,
          description: 'Target height in pixels',
          validator: (value: number) => Number.isInteger(value) && value > 0 && value <= 8192,
        },
        {
          name: 'preserveAspectRatio',
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: 'Whether to preserve aspect ratio',
        },
        {
          name: 'quality',
          type: 'number',
          required: false,
          defaultValue: 90,
          description: 'Output quality (1-100)',
          validator: (value: number) => Number.isInteger(value) && value >= 1 && value <= 100,
        },
      ],
    },
    {
      actionId: 'APPLY_FILTER',
      description: 'Apply image filters and effects',
      retryable: true,
      estimatedDuration: 4000,
      responseType: 'ImageFilterResult',
      parameters: [
        {
          name: 'imageData',
          type: 'string',
          required: true,
          description: 'Base64 encoded image data',
        },
        {
          name: 'filter',
          type: 'string',
          required: true,
          description: 'Filter to apply',
          validator: (value: string) => ['blur', 'sharpen', 'grayscale', 'sepia', 'vintage', 'brightness', 'contrast'].includes(value),
        },
        {
          name: 'intensity',
          type: 'number',
          required: false,
          defaultValue: 1.0,
          description: 'Filter intensity (0-2)',
          validator: (value: number) => value >= 0 && value <= 2,
        },
      ],
    },
  ],
};

export interface ImageResizeResult {
  type: 'IMAGE_RESIZE_RESULT';
  resizedImageData: string;
  originalSize: { width: number; height: number };
  newSize: { width: number; height: number };
  compressionRatio: number;
}

export interface ImageFilterResult {
  type: 'IMAGE_FILTER_RESULT';
  filteredImageData: string;
  filter: string;
  intensity: number;
  processingTime: number;
}
