import type {
  BusinessImportProposal,
  ConfirmedImportResult,
  ExtractedCatalogueItem,
  ImportFieldCategory,
  ImportFieldStatus,
  ImportProposalStats,
  ImportReviewField,
  ImportSourceFormat,
} from "@/lib/businesses/import/types";

export type {
  BusinessImportProposal,
  ConfirmedImportResult,
  ExtractedCatalogueItem,
  ImportFieldCategory,
  ImportFieldStatus,
  ImportProposalStats,
  ImportReviewField,
  ImportSourceFormat,
};

export interface ImportReviewContainerProps {
  workspaceId: string;
  userId: string;
  onSuccessRedirect?: string;
}

export type ReviewFilter =
  "all" | "unconfirmed" | "confirmed" | "rejected" | "material" | "catalogue";
