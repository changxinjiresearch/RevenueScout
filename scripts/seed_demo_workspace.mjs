import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const sql = postgres(databaseUrl, {
  max: 1,
  ssl: databaseUrl.includes("railway.internal") ? false : "require",
});

const candidates = await sql`
  SELECT o.id, o.name
  FROM organizations o
  WHERE o.created_at > NOW() - INTERVAL '6 hours'
    AND o.onboarding_completed_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM offerings f WHERE f.organization_id = o.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM icps i WHERE i.organization_id = o.id
    )
    AND EXISTS (
      SELECT 1
      FROM memberships m
      WHERE m.organization_id = o.id
        AND m.role = 'OWNER'
    )
  ORDER BY o.created_at DESC
`;

if (candidates.length !== 1) {
  await sql.end();
  throw new Error(
    `Guard refused seed: expected exactly 1 recent empty workspace, found ${candidates.length}.`,
  );
}

const organizationId = candidates[0].id;

await sql.begin(async (tx) => {
  await tx`
    UPDATE organizations
    SET
      name = 'Northlight Automation Pty Ltd',
      website = 'https://northlightautomation.example',
      country = 'Australia',
      service_regions = ARRAY['Australia'],
      industry = 'Business Software & Automation',
      company_size = '10–50 employees',
      description = 'Fictional B2B automation company used to test RevenueScout. Northlight Automation helps Australian SMEs reduce manual operational work through workflow automation, system integration and targeted AI-assisted process improvements.',
      updated_at = NOW()
    WHERE id = ${organizationId}
  `;

  const [offering] = await tx`
    INSERT INTO offerings (
      organization_id,
      name,
      description,
      primary_problems,
      typical_customers,
      min_contract_value,
      avg_contract_value,
      ideal_contract_value,
      sales_cycle_days,
      unsuitable_customers
    )
    VALUES (
      ${organizationId},
      'Operations Workflow Automation',
      'Design and implementation of workflow automation, system integration and operational dashboards for growing B2B companies.',
      'Manual scheduling, duplicated data entry, disconnected systems, multi-site coordination friction and repetitive back-office work.',
      'Australian B2B logistics, freight, warehousing and distribution companies with 20–250 employees that are growing, hiring or operating across multiple locations.',
      12000,
      30000,
      60000,
      45,
      'Microbusinesses under 10 employees, government agencies, nonprofits and organisations with no clear operational owner.'
    )
    RETURNING id
  `;

  const [icp] = await tx`
    INSERT INTO icps (
      organization_id,
      name,
      countries,
      states,
      cities,
      industries,
      subindustries,
      employee_min,
      employee_max,
      company_age_min,
      company_age_max,
      company_types,
      service_regions,
      fast_growth,
      multi_location,
      hiring,
      recent_funding,
      required_roles,
      business_models,
      technologies,
      digital_need,
      exclusions,
      excluded_industries,
      exclude_government,
      exclude_nonprofit,
      exclude_existing_customer,
      exclude_rejected,
      exclude_unsubscribed,
      employee_exclude_below,
      employee_exclude_above
    )
    VALUES (
      ${organizationId},
      'Australian Growth Logistics SME',
      ARRAY['Australia'],
      ARRAY['NSW','VIC','QLD','SA'],
      ARRAY[]::TEXT[],
      ARRAY['Logistics'],
      ARRAY['Freight','Warehousing','Distribution'],
      20,
      250,
      2,
      30,
      ARRAY['Private'],
      ARRAY['Australia','NSW','VIC','QLD','SA'],
      TRUE,
      TRUE,
      TRUE,
      FALSE,
      ARRAY['COO','Head of Operations','Operations Director'],
      ARRAY['B2B','multi-site'],
      ARRAY['Xero'],
      TRUE,
      'Avoid organisations with no identifiable operations owner or no realistic automation budget.',
      ARRAY['Government'],
      TRUE,
      TRUE,
      TRUE,
      TRUE,
      TRUE,
      10,
      1000
    )
    RETURNING id
  `;

  await tx`
    INSERT INTO offering_icps (offering_id, icp_id)
    VALUES (${offering.id}, ${icp.id})
  `;

  await tx`
    UPDATE organizations
    SET
      onboarding_completed_at = NOW(),
      config_version = config_version + 1,
      updated_at = NOW()
    WHERE id = ${organizationId}
  `;
});

console.log(
  `Seeded Northlight Automation Pty Ltd into workspace ${organizationId}.`,
);

await sql.end();
