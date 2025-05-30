/**
 * Storage Collections Interface - Abstraction for data persistence
 */

import type {
  Bank,
  TaskDefinition,
  BankTaskCapability,
  Request,
  RequestAssignment,
  RequestResult,
  RequestError,
  RequestStatusHistory,
  RequestQuery,
} from '../data-models';

export interface IStorageCollections {
  // Bank Collections
  banks: IBankCollection;
  tasks: ITaskCollection;
  capabilities: ICapabilityCollection;
  
  // Request Collections
  requests: IRequestCollection;
  assignments: IAssignmentCollection;
  results: IResultCollection;
  errors: IErrorCollection;
  statusHistory: IStatusHistoryCollection;
}

export interface IBankCollection {
  get(bankId: string): Promise<Bank | null>;
  set(bank: Bank): Promise<void>;
  delete(bankId: string): Promise<boolean>;
  list(): Promise<Bank[]>;
  findByStatus(status: Bank['status']): Promise<Bank[]>;
  findByManifest(manifestName: string): Promise<Bank[]>;
}

export interface ITaskCollection {
  get(taskId: string): Promise<TaskDefinition | null>;
  set(task: TaskDefinition): Promise<void>;
  delete(taskId: string): Promise<boolean>;
  list(): Promise<TaskDefinition[]>;
  findByCategory(category: string): Promise<TaskDefinition[]>;
}

export interface ICapabilityCollection {
  get(capabilityId: string): Promise<BankTaskCapability | null>;
  set(capability: BankTaskCapability): Promise<void>;
  delete(capabilityId: string): Promise<boolean>;
  list(): Promise<BankTaskCapability[]>;
  findByBank(bankId: string): Promise<BankTaskCapability[]>;
  findByTask(taskId: string): Promise<BankTaskCapability[]>;
  findByBankAndTask(bankId: string, taskId: string): Promise<BankTaskCapability | null>;
}

export interface IRequestCollection {
  get(requestId: string): Promise<Request | null>;
  set(request: Request): Promise<void>;
  delete(requestId: string): Promise<boolean>;
  list(): Promise<Request[]>;
  query(query: RequestQuery): Promise<Request[]>;
  findByStatus(status: Request['status']): Promise<Request[]>;
  findByClient(clientId: string): Promise<Request[]>;
  findByTask(taskId: string): Promise<Request[]>;
}

export interface IAssignmentCollection {
  get(assignmentId: string): Promise<RequestAssignment | null>;
  set(assignment: RequestAssignment): Promise<void>;
  delete(assignmentId: string): Promise<boolean>;
  list(): Promise<RequestAssignment[]>;
  findByRequest(requestId: string): Promise<RequestAssignment[]>;
  findByBank(bankId: string): Promise<RequestAssignment[]>;
  findByWorker(workerId: string): Promise<RequestAssignment[]>;
  findByStatus(status: RequestAssignment['status']): Promise<RequestAssignment[]>;
}

export interface IResultCollection {
  get(resultId: string): Promise<RequestResult | null>;
  set(result: RequestResult): Promise<void>;
  delete(resultId: string): Promise<boolean>;
  list(): Promise<RequestResult[]>;
  findByRequest(requestId: string): Promise<RequestResult[]>;
  findByAssignment(assignmentId: string): Promise<RequestResult | null>;
  findSuccessful(): Promise<RequestResult[]>;
  findFailed(): Promise<RequestResult[]>;
}

export interface IErrorCollection {
  get(errorId: string): Promise<RequestError | null>;
  set(error: RequestError): Promise<void>;
  delete(errorId: string): Promise<boolean>;
  list(): Promise<RequestError[]>;
  findByRequest(requestId: string): Promise<RequestError[]>;
  findByCategory(category: RequestError['category']): Promise<RequestError[]>;
  findBySeverity(severity: RequestError['severity']): Promise<RequestError[]>;
  findRetryable(): Promise<RequestError[]>;
}

export interface IStatusHistoryCollection {
  get(requestId: string): Promise<RequestStatusHistory[]>;
  add(requestId: string, history: RequestStatusHistory): Promise<void>;
  delete(requestId: string): Promise<boolean>;
  list(): Promise<Array<{ requestId: string; history: RequestStatusHistory[] }>>;
  findByStatus(status: Request['status']): Promise<RequestStatusHistory[]>;
}
