export const dynamic = "force-dynamic";

export default function ComparePage() {
  return (
    <main className="mx-auto max-w-6xl p-8">
      <h1 className="mb-4 text-2xl font-semibold">Compare runs</h1>
      <p className="text-sm text-zinc-500">
        Select up to 4 runs from the history table; pass their ids as <code>?ids=a,b,c</code> to compare. (Selection UI lands in a follow-up.)
      </p>
    </main>
  );
}
