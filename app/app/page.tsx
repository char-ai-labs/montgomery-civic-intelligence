export default function InsightsPage() {
  const InlineIcon = ({ symbol, label }: { symbol: string; label: string }) => (
    <span
      aria-label={label}
      role="img"
      style={{
        fontSize: 18,
        lineHeight: 1,
        transform: "translateY(1px)",
        display: "inline-block",
      }}
    >
      {symbol}
    </span>
  );

  const CardTitle = ({
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
      <strong style={{ fontSize: 16 }}>{children}</strong>
    </div>
  );

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

        .portal-wrap {
          font-family: Arial, Helvetica, sans-serif;
        }

        h1, h2 {
          color: var(--foreground);
        }

        a:focus {
          outline: 2px solid #007ac2;
          outline-offset: 2px;
        }

        .primary-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--foreground);
          background: var(--foreground);
          color: #ffffff;
          font-weight: 800;
          font-size: 15px;
          text-decoration: none;
          cursor: pointer;
          transition: transform 0.06s ease, box-shadow 0.15s ease;
          box-shadow: 0 1px 0 rgba(0,0,0,0.04);
        }

        .primary-button:hover {
          box-shadow: 0 6px 18px rgba(0,0,0,0.10);
          transform: translateY(-1px);
        }

        .primary-button:active {
          transform: translateY(0px);
          box-shadow: 0 2px 10px rgba(0,0,0,0.08);
        }

        .primary-button:focus-visible {
          outline: 2px solid #007ac2;
          outline-offset: 2px;
        }

        .ai-badge {
          display: inline-block;
          margin-top: 8px;
          font-size: 12px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
          font-weight: 700;
        }

        @media (max-width: 520px) {
          .primary-button {
            width: 100%;
          }
        }
      `}</style>

      <main className="portal-wrap">
        <div className="portal-hero">
          <h1 style={{ fontSize: 36 }}>
            Montgomery Civic Intelligence
          </h1>

          <div className="ai-badge">
            AI-powered civic insights
          </div>

          <p
            style={{ fontSize: 15, color: "#333333", marginTop: 14 }}
          >
            Turn Montgomery’s open permit data into clear, plain-language civic
            insight. Select a dataset to generate summaries, or ask a custom
            question. Every response includes transparency signals like date
            reliability and geographic coverage.
          </p>
        </div>

        <div className="portal-section">
          <h2 style={{ fontSize: 22 }}>Quick start</h2>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            {/* Card 1 */}
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 16,
                background: "var(--panel)",
              }}
            >
              <CardTitle icon="📁" iconLabel="Folder">
                1) Select your data
              </CardTitle>

              <p style={{ margin: "10px 0 12px", color: "#333333", fontSize: 15 }}>
                Choose Housing or Commercial prompts to generate real-time summaries.
                Or, ask your own question for a custom AI-powered answer from the
                latest permit data.
              </p>

              <a className="primary-button" href="/assistant">
                Go to Explore Data →
              </a>
            </div>

            {/* Card 2 */}
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 14,
                padding: 16,
                background: "var(--panel)",
              }}
            >
              <CardTitle icon="📊" iconLabel="Chart">
                2) View the overview
              </CardTitle>

              <p style={{ margin: "10px 0 12px", color: "#333333", fontSize: 15 }}>
                See quick stats like residential vs commercial volume, new vs repairs,
                and top corridors that are updated from your latest run.
              </p>

              <a className="primary-button" href="/assistant?tab=overview">
                Go to Overview →
              </a>

              {/* Tip moved inside card */}
              <p
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color: "var(--muted)",
                  lineHeight: 1.4,
                }}
              >
                Tip: If the overview looks empty, run a dataset in Explore Data first.
              </p>
            </div>
          </div>
        </div>

        <div className="portal-section" style={{ marginTop: 28 }}>
          <h2 style={{ fontSize: 22 }}>How it works</h2>

          <div
            style={{
              border: "1px solid var(--border)",
              borderRadius: 14,
              padding: 18,
              background: "var(--panel)",
            }}
          >
            <p style={{ margin: 0, color: "#333333", fontSize: 15, lineHeight: 1.65 }}>
            Montgomery Civic Intelligence adds an AI-powered insight layer to the City’s 
            open permit data. Leveraging Bright Data infrastructure for reliable public 
            data access and structured retrieval, the system transforms raw permit 
            records into clear trend summaries and structured civic signals. 
            Each response includes transparency indicators, such as date-window reliability 
            and geographic coverage. Enabling users to evaluate both the insight and its 
            confidence level.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}