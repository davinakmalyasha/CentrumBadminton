export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" aria-busy="true">
      <div className="flex flex-col items-center gap-3">
        <span className="text-4xl animate-bounce">🏸</span>
        <p className="text-xs font-bold uppercase tracking-widest text-navy-700/40">
          Memuat…
        </p>
      </div>
    </div>
  );
}
