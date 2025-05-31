import { describe, it, expect, beforeEach } from 'vitest';
import { TaskManager, TASK_MANAGER_EVENTS } from '../TaskManager';
import { MockResponder } from '../MockResponder';
import { firstValueFrom } from 'rxjs';

describe('TaskManager - Observable Pattern with MockResponder', () => {
  let taskManager: TaskManager;
  let mockResponder: MockResponder;

  beforeEach(async () => {
    taskManager = new TaskManager({ name: 'test-manager' });

    mockResponder = new MockResponder({
      name: 'test-responder',
      taskReducers: {
        'add-numbers': (parameters: { a: number; b: number }) => {
          return { result: parameters.a + parameters.b, operation: 'addition' };
        },
        'failing-task': () => {
          throw new Error('Test error');
        },
      },
    });

    // Attach responder to task manager
    await mockResponder.attachRequestManager(taskManager);
  });

  it('should complete claim/confirm cycle and process request', async () => {
    const events: any[] = [];
    const subscription = taskManager.subscribe((event) => events.push(event));

    // Submit a request - MockResponder will claim and process it
    const result$ = taskManager.submitRequest(
      'add-numbers',
      { a: 5, b: 3 },
      { clientId: 'test-client' },
    );

    // Wait for MockResponder to complete the full cycle
    const result = await firstValueFrom(result$);

    // Verify the claim/confirm cycle happened
    const submittedEvent = events.find(
      (e) => e.type === TASK_MANAGER_EVENTS.REQUEST_SUBMITTED,
    );

    const claimedEvent = events.find(
      (e) => e.type === TASK_MANAGER_EVENTS.REQUEST_CLAIMED,
    );
    const confirmedEvent = events.find(
      (e) => e.type === TASK_MANAGER_EVENTS.REQUEST_CLAIM_CONFIRMED,
    );
    const completedEvent = events.find(
      (e) => e.type === TASK_MANAGER_EVENTS.REQUEST_COMPLETED,
    );

    expect(submittedEvent).toBeDefined();
    expect(claimedEvent).toBeDefined();
    expect(claimedEvent.responderId).toBeDefined(); // Should be unique ID, not name
    expect(confirmedEvent).toBeDefined();
    expect(confirmedEvent.responderId).toBe(claimedEvent.responderId); // Same ID for claim and confirm
    expect(completedEvent).toBeDefined();

    expect(result).toEqual({ result: 8, operation: 'addition' });

    subscription.unsubscribe();
  });

  it('should return Observable that rejects when MockResponder fails', async () => {
    // Submit a request for a failing task - MockResponder will automatically fail it
    const result$ = taskManager.submitRequest(
      'failing-task',
      {},
      { clientId: 'test-client' },
    );

    // Wait for MockResponder to process and fail the request
    await expect(firstValueFrom(result$)).rejects.toThrow('Test error');
  });

  it('should ignore unknown tasks and let them timeout', async () => {
    await expect(
      new Promise((resolve, reject) => {
        // Capture events
        const events: any[] = [];
        const subscription = taskManager.subscribe((event) =>
          events.push(event),
        );

        // Submit a request for unknown task - MockResponder will ignore it
        const result$ = taskManager.submitRequest(
          'unknown-task',
          {},
          { clientId: 'test-client', maxTime: 100 },
        );

        // Subscribe to the result Observable
        result$.subscribe({
          next: (result) => {
            subscription.unsubscribe();
            resolve(result);
          },
          error: (error) => {
            subscription.unsubscribe();
            reject(error);
          },
        });

        // Since no responder handles this task, manually timeout after a delay
        setTimeout(() => {
          const submittedEvent = events.find(
            (e) => e.type === TASK_MANAGER_EVENTS.REQUEST_SUBMITTED,
          );
          if (submittedEvent) {
            taskManager.timeoutRequest(submittedEvent.requestId);
          }
        }, 50);
      }),
    ).rejects.toThrow('Request timed out');
  });

  it('should ensure only one responder processes when multiple are capable', async () => {
    // Create a second MockResponder with same capabilities
    const mockResponder2 = new MockResponder({
      name: 'test-responder-2',
      taskReducers: {
        'add-numbers': (parameters: { a: number; b: number }) => {
          return {
            result: parameters.a + parameters.b,
            operation: 'addition-from-responder-2',
          };
        },
      },
    });

    // Attach second responder to same task manager
    await mockResponder2.attachRequestManager(taskManager);

    const events: any[] = [];
    const subscription = taskManager.subscribe((event) => events.push(event));

    // Submit a request that both responders can handle
    const result$ = taskManager.submitRequest(
      'add-numbers',
      { a: 5, b: 3 },
      { clientId: 'test-client' },
    );

    // Wait for completion
    const result = await firstValueFrom(result$);

    // Verify only one completion event was sent
    const completedEvents = events.filter(
      (e) => e.type === TASK_MANAGER_EVENTS.REQUEST_COMPLETED,
    );
    expect(completedEvents).toHaveLength(1);

    // Verify only one responder was confirmed
    const confirmedEvents = events.filter(
      (e) => e.type === TASK_MANAGER_EVENTS.REQUEST_CLAIM_CONFIRMED,
    );
    expect(confirmedEvents).toHaveLength(1);

    // Verify we got a result (from whichever responder won)
    expect(result).toHaveProperty('result', 8);
    expect(result).toHaveProperty('operation');
    expect(result.operation).toMatch(/addition/);

    // Verify the winner has a valid unique ID (UUID format)
    const winnerResponderId = confirmedEvents[0].responderId;
    expect(winnerResponderId).toBeDefined();
    expect(typeof winnerResponderId).toBe('string');
    expect(winnerResponderId.length).toBeGreaterThan(10); // UUID is longer than names

    console.log(`🏆 Winner ID: ${winnerResponderId}`);

    subscription.unsubscribe();
  });
});
