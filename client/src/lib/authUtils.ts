// Authentication removed - direct access mode
export function isUnauthorizedError(error: any): boolean {
  return false; // No authentication errors in direct access mode
}

export function handleAuthError() {
  // No authentication required
}