import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Montgomery Civic Intelligence",
  description: "Data-backed civic summaries powered by Montgomery’s open data.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <style precedence="default" href="mci-layout-styles">{`
          :root {
            --foreground: #002b5c; /* Navy */
            --panel: #ffffff;      /* White */
            --panel-soft: #f8f9fa; /* Light gray */
            --border: #d3d3d3;     /* Border gray */
            --muted: #6c757d;      /* Muted text */
            --muted-2: #adb5bd;    /* Lighter muted */
            --link-color: #007ac2; /* Link blue */
            --body-text: #333333;  /* Body text */
          }

          /* Global defaults (tiny polish: consistent text rendering + colors) */
          html, body {
            color: var(--body-text);
            background: var(--panel-soft);
            text-rendering: optimizeLegibility;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }

          .topnav-link {
            font-size: 14px;
            font-weight: 800;
            color: var(--foreground);
            text-decoration: none;
            white-space: nowrap;
            padding: 8px 10px;
            border-radius: 10px;
            border: 1px solid transparent;
            display: inline-block;
            transition: background 0.15s ease, border-color 0.15s ease, transform 0.06s ease;
          }
          .topnav-link:hover {
            background: var(--panel-soft);
            border-color: var(--border);
            transform: translateY(-1px);
          }
          .topnav-link:active {
            transform: translateY(0px);
          }
          .topnav-link:focus-visible {
            outline: 2px solid var(--link-color);
            outline-offset: 2px;
          }

          .brand-link {
            color: inherit;
            text-decoration: none;
            display: inline-block;
            border-radius: 10px;
            padding: 6px 8px;
            margin-left: -8px;
            transition: background 0.15s ease;
          }
          .brand-link:hover {
            background: var(--panel-soft);
          }
          .brand-link:focus-visible {
            outline: 2px solid var(--link-color);
            outline-offset: 2px;
          }

          .shell {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
          }

          .content {
            flex: 1;
          }

          .container {
            max-width: 980px;
            margin: 0 auto;
          }

          /* ✅ Hover polish for cards across the app */
          .portal-card {
            transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
          }
          .portal-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 22px rgba(0,0,0,0.08);
            border-color: rgba(0,0,0,0.10);
          }

          /* Tiny polish: make the meta pill consistent everywhere if present */
          .meta-pill {
            font-size: 13px;
            color: var(--body-text);
            background: var(--panel-soft);
            border: 1px solid var(--border);
            border-radius: 999px;
            padding: 6px 10px;
            white-space: normal;
            overflow-wrap: anywhere;
            line-height: 1.35;
          }

          /* Tiny polish: slightly tighter vertical rhythm on small screens */
          @media (max-width: 520px) {
            .container {
              padding-left: 0;
              padding-right: 0;
            }
          }
        `}</style>

        <div className="shell">
          <header
            style={{
              borderBottom: "1px solid var(--border)",
              background: "var(--panel)",
            }}
          >
            <div
              className="container"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 16,
                padding: "16px 24px",
                flexWrap: "wrap",
              }}
            >
              {/* Brand */}
              <div
                style={{
                  fontWeight: 900,
                  fontSize: 18,
                  lineHeight: 1.2,
                  color: "var(--foreground)",
                  whiteSpace: "nowrap",
                }}
              >
                <Link href="/" className="brand-link" aria-label="Go to home">
                  Montgomery Civic Intelligence
                </Link>
              </div>

              {/* Navigation */}
              <nav
                style={{
                  display: "flex",
                  gap: 18,
                  alignItems: "center",
                  flexWrap: "wrap",
                  rowGap: 10,
                  justifyContent: "flex-end",
                }}
                aria-label="Primary navigation"
              >
                <Link href="/assistant" className="topnav-link">
                  Explore Data
                </Link>
                <Link href="/about" className="topnav-link">
                  About
                </Link>
              </nav>
            </div>
          </header>

          <main className="content">
            <div className="container" style={{ padding: 24 }}>
              {children}
            </div>
          </main>

          <footer
            style={{
              borderTop: "1px solid var(--border)",
              background: "var(--panel)",
            }}
          >
            <div
              className="container"
              style={{
                padding: "16px 24px",
                color: "var(--muted)",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              {/* ✅ Simplified footer copy */}
              <span>Powered by Montgomery Open Data</span>
              <span style={{ opacity: 0.9 }}>Easy civic insights</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}