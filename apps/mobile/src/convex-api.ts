/**
 * Re-exports the typed Convex API from the monorepo's generated files.
 *
 * Import in screens:
 *   import { api } from '@/convex-api';
 *
 * The `@/` alias resolves to `src/` via tsconfig paths, and Metro's watchFolders
 * (see metro.config.js) makes the monorepo's convex/_generated/ reachable.
 */
export { api } from '../../../convex/_generated/api';
