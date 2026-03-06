"use client";

import React, { useEffect, useMemo, useState } from "react";

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

function formatUtcToLocal(utcIso?: string) {
  if (!utcIso) return "—";
  const d = new Date(utcIso);
  if (!Number.isFinite(d.getTime())) return "—";
  return d.toLocaleString();
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
        minWidth: 0, // ✅ helps wrapping inside grid
      }}
    >
      <div style={{ fontSize: 13, color: "#333333", fontWeight: 700 }}>{title}</div>

      {/* ✅ Wrap-friendly value */}
      <div
        style={{
          marginTop: 6,
          fontSize: 28,
          fontWeight: 800,
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
        <div style={{ marginTop: 6, fontSize: 13, color: "#333333" }}>{subtitle}</div>
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "baseline",
        }}
      >
        <div style={{ fontWeight: 800, color: "var(--foreground)", fontSize: 16 }}>
          New vs Repairs (Residential)
        </div>
        <div style={{ fontSize: 13, color: "#333333" }}>
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

      <div
        style={{
          marginTop: 10,
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 13, color: "#333333" }}>
          <span style={{ fontWeight: 800 }}>{leftLabel}</span> • {leftPct}%
        </div>
        <div style={{ fontSize: 13, color: "#333333" }}>
          <span style={{ fontWeight: 800 }}>{rightLabel}</span> • {rightPct}%
        </div>
      </div>
    </div>
  );
}

export default function CivicKpisPage() {
  const [kpis, setKpis] = useState<KPIs | null>(null);

  const [pulledAtLocal, setPulledAtLocal] = useState<string>("—");
  const [dateReliable, setDateReliable] = useState<boolean>(true);
  const [geo, setGeo] = useState<"Low" | "Medium" | "High">("Medium");
  const [lookbackDays, setLookbackDays] = useState<number>(60);

  const [loading, setLoading] = useState<boolean>(false);
  const [slow, setSlow] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Standard KPI prompt to keep the experience consistent and reproducible.
  const kpiPrompt = useMemo(
    () =>
      "Return only KPI context for Montgomery permits: residential-likely count, commercial-likely count, percent new construction (residential new vs repairs/alterations), new count, repair/other count, and top corridor. Use the same last 60 days logic and date reliability rules.",
    []
  );

  async function refresh() {
    if (loading) return;

    setLoading(true);
    setSlow(false);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: kpiPrompt }),
      });

      const text = await res.text();
      if (!res.ok) throw new Error(text || `Request failed (${res.status})`);

      let parsed: ApiResponse | null = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = null;
      }

      const got = parsed?.kpis ?? null;

      if (got) {
        setKpis(got);
        setPulledAtLocal(formatUtcToLocal(got.pulledAtUtc));
        setDateReliable(!!got.dateFilterReliable);
        setGeo(got.geo ?? "Medium");
        setLookbackDays(got.lookbackDays ?? 60);
      } else {
        setKpis(null);
        setErrorMsg(
          "We couldn’t generate the overview yet. Try running a preset in Explore Data, then come back and refresh."
        );
      }
    } catch {
      setKpis(null);
      setErrorMsg("Something went wrong while generating the overview. Please try Refresh again.");
    } finally {
      setLoading(false);
    }
  }

  // Auto-load once on page open
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show “still working…” messaging if it takes a while (no fake ETA)
  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const t = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(t);
  }, [loading]);

  return (
    <>
      <style>{`
        :root {
          --foreground: #002b5c; /* Navy for headings */
          --panel: #ffffff; /* White background */
          --panel-soft: #f8f9fa; /* Light gray for soft panels */
          --border: #d3d3d3; /* Light gray borders */
          --muted: #6c757d; /* Gray for muted */
          --muted-2: #adb5bd; /* Lighter gray */
          --link-color: #007ac2; /* Blue for links */
        }
        .portal-wrap {
          font-family: Arial, Helvetica, sans-serif;
        }
        h1, h2 {
          color: var(--foreground);
        }
        button:focus, textarea:focus {
          outline: 2px solid #007ac2;
        }
        .progress-bar {
          height: 8px;
          border-radius: 999px;
          background: rgba(0,0,0,0.08);
          overflow: hidden;
          position: relative;
        }
        .progress-bar::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          height: 100%;
          width: 50%;
          background: var(--foreground);
          border-radius: 999px;
          opacity: 0.18;
          animation: shimmer 1.1s ease-in-out infinite;
        }
        @keyframes shimmer {
          0% { transform: translateX(-60%); }
          100% { transform: translateX(160%); }
        }
        .loading-note {
          margin-top: 6px;
          font-size: 14px;
          color: #333333;
        }
        .fade-in {
          animation: fadeIn 0.3s ease-in;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        /* ✅ Meta pill (wrapping-safe on mobile) */
        .meta-pill {
          display: inline-block;
          width: fit-content;
          max-width: 100%;
          padding: 6px 10px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--panel-soft);
          color: #333333;
          font-size: 13px;
          line-height: 1.35;
          white-space: normal;           /* allow wrap */
          overflow-wrap: anywhere;       /* break long chunks */
          word-break: break-word;        /* legacy safety */
        }
      `}</style>

      <main className="portal-wrap">
        <div style={{ marginBottom: 14 }}>
          <h1 style={{ fontSize: 36, margin: "6px 0 8px" }}>Montgomery Development Overview</h1>
          <p style={{ color: "#333333", margin: 0, fontSize: 15 }}>
            A clear snapshot of Montgomery’s housing and commercial activity, powered by official public data.
          </p>
        </div>

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
              <div style={{ fontWeight: 800, fontSize: 20, color: "var(--foreground)" }}>Current signals</div>
              <div style={{ marginTop: 6, fontSize: 14, color: "#333333" }}>
                Lookback window: {lookbackDays} days
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "center",
                flexWrap: "wrap",
                justifyContent: "flex-end",
              }}
            >
              {/* ✅ FIX: use .meta-pill instead of nowrap inline styles */}
              <div className="meta-pill">
                Pulled at: {pulledAtLocal} • Date filter: {dateReliable ? "Reliable" : "Not reliable"} • Geo: {geo}
              </div>

              <button
                onClick={refresh}
                disabled={loading}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "1px solid #002b5c",
                  background: loading ? "#6c757d" : "#002b5c",
                  color: "#ffffff",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: 800,
                  minWidth: 120,
                  fontSize: 15,
                }}
                aria-busy={loading}
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
          </div>

          {/* ✅ Loading feedback (indeterminate progress bar) */}
          {loading ? (
            <div style={{ marginTop: 12 }}>
              <div className="progress-bar" />
              <div className="loading-note fade-in">
                {slow ? "Still working. We’re pulling records and generating insights." : "Generating the overview. This may take a moment."}
              </div>
            </div>
          ) : null}

          {!kpis ? (
            <div
              style={{
                marginTop: 14,
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 14,
                background: "var(--panel-soft)",
                color: "#333333",
                lineHeight: 1.5,
                fontSize: 15,
              }}
            >
              {errorMsg ? (
                <span>{errorMsg}</span>
              ) : (
                <>
                  No snapshot yet. Click <b>Refresh</b>, or run any preset in <b>Explore Data</b> first.
                </>
              )}
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
                <KpiCard title="Residential permits" value={kpis.residentialCount} subtitle={`Last ${kpis.lookbackDays} days`} />
                <KpiCard title="Commercial permits" value={kpis.commercialCount} subtitle={`Last ${kpis.lookbackDays} days`} />
                <KpiCard title="% new construction" value={`${kpis.percentNew}%`} subtitle="Residential (new vs repairs/other)" />

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
                <MiniBar leftLabel="New" leftValue={kpis.newCount} rightLabel="Repairs/Other" rightValue={kpis.repairCount} />
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
                <b>Interpretation note:</b> Permits indicate approved work (not all active construction). If the date filter is{" "}
                <b>Not reliable</b>, the tool falls back to the most recent available records and flags the limitation.
              </div>
            </>
          )}
        </section>
      </main>
    </>
  );
}