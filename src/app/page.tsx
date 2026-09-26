export default function Home() {
  return (
    <main style={{padding: 40, textAlign: 'center', background: '#020617', color: 'white', minHeight: '100vh'}}>
      <h1 style={{fontSize: 40, fontWeight: 800}}>🧠 CAISY BRAIN</h1>
      <p style={{marginTop: 20, color: '#94a3b8'}}>Your Second Brain</p>
      <div style={{marginTop: 30}}>
        <a href="/workspace" style={{background: '#4f46e5', padding: '12px 24px', borderRadius: 12, color: 'white', textDecoration: 'none', fontWeight: 600}}>
          Enter Workspace →
        </a>
      </div>
    </main>
  );
}
