import type { WebResearchObservation, WebResearchResult } from "../enrichment/result-types";
import type { ClaimValidationSummary } from "./claims";

export type CollectedPage = {
  url: string;
  title: string;
  description: string;
  text: string;
  fetchedAt: string;
  pageKind:
    | "HOME"
    | "ABOUT"
    | "CAREERS"
    | "NEWS"
    | "SERVICES"
    | "LOCATIONS"
    | "CONTACT"
    | "OTHER";
};

export type CollectorResult = {
  officialWebsite: string;
  websiteConfidence: number;
  pages: CollectedPage[];
  attemptedUrls: string[];
  warnings: string[];
};

export type ExtractedCompanyFeatures = {
  businessSummary: string;
  industry: string;
  subindustry: string;
  industryConfidence: number;
  employeeLow: number;
  employeeHigh: number;
  employeeConfidence: number;
  serviceRegions: string[];
  businessModels: string[];
  technologies: string[];
  decisionRoles: string[];
};

export type LocalIntelligenceRun = {
  result: WebResearchResult;
  sourceUrls: string[];
  engine: "REVENUESCOUT_INTELLIGENCE_V2";
  model: "RS_CONVERSION_V2";
  collector: CollectorResult;
  observations: WebResearchObservation[];
  validation: ClaimValidationSummary;
};
