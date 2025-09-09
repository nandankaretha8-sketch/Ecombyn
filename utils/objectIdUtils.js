import mongoose from 'mongoose';

/**
 * Validates if a string is a valid MongoDB ObjectId
 * @param {string} id - The string to validate
 * @returns {boolean} - True if valid ObjectId, false otherwise
 */
export const isValidObjectId = (id) => {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id) && /^[a-fA-F0-9]{24}$/.test(id);
};

/**
 * Converts a string to ObjectId if valid, otherwise returns null
 * @param {string} id - The string to convert
 * @returns {mongoose.Types.ObjectId|null} - ObjectId if valid, null otherwise
 */
export const toObjectId = (id) => {
  if (!isValidObjectId(id)) return null;
  return new mongoose.Types.ObjectId(id);
};

/**
 * Safely converts an ObjectId to string, handling null/undefined values
 * @param {mongoose.Types.ObjectId|string|null} id - The ObjectId to convert
 * @returns {string|null} - String representation or null
 */
export const objectIdToString = (id) => {
  if (!id) return null;
  return id.toString();
};

/**
 * Compares two ObjectIds for equality, handling string/ObjectId types
 * @param {mongoose.Types.ObjectId|string} id1 - First ObjectId
 * @param {mongoose.Types.ObjectId|string} id2 - Second ObjectId
 * @returns {boolean} - True if equal, false otherwise
 */
export const areObjectIdsEqual = (id1, id2) => {
  if (!id1 || !id2) return false;
  return objectIdToString(id1) === objectIdToString(id2);
};
