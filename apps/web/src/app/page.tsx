import { getHealth } from "@/lib/api";

// Reads live API state at request time (not build time).
export const dynamic = "force-dynamic";

export default async function Home() {
  let health: string;
  try {
    const res = await getHealth();
    health = res.status;
  } catch (err) {
    health = `unreachable (${err instanceof Error ? err.message : "error"})`;
  }

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">homejobboard</h1>
      <p className="mt-2 text-gray-600">
        Single-user job aggregator — just-listed jobs, LLM-scored for fitness and ranked.
      </p>
      <p className="mt-6 text-sm">
        API health: <span className="font-mono">{health}</span>
      </p>
    </main>
  );
}
