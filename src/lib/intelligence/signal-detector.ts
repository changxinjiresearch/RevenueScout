import type {
  ConfidenceLabel,
  SignalType,
} from "../domain/types";
import type {
  CollectedPage,
} from "./types";
import type {
  WebResearchObservation,
} from "../enrichment/result-types";
import { registrableFamily } from "./source-evaluation";

type SignalRule = {
  type: SignalType;
  label: string;
  patterns: RegExp[];
  strength: number;
  confidence: number;
  rationale: string;
};

const RULES: SignalRule[] = [
  {
    type: "HIRING",
    label: "Active hiring",
    patterns: [
      /\bwe(?:'re| are) hiring\b/i,
      /\bjoin our team\b/i,
      /\bcurrent vacancies\b/i,
      /\bopen positions?\b/i,
      /\bjobs? available\b/i,
      /\bapply now\b/i,
    ],
    strength: 72,
    confidence: 0.84,
    rationale:
      "Current careers language indicates active hiring and possible operating change.",
  },
  {
    type: "EXPANSION",
    label: "Expansion activity",
    patterns: [
      /\bnew (?:site|facility|branch|depot|office|warehouse|distribution centre|distribution center)\b/i,
      /\bopened (?:a|our|its) new\b/i,
      /\bexpanding (?:into|across|our|the)\b/i,
      /\bnew location\b/i,
      /\bsecond (?:site|facility|branch|depot|office|warehouse)\b/i,
    ],
    strength: 82,
    confidence: 0.82,
    rationale:
      "Expansion can create near-term coordination, systems and process requirements.",
  },
  {
    type: "FUNDING",
    label: "Funding / investment",
    patterns: [
      /\braised\s+\$?[0-9][0-9,.]*\s*(?:m|million|b|billion)?\b/i,
      /\bfunding round\b/i,
      /\bcapital raise\b/i,
      /\bnew investment\b/i,
      /\bsecured investment\b/i,
    ],
    strength: 86,
    confidence: 0.88,
    rationale:
      "Fresh capital can increase budget availability and execution urgency.",
  },
  {
    type: "LEADERSHIP",
    label: "Leadership change",
    patterns: [
      /\bappointed\b.{0,90}\b(?:chief|ceo|coo|cio|cto|managing director|general manager)\b/i,
      /\bnew (?:ceo|coo|cio|cto|chief|managing director|general manager)\b/i,
      /\bjoins? as (?:chief|ceo|coo|cio|cto|managing director|general manager)\b/i,
    ],
    strength: 68,
    confidence: 0.84,
    rationale:
      "A leadership change can create a review window for processes, vendors and systems.",
  },
  {
    type: "TECHNOLOGY",
    label: "Technology change",
    patterns: [
      /\bdigital transformation\b/i,
      /\bimplement(?:ing|ed)?\b.{0,80}\b(?:erp|crm|sap|salesforce|oracle|dynamics 365|automation)\b/i,
      /\bmigrat(?:e|ing|ed)\b.{0,80}\b(?:cloud|system|platform|erp|crm)\b/i,
      /\bnew (?:erp|crm|technology platform|digital platform)\b/i,
      /\bautomation program\b/i,
    ],
    strength: 75,
    confidence: 0.8,
    rationale:
      "Technology change may create integration, migration or workflow-automation needs.",
  },
  {
    type: "PROCUREMENT",
    label: "Procurement activity",
    patterns: [
      /\brequest for proposal\b/i,
      /\brfp\b/i,
      /\binvitation to tender\b/i,
      /\bexpression of interest\b/i,
      /\bprocurement opportunity\b/i,
      /\btender notice\b/i,
    ],
    strength: 94,
    confidence: 0.92,
    rationale:
      "Public procurement language indicates an active or near-term buying process.",
  },
  {
    type: "GROWTH",
    label: "Growth signal",
    patterns: [
      /\brecord revenue\b/i,
      /\brevenue (?:grew|growth|increased)\b/i,
      /\bgrew by\s+[0-9]{1,3}%\b/i,
      /\bgrowth of\s+[0-9]{1,3}%\b/i,
      /\brapid growth\b/i,
      /\bstrong growth\b/i,
    ],
    strength: 70,
    confidence: 0.76,
    rationale:
      "Growth can increase process strain and raise the value of scalable operating systems.",
  },
  {
    type: "OPERATIONAL_PAIN",
    label: "Potential operational pain",
    patterns: [
      /\bmanual process(?:es)?\b/i,
      /\binefficien(?:t|cy|cies)\b/i,
      /\bbottleneck(?:s)?\b/i,
      /\boperational challenge(?:s)?\b/i,
      /\bprocess delays?\b/i,
      /\bstaff shortage(?:s)?\b/i,
    ],
    strength: 58,
    confidence: 0.62,
    rationale:
      "The page contains language consistent with potential operational pain; this remains a hypothesis until validated.",
  },
];

function sentenceCandidates(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 20 && value.length <= 500);
}

function dateFromText(value: string): string | null {
  const iso = /\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/.exec(
    value,
  );
  if (iso) {
    const date = new Date(
      `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(
        iso[3],
      ).padStart(2, "0")}T00:00:00Z`,
    );
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  const named =
    /\b(0?[1-9]|[12]\d|3[01])\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i.exec(
      value,
    );
  if (named) {
    const date = new Date(`${named[1]} ${named[2]} ${named[3]} UTC`);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  return null;
}

function sourceTypeForPage(
  page: CollectedPage,
  officialWebsite?: string,
): string {
  if (page.pageKind === "CAREERS") return "JOB_BOARD";
  if (page.pageKind === "NEWS") return "NEWS";

  if (
    officialWebsite &&
    registrableFamily(page.url) !== registrableFamily(officialWebsite)
  ) {
    return "OTHER";
  }

  return "COMPANY_WEBSITE";
}

function verificationForPage(
  page: CollectedPage,
  hasExplicitDate: boolean,
): ConfidenceLabel {
  if (page.pageKind === "CAREERS") return "LIKELY";
  if (hasExplicitDate) return "LIKELY";
  return "UNVERIFIED";
}

export function detectBuyingSignals(
  pages: CollectedPage[],
  now = new Date(),
  officialWebsite?: string,
): WebResearchObservation[] {
  const observations: WebResearchObservation[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    const sentences = sentenceCandidates(
      `${page.title}. ${page.description}. ${page.text}`,
    );

    for (const sentence of sentences) {
      for (const rule of RULES) {
        if (!rule.patterns.some((pattern) => pattern.test(sentence))) {
          continue;
        }

        const key = `${rule.type}|${page.url}|${sentence.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const explicitDate =
          dateFromText(sentence) ??
          dateFromText(page.title) ??
          dateFromText(page.url);
        const observedAt = explicitDate ?? page.fetchedAt ?? now.toISOString();
        const dated = Boolean(explicitDate);

        let confidence = rule.confidence;
        let strength = rule.strength;

        if (page.pageKind === "CAREERS" && rule.type === "HIRING") {
          confidence = Math.max(confidence, 0.88);
          strength = Math.max(strength, 78);
        }

        if (!dated && page.pageKind === "NEWS") {
          confidence = Math.min(confidence, 0.68);
          strength = Math.min(strength, 68);
        }

        observations.push({
          sourceType: sourceTypeForPage(page, officialWebsite),
          sourceTitle: page.title || new URL(page.url).hostname,
          sourceUrl: page.url,
          title: rule.label,
          observation: sentence.slice(0, 500),
          observedAt,
          confidence,
          verificationStatus: verificationForPage(page, dated),
          signalType: rule.type,
          signalStrength: strength,
          signalRationale: rule.rationale,
        });
      }
    }
  }

  return observations
    .sort(
      (a, b) =>
        b.signalStrength * b.confidence -
        a.signalStrength * a.confidence,
    )
    .slice(0, 12);
}
