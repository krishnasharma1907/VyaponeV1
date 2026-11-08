export default function HomePage() {
  return (
    <div
      style={{
        padding: "var(--page-gutter-mobile)",
        maxWidth: "640px",
        margin: "0 auto",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-6)",
      }}
    >
      <header
        style={{
          paddingTop: "var(--space-6)",
        }}
      >
        <div
          style={{
            display: "inline-block",
            padding: "var(--space-1) var(--space-3)",
            backgroundColor: "var(--color-brand-primary-soft)",
            color: "var(--color-brand-primary)",
            borderRadius: "var(--radius-full)",
            fontSize: "var(--font-size-caption)",
            fontWeight: "var(--font-weight-semibold)",
            letterSpacing: "var(--letter-spacing-caption)",
            marginBottom: "var(--space-3)",
          }}
        >
          Phase P1 &bull; Design Tokens Verified
        </div>
        <h1
          style={{
            fontSize: "var(--font-size-h1)",
            lineHeight: "var(--line-height-h1)",
            letterSpacing: "var(--letter-spacing-h1)",
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-2)",
          }}
        >
          VyapOne
        </h1>
        <p
          style={{
            color: "var(--color-text-secondary)",
            fontSize: "var(--font-size-body)",
            lineHeight: "var(--line-height-body)",
          }}
        >
          Every business. One platform.
        </p>
      </header>

      {/* Surface Card Example */}
      <section
        style={{
          padding: "var(--space-5)",
          backgroundColor: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-sm)",
        }}
      >
        <h2
          style={{
            fontSize: "var(--font-size-h3)",
            lineHeight: "var(--line-height-h3)",
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-2)",
          }}
        >
          Design System &amp; Semantic Tokens
        </h2>
        <p
          style={{
            fontSize: "var(--font-size-body-sm)",
            lineHeight: "var(--line-height-body-sm)",
            color: "var(--color-text-secondary)",
            marginBottom: "var(--space-4)",
          }}
        >
          Tokens are centralized in <code>tokens.ts</code> and <code>globals.css</code>. Zero
          scattered hardcoded brand colors.
        </p>

        {/* Action Pairings adhering to WCAG 2.2 AA Contrast */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-3)",
          }}
        >
          {/* Primary CTA (White on Emerald: 6.25:1) */}
          <button
            type="button"
            style={{
              minHeight: "var(--target-control-height)",
              padding: "0 var(--space-4)",
              backgroundColor: "var(--color-brand-primary)",
              color: "var(--color-brand-primary-fg)",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--font-size-body-sm)",
              fontWeight: "var(--font-weight-medium)",
              cursor: "pointer",
            }}
          >
            Primary Action
          </button>

          {/* Accent CTA (Dark Text on Marigold: 8.27:1) */}
          <button
            type="button"
            style={{
              minHeight: "var(--target-control-height)",
              padding: "0 var(--space-4)",
              backgroundColor: "var(--color-brand-accent)",
              color: "var(--color-brand-accent-fg)",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--font-size-body-sm)",
              fontWeight: "var(--font-weight-semibold)",
              cursor: "pointer",
            }}
          >
            New Bill (Accent)
          </button>
        </div>
      </section>

      {/* Glassmorphism Navigation Shell Preview */}
      <section
        className="glass-surface"
        style={{
          padding: "var(--space-4)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <h3
          style={{
            fontSize: "var(--font-size-h4)",
            lineHeight: "var(--line-height-h4)",
            color: "var(--color-text-primary)",
            marginBottom: "var(--space-1)",
          }}
        >
          Restrained Glass Surface
        </h3>
        <p
          style={{
            fontSize: "var(--font-size-body-sm)",
            color: "var(--color-text-secondary)",
            margin: 0,
          }}
        >
          80% white opacity with 12px backdrop blur and opaque fallback.
        </p>
      </section>
    </div>
  );
}
