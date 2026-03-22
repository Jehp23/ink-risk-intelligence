export default function PrivacyPolicy() {
  return (
    <main style={{
      maxWidth: 680,
      margin: "0 auto",
      padding: "60px 24px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      color: "#f0ecf8",
      background: "#080612",
      minHeight: "100vh",
      lineHeight: 1.7,
    }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: 40, fontSize: 14 }}>
        Last updated: March 2026
      </p>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Overview</h2>
        <p style={{ color: "rgba(255,255,255,0.7)" }}>
          Ink ("we", "our", "the extension") is a browser extension that analyzes Avalanche
          smart contract addresses found on web pages and displays risk scores inline.
          We are committed to protecting your privacy.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Data We Collect</h2>
        <p style={{ color: "rgba(255,255,255,0.7)" }}>
          We do not collect any personal data. The extension does not collect, store, or
          transmit any information that can identify you as an individual.
        </p>
        <p style={{ color: "rgba(255,255,255,0.7)", marginTop: 12 }}>
          When you hover over a smart contract address, that address (a public blockchain
          identifier) is sent to our backend API solely to retrieve its on-chain risk analysis.
          Contract addresses are public data and are not linked to any personal identity.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Local Storage</h2>
        <p style={{ color: "rgba(255,255,255,0.7)" }}>
          Analysis results are cached locally in your browser using{" "}
          <code style={{ background: "rgba(255,255,255,0.08)", padding: "1px 6px", borderRadius: 4, fontSize: 13 }}>
            chrome.storage.local
          </code>{" "}
          to avoid redundant API calls. This data never leaves your device and can be
          cleared at any time from the extension popup.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Third-Party Services</h2>
        <p style={{ color: "rgba(255,255,255,0.7)" }}>
          The extension communicates with our backend API hosted at{" "}
          <code style={{ background: "rgba(255,255,255,0.08)", padding: "1px 6px", borderRadius: 4, fontSize: 13 }}>
            ink-backend-mkis.onrender.com
          </code>
          , which fetches publicly available on-chain data from the Avalanche blockchain.
          No user data is included in these requests.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Data Sharing</h2>
        <p style={{ color: "rgba(255,255,255,0.7)" }}>
          We do not sell, trade, or transfer any data to third parties. We do not use
          any data for advertising, profiling, or any purpose unrelated to smart contract
          risk analysis.
        </p>
      </section>

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>Contact</h2>
        <p style={{ color: "rgba(255,255,255,0.7)" }}>
          If you have any questions about this policy, you can reach us at{" "}
          <a href="mailto:contact@ink-risk.xyz" style={{ color: "rgba(139,92,246,0.9)" }}>
            contact@ink-risk.xyz
          </a>.
        </p>
      </section>

      <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 24 }}>
        Ink — Smart Contract Risk Analyzer
      </p>
    </main>
  );
}
