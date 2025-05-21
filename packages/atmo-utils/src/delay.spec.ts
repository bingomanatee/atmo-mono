import { describe, it, expect, vi } from 'vitest';
import { delay, delayMs, delayWith } from './delay';

describe('delay utilities', () => {
  it('should execute callback after delay', async () => {
    const callback = vi.fn().mockReturnValue('result');
    
    const result = await delay(callback);
    
    expect(callback).toHaveBeenCalledTimes(1);
    expect(result).toBe('result');
  });
  
  it('should delay execution by specified milliseconds', async () => {
    const start = Date.now();
    
    await delayMs(50);
    
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40); // Allow for small timing variations
  });
  
  it('should delay execution and pass value to callback', async () => {
    const callback = vi.fn().mockImplementation((value) => `processed-${value}`);
    
    const result = await delayWith('test', callback);
    
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('test');
    expect(result).toBe('processed-test');
  });
});
