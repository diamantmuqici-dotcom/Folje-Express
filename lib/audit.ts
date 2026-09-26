import { readLogs, writeLogs, type LogEntry } from "./store";
import type { Session } from "./auth";

/** Append an entry to the immutable-ish audit trail (newest first, cap 1000). */
export async function audit(session: Session | null, action: string, detail: string, ip: string) {
  const entry: LogEntry = {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actor: session?.username || "anonim",
    role: session?.role || "-",
    action,
    detail: detail.slice(0, 300),
    ip,
  };
  const logs = await readLogs();
  logs.unshift(entry);
  await writeLogs(logs);
}
