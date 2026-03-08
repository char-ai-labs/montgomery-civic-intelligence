export default function AboutPage() {
  const githubUrl =
    process.env.NEXT_PUBLIC_GITHUB_URL ||
    "https://github.com/char-ai-labs/montgomery-civic-intelligence";

  const InlineIcon = ({ symbol, label }: { symbol: string; label: string }) => (
    <span
      aria-label={label}
      role="img"
      style={{
        fontSize: 16,
        lineHeight: 1,
        transform: "translateY(1px)",
        display: "inline-block",
      }}
    >
      {symbol}
    </span>
  );

  const SectionTitle = ({
    icon,
    iconLabel,
    children,
  }: {
    icon: string;
    iconLabel: string;
    children: React.ReactNode;
  }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <InlineIcon symbol={icon} label={iconLabel} />
      <h2 style={{ fontSize: 22, margin: 0 }}>{children}</h2>
    </div>
  );

  return (
    <>
      <style precedence="default" href="mci-about-styles">{`
        :root {
          --foreground: #002b5c;
          --panel: #ffffff;
          --border: #d3d3d3;
          --muted: #6c757d;
          --link-color: #007ac2;
          --body-text: #333333;
        }

        .portal-wrap {
          font-family: Arial, Helvetica, sans-serif;
          color: var(--body-text);
        }

        h1, h2 {
          color: var(--foreground);
        }

        a:focus {
          outline: 2px solid #007ac2;
          outline-offset: 2px;
        }

        .bullets {
          margin: 10px 0 0;
          padding-left: 18px;
          font-size: 15px;
          line-height: 1.65;
        }

        .bullets li {
          margin: 6px 0;
        }
      `}</style>

      <main className="portal-wrap">
        <h1 style={{ fontSize: 36, margin: "6px 0 12px" }}>About</h1>

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 14,
            padding: 18,
            background: "var(--panel)",
            marginBottom: 20,
          }}
        >
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65 }}>
            Montgomery Civic Intelligence is an AI-powered civic intelligence project that turns
            public permit data into clear insights on housing and commercial activity, helping
            residents and city stakeholders quickly understand development trends.
          </p>
        </div>

        {/* DATA SOURCES */}
        <section style={{ marginTop: 10 }}>
          <SectionTitle icon="🗄️" iconLabel="Database">
            Data sources
          </SectionTitle>

          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 16,
                background: "var(--panel)",
              }}
            >
              <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 900 }}>
                Main source
              </div>

              <div style={{ fontWeight: 900, marginTop: 8, marginBottom: 6, fontSize: 16 }}>
                Montgomery Open Data — Construction Permits
              </div>

              <div style={{ fontSize: 15, lineHeight: 1.6, color: "#333333" }}>
                Used for counts, trends, and corridor groupings based on recent permit activity.
              </div>
            </div>

            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 16,
                background: "var(--panel)",
              }}
            >
              <div style={{ fontSize: 13, color: "var(--muted)", fontWeight: 900 }}>
                Extra context
              </div>

              <div style={{ fontWeight: 900, marginTop: 8, marginBottom: 6, fontSize: 16 }}>
                Official City Pages (via Bright Data)
              </div>

              <div style={{ fontSize: 15, lineHeight: 1.6, color: "#333333" }}>
                Provides access to official city pages and public references that help verify or
                add context to development activity mentioned in the analysis.
                <span style={{ color: "var(--muted)" }}> (when available)</span>.
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section style={{ marginTop: 24 }}>
          <SectionTitle icon="✨" iconLabel="Sparkles">
            How it works
          </SectionTitle>

          <div
            style={{
              marginTop: 12,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
              <div style={{ fontWeight: 900, marginBottom: 6, fontSize: 16 }}>Explore</div>

              <div style={{ fontSize: 15, color: "#333333" }}>
                Pick a housing or commercial question to analyze recent permits.
              </div>
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
              <div style={{ fontWeight: 900, marginBottom: 6, fontSize: 16 }}>Summarize</div>

              <div style={{ fontSize: 15, color: "#333333" }}>
                AI generates plain-language summaries highlighting development activity, such as
                busy corridors and permit type trends.
              </div>
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
              <div style={{ fontWeight: 900, marginBottom: 6, fontSize: 16 }}>Quick Stats</div>

              <div style={{ fontSize: 15, color: "#333333" }}>
                The Overview tab shows key KPIs generated from the same data.
              </div>
            </div>
          </div>
        </section>

        {/* ARCHITECTURE */}
        <section style={{ marginTop: 24 }}>
          <SectionTitle icon="⚙️" iconLabel="Architecture">
            Architecture
          </SectionTitle>

          <div
            style={{
              marginTop: 12,
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 16,
              background: "var(--panel)",
            }}
          >
            <ul className="bullets">
              <li>Next.js app with Explore workflows and an Overview dashboard.</li>
              <li>
                Server API routes retrieve permit data, generate structured summaries, and return
                civic insight responses.
              </li>
              <li>
                Responses include transparency notes (date-window reliability + coverage limits).
              </li>
            </ul>
          </div>
        </section>

        {/* NOTES */}
        <section style={{ marginTop: 24 }}>
          <SectionTitle icon="⚠️" iconLabel="Warning">
            Notes and limitations
          </SectionTitle>

          <div
            style={{
              marginTop: 12,
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 16,
              background: "var(--panel)",
            }}
          >
            <ul className="bullets">
              <li>
                Permits reflect <b>approvals</b>, not completed construction.
              </li>
              <li>
                If a strict time window cannot be enforced, results fall back to the most recent
                available records.
              </li>
              <li>Use linked city sources to verify named projects.</li>
            </ul>
          </div>
        </section>

        {/* SOURCE CODE */}
        <section style={{ marginTop: 24 }}>
          <SectionTitle icon="💻" iconLabel="Source code">
            Source code
          </SectionTitle>

          <div
            style={{
              marginTop: 12,
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 16,
              background: "var(--panel)",
            }}
          >
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 15,
                lineHeight: 1.6,
                color: "#333333",
              }}
            >
              View the project repository for implementation details, architecture, and ongoing
              development.
            </p>

            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: "#0b2e59",
                color: "#ffffff",
                padding: "10px 16px",
                borderRadius: 8,
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              View source code on GitHub →
            </a>
          </div>
        </section>
      </main>
    </>
  );
}