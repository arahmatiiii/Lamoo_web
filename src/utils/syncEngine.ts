import { useStore } from '../store/useStore';
import { encryptJson, decryptJson, roomIdFor, rowKeyFor, relaySocketUrl } from './household';
import { toRecords, mergeAll, changedSince, recordKey, SyncRecord, SyncState } from './sync';

interface RelayRow {
  key: string;
  payload: string;
  seq: number;
}

const RECONNECT_MIN_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;
/** Local edits are batched briefly so a burst of typing is one push. */
const PUSH_DEBOUNCE_MS = 400;

/**
 * Keeps this device's copy of the shared collections in step with the rest of
 * the household.
 *
 * Local-first throughout: the app reads and writes its own store as before and
 * works offline. This only mirrors changes outwards and folds other people's
 * changes in. Everything on the wire is encrypted with the household secret,
 * so the relay is a dumb pipe.
 */
export function startHouseholdSync(): () => void {
  let socket: WebSocket | null = null;
  let stopped = false;
  let retry = RECONNECT_MIN_MS;
  let pushTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Set while applying remote rows, so our own write-back isn't re-published. */
  let applying = false;

  const status = (s: 'off' | 'connecting' | 'live' | 'error') => {
    if (useStore.getState().syncStatus !== s) useStore.getState().setSyncStatus(s);
  };

  const collectionsNow = () => {
    const { pantryItems, recipes, shoppingItems, reminders } = useStore.getState();
    return { pantry: pantryItems, recipe: recipes, shopping: shoppingItems, reminder: reminders };
  };

  /** Fold local edits into syncState and send whatever is newly changed. */
  const publish = async () => {
    const { householdSecret, syncState } = useStore.getState();
    if (!householdSecret || applying) return;

    const next = toRecords(collectionsNow(), syncState, Date.now());
    const changed = Object.entries(next).filter(([key, record]) => syncState[key] !== record);
    if (changed.length === 0) return;

    useStore.getState().applySync(next, useStore.getState().syncCursor);

    if (socket?.readyState !== WebSocket.OPEN) return; // will be re-sent on reconnect
    const rows = await Promise.all(
      changed.map(async ([key, record]) => ({
        key: await rowKeyFor(householdSecret, key),
        payload: await encryptJson(householdSecret, record),
      }))
    );
    socket.send(JSON.stringify({ type: 'push', records: rows }));
  };

  const schedulePublish = () => {
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void publish(), PUSH_DEBOUNCE_MS);
  };

  const receive = async (rows: RelayRow[]) => {
    const { householdSecret } = useStore.getState();
    if (!householdSecret || rows.length === 0) return;

    const incoming: SyncRecord[] = [];
    for (const row of rows) {
      try {
        incoming.push(await decryptJson<SyncRecord>(householdSecret, row.payload));
      } catch {
        // Not ours to read — a stale row from a previous household secret.
      }
    }

    const cursor = Math.max(useStore.getState().syncCursor, ...rows.map((r) => r.seq));
    if (incoming.length === 0) {
      useStore.getState().applySync(useStore.getState().syncState, cursor);
      return;
    }

    applying = true;
    try {
      useStore.getState().applySync(mergeAll(useStore.getState().syncState, incoming), cursor);
    } finally {
      applying = false;
    }
  };

  /** Everything this device knows that the relay has not acknowledged. */
  const pushBacklog = async () => {
    const { householdSecret, syncState } = useStore.getState();
    if (!householdSecret || socket?.readyState !== WebSocket.OPEN) return;

    const rows = await Promise.all(
      changedSince(syncState, 0).map(async (record) => ({
        key: await rowKeyFor(householdSecret, recordKey(record.kind, record.id)),
        payload: await encryptJson(householdSecret, record),
      }))
    );
    if (rows.length > 0) socket.send(JSON.stringify({ type: 'push', records: rows }));
  };

  const connect = async () => {
    if (stopped) return;
    const { householdSecret, householdRelayUrl, syncCursor } = useStore.getState();
    if (!householdSecret || !householdRelayUrl) {
      status('off');
      return;
    }

    status('connecting');
    let url: string;
    try {
      url = relaySocketUrl(householdRelayUrl, await roomIdFor(householdSecret));
    } catch {
      status('error');
      return;
    }

    const ws = new WebSocket(url);
    socket = ws;

    ws.onopen = () => {
      retry = RECONNECT_MIN_MS;
      status('live');
      ws.send(JSON.stringify({ type: 'pull', since: syncCursor }));
      void pushBacklog();
    };

    ws.onmessage = (event) => {
      let message: { type?: string; records?: RelayRow[] };
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (message.type === 'records' && Array.isArray(message.records)) void receive(message.records);
    };

    const reconnect = () => {
      if (stopped || socket !== ws) return;
      socket = null;
      status('error');
      reconnectTimer = setTimeout(() => void connect(), retry);
      retry = Math.min(retry * 2, RECONNECT_MAX_MS);
    };

    ws.onclose = reconnect;
    ws.onerror = reconnect;
  };

  // Reconnect when the household or relay changes, and whenever the shared
  // collections move.
  let lastIdentity = '';
  const unsubscribe = useStore.subscribe((state) => {
    const identity = `${state.householdSecret}|${state.householdRelayUrl}`;
    if (identity !== lastIdentity) {
      lastIdentity = identity;
      socket?.close();
      socket = null;
      void connect();
      return;
    }
    if (state.householdSecret) schedulePublish();
  });

  lastIdentity = (() => {
    const s = useStore.getState();
    return `${s.householdSecret}|${s.householdRelayUrl}`;
  })();
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

/** Exported for tests: the shape the relay stores. */
export type { RelayRow, SyncState };
