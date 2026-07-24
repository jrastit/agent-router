const loop = ["Discover", "Compare", "Select", "Pay", "Verify", "Deliver", "Record"];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-20 sm:px-10">
      <p className="mb-5 text-sm font-semibold uppercase tracking-[0.24em] text-cyan-300">
        System healthy
      </p>
      <h1 className="max-w-3xl text-5xl font-semibold tracking-tight text-white sm:text-7xl">
        The economic decision layer for autonomous agents.
      </h1>
      <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
        AgentRouter discovers providers, enforces policy, routes execution, and
        preserves verifiable evidence of every decision and payment.
      </p>
      <ol className="mt-12 flex flex-wrap gap-3" aria-label="Agent commerce loop">
        {loop.map((step, index) => (
          <li
            className="rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200"
            key={step}
          >
            <span className="mr-2 text-cyan-400">{index + 1}</span>
            {step}
          </li>
        ))}
      </ol>
    </main>
  );
}
