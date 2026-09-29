import initialCraCatalog from "@/data/regulatory/cra-catalog.json";
import { regulatoryCatalogSchema } from "./models";

export const CRA_FRAMEWORK_ID = "a8c1f2d4-2929-4292-8292-000000002847";
export const CRA_PRODUCT_NAME =
  "Cyber Resilience Act - CRA Readiness Assessment";
export const craCatalog = regulatoryCatalogSchema.parse(initialCraCatalog);

/** A partial catalog is not an active, legally complete assessment. */
export const CRA_RELEASE_STATUS = "draft" as const;
