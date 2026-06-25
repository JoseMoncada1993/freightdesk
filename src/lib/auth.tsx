// Single source of truth for auth lives in AuthContext.tsx.
// Re-exported here so both @/lib/auth and @/lib/AuthContext resolve to the same context.
export { AuthProvider, useAuth } from "./AuthContext";
