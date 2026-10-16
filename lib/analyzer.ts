import type {
  AnalyzeIssueInput,
  AnalyzeIssueOutput,
  SeasonalModeId,
  Severity
} from "@/types/civic";
import { detectModeFromText } from "@/lib/modes";
import { suggestDepartments } from "@/lib/departments";

type AnalysisProfile = {
  category: string;
  subcategories: string[];
  riskFlags: string[];
  severity: Severity;
  citizenSafeActions: string[];
  volunteerActions: string[];
  publicSafetyWarning?: string;
  followUpQuestion?: string;
};

export function analyzeIssue(input: AnalyzeIssueInput): AnalyzeIssueOutput {
  const reportText = [input.text, input.imageDescription, input.weatherHint]
    .filter(Boolean)
    .join(" ");
  const date = input.date ? new Date(input.date) : new Date();
  const mode = detectModeFromText(reportText, date, input.userSelectedMode);
  const profile = buildProfile(mode, reportText, input.approximateLocation);
  const departmentSuggestions = suggestDepartments(mode, profile.category, profile.riskFlags);
  const location = input.approximateLocation?.trim() || "the reported Kolkata location";
  const cleanSummary = createCleanSummary(mode, reportText, location, profile);

  return {
    mode,
    category: profile.category,
    subcategories: profile.subcategories,
    severity: profile.severity,
    riskFlags: profile.riskFlags,
    followUpQuestion: profile.followUpQuestion,
    departmentSuggestions,
    cleanSummary,
    officialEnglishComplaint: createOfficialComplaint(
      location,
      cleanSummary,
      profile,
      departmentSuggestions
    ),
    bengaliShareText: createBengaliShareText(location, cleanSummary, profile),
    hindiShareText: createHindiShareText(location, cleanSummary, profile),
    publicSafetyWarning: profile.publicSafetyWarning,
    volunteerActions: profile.volunteerActions,
    citizenSafeActions: profile.citizenSafeActions
  };
}

function buildProfile(
  mode: SeasonalModeId,
  reportText: string,
  approximateLocation?: string
): AnalysisProfile {
  const text = reportText.toLowerCase();
  const hasWater = hasAny(text, ["water", "flood", "rain", "waterlogging", "stagnant"]);
  const hasWire = hasAny(text, ["wire", "pole", "sparking", "electric", "light"]);
  const hasDrain = hasAny(text, ["drain", "gully", "plastic"]);
  const hasDengue = hasAny(text, ["dengue", "mosquito", "stagnant", "bamboo", "container"]);
  const hasManhole = hasAny(text, ["manhole", "pothole", "open drain"]);

  if (mode === "monsoon_flood_dengue") {
    const flags = compact([
      hasWater && "waterlogging",
      hasDrain && "blocked drain",
      hasAny(text, ["plastic", "garbage"]) && "plastic waste",
      hasWire && "electrical danger",
      hasDengue && "dengue risk",
      hasManhole && "fall risk"
    ]);
    const critical = hasWater && hasWire;

    return {
      category: "Waterlogging and drainage hazard",
      subcategories: compact([
        hasWater && "waterlogging",
        hasDrain && "blocked drain",
        hasWire && "electrical hazard",
        hasDengue && "dengue source",
        hasManhole && "hidden road hazard"
      ]),
      severity: critical ? "critical" : hasWater && (hasDrain || hasDengue) ? "high" : "medium",
      riskFlags: flags.length ? flags : ["monsoon escalation"],
      publicSafetyWarning: critical
        ? "Avoid the waterlogged stretch until electricity and drainage risks are checked."
        : "Use caution near the reported waterlogged area and avoid stepping into unclear water.",
      citizenSafeActions: [
        "Avoid contact with standing water near poles, wires, or open drains.",
        "Share a clear landmark and water depth if safe to observe.",
        "Keep children and elderly residents away from the flooded stretch."
      ],
      volunteerActions: [
        "Mark the risky edge of the drain or road with visible caution tape.",
        "Confirm if the same lane has repeated waterlogging this week.",
        "Escalate electrical-water combinations immediately before drain clearing."
      ]
    };
  }

  if (mode === "pujo_safety") {
    const flags = compact([
      hasAny(text, ["narrow", "exit", "crowd", "barricade"]) && "crowd bottleneck",
      hasWire && "temporary electrical hazard",
      hasAny(text, ["bamboo", "water", "stagnant"]) && "dengue risk",
      hasAny(text, ["fire", "stall", "cooking"]) && "fire safety gap",
      hasAny(text, ["traffic", "ambulance", "route"]) && "route obstruction"
    ]);

    return {
      category: "Pujo temporary-city safety",
      subcategories: compact([
        flags.includes("crowd bottleneck") && "crowd route",
        flags.includes("temporary electrical hazard") && "temporary wiring",
        flags.includes("dengue risk") && "stagnant water",
        flags.includes("route obstruction") && "traffic and access"
      ]),
      severity: flags.includes("temporary electrical hazard") && flags.includes("crowd bottleneck")
        ? "critical"
        : flags.length >= 2
          ? "high"
          : "medium",
      riskFlags: flags.length ? flags : ["festival infrastructure risk"],
      publicSafetyWarning: "Use an alternate route if this lane is crowded, wet, or has exposed wiring.",
      citizenSafeActions: [
        "Do not touch barricades, bamboo, or wiring in wet areas.",
        "Use wider exits and avoid stopping near the bottleneck.",
        "Share the warning with local volunteers if crowds are building."
      ],
      volunteerActions: [
        "Create a one-way crowd channel or widen the exit if possible.",
        "Keep people away from exposed wires; only qualified electrical workers should handle them.",
        "Empty rainwater collected in bamboo, tarpaulin, or temporary containers."
      ]
    };
  }

  if (mode === "post_pujo_cleanup") {
    return {
      category: "Post-Pujo waste and restoration",
      subcategories: ["pandal waste", "drain obstruction", "footpath access"],
      severity: hasDrain || hasWater ? "high" : "medium",
      riskFlags: compact([
        "cleanup overdue",
        hasDrain && "drain obstruction",
        hasWater && "stagnant water",
        "pedestrian obstruction"
      ]),
      publicSafetyWarning: "Avoid walking through blocked footpath sections or water around leftover materials.",
      citizenSafeActions: [
        "Photograph the remaining materials with a nearby landmark.",
        "Avoid moving heavy bamboo or sharp flex frames without help.",
        "Confirm whether the drain mouth is blocked."
      ],
      volunteerActions: [
        "Separate bamboo, flex, plastic, and thermocol for cleanup.",
        "Clear drain mouths before the next rain.",
        "Record before and after photos for the para archive."
      ]
    };
  }

  if (mode === "summer_heat_water") {
    const hasVulnerable = hasAny(text, [
      "elderly",
      "children",
      "school",
      "patients",
      "vendors",
      "workers",
      "queue"
    ]);

    return {
      category: "Heat and water stress",
      subcategories: compact([
        hasAny(text, ["tap", "tanker", "no water", "low pressure"]) && "water shortage",
        hasAny(text, ["heat", "shade", "queue"]) && "heat exposure",
        hasVulnerable && "vulnerable people affected"
      ]),
      severity: hasVulnerable ? "high" : "medium",
      riskFlags: compact(["water shortage", hasVulnerable && "vulnerable people affected", "heat stress"]),
      followUpQuestion: hasVulnerable
        ? undefined
        : "Are elderly people, children, outdoor workers, or patients affected?",
      publicSafetyWarning: "Carry water and avoid long waits in exposed heat until a water point is restored.",
      citizenSafeActions: [
        "Share the duration of the water shortage and number of affected households.",
        "Note if a public tap, school, clinic, or market queue is affected.",
        "Avoid crowding in direct sun while waiting for water."
      ],
      volunteerActions: [
        "Confirm whether a tanker or temporary water point is needed.",
        "Prioritize elderly residents, children, patients, vendors, and outdoor workers.",
        "Track repeated low-pressure reports by lane and ward."
      ]
    };
  }

  if (mode === "winter_air_dust") {
    const burning = hasAny(text, ["burning", "smoke", "fire"]);

    return {
      category: "Winter air and dust hazard",
      subcategories: compact([
        burning && "open burning",
        hasAny(text, ["dust", "road"]) && "road dust",
        hasAny(text, ["construction", "debris"]) && "construction debris",
        hasAny(text, ["light", "fog", "visibility"]) && "visibility hazard"
      ]),
      severity: burning ? "high" : "medium",
      riskFlags: compact([
        burning && "open burning",
        "air quality risk",
        hasAny(text, ["dust", "debris"]) && "respiratory risk",
        hasAny(text, ["fog", "light"]) && "visibility hazard"
      ]),
      publicSafetyWarning: "Avoid lingering near smoke or heavy dust, especially for children and elderly residents.",
      citizenSafeActions: [
        "Record whether waste is actively burning or smouldering.",
        "Note if the dust comes from road damage or uncovered construction debris.",
        "Avoid the smoke plume and keep windows closed nearby if needed."
      ],
      volunteerActions: [
        "Request immediate stop to open burning and safe waste pickup.",
        "Mark dusty road damage that needs repair or water sprinkling.",
        "Check if poor lighting is worsening visibility."
      ]
    };
  }

  if (mode === "wetlands_watch") {
    return {
      category: "East Kolkata Wetlands evidence",
      subcategories: compact([
        hasAny(text, ["dump", "debris"]) && "illegal dumping",
        hasAny(text, ["filling", "construction", "shed", "godown"]) && "filling or encroachment",
        hasAny(text, ["canal", "water channel"]) && "water-channel blockage",
        hasAny(text, ["smoke", "fire"]) && "fire or smoke"
      ]),
      severity: "high",
      riskFlags: compact([
        "ecological risk",
        hasAny(text, ["dump", "debris"]) && "dumping",
        hasAny(text, ["canal", "water channel"]) && "water-channel blockage",
        "timeline evidence needed"
      ]),
      followUpQuestion: approximateLocation ? undefined : "Can you add a bheri, canal, or road landmark?",
      publicSafetyWarning: "Treat this as environmental evidence and avoid confronting dumpers directly.",
      citizenSafeActions: [
        "Capture a safe landmark, vehicle detail, or canal edge if visible.",
        "Do not confront trucks or workers directly.",
        "Add time and direction of movement for timeline evidence."
      ],
      volunteerActions: [
        "Group repeat reports by bheri, canal, and access road.",
        "Save before and after photos for an evidence timeline.",
        "Escalate dumping, filling, or channel blockage as environmental evidence."
      ]
    };
  }

  if (mode === "pre_monsoon_storm_prep") {
    return {
      category: "Pre-monsoon preventable hazard",
      subcategories: compact([
        hasWire && "loose wire",
        hasAny(text, ["tree", "branch"]) && "weak branch or tree",
        hasAny(text, ["hoarding", "sign"]) && "unstable hoarding",
        hasDrain && "drain desilting need"
      ]),
      severity: hasWire || hasDrain ? "high" : "medium",
      riskFlags: compact([
        hasWire && "low wire",
        hasDrain && "drain choke",
        "rain escalation",
        hasAny(text, ["tree", "hoarding", "branch"]) && "wind hazard"
      ]),
      publicSafetyWarning: "Avoid standing below loose wires, branches, or hoardings during wind or rain.",
      citizenSafeActions: [
        "Share whether the hazard crosses a school route, market lane, or bus stop.",
        "Do not pull wires or branches yourself.",
        "Add a photo before the next rain if safe."
      ],
      volunteerActions: [
        "Mark hazards that must be handled before the next rain.",
        "Escalate low wires and blocked drain mouths together.",
        "Check if nearby storm routes have similar preventable risks."
      ]
    };
  }

  return {
    category: "Everyday para civic issue",
    subcategories: compact([
      hasAny(text, ["garbage", "dumping"]) && "garbage",
      hasAny(text, ["streetlight", "light"]) && "streetlighting",
      hasAny(text, ["pothole", "road"]) && "road repair",
      hasAny(text, ["manhole", "drain"]) && "drainage",
      hasAny(text, ["tap", "leak"]) && "water supply"
    ]),
    severity: hasAny(text, ["open manhole", "sparking", "unsafe wire"]) ? "high" : "medium",
    riskFlags: compact([
      hasAny(text, ["open manhole", "unsafe", "sparking"]) && "public safety risk",
      "recurrence check needed"
    ]),
    publicSafetyWarning: undefined,
    citizenSafeActions: [
      "Add a landmark and photo if available.",
      "Confirm whether the issue is still unresolved after 24 hours.",
      "Avoid direct contact with unsafe wires, open drains, or broken surfaces."
    ],
    volunteerActions: [
      "Check for duplicate reports from the same lane.",
      "Confirm the responsible department before escalation.",
      "Capture fixed proof once repair or cleanup is complete."
    ]
  };
}

function createCleanSummary(
  mode: SeasonalModeId,
  reportText: string,
  location: string,
  profile: AnalysisProfile
) {
  const firstSentence = reportText.trim().split(/[.!?]/).find(Boolean)?.trim();
  const readableInput = firstSentence || "A civic issue has been reported";
  const modePhrase = mode.replaceAll("_", " ");

  return `${readableInput} at ${location}. ParaReport classified it as ${profile.category.toLowerCase()} for ${modePhrase}.`;
}

function createOfficialComplaint(
  location: string,
  cleanSummary: string,
  profile: AnalysisProfile,
  departments: string[]
) {
  return [
    `To the concerned department: ${departments.join(", ")}.`,
    `A citizen report from ${location} indicates the following issue: ${cleanSummary}`,
    `Risk flags: ${profile.riskFlags.join(", ") || "recurrence check needed"}.`,
    `Requested action: inspect the location, address the immediate safety risk, and update local residents once action is taken. This packet is generated as civic evidence and does not claim official submission status.`
  ].join(" ");
}

function createBengaliShareText(location: string, cleanSummary: string, profile: AnalysisProfile) {
  return `পাড়া সতর্কতা: ${location}-এ ${profile.category} রিপোর্ট হয়েছে। ${cleanSummary} ঝুঁকি: ${profile.riskFlags.join(", ")}। নিরাপদ থাকুন এবং প্রয়োজনে বিকল্প রাস্তা ব্যবহার করুন।`;
}

function createHindiShareText(location: string, cleanSummary: string, profile: AnalysisProfile) {
  return `मोहल्ला सूचना: ${location} में ${profile.category} रिपोर्ट हुआ है। ${cleanSummary} जोखिम: ${profile.riskFlags.join(", ")}। सुरक्षित रहें और जरूरत हो तो दूसरा रास्ता लें।`;
}

function compact(values: Array<string | false | undefined>) {
  return values.filter(Boolean) as string[];
}

function hasAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}
