import { useStore } from '../store/useStore';
import { toRecords, mergeAll, changedSince, recordKey, SyncRecord, SyncState } from './sync';
import { relayTransport, serverTransport, type SyncTransport } from './syncTransport';

const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
/** Local edits are batched briefly so a burst of typing is one push. */
const PUSH_DEBOUNCE_MS = 400;

/** Close codes the server uses to say "do not just retry this". */
const FATAL_CLOSE_CODES = new Set([4401, 4409]);

/**
 * Which transport the current settings call for, or null for "nothing shared".
 *
 * Reading it from state rather than deciding at startup is what lets the user
 * switch between their own server and the encrypted relay without a reload.
 */
export function currentTransport(state = useStore.getState()): SyncTransport | null {
  if (state.backend === 'server') {
    if (!state.serverUrl || !state.authToken || !state.account?.householdId) return null;
    return serverTransport(state.serverUrl, state.authToken, state.account.householdId);
  }
  if (!state.householdSecret || !state.householdRelayUrl) return null;
  return relayTransport(state.householdSecret, state.householdRelayUrl);
}

/**
 * Keeps this device's copy of the shared collections in step with the rest of
 * the household.
 *
 * Local-first throughout: the app reads and writes its own store as before and
 * works offline. This only mirrors changes outwards and folds other people's
 * changes in.
 */
export function startHouseholdSync(): () => void {
  let socket: WebSocket | null = null;
  let stopped = false;
  let retry = RECONNECT_MIN_MS;
  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Set while applying remote rows, so our own write-back isn't re-published. */
  let applying = false;
  let transport: SyncTransport | null = null;

  const status = (s: 'off' | 'connecting' | 'live' | 'error') => {
    if (useStore.getState().syncStatus !== s) useStore.getState().setSyncStatus(s);
  };

  const collectionsNow = () => {
    const { pantryItems, recipes, shoppingItems, reminders } = useStore.getState();
    return { pantry: pantryItems, recipe: recipes, shopping: shoppingItems, reminder: reminders };
  };

  /** Fold local edits into syncState and send whatever is newly changed. */
  const publish = async () => {
    if (!transport || applying) return;
    const { syncState } = useStore.getState();

    const next = toRecords(collectionsNow(), syncState, Date.now());
    const changed = Object.entries(next).filter(([key, record]) => syncState[key] !== record);
    if (changed.length === 0) return;

    useStore.getState().applySync(next, useStore.getState().syncCursor);

    if (socket?.readyState !== WebSocket.OPEN) return; // will be re-sent on reconnect
    const rows = await transport.encode(changed.map(([key, record]) => ({ key, record })));
    socket.send(JSON.stringify({ type: 'push', records: rows }));
  };

  const schedulePublish = () => {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void publish(), PUSH_DEBOUNCE_MS);
  };

  const receive = async (rows: unknown[]) => {
    if (!transport || rows.length === 0) return;

    const { records, cursor } = await transport.decode(rows, useStore.getState().syncCursor);
    if (records.length === 0) {
      useStore.getState().applySync(useStore.getState().syncState, cursor);
      return;
    }

    applying = true;
    try {
      useStore.getState().applySync(mergeAll(useStore.getState().syncState, records), cursor);
    } finally {
      applying = false;
    }
  };

  /** Everything this device knows that the other end has not acknowledged. */
  const pushBacklog = async () => {
    if (!transport || socket?.readyState !== WebSocket.OPEN) return;
    const { syncState } = useStore.getState();

    const rows = await transport.encode(
      changedSince(syncState, 0).map((record) => ({
        key: recordKey(record.kind, record.id),
        record,
      }))
    );
    if (rows.length > 0) socket.send(JSON.stringify({ type: 'push', records: rows }));
  };

  const connect = async () => {
    if (stopped) return;
    transport = currentTransport();
    if (!transport) {
      status('off');
      return;
    }

    status('connecting');
    let url: string;
    try {
      url = await transport.socketUrl();
    } catch {
      status('error');
      return;
    }
    if (stopped) return;

    const ws = new WebSocket(url);
    socket = ws;
    const cursor = useStore.getState().syncCursor;

    ws.onopen = () => {
      retry = RECONNECT_MIN_MS;
      status('live');
      ws.send(JSON.stringify({ type: 'pull', since: cursor }));
      void pushBacklog();
    };

    ws.onmessage = (event) => {
      let message: { type?: string; records?: unknown[] };
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (message.type === 'records' && Array.isArray(message.records)) void receive(message.records);
    };

    const reconnect = (event?: CloseEvent) => {
      if (stopped || socket !== ws) return;
      socket = null;
      status('error');
      // A rejected token or a missing household will be rejected again just as
      // fast; retrying in a loop would only burn battery. The user has to fix
      // it in settings, and changing settings reconnects on its own.
      if (event && FATAL_CLOSE_CODES.has(event.code)) return;
      reconnectTimer = setTimeout(() => void connect(), retry);
      retry = Math.min(retry * 2, RECONNECT_MAX_MS);
    };

    ws.onclose = (event) => reconnect(event);
    ws.onerror = () => reconnect();
  };

  // Reconnect when the backend, household or account changes, and publish
  // whenever the shared collections move.
  let lastIdentity = currentTransport()?.identity ?? '';
  const unsubscribe = useStore.subscribe((state) => {
    const identity = currentTransport(state)?.identity ?? '';
    if (identity !== lastIdentity) {
      lastIdentity = identity;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
      socket = null;
      void connect();
      return;
    }
    if (identity) schedulePublish();
  });

  void connect();

  return () => {
    stopped = true;
    unsubscribe();
    if (pushTimer) clearTimeout(pushTimer);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
    socket = null;
  };
}

export type { SyncState, SyncRecord };
