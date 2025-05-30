/**
 * AI Inference Worker Manifest - Machine learning and AI operations
 */

import type { WorkerManifest } from '../types';

export const AI_INFERENCE_WORKER_MANIFEST: WorkerManifest = {
  name: 'ai-inference',
  version: '1.0.0',
  browserWorkerPath: '/workers/ai-inference-worker.js',
  nodeWorkerPath: './workers/ai-inference-worker-node.js',
  maxConcurrentTasks: 3,
  defaultTimeout: 120000, // 2 minutes for AI operations
  initConfig: {
    modelCache: true,
    gpuAcceleration: 'auto',
    memoryLimit: '2GB',
  },
  actions: [
    {
      actionId: 'TEXT_CLASSIFICATION',
      description: 'Classify text using pre-trained models',
      retryable: true,
      estimatedDuration: 3000,
      responseType: 'TextClassificationResult',
      parameters: [
        {
          name: 'text',
          type: 'string',
          required: true,
          description: 'Text to classify',
          validator: (value: string) => value.length > 0 && value.length < 10000,
        },
        {
          name: 'model',
          type: 'string',
          required: false,
          defaultValue: 'bert-base',
          description: 'Model to use for classification',
          validator: (value: string) => ['bert-base', 'roberta', 'distilbert', 'custom'].includes(value),
        },
        {
          name: 'categories',
          type: 'array',
          required: false,
          description: 'Custom categories for classification',
          validator: (value: string[]) => Array.isArray(value) && value.every(v => typeof v === 'string'),
        },
        {
          name: 'threshold',
          type: 'number',
          required: false,
          defaultValue: 0.5,
          description: 'Confidence threshold for classification',
          validator: (value: number) => value >= 0 && value <= 1,
        },
      ],
    },
    {
      actionId: 'SENTIMENT_ANALYSIS',
      description: 'Analyze sentiment of text content',
      retryable: true,
      estimatedDuration: 2000,
      responseType: 'SentimentAnalysisResult',
      parameters: [
        {
          name: 'text',
          type: 'string',
          required: true,
          description: 'Text to analyze',
          validator: (value: string) => value.length > 0,
        },
        {
          name: 'language',
          type: 'string',
          required: false,
          defaultValue: 'en',
          description: 'Language code (en, es, fr, de, etc.)',
          validator: (value: string) => /^[a-z]{2}$/.test(value),
        },
        {
          name: 'granularity',
          type: 'string',
          required: false,
          defaultValue: 'sentence',
          description: 'Analysis granularity: word, sentence, or document',
          validator: (value: string) => ['word', 'sentence', 'document'].includes(value),
        },
      ],
    },
    {
      actionId: 'NAMED_ENTITY_RECOGNITION',
      description: 'Extract named entities from text',
      retryable: true,
      estimatedDuration: 4000,
      responseType: 'NERResult',
      parameters: [
        {
          name: 'text',
          type: 'string',
          required: true,
          description: 'Text to process',
        },
        {
          name: 'entityTypes',
          type: 'array',
          required: false,
          defaultValue: ['PERSON', 'ORG', 'GPE', 'DATE'],
          description: 'Types of entities to extract',
          validator: (value: string[]) => Array.isArray(value),
        },
        {
          name: 'model',
          type: 'string',
          required: false,
          defaultValue: 'spacy-en',
          description: 'NER model to use',
        },
      ],
    },
    {
      actionId: 'IMAGE_CLASSIFICATION',
      description: 'Classify images using computer vision models',
      retryable: true,
      estimatedDuration: 8000,
      responseType: 'ImageClassificationResult',
      parameters: [
        {
          name: 'imageData',
          type: 'string',
          required: true,
          description: 'Base64 encoded image data or image URL',
        },
        {
          name: 'model',
          type: 'string',
          required: false,
          defaultValue: 'resnet50',
          description: 'Vision model to use',
          validator: (value: string) => ['resnet50', 'mobilenet', 'efficientnet', 'vit'].includes(value),
        },
        {
          name: 'topK',
          type: 'number',
          required: false,
          defaultValue: 5,
          description: 'Number of top predictions to return',
          validator: (value: number) => Number.isInteger(value) && value > 0 && value <= 20,
        },
      ],
    },
    {
      actionId: 'OBJECT_DETECTION',
      description: 'Detect and locate objects in images',
      retryable: true,
      estimatedDuration: 12000,
      responseType: 'ObjectDetectionResult',
      parameters: [
        {
          name: 'imageData',
          type: 'string',
          required: true,
          description: 'Base64 encoded image data or image URL',
        },
        {
          name: 'model',
          type: 'string',
          required: false,
          defaultValue: 'yolo-v5',
          description: 'Object detection model',
          validator: (value: string) => ['yolo-v5', 'faster-rcnn', 'ssd', 'detectron2'].includes(value),
        },
        {
          name: 'confidenceThreshold',
          type: 'number',
          required: false,
          defaultValue: 0.5,
          description: 'Minimum confidence for detections',
          validator: (value: number) => value >= 0 && value <= 1,
        },
        {
          name: 'maxDetections',
          type: 'number',
          required: false,
          defaultValue: 100,
          description: 'Maximum number of detections',
          validator: (value: number) => Number.isInteger(value) && value > 0,
        },
      ],
    },
    {
      actionId: 'TEXT_GENERATION',
      description: 'Generate text using language models',
      retryable: true,
      estimatedDuration: 15000,
      responseType: 'TextGenerationResult',
      parameters: [
        {
          name: 'prompt',
          type: 'string',
          required: true,
          description: 'Text prompt for generation',
        },
        {
          name: 'maxLength',
          type: 'number',
          required: false,
          defaultValue: 100,
          description: 'Maximum length of generated text',
          validator: (value: number) => Number.isInteger(value) && value > 0 && value <= 2048,
        },
        {
          name: 'temperature',
          type: 'number',
          required: false,
          defaultValue: 0.7,
          description: 'Sampling temperature (0-2)',
          validator: (value: number) => value >= 0 && value <= 2,
        },
        {
          name: 'model',
          type: 'string',
          required: false,
          defaultValue: 'gpt-3.5',
          description: 'Language model to use',
          validator: (value: string) => ['gpt-3.5', 'gpt-4', 'claude', 'llama2'].includes(value),
        },
      ],
    },
  ],
};

// Response type definitions
export interface TextClassificationResult {
  type: 'TEXT_CLASSIFICATION_RESULT';
  predictions: Array<{
    label: string;
    confidence: number;
  }>;
  model: string;
  processingTime: number;
}

export interface SentimentAnalysisResult {
  type: 'SENTIMENT_ANALYSIS_RESULT';
  overall: {
    sentiment: 'positive' | 'negative' | 'neutral';
    confidence: number;
    score: number; // -1 to 1
  };
  detailed?: Array<{
    text: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    confidence: number;
    score: number;
  }>;
  language: string;
}

export interface NERResult {
  type: 'NER_RESULT';
  entities: Array<{
    text: string;
    label: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  entityCounts: Record<string, number>;
  model: string;
}

export interface ImageClassificationResult {
  type: 'IMAGE_CLASSIFICATION_RESULT';
  predictions: Array<{
    class: string;
    confidence: number;
  }>;
  model: string;
  imageSize: { width: number; height: number };
  processingTime: number;
}

export interface ObjectDetectionResult {
  type: 'OBJECT_DETECTION_RESULT';
  detections: Array<{
    class: string;
    confidence: number;
    bbox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  totalDetections: number;
  model: string;
  imageSize: { width: number; height: number };
}

export interface TextGenerationResult {
  type: 'TEXT_GENERATION_RESULT';
  generatedText: string;
  prompt: string;
  model: string;
  parameters: {
    maxLength: number;
    temperature: number;
  };
  tokensGenerated: number;
  processingTime: number;
}
