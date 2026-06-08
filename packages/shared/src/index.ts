// Shared Zod schemas, inferred types, and pure domain logic for the API + web.
// Barrel — consumers import everything from "@homejobboard/shared".
//
// Placeholder for M01: the normalized `Job`, `JobFilters`, `Source`, and
// `JobScore` schemas land in milestone 02. A non-empty export keeps biome's
// `noUselessEmptyExport` + `isolatedModules` happy on the empty barrel.

export const SHARED_PACKAGE = "@homejobboard/shared";
