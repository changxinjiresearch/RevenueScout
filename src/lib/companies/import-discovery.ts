import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import {
  findCompanyDuplicate,
  normaliseCompanyName,
  normaliseDomain,
} from "./dedupe";
import type { DiscoveryCandidate } from "@/lib/discovery/types";

function evidenceHash(candidate: DiscoveryCandidate): string {
  return createHash("sha256")
    .update(
      [
        candidate.provider,
        candidate.providerRecordId,
        candidate.sourceUrl,
        candidate.observedAt,
      ].join("|"),
    )
    .digest("hex");
}

export async function importDiscoveryCandidate(input: {
  organizationId: string;
  userId: string;
  candidate: DiscoveryCandidate;
}): Promise<{ companyId: string; duplicate: boolean; duplicateReason?: string }> {
  const { organizationId, userId, candidate } = input;
  const domain = normaliseDomain(candidate.domain ?? candidate.website);

  const duplicate = await findCompanyDuplicate({
    organizationId,
    displayName: candidate.displayName,
    country: candidate.country,
    domain,
    identifierType:
      candidate.provider === "GLEIF" ? "LEI" : candidate.provider,
    identifierValue: candidate.providerRecordId,
  });

  const sql = db();

  if (duplicate) {
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
        created_by
      )
      VALUES (
        ${organizationId},
        ${duplicate.id},
        ${candidate.provider},
        ${candidate.sourceUrl},
        ${candidate.sourceLabel},
        ${candidate.legalName},
        ${candidate.description ?? "External legal-entity record."},
        ${new Date(candidate.observedAt)},
        ${candidate.sourceConfidence},
        ${candidate.verificationStatus},
        180,
        ${evidenceHash(candidate)},
        ${candidate.providerRecordId},
        ${JSON.stringify(candidate)}::jsonb,
        ${userId}
      )
      ON CONFLICT (company_id, content_hash) WHERE content_hash IS NOT NULL
      DO NOTHING
    `;

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
        ${candidate.serviceRegions},
        ${candidate.entityType},
        'DISCOVERY',
        ${userId}
      )
      RETURNING id
    `;

    companyId = company.id;

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
        ${candidate.provider === "GLEIF" ? "LEI" : candidate.provider},
        ${candidate.providerRecordId},
        ${candidate.provider}
      )
      ON CONFLICT DO NOTHING
    `;

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
        created_by
      )
      VALUES (
        ${organizationId},
        ${company.id},
        ${candidate.provider},
        ${candidate.sourceUrl},
        ${candidate.sourceLabel},
        ${candidate.legalName},
        ${candidate.description ?? "External legal-entity record."},
        ${new Date(candidate.observedAt)},
        ${candidate.sourceConfidence},
        ${candidate.verificationStatus},
        180,
        ${evidenceHash(candidate)},
        ${candidate.providerRecordId},
        ${JSON.stringify(candidate)}::jsonb,
        ${userId}
      )
    `;
  });

  return { companyId, duplicate: false };
}
