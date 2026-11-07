import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from '../store/useStore';
import { currentTransport } from './syncEngine';
import type { ServerAccount, ServerHousehold } from './serverApi';

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
    authToken: '',
    account: null,
    serverHousehold: null,
    syncState: {},
    syncCursor: 0,
    syncStatus: 'off',
    reminders: [],
  });
});

describe('currentTransport', () => {
  it('shares nothing while signed out', () => {
    expect(currentTransport(useStore.getState())).toBeNull();
  });

  it('needs both a token and a kitchen before it will sync', () => {
    useStore.getState().setServerSession('tok', account(), null);
    expect(currentTransport(useStore.getState())).toBeNull();

    useStore.getState().setServerHousehold(household());
    expect(currentTransport(useStore.getState())?.identity).toContain('server|');
  });

  it('reconnects when the kitchen changes', () => {
    useStore.getState().setServerSession('tok', account(), household({ id: 'h1' }));
    const first = currentTransport(useStore.getState())?.identity;

    useStore.getState().setServerHousehold(household({ id: 'h2' }));
    expect(currentTransport(useStore.getState())?.identity).not.toBe(first);
  });
});

describe('a server session', () => {
  it('records the account and adopts the kitchen the server reports', () => {
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

  it('drops the row history when the kitchen changes', () => {
    useStore.setState({
      syncState: { 'pantry:p1': { kind: 'pantry', id: 'p1', updatedAt: 1 } },
      syncCursor: 9,
    });
    useStore.getState().setServerHousehold(household());

    // A cursor from another kitchen means nothing to this one — keeping it
    // would skip everything the new kitchen already has.
    expect(useStore.getState().syncState).toEqual({});
    expect(useStore.getState().syncCursor).toBe(0);
  });

  it('forgets everything about the server on sign-out', () => {
    useStore.getState().setServerSession('tok', account({ householdId: 'h1' }), household());
    useStore.getState().clearServerSession();

    const state = useStore.getState();
    expect(state.authToken).toBe('');
    expect(state.account).toBeNull();
    expect(state.serverHousehold).toBeNull();
    expect(state.syncStatus).toBe('off');
  });

  it('leaves the local pantry alone on sign-out — the data is still yours', () => {
    useStore.setState({
      reminders: [{ id: 'r1', text: 'x', day: 'شنبه', time: '۹:۰۰', type: 'خرید', completed: false }],
    });
    useStore.getState().clearServerSession();
    expect(useStore.getState().reminders).toHaveLength(1);
  });
});
