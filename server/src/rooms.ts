interface Sendable {
  send(data: string): void;
  readyState: number;
}

const OPEN = 1;

/**
 * Who is listening for which household's changes. A phone that pushes a change
 * gets it echoed back deliberately: that is how it learns the server's `seq`
 * for its own row, and how it finds out when the server's copy won the merge.
 */
export class Rooms {
  private rooms = new Map<string, Set<Sendable>>();

  join(householdId: string, socket: Sendable): void {
    const set = this.rooms.get(householdId) ?? new Set<Sendable>();
    set.add(socket);
    this.rooms.set(householdId, set);
  }

  leave(householdId: string, socket: Sendable): void {
    const set = this.rooms.get(householdId);
    if (!set) return;
    set.delete(socket);
    if (set.size === 0) this.rooms.delete(householdId);
  }

  broadcast(householdId: string, message: unknown): void {
    const set = this.rooms.get(householdId);
    if (!set) return;
    const payload = JSON.stringify(message);
    for (const socket of set) {
      if (socket.readyState === OPEN) {
        try {
          socket.send(payload);
        } catch {
          // A socket that died between the readyState check and the write is
          // about to fire its close handler, which removes it from the room.
        }
      }
    }
  }

  size(householdId: string): number {
    return this.rooms.get(householdId)?.size ?? 0;
  }
}
