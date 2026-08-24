import Shuttlecock from "@/components/icons/Shuttlecock";

export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" aria-busy="true">
      <div className="flex flex-col items-center gap-3">
        <Shuttlecock
          className="h-10 w-10 animate-bounce text-sky-brand-500"
          strokeWidth={1.5}
        />
        <p className="text-xs font-bold uppercase tracking-widest text-navy-700/40">
          Memuat…
        </p>
      </div>
    </div>
  );
}
