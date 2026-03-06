"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Preset = {
  id: string;
  label: string;
  blurb: string;
  question: string;
  section: "Housing & Development" | "Commercial & Economic Activity" | "Quality & Methods";
};

type KPIs = {
  residentialCount: number;
  commercialCount: number;
  percentNew: number;
  newCount: number;
  repairCount: number;
  topCorridor: string;
  dateFilterReliable: boolean;
  geo: "Low" | "Medium" | "High";
  lookbackDays: number;
  pulledAtUtc: string;
};

type ApiResponse = {
  answer?: string;
  kpis?: KPIs;
  meta?: {
    pulledAtUtc?: string;
    lookbackDays?: number;
    geo?: "Low" | "Medium" | "High";
    dateFilterReliable?: boolean;
  };
};

function sanitizeAnswer(raw: string): string {
  if (!raw) return raw;

  const lines = raw.split("\n");

  const startIdx = lines.findIndex((line) =>
    /^\s*(\d+\)\s*)?Suggested next questions\s*:/i.test(line.trim())
  );

  const kept = startIdx >= 0 ? lines.slice(0, startIdx) : lines;

  while (kept.length > 0 && kept[kept.length - 1].trim() === "") {
    kept.pop();
  }

  return kept.join("\n");
}

/**
 * Turns URLs in plain text into clickable links while preserving newlines.
 * Works well inside a container with whiteSpace: "pre-wrap".
 */
function renderWithLinks(text: string): React.ReactNode[] {
  if (!text) return [];

  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = urlRegex.exec(text)) !== null) {
    const start = match.index;
    const rawUrl = match[0];

    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }

    const trailingPunct = rawUrl.match(/[),.;:!?]+$/)?.[0] ?? "";
    const urlCore = trailingPunct ? rawUrl.slice(0, -trailingPunct.length) : rawUrl;

    const href = urlCore.startsWith("http") ? urlCore : `https://${urlCore}`;

    const display =
      urlCore.length > 70 ? `${urlCore.slice(0, 50)}…${urlCore.slice(-15)}` : urlCore;

    parts.push(
      <a
        key={`url-${start}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: "var(--link-color)",
          textDecoration: "underline",
          wordBreak: "break-word",
          overflowWrap: "anywhere",
        }}
      >
        {display}
      </a>
    );

    if (trailingPunct) parts.push(trailingPunct);
    lastIndex = start + rawUrl.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function CivicLoading({
  title = "Compiling summary…",
  subtitle = "Fetching permit records and generating a transparent, data-backed response.",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        padding: 16,
        border: "1px solid var(--border)",
        borderRadius: 12,
        background: "var(--panel-soft)",
      }}
    >
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes shimmer {
          0% { transform: translateX(-60%); }
          100% { transform: translateX(160%); }
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          aria-hidden="true"
          style={{
            width: 16,
            height: 16,
            borderRadius: "50%",
            border: "2px solid rgba(0,0,0,0.15)",
            borderTopColor: "var(--foreground)",
            display: "inline-block",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <div style={{ fontWeight: 800, color: "var(--foreground)" }}>{title}</div>
      </div>

      <div style={{ marginTop: 6, fontSize: 14, color: "var(--muted)", lineHeight: 1.4 }}>
        {subtitle}
      </div>

      <div
        aria-hidden="true"
        style={{
          marginTop: 12,
          height: 8,
          borderRadius: 999,
          background: "rgba(0,0,0,0.08)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            height: "100%",
            width: "50%",
            background: "var(--foreground)",
            borderRadius: 999,
            opacity: 0.18,
            animation: "shimmer 1.1s ease-in-out infinite",
          }}
        />
      </div>

      <div style={{ marginTop: 10, fontSize: 13, color: "var(--muted)" }}>
        Tip: If results take longer than expected, the data source may be rate-limited.
      </div>
    </div>
  );
}

function formatUtcToLocal(utcIso?: string) {
  if (!utcIso) return "";
  const d = new Date(utcIso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString();
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      type="button"
      role="tab"
      aria-selected={active}
      className="tab-btn"
      style={{
        padding: "10px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? "transparent" : "var(--border)"}`,
        background: active ? "var(--foreground)" : "var(--panel)",
        color: active ? "var(--panel)" : "var(--foreground)",
        cursor: "pointer",
        fontWeight: 800,
      }}
    >
      {label}
    </button>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 14,
        background: "var(--panel)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.02)",
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 800 }}>{title}</div>
      <div
        style={{
          marginTop: 6,
          fontSize: 28,
          fontWeight: 900,
          color: "var(--foreground)",
          lineHeight: 1.1,
          whiteSpace: "normal",
          overflowWrap: "anywhere",
          wordBreak: "break-word",
          minWidth: 0,
        }}
      >
        {value}
      </div>
      {subtitle ? (
        <div style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>{subtitle}</div>
      ) : null}
    </div>
  );
}

function MiniBar({
  leftLabel,
  leftValue,
  rightLabel,
  rightValue,
}: {
  leftLabel: string;
  leftValue: number;
  rightLabel: string;
  rightValue: number;
}) {
  const total = Math.max(leftValue + rightValue, 1);
  const leftPct = Math.round((leftValue / total) * 100);
  const rightPct = 100 - leftPct;

  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 14,
        padding: 14,
        background: "var(--panel)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <div style={{ fontWeight: 900, color: "var(--foreground)" }}>New vs Repairs (Residential)</div>
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          {leftValue} / {rightValue}
        </div>
      </div>

      <div
        aria-hidden="true"
        style={{
          marginTop: 10,
          height: 10,
          borderRadius: 999,
          background: "rgba(0,0,0,0.08)",
          overflow: "hidden",
          display: "flex",
        }}
      >
        <div style={{ width: `${leftPct}%`, background: "rgba(0,0,0,0.65)" }} />
        <div style={{ width: `${rightPct}%`, background: "rgba(0,0,0,0.22)" }} />
      </div>

      <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 13, color: "var(--muted-2)" }}>
          <span style={{ fontWeight: 900 }}>{leftLabel}</span> • {leftPct}%
        </div>
        <div style={{ fontSize: 13, color: "var(--muted-2)" }}>
          <span style={{ fontWeight: 900 }}>{rightLabel}</span> • {rightPct}%
        </div>
      </div>
    </div>
  );
}

export default function ExploreDataPage() {
  const presets: Preset[] = useMemo(
    () => [
      {
        id: "housing_activity",
        section: "Housing & Development",
        label: "Housing activity (last 60 days)",
        blurb: "Counts by permit type and where activity is concentrated.",
        question:
          "Summarize housing-related construction activity in Montgomery based on permits from the last 60 days. Include counts by type and top corridors. If the date window cannot be enforced, explain why and summarize the most recent available records.",
      },
      {
        id: "new_vs_repairs",
        section: "Housing & Development",
        label: "New builds vs repairs",
        blurb: "Quick read on growth vs maintenance/renovation.",
        question:
          "In the last 60 days, compare new residential construction permits vs repairs/alterations. Provide totals and a short interpretation of what it might indicate. Use only residential-likely permit data.",
      },
      {
        id: "top_areas",
        section: "Housing & Development",
        label: "Top housing corridors",
        blurb: "Top 5 corridors by housing-related permits.",
        question:
          "Based on permit data, which corridors show the most housing-related construction activity in the last 60 days? Provide the top 5 corridors and counts, and briefly interpret what that suggests.",
      },
      {
        id: "commercial_activity",
        section: "Commercial & Economic Activity",
        label: "Commercial activity (last 60 days)",
        blurb: "Counts by commercial permit type and top corridors.",
        question:
          "Summarize commercial construction activity in Montgomery based on permits from the last 60 days. Include totals by type, top corridors, and a short interpretation of what it may indicate about economic activity. Use only commercial-likely permit data.",
      },
      {
        id: "business_corridors",
        section: "Commercial & Economic Activity",
        label: "Top business corridors",
        blurb: "Top 5 corridors with the most commercial permits.",
        question:
          "Based on permit data, which corridors show the most commercial activity in the last 60 days? Provide the top 5 corridors and counts, and interpret what that suggests about local economic activity.",
      },
      {
        id: "data_confidence",
        section: "Quality & Methods",
        label: "Data confidence and caveats",
        blurb: "Date reliability, geography limitations, and what permits mean.",
        question:
          "Explain the confidence level of the permit-based insights: date reliability (whether the last-60-days window is enforceable), geography limitations (city limits / coverage), and what permit data does/does not represent. Keep it concise and structured.",
      },
      {
        id: "what_to_verify",
        section: "Quality & Methods",
        label: "How to verify named developments",
        blurb: "Where to find official project names and approvals.",
        question:
          "If someone wants the names of specific housing developments underway, what are the best official places to verify in Montgomery (planning, zoning, agendas, council minutes), and what should they look for?",
      },
    ],
    []
  );

  const [tab, setTab] = useState<"explore" | "overview">("explore");

  const [response, setResponse] = useState("");
  const [pulledAt, setPulledAt] = useState("");
  const [error, setError] = useState("");

  const [kpis, setKpis] = useState<KPIs | null>(null);

  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const loading = activePresetId !== null;

  const [showCustom, setShowCustom] = useState(false);
  const [customQuestion, setCustomQuestion] = useState("");

  const resultsRef = useRef<HTMLElement | null>(null);

  // allow /assistant?tab=overview to open the Overview tab
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const t = params.get("tab");
    if (t === "overview") setTab("overview");
  }, []);

  // single-open accordion: Housing starts open by default
  const [openSection, setOpenSection] = useState<Preset["section"]>("Housing & Development");

  function toggleSection(title: Preset["section"]) {
    setOpenSection(title);
  }

  function scrollToResults() {
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function runQuestion(q: string, presetId?: string) {
    setError("");
    setResponse("");
    setPulledAt("");

    const trimmed = q.trim();
    if (!trimmed) {
      setError("Select a question or type a custom question first.");
      return;
    }

    setTab("explore");
    scrollToResults();
    setActivePresetId(presetId ?? "custom");

    const MIN_DELAY = 600;
    const start = Date.now();

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });

      const text = await res.text();

      const elapsed = Date.now() - start;
      if (elapsed < MIN_DELAY) {
        await new Promise((r) => setTimeout(r, MIN_DELAY - elapsed));
      }

      if (!res.ok) {
        throw new Error(text || `Request failed (${res.status})`);
      }

      let parsed: ApiResponse | null = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }

      const answer = parsed?.answer ?? text;
      setResponse(sanitizeAnswer(answer));

      const serverPulledAt = parsed?.kpis?.pulledAtUtc ?? parsed?.meta?.pulledAtUtc;
      const localPulledAt = serverPulledAt
        ? formatUtcToLocal(serverPulledAt)
        : new Date().toLocaleString();
      setPulledAt(localPulledAt);

      if (parsed?.kpis) {
        setKpis(parsed.kpis);
      }
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong.");
    } finally {
      setActivePresetId(null);
    }
  }

  function Section({
    title,
    icon,
    description,
    items,
  }: {
    title: Preset["section"];
    icon: string;
    description: string;
    items: Preset[];
  }) {
    const isOpen = openSection === title;
    const count = items.length;
    const disabled = loading;

    return (
      <section
        style={{
          border: "1px solid var(--border)",
          borderRadius: 14,
          background: "var(--panel-soft)",
          marginBottom: 14,
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => toggleSection(title)}
          aria-expanded={isOpen}
          disabled={disabled}
          className="accordion-header"
          style={{
            width: "100%",
            textAlign: "left",
            padding: 16,
            background: "transparent",
            border: "none",
            cursor: disabled ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            opacity: disabled ? 0.85 : 1,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>
                {icon}
              </span>
              <h2 style={{ fontSize: 20, margin: 0, color: "var(--foreground)" }}>{title}</h2>

              <span
                style={{
                  fontSize: 12,
                  color: "var(--muted)",
                  border: "1px solid var(--border)",
                  background: "var(--panel)",
                  padding: "2px 8px",
                  borderRadius: 999,
                  fontWeight: 800,
                  whiteSpace: "nowrap",
                }}
                aria-label={`${count} presets`}
              >
                {count} {count === 1 ? "preset" : "presets"}
              </span>
            </div>

            <p
              style={{
                marginTop: 8,
                marginBottom: 0,
                color: "#333333",
                fontWeight: 400,
                fontSize: 15,
                lineHeight: 1.45,
              }}
            >
              {description}
            </p>
          </div>

          <span
            aria-hidden="true"
            style={{
              fontSize: 16,
              color: "var(--muted)",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.15s ease",
              marginTop: 2,
            }}
          >
            ▾
          </span>
        </button>

        {isOpen ? (
          <div style={{ padding: "0 16px 16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((p) => {
                const isActive = activePresetId === p.id;

                return (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "var(--panel)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: "var(--foreground)", fontSize: 16 }}>
                        {p.label}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          color: "var(--muted)",
                          marginTop: 2,
                          lineHeight: 1.35,
                        }}
                      >
                        {p.blurb}
                      </div>
                    </div>

                    <button
                      onClick={() => runQuestion(p.question, p.id)}
                      disabled={loading}
                      className="run-btn"
                      style={{
                        padding: "12px 16px",
                        borderRadius: 12,
                        border: "1px solid var(--foreground)",
                        background: loading
                          ? "#6c757d"
                          : isActive
                          ? "var(--foreground)"
                          : "var(--panel)",
                        color: loading ? "#ffffff" : isActive ? "var(--panel)" : "var(--foreground)",
                        cursor: loading ? "not-allowed" : "pointer",
                        fontWeight: 900,
                        whiteSpace: "nowrap",
                        minWidth: 88,
                        transition: "transform 0.06s ease, box-shadow 0.15s ease",
                        boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
                      }}
                    >
                      {isActive ? "Running..." : "Run"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  const housingItems = presets.filter((p) => p.section === "Housing & Development");
  const commercialItems = presets.filter((p) => p.section === "Commercial & Economic Activity");
  const qualityItems = presets.filter((p) => p.section === "Quality & Methods");

  const dateReliable = kpis?.dateFilterReliable ?? true;
  const geoLabel = kpis?.geo ?? "Medium";
  const lookbackDays = kpis?.lookbackDays ?? 60;

  return (
    <>
      <style>{`
        :root {
          --foreground: #002b5c;
          --panel: #ffffff;
          --panel-soft: #f8f9fa;
          --border: #d3d3d3;
          --muted: #6c757d;
          --muted-2: #adb5bd;
          --link-color: #007ac2;
        }
        .portal-wrap { font-family: Arial, Helvetica, sans-serif; }
        h1, h2 { color: var(--foreground); }
        button:focus, textarea:focus { outline: 2px solid #007ac2; outline-offset: 2px; }

        .run-btn:hover { box-shadow: 0 8px 18px rgba(0,0,0,0.10); transform: translateY(-1px); }
        .run-btn:active { transform: translateY(0px); box-shadow: 0 2px 10px rgba(0,0,0,0.08); }
        .accordion-header:hover { background: rgba(0,0,0,0.02); }

        .primary-cta {
          padding: 12px 16px;
          border-radius: 12px;
          border: 1px solid var(--foreground);
          background: var(--foreground);
          color: var(--panel);
          cursor: pointer;
          font-weight: 900;
          font-size: 15px;
          white-space: nowrap;
          transition: transform 0.06s ease, box-shadow 0.15s ease, opacity 0.15s ease;
          box-shadow: 0 1px 0 rgba(0,0,0,0.04);
        }
        .primary-cta:hover { box-shadow: 0 8px 18px rgba(0,0,0,0.10); transform: translateY(-1px); }
        .primary-cta:active { transform: translateY(0px); box-shadow: 0 2px 10px rgba(0,0,0,0.08); }

        @media (max-width: 520px) {
          .primary-cta { width: 100%; justify-content: center; }
        }
      `}</style>

      <main className="portal-wrap">
        <h1 style={{ fontSize: 36, margin: "6px 0 8px" }}>Explore Data</h1>
        <p style={{ color: "#333333", margin: "0 0 14px", fontSize: 15 }}>
          AI-powered analysis on Montgomery&apos;s open permit data to generate clear housing and
          commercial insights.
        </p>

        <div role="tablist" style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
          <TabButton active={tab === "explore"} label="Explore Data" onClick={() => setTab("explore")} />
          <TabButton active={tab === "overview"} label="Overview" onClick={() => setTab("overview")} />
        </div>

        {tab === "overview" ? (
          <section
            style={{
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 16,
              background: "var(--panel)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 22 }}>Montgomery Development Overview</h2>
                <p style={{ marginTop: 6, marginBottom: 0, color: "var(--muted)", fontSize: 14 }}>
                  A quick snapshot of current construction signals (lookback: {lookbackDays} days).
                </p>
              </div>

              <div className="meta-pill">
                Pulled at: {pulledAt || "—"} • Date filter: {dateReliable ? "Reliable" : "Not reliable"} • Geo:{" "}
                {geoLabel}
              </div>
            </div>

            {!kpis ? (
              <div style={{ marginTop: 14 }}>
                <div style={{ color: "#333333", fontSize: 15 }}>
                  Run any preset in <b>Explore Data</b> to populate the overview cards here.
                </div>
                <div style={{ marginTop: 10 }}>
                  <button
                    onClick={() => setTab("explore")}
                    className="primary-cta"
                    style={{ padding: "10px 14px" }}
                  >
                    Go to Explore Data
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div
                  style={{
                    marginTop: 16,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 12,
                  }}
                >
                  <KpiCard
                    title="Residential permits"
                    value={kpis.residentialCount}
                    subtitle={`Last ${kpis.lookbackDays} days`}
                  />
                  <KpiCard
                    title="Commercial permits"
                    value={kpis.commercialCount}
                    subtitle={`Last ${kpis.lookbackDays} days`}
                  />
                  <KpiCard
                    title="% new construction"
                    value={`${kpis.percentNew}%`}
                    subtitle="Residential (new vs repairs/alterations)"
                  />
                  <KpiCard
                    title="Top corridor"
                    value={<span style={{ fontSize: 20, lineHeight: 1.25 }}>{kpis.topCorridor || "—"}</span>}
                    subtitle="Highest permit concentration"
                  />
                  <KpiCard
                    title="Data reliability"
                    value={kpis.dateFilterReliable ? "Reliable" : "Limited"}
                    subtitle="Date parsing / window enforcement"
                  />
                </div>

                <div style={{ marginTop: 12 }}>
                  <MiniBar
                    leftLabel="New"
                    leftValue={kpis.newCount}
                    rightLabel="Repairs/Other"
                    rightValue={kpis.repairCount}
                  />
                </div>

                <div
                  style={{
                    marginTop: 12,
                    fontSize: 13,
                    color: "#333333",
                    lineHeight: 1.5,
                    background: "var(--panel-soft)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: 12,
                  }}
                >
                  <b>How to interpret:</b> Permits indicate approved work (not all active construction). If
                  the date filter is marked <b>Not reliable</b>, the system falls back to the most recent
                  available records and flags the limitation.
                </div>
              </>
            )}
          </section>
        ) : null}

        {tab === "explore" ? (
          <>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 14,
                background: "var(--panel)",
                marginBottom: 14,
              }}
            >
              <div style={{ fontWeight: 900, color: "var(--foreground)", marginBottom: 6 }}>
                Choose a preset to run a fast analysis
              </div>
              <div style={{ color: "var(--muted)", fontSize: 14, lineHeight: 1.45 }}>
                Or use <b>Ask a custom question</b> for anything else (e.g., a specific corridor, permit
                type, or time window).
              </div>
            </div>

            <Section
              title="Housing & Development"
              icon="🏠"
              description="Data-backed summaries of housing-related construction activity derived from the City’s permit dataset."
              items={housingItems}
            />

            <Section
              title="Commercial & Economic Activity"
              icon="💼"
              description="Signals of business growth and investment based on commercial-related permits and where they cluster."
              items={commercialItems}
            />

            <Section
              title="Quality & Methods"
              icon="✅"
              description="Transparency: what the data can support, caveats, and how to verify official project names."
              items={qualityItems}
            />

            <section
              style={{
                marginBottom: 16,
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 16,
                background: "var(--panel)",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ margin: 0, fontSize: 18, color: "var(--foreground)" }}>Ask your own question</h2>
                  <p style={{ marginTop: 6, marginBottom: 0, color: "var(--muted)", fontSize: 14, lineHeight: 1.4 }}>
                    Ask about corridors, permit types, or time windows, and get a structured answer with transparency signals.
                  </p>
                </div>

                <button
                  onClick={() => setShowCustom((s) => !s)}
                  disabled={loading}
                  className="primary-cta"
                  style={{
                    background: showCustom ? "var(--panel)" : "var(--foreground)",
                    color: showCustom ? "var(--foreground)" : "var(--panel)",
                    cursor: loading ? "not-allowed" : "pointer",
                    opacity: loading ? 0.85 : 1,
                  }}
                  aria-expanded={showCustom}
                >
                  {showCustom ? "Hide custom question" : "Ask a custom question"}
                </button>
              </div>

              {showCustom && (
                <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                  <textarea
                    value={customQuestion}
                    onChange={(e) => setCustomQuestion(e.target.value)}
                    placeholder="Example: What corridors saw the most commercial permit activity in the last 60 days, and what might it suggest?"
                    disabled={loading}
                    aria-label="Enter your custom question about permits"
                    style={{
                      width: "100%",
                      height: 120,
                      padding: 12,
                      fontSize: 16,
                      borderRadius: 10,
                      border: "1px solid var(--border)",
                      background: "var(--panel)",
                      color: "var(--foreground)",
                      opacity: loading ? 0.85 : 1,
                    }}
                  />

                  <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      onClick={() => runQuestion(customQuestion, "custom")}
                      disabled={loading}
                      className="run-btn"
                      style={{
                        padding: "12px 16px",
                        borderRadius: 12,
                        border: "1px solid var(--foreground)",
                        background: activePresetId === "custom" ? "var(--foreground)" : "var(--panel)",
                        color: activePresetId === "custom" ? "var(--panel)" : "var(--foreground)",
                        cursor: loading ? "not-allowed" : "pointer",
                        fontWeight: 900,
                        fontSize: 15,
                        whiteSpace: "nowrap",
                        boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
                      }}
                    >
                      {activePresetId === "custom" ? "Thinking..." : "Ask"}
                    </button>

                    <span style={{ color: "var(--muted)", fontSize: 13 }}>
                      Tip: Mention a timeframe (e.g., “last 60 days”) and whether you mean housing or commercial.
                    </span>
                  </div>
                </div>
              )}
            </section>

            <section
              ref={(el) => {
                resultsRef.current = el;
              }}
              style={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 16,
                background: "var(--panel)",
                scrollMarginTop: 16,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 20 }}>Results</h2>
                <span style={{ fontSize: 13, color: "#333333" }}>Uses live permit data when available</span>
              </div>

              <div style={{ marginTop: 12 }}>
                {error ? (
                  <p style={{ color: "#b00020", whiteSpace: "pre-wrap", fontSize: 15 }}>{error}</p>
                ) : response ? (
                  <div
                    style={{
                      padding: 14,
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      background: "var(--panel-soft)",
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.55,
                      wordBreak: "break-word",
                      overflowWrap: "anywhere",
                      fontSize: 15,
                    }}
                  >
                    <div className="meta-pill" style={{ marginBottom: 14 }}>
                      Pulled at: {pulledAt || "—"} • Date filter: {dateReliable ? "Reliable" : "Not reliable"} • Geo:{" "}
                      {geoLabel}
                    </div>

                    <div style={{ marginTop: 6 }}>{renderWithLinks(response)}</div>
                  </div>
                ) : loading ? (
                  <CivicLoading />
                ) : (
                  <p style={{ color: "#333333", fontSize: 15 }}>
                    Run one of the preset insights above to generate a data-backed answer.
                  </p>
                )}
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <button
                  onClick={() => setTab("overview")}
                  className="primary-cta"
                  style={{ padding: "10px 14px" }}
                >
                  View Overview
                </button>
                <span style={{ fontSize: 13, color: "var(--muted)" }}>
                  Shows KPI cards and a quick New vs Repairs indicator.
                </span>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </>
  );
}