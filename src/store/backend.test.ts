import { beforeEach, describe, expect, it } from 'vitest';
import { migratePersistedState, useStore, type Reminder } from './useStore';
import { currentTransport } from '../utils/syncEngine';
import { createHouseholdSecret } from '../utils/household';
import type { ServerAccount, ServerHousehold } from '../utils/serverApi';

const account = (over: Partial<ServerAccount> = {}): ServerAccount => ({
  id: 'u1',
  handle: 'ali',
  displayName: 'علی',
  friendCode: 'ACDEFGHJ',
  householdId: null,
  ...over,
});

const household = (over: Partial<ServerHousehold> = {}): ServerHousehold => ({
  id: 'h1',
  name: 'خانهٔ ما',
  inviteCode: 'ACDEFGHJKMNP',
  cursor: 0,
  members: [],
  ...over,
});

beforeEach(() => {
  useStore.setState({
    backend: 'server',
    serverUrl: '',
    authToken: '',
    account: null,
    serverHousehold: null,
    pushEnabled: false,
    householdSecret: '',
    householdRelayUrl: '',
    syncState: {},
    syncCursor: 0,
    syncStatus: 'off',
    reminders: [],
  });
});

describe('choosing a backend', () => {
  it('shares nothing until something is configured', () => {
    expect(currentTransport(useStore.getState())).toBeNull();
  });

  it('needs a server, a token and a household before it will sync', () => {
    const store = useStore.getState();
    store.setServerUrl('https://a.com');
    store.setServerSession('tok', account(), null);
    expect(currentTransport(useStore.getState())).toBeNull();

    useStore.getState().setServerHousehold(household());
    expect(currentTransport(useStore.getState())?.identity).toContain('server|');
  });

  it('uses the encrypted relay when that is the chosen backend', () => {
    const secret = createHouseholdSecret();
    const store = useStore.getState();
    store.setBackend('relay');
    store.joinHousehold(secret, 'https://relay.example.com');
    expect(currentTransport(useStore.getState())?.identity).toContain('relay|');
  });

  it('ignores server credentials while the relay is selected, and the reverse', () => {
    const store = useStore.getState();
    store.setServerUrl('https://a.com');
    store.setServerSession('tok', account({ householdId: 'h1' }), household());
    store.joinHousehold(createHouseholdSecret(), 'https://relay.example.com');

    useStore.getState().setBackend('relay');
    expect(currentTransport(useStore.getState())?.identity).toContain('relay|');

    useStore.getState().setBackend('server');
    expect(currentTransport(useStore.getState())?.identity).toContain('server|');
  });

  it('drops the row history when the backend changes', () => {
    useStore.setState({ syncState: { 'pantry:p1': { kind: 'pantry', id: 'p1', updatedAt: 1 } }, syncCursor: 9 });
    useStore.getState().setBackend('relay');
    // A cursor from one backend means nothing to the other — keeping it would
    // skip everything the new backend has.
    expect(useStore.getState().syncState).toEqual({});
    expect(useStore.getState().syncCursor).toBe(0);
  });
});

describe('a server session', () => {
  it('records the account and adopts the household the server reports', () => {
    useStore.getState().setServerSession('tok', account(), household({ id: 'h9' }));
    expect(useStore.getState().authToken).toBe('tok');
    expect(useStore.getState().serverHousehold?.id).toBe('h9');
  });

  it('keeps the account’s household id in step when it joins or leaves one', () => {
    useStore.getState().setServerSession('tok', account(), null);
    useStore.getState().setServerHousehold(household({ id: 'h2' }));
    expect(useStore.getState().account?.householdId).toBe('h2');

    useStore.getState().setServerHousehold(null);
    expect(useStore.getState().account?.householdId).toBeNull();
    expect(currentTransport(useStore.getState())).toBeNull();
  });

  it('forgets everything about the server on sign-out', () => {
    useStore.getState().setServerSession('tok', account({ householdId: 'h1' }), household());
    useStore.getState().setPushEnabled(true);
    useStore.getState().clearServerSession();

    const state = useStore.getState();
    expect(state.authToken).toBe('');
    expect(state.account).toBeNull();
    expect(state.serverHousehold).toBeNull();
    expect(state.pushEnabled).toBe(false);
    expect(state.syncStatus).toBe('off');
  });

  it('leaves the local pantry alone on sign-out — the data is still yours', () => {
    useStore.setState({ reminders: [{ id: 'r1', text: 'x', day: 'شنبه', time: '۹:۰۰', type: 'خرید', completed: false }] });
    useStore.getState().clearServerSession();
    expect(useStore.getState().reminders).toHaveLength(1);
  });
});

describe('migration to v3', () => {
  const legacy = (over: Partial<Reminder> = {}): Reminder => ({
    id: 'r1',
    text: 'ماست بگیر',
    day: 'شنبه',
    time: '۱۹:۰۰',
    type: 'خرید',
    completed: false,
    ...over,
  });

  it('gives an old reminder an absolute due time so it can notify', () => {
    const migrated = migratePersistedState({ reminders: [legacy()] }, 2) as { reminders: Reminder[] };
    expect(migrated.reminders[0].dueAt).toBeTypeOf('number');
    expect(migrated.reminders[0].dueAt as number).toBeGreaterThan(Date.now());
  });

  it('leaves a reminder that already has one untouched', () => {
    const migrated = migratePersistedState({ reminders: [legacy({ dueAt: 123 })] }, 2) as {
      reminders: Reminder[];
    };
    expect(migrated.reminders[0].dueAt).toBe(123);
  });

  it('leaves it undefined rather than inventing a time it cannot parse', () => {
    const migrated = migratePersistedState({ reminders: [legacy({ day: 'بعداً' })] }, 2) as {
      reminders: Reminder[];
    };
    expect(migrated.reminders[0].dueAt).toBeUndefined();
  });

  it('still upgrades expiry countdowns on the way through', () => {
    const migrated = migratePersistedState(
      { pantryItems: [{ id: 'p1', name: 'شیر', expiryDays: 3 }], reminders: [legacy()] },
      1
    ) as { pantryItems: { expiryDate?: string }[]; reminders: Reminder[] };
    expect(migrated.pantryItems[0].expiryDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(migrated.reminders[0].dueAt).toBeTypeOf('number');
  });

  it('does nothing to state already at v3', () => {
    const state = { reminders: [legacy()] };
    expect(migratePersistedState(state, 3)).toBe(state);
  });

  it('survives state with no reminders at all', () => {
    expect(migratePersistedState({}, 1)).toEqual({});
    expect(migratePersistedState(null, 1)).toBeNull();
  });
});
