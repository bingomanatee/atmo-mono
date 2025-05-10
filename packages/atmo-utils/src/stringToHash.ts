
export function stringToHash(str: string, size = 8): string {
  let hash = 0;

  if (str.length === 0) return '0';

  for (let i = 0; i < str.length; i++) {
    // Get the character code
    const char = str.charCodeAt(i);
    // Shift the hash left by 5 bits (multiply by 32) and add the current hash
    // Then add the character code
    hash = (hash << 5) - hash + char;
    // Convert to 32-bit integer (handles integer overflow)
    hash = hash & hash;
  }

  // Convert to a positive hexadecimal string and take the first 8 characters
  // Use Math.abs to ensure we get a positive number
  return Math.abs(hash).toString(16).padStart(size, '0').substring(0, size);
}