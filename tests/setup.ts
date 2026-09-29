// Vitest setup.
//
// `src/lib/proxy/client.ts` imports `next/headers` (a server-only API
// that only exists inside a Next request scope) and `react`'s `cache`.
// Node-env tests have neither, so both are stubbed here rather than in
// every test file. The cookie jar is a plain Map so tests can read back
// what the connector wrote — that is how the httpOnly assertion works.
import { vi } from "vitest";

type CookieJar = Map<string, { value: string; opts?: Record<string, unknown> }>;

const jar: CookieJar = new Map();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const hit = jar.get(name);
      return hit ? { name, value: hit.value } : undefined;
    },
    set: (name: string, value: string, opts?: Record<string, unknown>) => {
      jar.set(name, { value, opts });
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
}));

// The real `cache` is a per-request memoiser that needs React's request
// scope. A pass-through keeps the connector's call shape valid and
// makes each assertion independent, which is what a unit test wants.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

export function cookieJar(): CookieJar {
  return jar;
}

export function resetCookieJar(): void {
  jar.clear();
}
