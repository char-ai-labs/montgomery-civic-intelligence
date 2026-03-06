import { NextResponse } from "next/server";
import OpenAI from "openai";

// ✅ Bright Data MCP (hosted)
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

// ✅ Force Node runtime (MCP SDK expects Node features)
export const runtime = "nodejs";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const FEATURE_SERVER =
  "https://mgmgis.montgomeryal.gov/arcgis/rest/services/HostedDatasets/Construction_Permits/FeatureServer";

type AnyObj = Record<string, any>;

function normalizeStr(v: any) {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  return String(v);
}

function safeToNumber(v: any): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseMaybeDateToMs(v: any): number | null {
  const n = safeToNumber(v);
  if (n !== null && n > 1000000000) {
    if (n < 100000000000) return n * 1000; // seconds -> ms
    return n; // ms
  }
  if (typeof v === "string") {
    const d = new Date(v);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

function formatDateISO(ms: number) {
  return new Date(ms).toISOString().slice(0, 10);
}

async function fetchJson(url: string) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    // ignore
  }
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} for ${url}\nBody: ${text.slice(0, 700)}`);
  }
  return json ?? text;
}

function scoreFieldName(name: string, wanted: string[]) {
  const n = name.toLowerCase();
  let score = 0;
  for (const w of wanted) {
    if (n === w) score += 10;
    if (n.includes(w)) score += 3;
  }
  return score;
}

function chooseBestField(fieldNames: string[], wanted: string[]) {
  let best: string | null = null;
  let bestScore = 0;
  for (const f of fieldNames) {
    const s = scoreFieldName(f, wanted);
    if (s > bestScore) {
      bestScore = s;
      best = f;
    }
  }
  return best;
}

async function getLayerInfo(layer = 0) {
  return fetchJson(`${FEATURE_SERVER}/${layer}?f=pjson`);
}

async function queryLayer(layer = 0, limit = 800, orderBy?: string | null) {
  const url = `${FEATURE_SERVER}/${layer}/query`;
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "*",
    returnGeometry: "false",
    f: "json",
    resultRecordCount: String(limit),
  });
  if (orderBy) params.set("orderByFields", `${orderBy} DESC`);
  return fetchJson(`${url}?${params.toString()}`);
}

function isResidentialLikely(record: AnyObj, typeField?: string | null, descField?: string | null) {
  const t = typeField ? normalizeStr(record[typeField]).toLowerCase() : "";
  const d = descField ? normalizeStr(record[descField]).toLowerCase() : "";
  const hay = `${t} ${d}`;

  const needles = [
    "residential",
    "single family",
    "single-family",
    "sfr",
    "duplex",
    "triplex",
    "quadplex",
    "multi family",
    "multifamily",
    "apartment",
    "townhome",
    "townhouse",
    "condo",
    "dwelling",
    "home",
    "house",
    "unit",
    "addition",
    "remodel",
    "renovation",
    "rehab",
  ];

  return needles.some((k) => hay.includes(k));
}

function isCommercialLikely(record: AnyObj, typeField?: string | null, descField?: string | null) {
  const t = typeField ? normalizeStr(record[typeField]).toLowerCase() : "";
  const d = descField ? normalizeStr(record[descField]).toLowerCase() : "";
  const hay = `${t} ${d}`;

  const needles = [
    "commercial",
    "retail",
    "restaurant",
    "office",
    "industrial",
    "warehouse",
    "store",
    "tenant finish",
    "tenant improvement",
    "ti ",
    "medical",
    "clinic",
    "bank",
    "hotel",
    "motel",
    "shell",
  ];

  return needles.some((k) => hay.includes(k));
}

function extractStreetKey(address: string) {
  const a = address.trim().replace(/\s+/g, " ");
  if (!a) return "";
  const parts = a.split(" ");
  const start = /^\d+$/.test(parts[0]) ? 1 : 0;
  return parts.slice(start, Math.min(parts.length, start + 4)).join(" ").toUpperCase();
}

function topCounts(items: string[], topN = 7) {
  const m = new Map<string, number>();
  for (const it of items) {
    const k = it.trim();
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([key, count]) => ({ key, count }));
}

function computeNewVsRepairs(typeCounts: Record<string, number>) {
  let total = 0;
  let newCount = 0;
  let repairCount = 0;

  const isNew = (k: string) => /\bnew\b|new\s*construction|new\s*build|new\s*bldg|ground\s*up/i.test(k);
  const isRepair = (k: string) =>
    /repair|alter|addition|existing|remodel|renov|rehab|replace|tenant\s*improvement|ti\b/i.test(k);

  for (const [kRaw, vRaw] of Object.entries(typeCounts)) {
    const v = Number(vRaw) || 0;
    if (v <= 0) continue;
    const k = (kRaw || "").toLowerCase();

    total += v;
    if (isNew(k)) newCount += v;
    else if (isRepair(k)) repairCount += v;
  }

  const denom = Math.max(total, 1);
  const percentNew = Math.round((newCount / denom) * 100);

  return { total, newCount, repairCount, percentNew };
}

function summarizePermits(
  attrsList: AnyObj[],
  fields: { date?: string | null; type?: string | null; desc?: string | null; status?: string | null; address?: string | null },
  sinceMs: number | null
) {
  const dateField = fields.date ?? null;
  const typeField = fields.type ?? fields.desc ?? null;

  // Date parse reliability check
  let parsed = 0;
  let totalWithDate = 0;
  if (dateField) {
    for (const a of attrsList.slice(0, 200)) {
      const raw = a[dateField];
      if (raw === null || raw === undefined || raw === "") continue;
      totalWithDate++;
      if (parseMaybeDateToMs(raw) !== null) parsed++;
    }
  }
  const parseRate = totalWithDate > 0 ? parsed / totalWithDate : 0;
  const dateFilterReliable = Boolean(dateField) && totalWithDate >= 10 && parseRate >= 0.6;

  // Apply window only if reliable
  const windowed =
    sinceMs && dateFilterReliable && dateField
      ? attrsList.filter((a) => {
          const ms = parseMaybeDateToMs(a[dateField!]);
          return ms !== null && ms >= sinceMs;
        })
      : attrsList;

  // Type counts (full record for KPI math)
  const typeCountsMap = new Map<string, number>();
  for (const a of windowed) {
    const t = typeField ? normalizeStr(a[typeField]).trim() : "";
    const key = t || "(unknown type)";
    typeCountsMap.set(key, (typeCountsMap.get(key) ?? 0) + 1);
  }

  const typeCounts: Record<string, number> = {};
  for (const [k, v] of typeCountsMap.entries()) typeCounts[k] = v;

  // Top types (for LLM)
  const topTypes = Array.from(typeCountsMap.entries())
    .sort((x, y) => y[1] - x[1])
    .slice(0, 8)
    .map(([type, count]) => ({ type, count }));

  // Top corridors
  const addrField = fields.address ?? null;
  const corridors = addrField
    ? windowed.map((a) => extractStreetKey(normalizeStr(a[addrField]))).filter(Boolean)
    : [];
  const topCorridors = topCounts(corridors, 7);

  // Sample records
  const sample = windowed.slice(0, 10).map((a) => {
    let dateOut = "";
    if (dateField) {
      const ms = parseMaybeDateToMs(a[dateField]);
      dateOut = ms ? formatDateISO(ms) : normalizeStr(a[dateField]);
    }
    return {
      date: dateOut,
      type: typeField ? normalizeStr(a[typeField]) : "",
      status: fields.status ? normalizeStr(a[fields.status]) : "",
      address: addrField ? normalizeStr(a[addrField]) : "",
    };
  });

  return {
    count: windowed.length,
    topTypes,
    topCorridors,
    sample,
    dateField,
    dateFilterReliable,
    dateParseRate: parseRate,
    dateSamplesChecked: totalWithDate,
    typeCounts,
  };
}

function inferVertical(question: string): "commercial" | "housing" | "general" {
  const q = question.toLowerCase();
  if (q.includes("commercial") || q.includes("business") || q.includes("retail") || q.includes("economic"))
    return "commercial";
  if (q.includes("housing") || q.includes("residential") || q.includes("home") || q.includes("apartment"))
    return "housing";
  return "general";
}

/** -----------------------------
 * Bright Data MCP (time-budgeted)
 * ------------------------------*/
type ExternalSignal = { title: string; url: string; source?: string };
type BdDiag = { ok: boolean; tool?: string; reason?: string };

function stripTrailingPunct(url: string) {
  return url.replace(/[),.;:!?]+$/g, "");
}

function tryParseJsonFromText(text: string): any | null {
  const t = text.trim();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function extractSearchResultsFromJson(json: any): any[] {
  if (!json || typeof json !== "object") return [];
  const candidates = [
    json.organic,
    json.organic_results,
    json.results,
    json.items,
    json.data?.organic,
    json.data?.results,
    json.data?.items,
  ].filter(Boolean);

  for (const cand of candidates) {
    if (Array.isArray(cand)) return cand;
  }
  return [];
}

function deepCollectResultItems(root: any): any[] {
  const out: any[] = [];
  const stack = [root];
  const seen = new Set<any>();

  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (seen.has(cur)) continue;
    seen.add(cur);

    const direct = extractSearchResultsFromJson(cur);
    if (direct.length) out.push(...direct);

    for (const k of Object.keys(cur)) {
      const v = (cur as any)[k];
      if (v && typeof v === "object") stack.push(v);
    }
  }
  return out;
}

function isPreferredOfficial(url: string) {
  return (
    /https?:\/\/(www\.)?montgomeryal\.gov/i.test(url) ||
    /https?:\/\/opendata\.montgomeryal\.gov/i.test(url) ||
    /https?:\/\/mgmgis\.montgomeryal\.gov/i.test(url)
  );
}

// ✅ IMPORTANT: subdomains FIRST so they don't get mislabeled as city pages
function categorizeSignal(
  url: string
): "Official meetings" | "Official city pages" | "Official open data" | "Official GIS" | "Other" {
  const u = url.toLowerCase();

  if (u.includes("opendata.montgomeryal.gov")) return "Official open data";
  if (u.includes("mgmgis.montgomeryal.gov") || u.includes("arcgis/rest")) return "Official GIS";

  if (
    u.includes("montgomeryal.gov") &&
    (u.includes("/calendar/") || u.includes("agenda") || u.includes("minutes") || u.includes("meeting"))
  ) {
    return "Official meetings";
  }

  if (u.includes("montgomeryal.gov")) return "Official city pages";

  return "Other";
}

function rankSignal(s: ExternalSignal): number {
  const cat = categorizeSignal(s.url);
  if (cat === "Official meetings") return 100;
  if (cat === "Official city pages") return 90;
  if (cat === "Official open data") return 80;
  if (cat === "Official GIS") return 70;
  return 10;
}

function toSignalFromAny(it: any): ExternalSignal | null {
  const url = stripTrailingPunct(normalizeStr(it?.url || it?.link || it?.href || "")).trim();
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const title = normalizeStr(it?.title || it?.name || it?.snippet || it?.description || "Public reference").trim();
  const source = normalizeStr(it?.source || it?.domain || it?.displayed_link || it?.display_link || "").trim();
  return { title, url, source };
}

function compactExcerpt(md: string, maxChars = 240) {
  const lines = md
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "#" && l !== "##" && l !== "###");

  const picked: string[] = [];
  for (const line of lines) {
    const low = line.toLowerCase();
    if (low.includes("skip to") || low.includes("cookie") || low.includes("javascript")) continue;
    if (line.length > 180 && (low.includes("departments") || low.includes("government") || low.includes("home"))) continue;

    picked.push(line.replace(/\s+/g, " "));
    if (picked.length >= 2) break;
    if (picked.join(" ").length >= maxChars) break;
  }

  const out = picked.join(" ");
  return out.length > maxChars ? out.slice(0, maxChars - 1) + "…" : out;
}

let printedBdToolsOnce = false;

async function fetchExternalSignalsBrightData(
  question: string
): Promise<{ items: ExternalSignal[]; excerpts: { url: string; excerpt: string }[]; diag: BdDiag }> {
  const token = process.env.BRIGHTDATA_MCP_TOKEN;
  if (!token) return { items: [], excerpts: [], diag: { ok: false, reason: "No BRIGHTDATA_MCP_TOKEN" } };

  const start = Date.now();
  const MAX_MS = 35000;
  const timeLeft = () => MAX_MS - (Date.now() - start);

  const client = new Client({ name: "montgomery-civic-intel", version: "1.0.0" });
  const sseUrl =
    process.env.BRIGHTDATA_MCP_SSE_URL ||
    `https://mcp.brightdata.com/sse?token=${encodeURIComponent(token)}&groups=advanced_scraping`;
  const transport = new SSEClientTransport(new URL(sseUrl));

  try {
    await client.connect(transport);

    if (!printedBdToolsOnce) {
      printedBdToolsOnce = true;
      const toolsRes: any = await client.listTools();
      const toolNames: string[] = Array.isArray(toolsRes?.tools)
        ? toolsRes.tools.map((t: any) => normalizeStr(t?.name)).filter(Boolean)
        : [];
      console.log("✅ Bright Data MCP tools:", toolNames);
    }

    // ✅ Meeting-heavy queries (more likely to land “Official meetings”)
    const qHint = question.slice(0, 70).replace(/\s+/g, " ").trim();
    const queryStrings = [
      `site:montgomeryal.gov agenda filetype:pdf ${qHint}`.trim(),
      `site:montgomeryal.gov minutes ${qHint}`.trim(),
      `site:montgomeryal.gov /calendar/ meeting ${qHint}`.trim(),
      `site:montgomeryal.gov "City Council" agenda ${qHint}`.trim(),
      `site:montgomeryal.gov "Planning Commission" agenda ${qHint}`.trim(),
      `site:opendata.montgomeryal.gov permits ${qHint}`.trim(),
      `mgmgis.montgomeryal.gov Construction_Permits FeatureServer`.trim(),
    ].slice(0, 6); // keep it quick

    console.log("✅ BD calling search_engine_batch with", queryStrings.length, "query objects");

    let rawItems: any[] = [];

    // Batch first
    try {
      const batchRes: any = await client.callTool({
        name: "search_engine_batch",
        arguments: {
          queries: queryStrings.map((q) => ({ query: q })),
          num_results: 6,
          country: "us",
          language: "en",
        },
      });

      const contentArr = Array.isArray(batchRes?.content) ? batchRes.content : [];
      const c0 = contentArr[0];
      const c0Text = typeof c0?.text === "string" ? c0.text : "";
      const jsonFromSlots = c0?.json ?? c0?.data ?? batchRes?.json ?? batchRes?.data ?? null;
      const jsonFromText = c0Text ? tryParseJsonFromText(c0Text) : null;
      const json = jsonFromSlots ?? jsonFromText;

      rawItems = deepCollectResultItems(json);
    } catch (e: any) {
      console.log("⚠️ BD batch call failed, falling back to search_engine. Reason:", e?.message ?? String(e));
    }

    // Fallback: single if batch empty and time remains
    if (!rawItems.length && timeLeft() > 9000) {
      for (const q of queryStrings) {
        if (timeLeft() < 6500) break;

        const singleRes: any = await client.callTool({
          name: "search_engine",
          arguments: { query: q, num_results: 8, country: "us", language: "en" },
        });

        const contentArr = Array.isArray(singleRes?.content) ? singleRes.content : [];
        const c0 = contentArr[0];
        const c0Text = typeof c0?.text === "string" ? c0.text : "";
        const json = c0Text ? tryParseJsonFromText(c0Text) : c0?.json ?? c0?.data ?? null;

        const items = extractSearchResultsFromJson(json);
        if (items.length) {
          rawItems = items;
          break;
        }
      }
    }

    // Normalize + de-dupe + keep official
    const dedup = new Map<string, ExternalSignal>();
    for (const it of rawItems) {
      const s = toSignalFromAny(it);
      if (!s) continue;
      if (!isPreferredOfficial(s.url)) continue;
      if (!dedup.has(s.url)) dedup.set(s.url, s);
    }

    let items = Array.from(dedup.values());
    items.sort((a, b) => rankSignal(b) - rankSignal(a));

    // De-noise: max 2 GIS links
    const out: ExternalSignal[] = [];
    let gisCount = 0;
    for (const it of items) {
      const cat = categorizeSignal(it.url);
      if (cat === "Official GIS") {
        if (gisCount >= 2) continue;
        gisCount++;
      }
      out.push(it);
      if (out.length >= 7) break;
    }
    items = out;

    // Scrape up to 2 montgomeryal.gov links if time allows
    const excerptTargets = items
      .filter((x) => /https?:\/\/(www\.)?montgomeryal\.gov/i.test(x.url))
      .slice(0, 2);

    const excerpts: { url: string; excerpt: string }[] = [];
    if (excerptTargets.length && timeLeft() > 7000) {
      for (const t of excerptTargets) {
        if (timeLeft() < 5000) break;
        try {
          const scrapeRes: any = await client.callTool({
            name: "scrape_as_markdown",
            arguments: { url: t.url },
          });

          const contentArr = Array.isArray(scrapeRes?.content) ? scrapeRes.content : [];
          const c0 = contentArr[0];
          const md = typeof c0?.text === "string" ? c0.text : "";

          if (md.trim()) {
            const excerpt = compactExcerpt(md, 260);
            if (excerpt) excerpts.push({ url: t.url, excerpt });
          }
        } catch {
          // best-effort
        }
      }
    }

    if (!items.length) {
      const spent = Date.now() - start;
      return {
        items: [],
        excerpts: [],
        diag: { ok: false, tool: "search_engine_batch/search_engine", reason: `No items extracted (spent ${spent}ms)` },
      };
    }

    return {
      items,
      excerpts,
      diag: { ok: true, tool: "search_engine_batch/search_engine (+scrape_as_markdown when time allows)" },
    };
  } catch (e: any) {
    return { items: [], excerpts: [], diag: { ok: false, reason: e?.message ?? "Bright Data MCP error" } };
  } finally {
    try {
      await client.close();
    } catch {
      // ignore
    }
  }
}

function buildBrightDataFooter(
  items: ExternalSignal[],
  excerpts: { url: string; excerpt: string }[],
  tokenPresent: boolean,
  pulledAtUtc: string,
  diag?: BdDiag
) {
  const header = `External verification sources (official city pages via Bright Data):`;

  if (!tokenPresent) {
    return `${header}\nPulled at (UTC): ${pulledAtUtc}\n- Bright Data token not detected on server (check BRIGHTDATA_MCP_TOKEN).\n`;
  }
  if (!items.length) {
    const reason = diag?.reason ? ` (${diag.reason})` : "";
    const tool = diag?.tool ? ` Tool: ${diag.tool}.` : "";
    return `${header}\nPulled at (UTC): ${pulledAtUtc}\n- No results returned${reason}.${tool}\n`;
  }

  const groups: Record<string, ExternalSignal[]> = {};
  for (const it of items) {
    const cat = categorizeSignal(it.url);
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(it);
  }

  const orderedCats = ["Official meetings", "Official city pages", "Official open data", "Official GIS", "Other"].filter(
    (c) => (groups[c] ?? []).length > 0
  );

  const excerptMap = new Map(excerpts.map((e) => [e.url, e.excerpt] as const));

  let out = `${header}\nPulled at (UTC): ${pulledAtUtc}\n`;
  for (const cat of orderedCats) {
    out += `\n${cat}:\n`;
    for (const it of groups[cat]) {
      out += `- ${it.title}\n  ${it.url}\n`;
      const ex = excerptMap.get(it.url);
      if (ex) out += `  Excerpt: ${ex}\n`;
    }
  }
  out += "\n";
  return out;
}

/** -----------------------------
 * Route handler
 * ------------------------------*/
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const question = String(body?.question ?? "").trim();
    if (!question) {
      return NextResponse.json({ answer: "No question provided." }, { status: 400 });
    }

    // ✅ Logs requested
    console.log("✅ /api/assistant HIT");
    console.log("✅ BD token present?", !!process.env.BRIGHTDATA_MCP_TOKEN);

    const tokenPresent = !!process.env.BRIGHTDATA_MCP_TOKEN;

    const pulledAtMs = Date.now();
    const pulledAtUtc = new Date(pulledAtMs).toISOString();
    const lookbackDays = 60;
    const sinceMs = pulledAtMs - lookbackDays * 24 * 60 * 60 * 1000;

    const vertical = inferVertical(question);

    // Bright Data enrichment (best-effort)
    const bd = tokenPresent
      ? await fetchExternalSignalsBrightData(question)
      : { items: [], excerpts: [], diag: { ok: false, reason: "No token" as string } };

    let liveDataBlock = "";
    let kpis = {
      residentialCount: 0,
      commercialCount: 0,
      percentNew: 0,
      newCount: 0,
      repairCount: 0,
      topCorridor: "—",
      dateFilterReliable: false,
      geo: "Medium" as const,
      lookbackDays,
      pulledAtUtc,
    };

    try {
      const layerInfo: any = await getLayerInfo(0);
      const fieldNames: string[] = Array.isArray(layerInfo?.fields)
        ? layerInfo.fields.map((f: any) => String(f?.name ?? "")).filter(Boolean)
        : [];

      const dateField = chooseBestField(fieldNames, [
        "issue",
        "issued",
        "issuedate",
        "issue_date",
        "applied",
        "application",
        "created",
        "date",
      ]);

      const typeField = chooseBestField(fieldNames, [
        "permit_type",
        "permittype",
        "type",
        "workclass",
        "work_class",
        "class",
        "category",
        "subtype",
      ]);

      const descField = chooseBestField(fieldNames, [
        "description",
        "work_description",
        "workdesc",
        "scope",
        "project",
        "job",
      ]);

      const statusField = chooseBestField(fieldNames, ["status", "permit_status", "current_status", "state"]);
      const addressField = chooseBestField(fieldNames, ["address", "site_address", "full_address", "street", "location"]);

      const data: any = await queryLayer(0, 800, dateField);
      const features: any[] = Array.isArray(data?.features) ? data.features : [];
      const attrsList: AnyObj[] = features.map((f) => f?.attributes).filter((a) => a && typeof a === "object");

      const filteredByCity = addressField
        ? attrsList.filter((a) => normalizeStr(a[addressField]).toLowerCase().includes("montgomery"))
        : attrsList;

      const residentialAll = filteredByCity.filter((a) => isResidentialLikely(a, typeField, descField));
      const commercialAll = filteredByCity.filter((a) => isCommercialLikely(a, typeField, descField));

      const residentialSummary = summarizePermits(
        residentialAll,
        { date: dateField, type: typeField, desc: descField, status: statusField, address: addressField },
        sinceMs
      );

      const commercialSummary = summarizePermits(
        commercialAll,
        { date: dateField, type: typeField, desc: descField, status: statusField, address: addressField },
        sinceMs
      );

      const nv = computeNewVsRepairs(residentialSummary.typeCounts);
      const topCorridor = residentialSummary.topCorridors?.[0]?.key ?? "—";

      kpis = {
        residentialCount: residentialSummary.count,
        commercialCount: commercialSummary.count,
        percentNew: nv.percentNew,
        newCount: nv.newCount,
        repairCount: nv.repairCount,
        topCorridor,
        dateFilterReliable: residentialSummary.dateFilterReliable,
        geo: "Medium",
        lookbackDays,
        pulledAtUtc,
      };

      liveDataBlock =
        `DATA FRESHNESS:\n` +
        `- Pulled at (UTC): ${pulledAtUtc}\n` +
        `- Intended window: last ${lookbackDays} days\n\n` +
        `DATA SOURCE:\n- ${FEATURE_SERVER} (layer 0)\n\n` +
        `VERTICAL REQUESTED: ${vertical}\n\n` +
        `DATE FILTER RELIABILITY:\n` +
        `- dateField: ${dateField ?? "(none)"}\n` +
        `- parse success rate (sample): ${(residentialSummary.dateParseRate * 100).toFixed(0)}% over ${residentialSummary.dateSamplesChecked} non-empty values\n` +
        `- date-window filter applied: ${residentialSummary.dateFilterReliable ? "YES" : "NO (not reliable)"}\n\n` +
        `RESIDENTIAL-LIKELY (filtered to address containing "Montgomery" when possible):\n` +
        `- Count (windowed if reliable): ${residentialSummary.count}\n` +
        `- Top types: ${JSON.stringify(residentialSummary.topTypes)}\n` +
        `- Top corridors: ${JSON.stringify(residentialSummary.topCorridors)}\n\n` +
        `COMMERCIAL-LIKELY (filtered to address containing "Montgomery" when possible):\n` +
        `- Count (windowed if reliable): ${commercialSummary.count}\n` +
        `- Top types: ${JSON.stringify(commercialSummary.topTypes)}\n` +
        `- Top corridors: ${JSON.stringify(commercialSummary.topCorridors)}\n` +
        `- Sample records (up to 10): ${JSON.stringify(commercialSummary.sample, null, 2)}\n`;
    } catch (e: any) {
      liveDataBlock =
        `DATA FRESHNESS:\n- Pulled at (UTC): ${pulledAtUtc}\n\n` +
        `Live permit data error: ${e?.message ?? String(e)}\n`;
    }

    const brightDataFooter = buildBrightDataFooter(bd.items, bd.excerpts, tokenPresent, pulledAtUtc, bd.diag);

    const systemPrompt = `
You are a civic intelligence assistant for Montgomery, Alabama.

Output format (exact):
1) Short answer (1–2 sentences)
2) What’s underway (bullets; label each bullet as "Confirmed (permit data)" or "Likely")
3) What the permit data suggests (2–6 bullets; include time window + top corridors)
4) Where to verify (official sources / offices / datasets)

Rules:
- Never fabricate project names, funding amounts, dates, addresses, approvals, or citations.
- Use the appropriate section:
  - If the user asks about commercial/economic activity, prioritize COMMERCIAL-LIKELY.
  - If the user asks about housing/residential, prioritize RESIDENTIAL-LIKELY.
- Do NOT mix residential counts into a commercial answer (or vice versa).
- Permit data reflects permitted work, not all active construction.
- If the date filter is not reliable, say the 60-day window could not be enforced.
- Geography note: even with filtering, dataset coverage may include non-city areas; interpret carefully.
- Do NOT include a "Suggested next questions" section.
`.trim();

    const userPrompt = `
Question: ${question}

LIVE CIVIC CONTEXT:
${liveDataBlock}

Answer using the required format.
`.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const baseAnswer = completion.choices?.[0]?.message?.content ?? "No answer generated.";

    // Keep sponsor footer visible in the answer text
    const finalAnswer = `${baseAnswer}\n\n---\n${brightDataFooter}`;

    // ✅ NEW: return structured KPI data for Civic Intelligence tab
    return NextResponse.json({
      answer: finalAnswer,
      kpis,
      meta: {
        pulledAtUtc,
        lookbackDays,
        geo: "Medium",
        dateFilterReliable: kpis.dateFilterReliable,
      },
    });
  } catch (err: any) {
    const msg =
      err?.message ||
      err?.error?.message ||
      err?.response?.data?.error?.message ||
      JSON.stringify(err);
    return NextResponse.json({ answer: `API ERROR: ${msg}` }, { status: 500 });
  }
}