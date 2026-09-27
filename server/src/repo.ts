import { createHash, randomBytes } from 'node:crypto';
import type { Database } from './db.ts';
import { plain, plainAll } from './db.ts';
import { newFriendCode, newId, newInviteCode } from './ids.ts';
import { mergeRecord, type SyncKind, type SyncRecord } from './records.ts';

export interface UserRow {
  id: string;
  handle: string;
  handle_lower: string;
  password_hash: string;
  display_name: string;
  friend_code: string;
  household_id: string | null;
  created_at: number;
}

export interface HouseholdRow {
  id: string;
  name: string;
  invite_code: string;
  seq: number;
  created_at: number;
}

export interface FriendshipRow {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  created_at: number;
}

export interface CardRow {
  id: string;
  author_id: string;
  title: string;
  note: string;
  recipe_json: string;
  image_id: string | null;
  created_at: number;
  expires_at: number;
}

/** Stored rows carry a server-assigned `seq` so clients can ask for a delta. */
export interface StoredRecord extends SyncRecord {
  seq: number;
}

export interface PushSubRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: number;
}

/** Tokens are stored hashed: a stolen database backup should not be a login. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export type Repo = ReturnType<typeof createRepo>;

export function createRepo(db: Database) {
  const insertUser = db.prepare(
    `INSERT INTO users (id, handle, handle_lower, password_hash, display_name, friend_code, household_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`
  );
  const selectUserByHandle = db.prepare('SELECT * FROM users WHERE handle_lower = ?');
  const selectUserById = db.prepare('SELECT * FROM users WHERE id = ?');
  const selectUserByFriendCode = db.prepare('SELECT * FROM users WHERE friend_code = ?');
  const updateUserHousehold = db.prepare('UPDATE users SET household_id = ? WHERE id = ?');

  const insertToken = db.prepare(
    'INSERT INTO tokens (token_hash, user_id, created_at, last_seen_at) VALUES (?, ?, ?, ?)'
  );
  const selectToken = db.prepare('SELECT user_id FROM tokens WHERE token_hash = ?');
  const touchToken = db.prepare('UPDATE tokens SET last_seen_at = ? WHERE token_hash = ?');
  const deleteToken = db.prepare('DELETE FROM tokens WHERE token_hash = ?');

  const insertHousehold = db.prepare(
    'INSERT INTO households (id, name, invite_code, seq, created_at) VALUES (?, ?, ?, 0, ?)'
  );
  const selectHouseholdById = db.prepare('SELECT * FROM households WHERE id = ?');
  const selectHouseholdByCode = db.prepare('SELECT * FROM households WHERE invite_code = ?');
  const selectMembers = db.prepare(
    'SELECT id, handle, display_name FROM users WHERE household_id = ? ORDER BY created_at'
  );
  const countMembers = db.prepare('SELECT COUNT(*) AS n FROM users WHERE household_id = ?');
  const deleteHousehold = db.prepare('DELETE FROM households WHERE id = ?');

  const bumpSeq = db.prepare('UPDATE households SET seq = seq + 1 WHERE id = ? RETURNING seq');
  const selectRecord = db.prepare(
    'SELECT kind, record_id, updated_at, deleted, value_json, seq FROM records WHERE household_id = ? AND kind = ? AND record_id = ?'
  );
  const upsertRecord = db.prepare(
    `INSERT INTO records (household_id, kind, record_id, updated_at, deleted, value_json, seq)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (household_id, kind, record_id)
     DO UPDATE SET updated_at = excluded.updated_at, deleted = excluded.deleted,
                   value_json = excluded.value_json, seq = excluded.seq`
  );
  const selectRecordsSince = db.prepare(
    `SELECT kind, record_id, updated_at, deleted, value_json, seq FROM records
     WHERE household_id = ? AND seq > ? ORDER BY seq LIMIT ?`
  );

  const insertFriendship = db.prepare(
    'INSERT INTO friendships (id, requester_id, addressee_id, status, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const selectFriendshipBetween = db.prepare(
    `SELECT * FROM friendships
     WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)`
  );
  const selectFriendshipById = db.prepare('SELECT * FROM friendships WHERE id = ?');
  const acceptFriendship = db.prepare("UPDATE friendships SET status = 'accepted' WHERE id = ?");
  const deleteFriendship = db.prepare('DELETE FROM friendships WHERE id = ?');
  const selectFriendshipsFor = db.prepare(
    'SELECT * FROM friendships WHERE requester_id = ? OR addressee_id = ?'
  );

  const insertCard = db.prepare(
    `INSERT INTO cards (id, author_id, title, note, recipe_json, image_id, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const selectCardById = db.prepare('SELECT * FROM cards WHERE id = ?');
  const deleteExpiredCards = db.prepare('DELETE FROM cards WHERE expires_at <= ?');
  const markSeen = db.prepare(
    'INSERT OR IGNORE INTO card_views (card_id, user_id, seen_at) VALUES (?, ?, ?)'
  );
  const markSaved = db.prepare(
    'INSERT OR IGNORE INTO card_saves (card_id, user_id, saved_at) VALUES (?, ?, ?)'
  );
  const countSaves = db.prepare('SELECT COUNT(*) AS n FROM card_saves WHERE card_id = ?');
  const hasSeen = db.prepare('SELECT 1 AS yes FROM card_views WHERE card_id = ? AND user_id = ?');

  const upsertPushSub = db.prepare(
    `INSERT INTO push_subs (id, user_id, endpoint, p256dh, auth, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = excluded.user_id,
       p256dh = excluded.p256dh, auth = excluded.auth`
  );
  const selectPushSubs = db.prepare('SELECT * FROM push_subs WHERE user_id = ?');
  const deletePushSub = db.prepare('DELETE FROM push_subs WHERE endpoint = ?');
  const insertPushLog = db.prepare(
    'INSERT OR IGNORE INTO push_log (user_id, tag, sent_at) VALUES (?, ?, ?)'
  );
  const prunePushLog = db.prepare('DELETE FROM push_log WHERE sent_at < ?');
  const selectHouseholdIds = db.prepare('SELECT id FROM households');

  const insertMedia = db.prepare(
    'INSERT INTO media (id, owner_id, mime, bytes, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const selectMedia = db.prepare('SELECT mime, bytes FROM media WHERE id = ?');

  const toSyncRecord = (row: Record<string, unknown>): StoredRecord => {
    const record: StoredRecord = {
      kind: row.kind as SyncKind,
      id: row.record_id as string,
      updatedAt: Number(row.updated_at),
      seq: Number(row.seq),
    };
    if (Number(row.deleted) === 1) record.deleted = true;
    else record.value = row.value_json ? JSON.parse(String(row.value_json)) : undefined;
    return record;
  };

  return {
    db,

    // ---- accounts -------------------------------------------------------

    createUser(handle: string, passwordHash: string, displayName: string): UserRow {
      const user: UserRow = {
        id: newId(),
        handle: handle.trim(),
        handle_lower: handle.trim().toLowerCase(),
        password_hash: passwordHash,
        display_name: displayName.trim() || handle.trim(),
        friend_code: newFriendCode(),
        household_id: null,
        created_at: Date.now(),
      };
      insertUser.run(
        user.id,
        user.handle,
        user.handle_lower,
        user.password_hash,
        user.display_name,
        user.friend_code,
        user.created_at
      );
      return user;
    },

    userByHandle(handle: string): UserRow | null {
      return plain<UserRow>(selectUserByHandle.get(handle.trim().toLowerCase()));
    },

    userById(id: string): UserRow | null {
      return plain<UserRow>(selectUserById.get(id));
    },

    userByFriendCode(code: string): UserRow | null {
      return plain<UserRow>(selectUserByFriendCode.get(code));
    },

    issueToken(userId: string): string {
      const token = randomBytes(32).toString('hex');
      const now = Date.now();
      insertToken.run(hashToken(token), userId, now, now);
      return token;
    },

    userForToken(token: string): UserRow | null {
      const hash = hashToken(token);
      const row = plain<{ user_id: string }>(selectToken.get(hash));
      if (!row) return null;
      touchToken.run(Date.now(), hash);
      return this.userById(row.user_id);
    },

    revokeToken(token: string): void {
      deleteToken.run(hashToken(token));
    },

    // ---- household ------------------------------------------------------

    createHousehold(name: string, ownerId: string): HouseholdRow {
      const household: HouseholdRow = {
        id: newId(),
        name: name.trim() || 'آشپزخانهٔ ما',
        invite_code: newInviteCode(),
        seq: 0,
        created_at: Date.now(),
      };
      insertHousehold.run(household.id, household.name, household.invite_code, household.created_at);
      updateUserHousehold.run(household.id, ownerId);
      return household;
    },

    householdById(id: string): HouseholdRow | null {
      return plain<HouseholdRow>(selectHouseholdById.get(id));
    },

    householdByInviteCode(code: string): HouseholdRow | null {
      return plain<HouseholdRow>(selectHouseholdByCode.get(code));
    },

    members(householdId: string) {
      return plainAll<{ id: string; handle: string; display_name: string }>(
        selectMembers.all(householdId)
      );
    },

    setHousehold(userId: string, householdId: string | null): void {
      updateUserHousehold.run(householdId, userId);
    },

    /**
     * Leaving takes the last member's household with it, rows and all. Keeping
     * an empty household alive would leave its invite code valid forever, which
     * is the one way a stale code could let a stranger in.
     */
    leaveHousehold(user: UserRow): void {
      if (!user.household_id) return;
      const householdId = user.household_id;
      updateUserHousehold.run(null, user.id);
      const remaining = plain<{ n: number }>(countMembers.get(householdId));
      if (!remaining || Number(remaining.n) === 0) deleteHousehold.run(householdId);
    },

    // ---- shared records -------------------------------------------------

    /**
     * Merges incoming rows with the same last-write-wins rule the client uses
     * and returns only what actually changed, each stamped with a fresh `seq`.
     * The relay's mistake to avoid: trusting the sender's clock for ordering.
     */
    applyRecords(householdId: string, incoming: SyncRecord[]): { stored: StoredRecord[]; cursor: number } {
      const stored: StoredRecord[] = [];
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const record of incoming) {
          const existingRow = selectRecord.get(householdId, record.kind, record.id) as
            | Record<string, unknown>
            | undefined;
          const existing = existingRow ? toSyncRecord(existingRow) : undefined;
          const winner = mergeRecord(existing, record);
          if (existing && winner === existing) continue;

          const bumped = plain<{ seq: number }>(bumpSeq.get(householdId));
          const seq = Number(bumped?.seq ?? 0);
          upsertRecord.run(
            householdId,
            winner.kind,
            winner.id,
            winner.updatedAt,
            winner.deleted ? 1 : 0,
            winner.deleted ? null : JSON.stringify(winner.value ?? null),
            seq
          );
          stored.push({ ...winner, seq });
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return { stored, cursor: this.cursor(householdId) };
    },

    recordsSince(householdId: string, since: number, limit = 2000): StoredRecord[] {
      return (selectRecordsSince.all(householdId, since, limit) as Record<string, unknown>[]).map(
        toSyncRecord
      );
    },

    cursor(householdId: string): number {
      return Number(this.householdById(householdId)?.seq ?? 0);
    },

    // ---- friends --------------------------------------------------------

    friendshipBetween(a: string, b: string): FriendshipRow | null {
      return plain<FriendshipRow>(selectFriendshipBetween.get(a, b, b, a));
    },

    friendshipById(id: string): FriendshipRow | null {
      return plain<FriendshipRow>(selectFriendshipById.get(id));
    },

    requestFriendship(requesterId: string, addresseeId: string): FriendshipRow {
      const row: FriendshipRow = {
        id: newId(),
        requester_id: requesterId,
        addressee_id: addresseeId,
        status: 'pending',
        created_at: Date.now(),
      };
      insertFriendship.run(row.id, row.requester_id, row.addressee_id, row.status, row.created_at);
      return row;
    },

    acceptFriendship(id: string): void {
      acceptFriendship.run(id);
    },

    removeFriendship(id: string): void {
      deleteFriendship.run(id);
    },

    friendshipsFor(userId: string): FriendshipRow[] {
      return plainAll<FriendshipRow>(selectFriendshipsFor.all(userId, userId));
    },

    acceptedFriendIds(userId: string): string[] {
      return this.friendshipsFor(userId)
        .filter((f) => f.status === 'accepted')
        .map((f) => (f.requester_id === userId ? f.addressee_id : f.requester_id));
    },

    // ---- cards ----------------------------------------------------------

    createCard(input: {
      authorId: string;
      title: string;
      note: string;
      recipe: unknown;
      imageId: string | null;
      ttlMs: number;
    }): CardRow {
      const now = Date.now();
      const row: CardRow = {
        id: newId(),
        author_id: input.authorId,
        title: input.title,
        note: input.note,
        recipe_json: JSON.stringify(input.recipe),
        image_id: input.imageId,
        created_at: now,
        expires_at: now + input.ttlMs,
      };
      insertCard.run(
        row.id,
        row.author_id,
        row.title,
        row.note,
        row.recipe_json,
        row.image_id,
        row.created_at,
        row.expires_at
      );
      return row;
    },

    cardById(id: string): CardRow | null {
      return plain<CardRow>(selectCardById.get(id));
    },

    /** Cards from accepted friends that have not expired, newest first. */
    feedFor(userId: string): CardRow[] {
      const friends = this.acceptedFriendIds(userId);
      if (friends.length === 0) return [];
      const placeholders = friends.map(() => '?').join(',');
      const rows = db
        .prepare(
          `SELECT * FROM cards WHERE author_id IN (${placeholders}) AND expires_at > ?
           ORDER BY created_at DESC LIMIT 200`
        )
        .all(...friends, Date.now());
      return plainAll<CardRow>(rows);
    },

    pruneExpiredCards(now = Date.now()): void {
      deleteExpiredCards.run(now);
    },

    markCardSeen(cardId: string, userId: string): void {
      markSeen.run(cardId, userId, Date.now());
    },

    markCardSaved(cardId: string, userId: string): void {
      markSaved.run(cardId, userId, Date.now());
    },

    cardSaveCount(cardId: string): number {
      return Number(plain<{ n: number }>(countSaves.get(cardId))?.n ?? 0);
    },

    cardSeenBy(cardId: string, userId: string): boolean {
      return plain<{ yes: number }>(hasSeen.get(cardId, userId)) !== null;
    },

    // ---- push -----------------------------------------------------------

    savePushSub(userId: string, sub: { endpoint: string; p256dh: string; auth: string }): void {
      upsertPushSub.run(newId(), userId, sub.endpoint, sub.p256dh, sub.auth, Date.now());
    },

    pushSubs(userId: string): PushSubRow[] {
      return plainAll<PushSubRow>(selectPushSubs.all(userId));
    },

    dropPushSub(endpoint: string): void {
      deletePushSub.run(endpoint);
    },

    /** True the first time this exact notification is claimed for this user. */
    claimPush(userId: string, tag: string, now = Date.now()): boolean {
      return Number(insertPushLog.run(userId, tag, now).changes) > 0;
    },

    prunePushLog(before: number): void {
      prunePushLog.run(before);
    },

    householdIds(): string[] {
      return plainAll<{ id: string }>(selectHouseholdIds.all()).map((row) => row.id);
    },

    /** Every non-deleted row of one kind, for the notification scan. */
    recordsOfKind(householdId: string, kind: SyncKind): StoredRecord[] {
      const rows = db
        .prepare(
          `SELECT kind, record_id, updated_at, deleted, value_json, seq FROM records
           WHERE household_id = ? AND kind = ? AND deleted = 0`
        )
        .all(householdId, kind) as Record<string, unknown>[];
      return rows.map(toSyncRecord);
    },

    // ---- media ----------------------------------------------------------

    storeMedia(ownerId: string, mime: string, bytes: Uint8Array): string {
      const id = newId();
      insertMedia.run(id, ownerId, mime, bytes, Date.now());
      return id;
    },

    mediaById(id: string): { mime: string; bytes: Uint8Array } | null {
      const row = plain<{ mime: string; bytes: Uint8Array }>(selectMedia.get(id));
      return row ? { mime: row.mime, bytes: row.bytes } : null;
    },
  };
}
