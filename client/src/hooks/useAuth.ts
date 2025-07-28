// Authentication removed - direct access mode
export function useAuth() {
  return {
    user: { id: 'anonymous', name: 'Anonymous User' },
    isLoading: false,
    isAuthenticated: true, // Always authenticated for direct access
  };
}
