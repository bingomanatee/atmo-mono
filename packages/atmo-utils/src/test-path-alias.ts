/**
 * Test file to demonstrate the use of the "~/" path alias
 */

// Import using the "~/" path alias
import { isObj } from './isObj.ts';

/**
 * A simple function that uses the imported function
 * to demonstrate that the path alias works correctly
 */
export function testPathAlias(value: unknown): boolean {
  console.log('Testing path alias with value:', value);
  return isObj(value);
}
