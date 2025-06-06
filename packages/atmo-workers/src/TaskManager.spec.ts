import { describe, expect, it } from 'vitest';
import { TaskManager } from './TaskManager.ts';
import { type MessageIF } from './types.workers.ts';

describe('TaskManager', () => {
  describe('constructor', () => {
    it('should create a manager with no tasks', () => {
      const mgr = new TaskManager();
      expect(mgr.status()).toEqual({
        pending: [],
        working: [],
        failed: [],
        active: [],
      });
    });
  });

  describe('addTask', () => {
    it('should add a task', () => {
      const mgr = new TaskManager();
      const msgs: MessageIF[] = [];
      const sub = mgr.events$.subscribe((msg) => msgs.push(msg));
      const task = mgr.addTask({
        name: 'foo',
        params: 100,
      });

      expect(mgr.status()).toEqual({
        pending: [task.id],
        working: [],
        failed: [],
        active: [],
      });

      expect(msgs.length).toBe(1);
      expect(msgs[0].content.id).toBe(task.id);

      sub.unsubscribe();
    });
  });
});
