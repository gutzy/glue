/**
 * Vector utility functions for basic 3D math operations
 * These utilities provide simple vector operations without requiring Three.js
 */

/**
 * Apply a quaternion rotation to a vector
 * @param {Object} vector - Vector object with x, y, z properties
 * @param {Object} quaternion - Quaternion object with x, y, z, w properties
 */
export function applyQuaternionToVector(vector, quaternion) {
  const { x, y, z, w } = quaternion;
  const vx = vector.x;
  const vy = vector.y;
  const vz = vector.z;
  
  // Apply quaternion rotation
  vector.x = (1 - 2 * y * y - 2 * z * z) * vx + (2 * x * y - 2 * w * z) * vy + (2 * x * z + 2 * w * y) * vz;
  vector.y = (2 * x * y + 2 * w * z) * vx + (1 - 2 * x * x - 2 * z * z) * vy + (2 * y * z - 2 * w * x) * vz;
  vector.z = (2 * x * z - 2 * w * y) * vx + (2 * y * z + 2 * w * x) * vy + (1 - 2 * x * x - 2 * y * y) * vz;
}

/**
 * Normalize a vector to unit length
 * @param {Object} vector - Vector object with x, y, z properties
 */
export function normalizeVector(vector) {
  const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y + vector.z * vector.z);
  if (length > 0) {
    vector.x /= length;
    vector.y /= length;
    vector.z /= length;
  }
}

/**
 * Create a copy of a vector
 * @param {Object} vector - Vector object with x, y, z properties
 * @returns {Object} New vector object
 */
export function cloneVector(vector) {
  return { x: vector.x, y: vector.y, z: vector.z };
}

/**
 * Negate a vector (multiply all components by -1)
 * @param {Object} vector - Vector object with x, y, z properties
 * @returns {Object} New negated vector object
 */
export function negateVector(vector) {
  return { x: -vector.x, y: -vector.y, z: -vector.z };
}

