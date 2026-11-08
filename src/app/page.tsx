export default function HomePage() {
  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
        maxWidth: "600px",
        margin: "0 auto",
      }}
    >
      <header>
        <h1 style={{ color: "#0F5132", fontSize: "1.75rem", marginBottom: "0.5rem" }}>VyapOne</h1>
        <p style={{ color: "#4B5563", fontSize: "1rem", lineHeight: "1.5" }}>
          Digital Operating Platform for Local Businesses and Reseller Agencies.
        </p>
      </header>
      <section
        style={{
          marginTop: "2rem",
          padding: "1rem",
          backgroundColor: "#F3F4F6",
          borderRadius: "8px",
        }}
      >
        <h2 style={{ fontSize: "1.1rem", color: "#1F2937", marginBottom: "0.5rem" }}>
          Application Foundation Operational
        </h2>
        <p style={{ fontSize: "0.9rem", color: "#4B5563", margin: 0 }}>
          Phase P1 Workspace Scaffolding (Task VO-010) successfully initialized.
        </p>
      </section>
    </div>
  );
}
