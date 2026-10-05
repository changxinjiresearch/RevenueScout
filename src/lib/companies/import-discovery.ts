import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import {
  findCompanyDuplicate,
  normaliseCompanyName,
  normaliseDomain,
} from "./dedupe";
import type {
  DiscoveryCandidate,
  DiscoveryEvidenceSource,
  DiscoveryProviderIdentifier,
} from "@/lib/discovery/types";

type PersistableEvidence = {
  sourceType: string;
  sourceUrl: string;
  sourceLabel: string;
  title: string;
  excerpt: string;
  observedAt: string;
  confidence: number;
  verificationStatus: "CONFIRMED" | "LIKELY" | "UNVERIFIED";
  providerRecordId: string | null;
  sourceFamily: string | null;
  rawPayload: unknown;
};

function candidateIdentifiers(
  candidate: DiscoveryCandidate,
): DiscoveryProviderIdentifier[] {
  if (candidate.providerIdentifiers?.length) {
    return candidate.providerIdentifiers;
  }

  if (candidate.provider === "GLEIF") {
    return [
      {
        provider: "GLEIF",
        identifierType: "LEI",
        identifierValue: candidate.providerRecordId,
      },
    ];
  }

  if (candidate.provider === "WIKIDATA") {
    return [
      {
        provider: "WIKIDATA",
        identifierType: "WIKIDATA",
        identifierValue: candidate.providerRecordId,
      },
    ];
  }

  return [];
}

function candidateEvidence(candidate: DiscoveryCandidate): PersistableEvidence[] {
  if (candidate.sourceEvidence?.length) {
    return candidate.sourceEvidence.map((evidence: DiscoveryEvidenceSource) => ({
      sourceType: evidence.provider,
      sourceUrl: evidence.sourceUrl,
      sourceLabel: evidence.sourceLabel,
      title: candidate.legalName || candidate.displayName,
      excerpt: evidence.excerpt,
      observedAt: evidence.observedAt,
      confidence: evidence.confidence,
      verificationStatus: evidence.verificationStatus,
      providerRecordId: evidence.providerRecordId ?? null,
      sourceFamily: evidence.sourceFamily,
      rawPayload: evidence,
    }));
  }

  return [
    {
      sourceType: candidate.provider,
      sourceUrl: candidate.sourceUrl,
      sourceLabel: candidate.sourceLabel,
      title: candidate.legalName,
      excerpt:
        candidate.description ??
        "External discovery record retained for provenance.",
      observedAt: candidate.observedAt,
      confidence: candidate.sourceConfidence,
      verificationStatus: candidate.verificationStatus,
      providerRecordId: candidate.providerRecordId,
      sourceFamily: null,
      rawPayload: candidate,
    },
  ];
}

function evidenceHash(
  candidate: DiscoveryCandidate,
  evidence: PersistableEvidence,
): string {
  return createHash("sha256")
    .update(
      [
        candidate.displayName,
        evidence.sourceType,
        evidence.providerRecordId ?? "",
        evidence.sourceUrl,
        evidence.excerpt,
      ].join("|"),
    )
    .digest("hex");
}

async function findDuplicateAcrossIdentifiers(input: {
  organizationId: string;
  candidate: DiscoveryCandidate;
  domain: string | null;
}) {
  const identifiers = candidateIdentifiers(input.candidate);

  for (const identifier of identifiers) {
    const match = await findCompanyDuplicate({
      organizationId: input.organizationId,
      displayName: input.candidate.displayName,
      country: input.candidate.country,
      domain: input.domain,
      identifierType: identifier.identifierType,
      identifierValue: identifier.identifierValue,
    });
    if (match) return match;
  }

  return findCompanyDuplicate({
    organizationId: input.organizationId,
    displayName: input.candidate.displayName,
    country: input.candidate.country,
    domain: input.domain,
  });
}

export async function importDiscoveryCandidate(input: {
  organizationId: string;
  userId: string;
  candidate: DiscoveryCandidate;
}): Promise<{ companyId: string; duplicate: boolean; duplicateReason?: string }> {
  const { organizationId, userId, candidate } = input;
  const domain = normaliseDomain(candidate.domain ?? candidate.website);
  const identifiers = candidateIdentifiers(candidate);
  const evidence = candidateEvidence(candidate);

  const duplicate = await findDuplicateAcrossIdentifiers({
    organizationId,
    candidate,
    domain,
  });

  const sql = db();

  if (duplicate) {
    for (const item of evidence) {
      await sql`
        INSERT INTO company_evidence (
          organization_id,
          company_id,
          source_type,
          source_url,
          source_label,
          title,
          excerpt,
          observed_at,
          confidence,
          verification_status,
          stale_after_days,
          content_hash,
          provider_record_id,
          raw_payload,
          source_family,
          source_quality,
          extraction_confidence,
          created_by
        )
        VALUES (
          ${organizationId},
          ${duplicate.id},
          ${item.sourceType},
          ${item.sourceUrl},
          ${item.sourceLabel},
          ${item.title},
          ${item.excerpt},
          ${new Date(item.observedAt)},
          ${item.confidence},
          ${item.verificationStatus},
          180,
          ${evidenceHash(candidate, item)},
          ${item.providerRecordId},
          ${JSON.stringify(item.rawPayload)}::text::jsonb,
          ${item.sourceFamily},
          ${item.confidence},
          0.95,
          ${userId}
        )
        ON CONFLICT (company_id, content_hash) WHERE content_hash IS NOT NULL
        DO NOTHING
      `;
    }

    for (const identifier of identifiers) {
      await sql`
        INSERT INTO company_identifiers (
          organization_id,
          company_id,
          identifier_type,
          identifier_value,
          provider
        )
        VALUES (
          ${organizationId},
          ${duplicate.id},
          ${identifier.identifierType},
          ${identifier.identifierValue},
          ${identifier.provider}
        )
        ON CONFLICT DO NOTHING
      `;
    }

    return {
      companyId: duplicate.id,
      duplicate: true,
      duplicateReason: duplicate.reason,
    };
  }

  let companyId = "";

  await sql.begin(async (tx) => {
    const [company] = await tx<{ id: string }[]>`
      INSERT INTO companies (
        organization_id,
        display_name,
        legal_name,
        name_key,
        website,
        domain,
        description,
        country,
        state,
        city,
        address,
        industry,
        subindustry,
        employee_count,
        employee_range,
        founded_year,
        company_type,
        legal_entity_category,
        legal_entity_subcategory,
        entity_status,
        registration_status,
        jurisdiction,
        legal_form_code,
        registration_authority,
        registered_as,
        provider_last_updated_at,
        service_regions,
        entity_type,
        source_origin,
        created_by
      )
      VALUES (
        ${organizationId},
        ${candidate.displayName},
        ${candidate.legalName},
        ${normaliseCompanyName(candidate.displayName)},
        ${candidate.website},
        ${domain},
        ${candidate.description},
        ${candidate.country},
        ${candidate.state},
        ${candidate.city},
        ${candidate.address},
        ${candidate.industry},
        ${candidate.subindustry},
        ${candidate.employeeCount},
        ${candidate.employeeRange},
        ${candidate.foundedYear},
        ${candidate.companyType},
        ${candidate.legalEntityCategory},
        ${candidate.legalEntitySubcategory},
        ${candidate.entityStatus},
        ${candidate.registrationStatus},
        ${candidate.jurisdiction},
        ${candidate.legalFormCode},
        ${candidate.registrationAuthority},
        ${candidate.registeredAs},
        ${candidate.providerLastUpdatedAt
          ? new Date(candidate.providerLastUpdatedAt)
          : null},
        ${candidate.serviceRegions},
        ${candidate.entityType},
        'DISCOVERY',
        ${userId}
      )
      RETURNING id
    `;

    companyId = company.id;

    for (const identifier of identifiers) {
      await tx`
        INSERT INTO company_identifiers (
          organization_id,
          company_id,
          identifier_type,
          identifier_value,
          provider
        )
        VALUES (
          ${organizationId},
          ${company.id},
          ${identifier.identifierType},
          ${identifier.identifierValue},
          ${identifier.provider}
        )
        ON CONFLICT DO NOTHING
      `;
    }

    for (const item of evidence) {
      await tx`
        INSERT INTO company_evidence (
          organization_id,
          company_id,
          source_type,
          source_url,
          source_label,
          title,
          excerpt,
          observed_at,
          confidence,
          verification_status,
          stale_after_days,
          content_hash,
          provider_record_id,
          raw_payload,
          source_family,
          source_quality,
          extraction_confidence,
          created_by
        )
        VALUES (
          ${organizationId},
          ${company.id},
          ${item.sourceType},
          ${item.sourceUrl},
          ${item.sourceLabel},
          ${item.title},
          ${item.excerpt},
          ${new Date(item.observedAt)},
          ${item.confidence},
          ${item.verificationStatus},
          180,
          ${evidenceHash(candidate, item)},
          ${item.providerRecordId},
          ${JSON.stringify(item.rawPayload)}::text::jsonb,
          ${item.sourceFamily},
          ${item.confidence},
          0.95,
          ${userId}
        )
        ON CONFLICT (company_id, content_hash) WHERE content_hash IS NOT NULL
        DO NOTHING
      `;
    }
  });

  return { companyId, duplicate: false };
}
