// Next.js runs this once when the server process boots, which is where the
// daily recap scheduler gets attached. It must not run in the edge runtime or
// during the production build.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  const { startRecapScheduler } = await import('./lib/recap-scheduler');
  startRecapScheduler();
}
