// Staff registration via the proxy (owner session attached).
import { proxyFetch } from "@/lib/proxy/client";

export async function proxyRegister(args: {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
}): Promise<{ data: { id: string } | null; error: { message?: string; status?: number } | null }> {
  try {
    const data = await proxyFetch<{ user: { id: string } }>("/v1/auth/register", {
      method: "POST",
      body: args,
    });
    return { data: { id: data.user.id }, error: null };
  } catch (e) {
    return {
      data: null,
      error: {
        message: e instanceof Error ? e.message : "unknown",
        status: (e as { status?: number }).status,
      },
    };
  }
}
