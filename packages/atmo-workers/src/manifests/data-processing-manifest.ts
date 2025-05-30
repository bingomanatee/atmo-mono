/**
 * Data Processing Worker Manifest - ETL, analysis, and transformation
 */

import type { WorkerManifest } from '../types';

export const DATA_PROCESSING_WORKER_MANIFEST: WorkerManifest = {
  name: 'data-processing',
  version: '1.0.0',
  browserWorkerPath: '/workers/data-processing-worker.js',
  nodeWorkerPath: './workers/data-processing-worker-node.js',
  maxConcurrentTasks: 8,
  defaultTimeout: 45000,
  initConfig: {
    memoryLimit: '512MB',
    streamingEnabled: true,
  },
  actions: [
    {
      actionId: 'CSV_PARSE',
      description: 'Parse CSV data with configurable options',
      retryable: true,
      estimatedDuration: 2000,
      responseType: 'CSVParseResult',
      parameters: [
        {
          name: 'csvData',
          type: 'string',
          required: true,
          description: 'Raw CSV data as string',
        },
        {
          name: 'delimiter',
          type: 'string',
          required: false,
          defaultValue: ',',
          description: 'Field delimiter character',
        },
        {
          name: 'hasHeader',
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: 'Whether first row contains headers',
        },
        {
          name: 'skipEmptyLines',
          type: 'boolean',
          required: false,
          defaultValue: true,
          description: 'Skip empty lines during parsing',
        },
      ],
    },
    {
      actionId: 'JSON_TRANSFORM',
      description: 'Transform JSON data using JSONPath expressions',
      retryable: true,
      estimatedDuration: 1500,
      responseType: 'JSONTransformResult',
      parameters: [
        {
          name: 'data',
          type: 'object',
          required: true,
          description: 'JSON data to transform',
        },
        {
          name: 'transformations',
          type: 'array',
          required: true,
          description: 'Array of transformation rules',
          validator: (value: any[]) => Array.isArray(value) && value.length > 0,
        },
        {
          name: 'outputFormat',
          type: 'string',
          required: false,
          defaultValue: 'object',
          description: 'Output format: object, array, or flat',
          validator: (value: string) => ['object', 'array', 'flat'].includes(value),
        },
      ],
    },
    {
      actionId: 'DATA_AGGREGATION',
      description: 'Aggregate data using various statistical functions',
      retryable: true,
      estimatedDuration: 3000,
      responseType: 'DataAggregationResult',
      parameters: [
        {
          name: 'dataset',
          type: 'array',
          required: true,
          description: 'Array of data objects to aggregate',
          validator: (value: any[]) => Array.isArray(value),
        },
        {
          name: 'groupBy',
          type: 'array',
          required: true,
          description: 'Fields to group by',
          validator: (value: string[]) => Array.isArray(value) && value.every(v => typeof v === 'string'),
        },
        {
          name: 'aggregations',
          type: 'object',
          required: true,
          description: 'Aggregation functions to apply',
        },
        {
          name: 'filters',
          type: 'array',
          required: false,
          defaultValue: [],
          description: 'Filters to apply before aggregation',
        },
      ],
    },
    {
      actionId: 'DATA_VALIDATION',
      description: 'Validate data against schema and business rules',
      retryable: true,
      estimatedDuration: 2500,
      responseType: 'DataValidationResult',
      parameters: [
        {
          name: 'data',
          type: 'array',
          required: true,
          description: 'Data to validate',
        },
        {
          name: 'schema',
          type: 'object',
          required: true,
          description: 'JSON schema for validation',
        },
        {
          name: 'businessRules',
          type: 'array',
          required: false,
          defaultValue: [],
          description: 'Custom business rules to apply',
        },
        {
          name: 'strictMode',
          type: 'boolean',
          required: false,
          defaultValue: false,
          description: 'Whether to use strict validation',
        },
      ],
    },
    {
      actionId: 'TIME_SERIES_ANALYSIS',
      description: 'Analyze time series data for trends and patterns',
      retryable: true,
      estimatedDuration: 8000,
      responseType: 'TimeSeriesAnalysisResult',
      parameters: [
        {
          name: 'timeSeries',
          type: 'array',
          required: true,
          description: 'Time series data with timestamp and value',
          validator: (value: any[]) => Array.isArray(value) && value.length > 0,
        },
        {
          name: 'timeColumn',
          type: 'string',
          required: true,
          description: 'Name of the timestamp column',
        },
        {
          name: 'valueColumn',
          type: 'string',
          required: true,
          description: 'Name of the value column',
        },
        {
          name: 'analysisType',
          type: 'array',
          required: false,
          defaultValue: ['trend', 'seasonality'],
          description: 'Types of analysis to perform',
          validator: (value: string[]) => value.every(v => ['trend', 'seasonality', 'anomalies', 'forecast'].includes(v)),
        },
        {
          name: 'windowSize',
          type: 'number',
          required: false,
          defaultValue: 30,
          description: 'Window size for moving averages',
          validator: (value: number) => Number.isInteger(value) && value > 0,
        },
      ],
    },
    {
      actionId: 'DATA_DEDUPLICATION',
      description: 'Remove duplicate records using fuzzy matching',
      retryable: true,
      estimatedDuration: 5000,
      responseType: 'DataDeduplicationResult',
      parameters: [
        {
          name: 'dataset',
          type: 'array',
          required: true,
          description: 'Dataset to deduplicate',
        },
        {
          name: 'matchFields',
          type: 'array',
          required: true,
          description: 'Fields to use for matching',
          validator: (value: string[]) => Array.isArray(value) && value.length > 0,
        },
        {
          name: 'threshold',
          type: 'number',
          required: false,
          defaultValue: 0.8,
          description: 'Similarity threshold (0-1)',
          validator: (value: number) => value >= 0 && value <= 1,
        },
        {
          name: 'algorithm',
          type: 'string',
          required: false,
          defaultValue: 'levenshtein',
          description: 'Matching algorithm: levenshtein, jaccard, or soundex',
          validator: (value: string) => ['levenshtein', 'jaccard', 'soundex'].includes(value),
        },
      ],
    },
  ],
};

// Response type definitions
export interface CSVParseResult {
  type: 'CSV_PARSE_RESULT';
  data: Record<string, any>[];
  headers: string[];
  rowCount: number;
  errors: string[];
  parseTime: number;
}

export interface JSONTransformResult {
  type: 'JSON_TRANSFORM_RESULT';
  transformedData: any;
  appliedTransformations: number;
  errors: string[];
  outputFormat: string;
}

export interface DataAggregationResult {
  type: 'DATA_AGGREGATION_RESULT';
  aggregatedData: Record<string, any>[];
  groupCount: number;
  totalRecords: number;
  aggregationSummary: Record<string, any>;
}

export interface DataValidationResult {
  type: 'DATA_VALIDATION_RESULT';
  isValid: boolean;
  validRecords: number;
  invalidRecords: number;
  errors: Array<{
    recordIndex: number;
    field: string;
    error: string;
    value: any;
  }>;
  businessRuleViolations: Array<{
    rule: string;
    violatingRecords: number[];
  }>;
}

export interface TimeSeriesAnalysisResult {
  type: 'TIME_SERIES_ANALYSIS_RESULT';
  trend: {
    direction: 'increasing' | 'decreasing' | 'stable';
    strength: number;
    slope: number;
  };
  seasonality?: {
    detected: boolean;
    period: number;
    strength: number;
  };
  anomalies?: Array<{
    timestamp: string;
    value: number;
    severity: 'low' | 'medium' | 'high';
  }>;
  forecast?: Array<{
    timestamp: string;
    predicted: number;
    confidence: number;
  }>;
  statistics: {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
  };
}

export interface DataDeduplicationResult {
  type: 'DATA_DEDUPLICATION_RESULT';
  originalCount: number;
  deduplicatedCount: number;
  duplicatesRemoved: number;
  duplicateGroups: Array<{
    representative: Record<string, any>;
    duplicates: Record<string, any>[];
    similarity: number;
  }>;
  algorithm: string;
  threshold: number;
}
