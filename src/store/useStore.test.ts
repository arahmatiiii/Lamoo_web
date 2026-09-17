import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useStore, migratePersistedState, PantryItem, ShoppingItem } from './useStore';

const pantryItem = (over: Partial<PantryItem> = {}): PantryItem => ({
  id: 'p1',
  name: 'پیاز',
  category: 'سایر',
  amount: '2',
  unit: 'عدد',
  emoji: '🧅',
  available: true,
  ...over,
});

const shoppingItem = (over: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id: 's1',
  name: 'پیاز',
  amount: '2',
  unit: 'عدد',
  emoji: '🧅',
  purchased: false,
  ...over,
});

beforeEach(() => {
  useStore.setState({ pantryItems: [], shoppingItems: [], recipes: [] });
});

describe('purchaseShoppingItem', () => {
  it('marks the item bought and stocks it in the pantry', () => {
    useStore.setState({ shoppingItems: [shoppingItem()] });

    expect(useStore.getState().purchaseShoppingItem('s1')).toBe(true);

    const { shoppingItems, pantryItems } = useStore.getState();
    expect(shoppingItems[0].purchased).toBe(true);
    expect(pantryItems).toHaveLength(1);
    expect(pantryItems[0]).toMatchObject({ name: 'پیاز', amount: '2', unit: 'عدد', available: true });
  });

  it('restocks a matching pantry item instead of duplicating it', () => {
    useStore.setState({
      pantryItems: [pantryItem({ available: false, amount: '0' })],
      shoppingItems: [shoppingItem({ amount: '5' })],
    });

    useStore.getState().purchaseShoppingItem('s1');

    const { pantryItems } = useStore.getState();
    expect(pantryItems).toHaveLength(1);
    expect(pantryItems[0]).toMatchObject({ id: 'p1', available: true, amount: '5' });
  });

  it('does nothing for an item that was already bought', () => {
    useStore.setState({ shoppingItems: [shoppingItem({ purchased: true })] });

    expect(useStore.getState().purchaseShoppingItem('s1')).toBe(false);
    expect(useStore.getState().pantryItems).toHaveLength(0);
  });

  it('ignores an unknown id', () => {
    expect(useStore.getState().purchaseShoppingItem('nope')).toBe(false);
    expect(useStore.getState().pantryItems).toHaveLength(0);
  });
});

describe('consumePantryItems', () => {
  it('marks matching items used up and reports them for undo', () => {
    useStore.setState({
      pantryItems: [pantryItem(), pantryItem({ id: 'p2', name: 'گوجه', emoji: '🍅' })],
    });

    const emptied = useStore.getState().consumePantryItems(['پیاز']);

    expect(emptied).toEqual(['p1']);
    const items = useStore.getState().pantryItems;
    expect(items.find((p) => p.id === 'p1')?.available).toBe(false);
    expect(items.find((p) => p.id === 'p2')?.available).toBe(true);
  });

  it('matches a parenthesised pantry name against a plain ingredient', () => {
    useStore.setState({ pantryItems: [pantryItem({ name: 'میگو (فریز)' })] });

    expect(useStore.getState().consumePantryItems(['میگو'])).toEqual(['p1']);
  });

  it('never consumes one pantry item twice for two ingredients', () => {
    useStore.setState({ pantryItems: [pantryItem({ name: 'فلفل' })] });

    expect(useStore.getState().consumePantryItems(['فلفل', 'فلفل'])).toEqual(['p1']);
  });

  it('skips items that are already used up', () => {
    useStore.setState({ pantryItems: [pantryItem({ available: false })] });

    expect(useStore.getState().consumePantryItems(['پیاز'])).toEqual([]);
  });

  it('returns nothing when no ingredient matches', () => {
    useStore.setState({ pantryItems: [pantryItem()] });

    expect(useStore.getState().consumePantryItems(['زعفران'])).toEqual([]);
    expect(useStore.getState().pantryItems[0].available).toBe(true);
  });
});

describe('restorePantryItems', () => {
  it('undoes a cook, putting the items back', () => {
    useStore.setState({ pantryItems: [pantryItem(), pantryItem({ id: 'p2', name: 'گوجه' })] });

    const emptied = useStore.getState().consumePantryItems(['پیاز', 'گوجه']);
    useStore.getState().restorePantryItems(emptied);

    expect(useStore.getState().pantryItems.every((p) => p.available)).toBe(true);
  });

  it('leaves items it was not given alone', () => {
    useStore.setState({ pantryItems: [pantryItem({ available: false })] });

    useStore.getState().restorePantryItems(['other-id']);

    expect(useStore.getState().pantryItems[0].available).toBe(false);
  });
});

describe('migratePersistedState', () => {
  afterEach(() => vi.useRealTimers());

  it('anchors a v1 countdown to a fixed date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-10T12:00:00'));

    const migrated = migratePersistedState(
      { pantryItems: [{ ...pantryItem(), expiryDays: 4, expiryDate: undefined }] },
      1
    ) as { pantryItems: PantryItem[] };

    expect(migrated.pantryItems[0].expiryDate).toBe('2026-03-14');
    expect(migrated.pantryItems[0]).not.toHaveProperty('expiryDays');
  });

  it('leaves items that never had an expiry without a date', () => {
    const migrated = migratePersistedState({ pantryItems: [pantryItem()] }, 1) as {
      pantryItems: PantryItem[];
    };

    expect(migrated.pantryItems[0].expiryDate).toBeUndefined();
  });

  it('keeps the rest of the persisted state intact', () => {
    const migrated = migratePersistedState({ pantryItems: [], userName: 'علی', theme: 'dark' }, 1);

    expect(migrated).toMatchObject({ userName: 'علی', theme: 'dark' });
  });

  it('does not touch state that is already on v2', () => {
    const state = { pantryItems: [{ ...pantryItem(), expiryDate: '2026-01-01' }] };

    expect(migratePersistedState(state, 2)).toBe(state);
  });

  it('tolerates junk rather than throwing during startup', () => {
    expect(migratePersistedState(null, 1)).toBeNull();
    expect(migratePersistedState({}, 1)).toEqual({});
  });
});

describe('the shop → cook → restock cycle', () => {
  it('survives a full round trip', () => {
    useStore.setState({ shoppingItems: [shoppingItem()] });

    // Bought it — now in the pantry.
    useStore.getState().purchaseShoppingItem('s1');
    expect(useStore.getState().pantryItems[0].available).toBe(true);

    // Cooked with it — used up.
    const emptied = useStore.getState().consumePantryItems(['پیاز']);
    expect(useStore.getState().pantryItems[0].available).toBe(false);

    // Changed our mind — back on the shelf.
    useStore.getState().restorePantryItems(emptied);
    expect(useStore.getState().pantryItems[0].available).toBe(true);
  });
});
