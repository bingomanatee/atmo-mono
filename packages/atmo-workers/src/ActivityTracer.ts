/**
 * Activity Tracer - Tracks worker activity and recommends optimal worker selection
 */

import type { WorkerActivity, BankActivity, WorkerMessage, WorkerResponse } from './types';

export class ActivityTracer {
  private banks: Map<string, BankActivity> = new Map();
  private messageHistory: Map<string, { sent: number; completed?: number }> = new Map();
  private readonly maxHistorySize = 1000;

  /**
   * Initialize a worker bank for tracking
   */
  initializeBank(bankId: string, workerIds: string[]): void {
    const workers = new Map<string, WorkerActivity>();
    
    workerIds.forEach(workerId => {
      workers.set(workerId, {
        workerId,
        bankId,
        messagesSent: 0,
        messagesCompleted: 0,
        currentLoad: 0,
        lastActivity: Date.now(),
        averageResponseTime: 0,
        status: 'idle',
      });
    });

    this.banks.set(bankId, {
      bankId,
      workerCount: workerIds.length,
      activeWorkers: workerIds.length,
      totalMessages: 0,
      completedMessages: 0,
      currentLoad: 0,
      workers,
    });
  }

  /**
   * Record a message being sent to a worker
   */
  recordMessageSent(message: WorkerMessage, workerId: string, bankId: string): void {
    const bank = this.banks.get(bankId);
    if (!bank) return;

    const worker = bank.workers.get(workerId);
    if (!worker) return;

    // Update worker activity
    worker.messagesSent++;
    worker.currentLoad++;
    worker.lastActivity = Date.now();
    worker.status = 'busy';

    // Update bank activity
    bank.totalMessages++;
    bank.currentLoad++;

    // Record in message history
    this.messageHistory.set(message.taskId, {
      sent: Date.now(),
    });

    // Cleanup old history
    this.cleanupHistory();
  }

  /**
   * Record a message being completed by a worker
   */
  recordMessageCompleted(response: WorkerResponse): void {
    const bank = this.banks.get(response.bankId);
    if (!bank) return;

    const worker = bank.workers.get(response.workerId);
    if (!worker) return;

    const messageRecord = this.messageHistory.get(response.taskId);
    if (messageRecord) {
      messageRecord.completed = Date.now();
      
      // Update average response time
      const responseTime = messageRecord.completed - messageRecord.sent;
      if (worker.messagesCompleted === 0) {
        worker.averageResponseTime = responseTime;
      } else {
        // Exponential moving average
        worker.averageResponseTime = 
          (worker.averageResponseTime * 0.8) + (responseTime * 0.2);
      }
    }

    // Update worker activity
    worker.messagesCompleted++;
    worker.currentLoad = Math.max(0, worker.currentLoad - 1);
    worker.lastActivity = Date.now();
    worker.status = worker.currentLoad > 0 ? 'busy' : 'idle';

    // Update bank activity
    bank.completedMessages++;
    bank.currentLoad = Math.max(0, bank.currentLoad - 1);
  }

  /**
   * Record a worker error
   */
  recordWorkerError(workerId: string, bankId: string, error: string): void {
    const bank = this.banks.get(bankId);
    if (!bank) return;

    const worker = bank.workers.get(workerId);
    if (!worker) return;

    worker.status = 'error';
    worker.lastActivity = Date.now();
    
    // Reduce current load if worker had pending tasks
    if (worker.currentLoad > 0) {
      bank.currentLoad -= worker.currentLoad;
      worker.currentLoad = 0;
    }
  }

  /**
   * Mark a worker as offline
   */
  markWorkerOffline(workerId: string, bankId: string): void {
    const bank = this.banks.get(bankId);
    if (!bank) return;

    const worker = bank.workers.get(workerId);
    if (!worker) return;

    worker.status = 'offline';
    bank.activeWorkers = Math.max(0, bank.activeWorkers - 1);
    
    // Transfer load from offline worker
    if (worker.currentLoad > 0) {
      bank.currentLoad -= worker.currentLoad;
      worker.currentLoad = 0;
    }
  }

  /**
   * Mark a worker as back online
   */
  markWorkerOnline(workerId: string, bankId: string): void {
    const bank = this.banks.get(bankId);
    if (!bank) return;

    const worker = bank.workers.get(workerId);
    if (!worker) return;

    if (worker.status === 'offline') {
      worker.status = 'idle';
      worker.lastActivity = Date.now();
      bank.activeWorkers++;
    }
  }

  /**
   * Get the next recommended worker for a message
   */
  getNextWorker(bankId?: string): { workerId: string; bankId: string } | null {
    let candidateBanks: BankActivity[];
    
    if (bankId) {
      const bank = this.banks.get(bankId);
      candidateBanks = bank ? [bank] : [];
    } else {
      candidateBanks = Array.from(this.banks.values());
    }

    // Filter to banks with active workers
    candidateBanks = candidateBanks.filter(bank => bank.activeWorkers > 0);
    
    if (candidateBanks.length === 0) {
      return null;
    }

    // Find the bank with the lowest load ratio
    const bestBank = candidateBanks.reduce((best, current) => {
      const bestRatio = best.currentLoad / best.activeWorkers;
      const currentRatio = current.currentLoad / current.activeWorkers;
      return currentRatio < bestRatio ? current : best;
    });

    // Find the best worker in the selected bank
    const availableWorkers = Array.from(bestBank.workers.values())
      .filter(worker => worker.status === 'idle' || worker.status === 'busy');

    if (availableWorkers.length === 0) {
      return null;
    }

    // Sort by load, then by average response time
    const bestWorker = availableWorkers.reduce((best, current) => {
      if (current.currentLoad < best.currentLoad) {
        return current;
      } else if (current.currentLoad === best.currentLoad) {
        return current.averageResponseTime < best.averageResponseTime ? current : best;
      }
      return best;
    });

    return {
      workerId: bestWorker.workerId,
      bankId: bestBank.bankId,
    };
  }

  /**
   * Get activity statistics for a bank
   */
  getBankActivity(bankId: string): BankActivity | null {
    return this.banks.get(bankId) || null;
  }

  /**
   * Get activity statistics for a worker
   */
  getWorkerActivity(workerId: string, bankId: string): WorkerActivity | null {
    const bank = this.banks.get(bankId);
    return bank?.workers.get(workerId) || null;
  }

  /**
   * Get all bank activities
   */
  getAllBankActivities(): BankActivity[] {
    return Array.from(this.banks.values());
  }

  /**
   * Get load balancing recommendations
   */
  getLoadBalancingReport(): {
    totalWorkers: number;
    activeWorkers: number;
    totalLoad: number;
    averageLoad: number;
    recommendations: string[];
  } {
    const banks = Array.from(this.banks.values());
    const totalWorkers = banks.reduce((sum, bank) => sum + bank.workerCount, 0);
    const activeWorkers = banks.reduce((sum, bank) => sum + bank.activeWorkers, 0);
    const totalLoad = banks.reduce((sum, bank) => sum + bank.currentLoad, 0);
    const averageLoad = activeWorkers > 0 ? totalLoad / activeWorkers : 0;
    
    const recommendations: string[] = [];
    
    // Check for overloaded banks
    banks.forEach(bank => {
      const bankLoad = bank.activeWorkers > 0 ? bank.currentLoad / bank.activeWorkers : 0;
      if (bankLoad > averageLoad * 1.5) {
        recommendations.push(`Bank ${bank.bankId} is overloaded (${bankLoad.toFixed(1)} vs avg ${averageLoad.toFixed(1)})`);
      }
    });
    
    // Check for offline workers
    banks.forEach(bank => {
      const offlineWorkers = bank.workerCount - bank.activeWorkers;
      if (offlineWorkers > 0) {
        recommendations.push(`Bank ${bank.bankId} has ${offlineWorkers} offline workers`);
      }
    });
    
    if (recommendations.length === 0) {
      recommendations.push('Load distribution is optimal');
    }

    return {
      totalWorkers,
      activeWorkers,
      totalLoad,
      averageLoad,
      recommendations,
    };
  }

  /**
   * Reset all activity tracking
   */
  reset(): void {
    this.banks.clear();
    this.messageHistory.clear();
  }

  /**
   * Clean up old message history
   */
  private cleanupHistory(): void {
    if (this.messageHistory.size <= this.maxHistorySize) return;

    // Remove oldest entries
    const entries = Array.from(this.messageHistory.entries());
    entries.sort((a, b) => a[1].sent - b[1].sent);
    
    const toRemove = entries.slice(0, entries.length - this.maxHistorySize);
    toRemove.forEach(([taskId]) => {
      this.messageHistory.delete(taskId);
    });
  }
}
