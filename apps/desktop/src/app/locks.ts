import { useCallback, useEffect, useRef, useState } from "react";

export type LockRecord = {
  id: string;
  label: string;
  method: string;
  salt: string;
  pin?: string;
  password?: string;
  codeSecret?: string;
  createdAt: number;
  failures: number;
  lockedUntil: number;
  ladder: number[];
};
export type Ticket = { id: string; subject: string; body: string; at: number; resolved: boolean };
export type LockStore = {
  locks: Record<string, LockRecord>;
  tickets: Record<string, Ticket>;
  ready: boolean;
  folder: string;
  save: (record: LockRecord | null, id: string) => Promise<void>;
  saveTicket: (ticket: Ticket) => Promise<void>;
  openFolder: () => Promise<boolean>;
};

const bridge = () => window.materialBrowser?.elementLocks;
async function read(kind: "locks" | "tickets") {
  const service = bridge();
  if (service) return (await service("read", { kind })) || {};
  try {
    return JSON.parse(localStorage.getItem(`element-${kind}`) || "{}");
  } catch {
    return {};
  }
}
async function write(kind: "locks" | "tickets", value: Record<string, unknown>) {
  const service = bridge();
  if (service) return service("write", { kind, value });
  localStorage.setItem(`element-${kind}`, JSON.stringify(value));
}

/** Loads element locks and tickets from their own folder (outside the vault). */
export function useLockStore(): LockStore {
  const [locks, setLocks] = useState<Record<string, LockRecord>>({});
  const [tickets, setTickets] = useState<Record<string, Ticket>>({});
  const [ready, setReady] = useState(false);
  const [folder, setFolder] = useState("");
  const latest = useRef({ locks, tickets });
  latest.current = { locks, tickets };
  useEffect(() => {
    let live = true;
    Promise.all([read("locks"), read("tickets"), bridge()?.("folder").catch(() => null)])
      .then(([l, tk, f]) => {
        if (!live) return;
        setLocks(l || {});
        setTickets(tk || {});
        setFolder(f?.path || "");
        setReady(true);
      })
      .catch(() => live && setReady(true));
    return () => {
      live = false;
    };
  }, []);
  const save = useCallback(async (record: LockRecord | null, id: string) => {
    const next = { ...latest.current.locks };
    if (record) next[id] = record;
    else delete next[id];
    await write("locks", next);
    setLocks(next);
  }, []);
  const saveTicket = useCallback(async (ticket: Ticket) => {
    const next = { ...latest.current.tickets, [ticket.id]: ticket };
    await write("tickets", next);
    setTickets(next);
  }, []);
  const openFolder = useCallback(async () => {
    const result = await bridge()?.("open");
    return result?.ok === true;
  }, []);
  return { locks, tickets, ready, folder, save, saveTicket, openFolder };
}
