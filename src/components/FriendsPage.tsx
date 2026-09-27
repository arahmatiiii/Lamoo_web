import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Copy,
  Check,
  UserPlus,
  UserMinus,
  BookmarkPlus,
  Loader2,
  RefreshCw,
  Users,
} from 'lucide-react';
import { useStore, type Recipe } from '../store/useStore';
import ScreenHeader from './ScreenHeader';
import { useToast } from './Toast';
import { fa } from '../utils/format';
import {
  acceptFriend,
  fetchCard,
  fetchFeed,
  fetchFriends,
  markCardSeen,
  removeFriend,
  requestFriend,
  saveCard,
  serverAssetUrl,
  type CardDetail,
  type CardSummary,
  type FriendLists,
} from '../utils/serverApi';

/** "۲ ساعت پیش" — a card only lives a day, so hours and minutes are enough. */
function agoFa(timestamp: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return 'همین حالا';
  if (minutes < 60) return `${fa(minutes)} دقیقه پیش`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${fa(hours)} ساعت پیش`;
  return `${fa(Math.round(hours / 24))} روز پیش`;
}

export default function FriendsPage() {
  const store = useStore();
  const { showToast } = useToast();
  const [feed, setFeed] = useState<CardSummary[]>([]);
  const [lists, setLists] = useState<FriendLists | null>(null);
  const [open, setOpen] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [copied, setCopied] = useState(false);

  const ready = store.backend === 'server' && !!store.serverUrl && !!store.authToken;
  const { serverUrl, authToken } = store;

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    try {
      const [feedResult, friendResult] = await Promise.all([
        fetchFeed(serverUrl, authToken),
        fetchFriends(serverUrl, authToken),
      ]);
      setFeed(feedResult.cards);
      setLists(friendResult);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'نشد', 'error');
    } finally {
      setLoading(false);
    }
    // showToast comes from a context that is stable for the page's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, serverUrl, authToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!ready) {
    return (
      <div className="flex flex-col h-full">
        <ScreenHeader kicker="دوستان" headline="کارت دوستانت" />
        <div className="flex-1 px-5">
          <div className="card-lg space-y-3" style={{ padding: 22 }}>
            <Users size={22} style={{ color: 'var(--accent)' }} />
            <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              برای این بخش باید به سرور خودت وصل باشی
            </div>
            <div className="text-xs leading-[1.9]" style={{ color: 'var(--neutral-600)' }}>
              دوستان و استوری بدون سرور کار نمی‌کند: یک‌جایی باید بداند کارت تو را به کدام
              دوستت نشان بدهد. در تنظیمات → آشپزخانهٔ مشترک، «سرور خودم» را انتخاب کن و
              وارد شو.
            </div>
            <button className="btn-primary" onClick={() => store.setActiveTab('settings')}>
              رفتن به تنظیمات
            </button>
          </div>
        </div>
      </div>
    );
  }

  const openCard = async (summary: CardSummary) => {
    try {
      const { card } = await fetchCard(serverUrl, authToken, summary.id);
      setOpen(card);
      if (!summary.seen) {
        await markCardSeen(serverUrl, authToken, summary.id).catch(() => undefined);
        setFeed((cards) => cards.map((c) => (c.id === summary.id ? { ...c, seen: true } : c)));
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'این کارت باز نشد', 'error');
    }
  };

  const keep = async (card: CardDetail) => {
    try {
      const { recipe } = await saveCard(serverUrl, authToken, card.id);
      // A fresh id, so saving a friend's recipe twice does not collide with the
      // copy already in your book.
      const mine: Recipe = { ...recipe, id: `${Date.now()}` };
      store.addRecipe(mine);
      setOpen(null);
      showToast(`«${recipe.name}» به دفترت اضافه شد`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'ذخیره نشد', 'error');
    }
  };

  const addFriend = async () => {
    if (!codeInput.trim()) return;
    try {
      const { status } = await requestFriend(serverUrl, authToken, codeInput);
      setCodeInput('');
      showToast(status === 'accepted' ? 'دوست شدید!' : 'درخواست فرستاده شد');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'نشد', 'error');
    }
  };

  const accept = async (friendshipId: string) => {
    try {
      await acceptFriend(serverUrl, authToken, friendshipId);
      showToast('قبول شد');
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'نشد', 'error');
    }
  };

  const unfriend = async (friendshipId: string) => {
    try {
      await removeFriend(serverUrl, authToken, friendshipId);
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'نشد', 'error');
    }
  };

  const copyMyCode = async () => {
    if (!lists?.myCode) return;
    try {
      await navigator.clipboard.writeText(lists.myCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('کپی نشد — دستی انتخابش کن', 'error');
    }
  };

  const unseen = feed.filter((card) => !card.seen).length;

  return (
    <div className="flex flex-col h-full">
      <ScreenHeader
        kicker="دوستان"
        headline={unseen > 0 ? `${fa(unseen)} کارت نخونده` : 'کارت دوستانت'}
      />

      <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-5">
        {/* The story rail: a friend with something new gets a ring. */}
        {feed.length > 0 && (
          <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {feed.map((card) => (
              <button
                key={card.id}
                className="press flex flex-col items-center gap-1.5 flex-shrink-0"
                style={{ width: 72 }}
                onClick={() => void openCard(card)}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 999,
                    padding: 3,
                    background: card.seen ? 'var(--surface)' : 'var(--accent)',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: 999,
                      overflow: 'hidden',
                      background: 'var(--surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {card.imageUrl ? (
                      <img
                        src={serverAssetUrl(serverUrl, card.imageUrl)}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: 24 }}>🍲</span>
                    )}
                  </div>
                </div>
                <span
                  className="text-xs truncate w-full text-center"
                  style={{ color: card.seen ? 'var(--neutral-500)' : 'var(--text)', fontWeight: card.seen ? 400 : 700 }}
                >
                  {card.author.displayName}
                </span>
              </button>
            ))}
          </div>
        )}

        {feed.length === 0 && (
          <div className="card-lg space-y-2" style={{ padding: 20 }}>
            <div className="text-sm font-bold" style={{ color: 'var(--text)' }}>
              {lists?.friends.length ? 'دوستانت هنوز چیزی نگذاشته‌اند' : 'هنوز دوستی اضافه نکردی'}
            </div>
            <div className="text-xs leading-[1.9]" style={{ color: 'var(--neutral-600)' }}>
              کد پایین را به دوستت بده، و کد او را اینجا وارد کن. بعد هر وقت یکی‌تان از یک
              دستور کارت بسازد، آن یکی می‌بیند و می‌تواند با تمام جزئیات به دفتر خودش اضافه کند.
            </div>
          </div>
        )}

        {/* Cards as a list too, so a long rail is not the only way in. */}
        {feed.map((card) => (
          <button
            key={`row-${card.id}`}
            className="press w-full card-lg flex items-center gap-3 text-right"
            style={{ padding: 14 }}
            onClick={() => void openCard(card)}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                overflow: 'hidden',
                flexShrink: 0,
                background: 'var(--surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {card.imageUrl ? (
                <img
                  src={serverAssetUrl(serverUrl, card.imageUrl)}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ fontSize: 22 }}>🍲</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold truncate" style={{ color: 'var(--text)' }}>
                {card.title}
              </div>
              <div className="text-xs truncate" style={{ color: 'var(--neutral-600)' }}>
                {card.author.displayName} · {agoFa(card.createdAt)}
              </div>
            </div>
            {!card.seen && (
              <span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--accent)', flexShrink: 0 }} />
            )}
          </button>
        ))}

        {/* Friend code and requests */}
        <div className="card-lg space-y-[15px]" style={{ padding: 20 }}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>کد دوستی تو</span>
            <button className="press" onClick={() => void load()} disabled={loading} aria-label="تازه‌سازی">
              {loading ? (
                <Loader2 size={15} className="animate-spin" style={{ color: 'var(--neutral-600)' }} />
              ) : (
                <RefreshCw size={15} style={{ color: 'var(--neutral-600)' }} />
              )}
            </button>
          </div>

          <button
            className="press w-full flex items-center justify-between"
            style={{ background: 'var(--surface)', borderRadius: 18, padding: '14px 16px' }}
            onClick={copyMyCode}
          >
            <span className="text-sm font-bold" style={{ direction: 'ltr', letterSpacing: 3, color: 'var(--text)' }}>
              {lists?.myCode ?? '········'}
            </span>
            {copied ? <Check size={16} style={{ color: 'var(--sage)' }} /> : <Copy size={16} style={{ color: 'var(--neutral-600)' }} />}
          </button>

          <div className="text-xs leading-[1.75]" style={{ color: 'var(--neutral-500)' }}>
            این کد دسترسی نمی‌دهد — فقط درخواست دوستی می‌سازد و خودت باید قبول کنی.
          </div>

          <div className="flex gap-2">
            <input
              className="pill-input min-w-0 flex-1"
              style={{ background: 'var(--surface)', border: 'none', direction: 'ltr', textAlign: 'left', fontSize: 13 }}
              type="text"
              placeholder="کد دوستت"
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void addFriend()}
            />
            <button
              className="press flex-shrink-0 flex items-center gap-1.5 font-bold"
              style={{ padding: '0 16px', borderRadius: 14, background: 'var(--accent)', color: '#fff', fontSize: 13 }}
              onClick={() => void addFriend()}
            >
              <UserPlus size={14} />
              اضافه
            </button>
          </div>

          {lists && lists.incoming.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold" style={{ color: 'var(--text)' }}>درخواست‌های تازه</div>
              {lists.incoming.map((friend) => (
                <div key={friend.friendshipId} className="flex items-center gap-2">
                  <span className="text-sm flex-1 truncate" style={{ color: 'var(--text)' }}>
                    {friend.displayName}
                  </span>
                  <button
                    className="press font-bold"
                    style={{ padding: '6px 14px', borderRadius: 12, background: 'var(--sage)', color: '#fff', fontSize: 12 }}
                    onClick={() => void accept(friend.friendshipId)}
                  >
                    قبول
                  </button>
                  <button
                    className="press"
                    style={{ color: 'var(--accent-700)' }}
                    onClick={() => void unfriend(friend.friendshipId)}
                    aria-label="رد کردن"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {lists && lists.friends.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold" style={{ color: 'var(--text)' }}>دوستانت</div>
              {lists.friends.map((friend) => (
                <div key={friend.friendshipId} className="flex items-center gap-2">
                  <span className="text-sm flex-1 truncate" style={{ color: 'var(--text)' }}>
                    {friend.displayName}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--neutral-500)', direction: 'ltr' }}>
                    @{friend.handle}
                  </span>
                  <button
                    className="press"
                    style={{ color: 'var(--neutral-600)' }}
                    onClick={() => void unfriend(friend.friendshipId)}
                    aria-label="حذف دوست"
                  >
                    <UserMinus size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {lists && lists.outgoing.length > 0 && (
            <div className="text-xs" style={{ color: 'var(--neutral-500)' }}>
              منتظر قبول کردن: {lists.outgoing.map((f) => f.displayName).join('، ')}
            </div>
          )}
        </div>
      </div>

      {open && <CardReader card={open} onClose={() => setOpen(null)} onKeep={() => void keep(open)} />}
    </div>
  );
}

/**
 * Full-screen story reader: the picture, the note, and the whole recipe.
 *
 * Rendered into `document.body` rather than in place. The page content sits
 * inside an animated wrapper that forms its own stacking context, so a `fixed`
 * overlay declared in there loses to the bottom nav however high its z-index is
 * — the nav ends up swallowing taps meant for the button at the bottom.
 */
function CardReader({
  card,
  onClose,
  onKeep,
}: {
  card: CardDetail;
  onClose: () => void;
  onKeep: () => void;
}) {
  const serverUrl = useStore((s) => s.serverUrl);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        // Portalled to the body, so it sits outside the shell that normally
        // carries the safe-area insets and has to bring its own.
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)',
      }}
    >
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="min-w-0">
          <div className="text-xs" style={{ color: 'var(--neutral-500)' }}>
            {card.author.displayName} · {agoFa(card.createdAt)}
          </div>
          <div className="text-lg font-extrabold truncate" style={{ color: 'var(--text)' }}>
            {card.title}
          </div>
        </div>
        <button className="press" onClick={onClose} aria-label="بستن">
          <X size={22} style={{ color: 'var(--neutral-600)' }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
        {card.imageUrl && (
          <img
            src={serverAssetUrl(serverUrl, card.imageUrl)}
            alt={card.title}
            style={{ width: '100%', borderRadius: 22, display: 'block' }}
          />
        )}

        {card.note && (
          <div className="text-sm leading-[1.9]" style={{ color: 'var(--text)' }}>
            {card.note}
          </div>
        )}

        <div className="card-lg space-y-3" style={{ padding: 18 }}>
          <div className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--text)' }}>
            <span style={{ fontSize: 20 }}>{card.recipe.emoji}</span>
            {card.recipe.name}
          </div>
          <div className="text-xs" style={{ color: 'var(--neutral-600)' }}>
            {fa(card.recipe.timeMinutes)} دقیقه · {fa(card.recipe.servings)} نفر ·{' '}
            {fa(card.recipe.calories)} کالری
          </div>

          <div>
            <div className="text-xs font-bold mb-1.5" style={{ color: 'var(--text)' }}>مواد لازم</div>
            <div className="text-xs leading-[2]" style={{ color: 'var(--neutral-600)' }}>
              {card.recipe.ingredients.map((ing) => ing.name).join(' · ')}
            </div>
          </div>

          <div>
            <div className="text-xs font-bold mb-1.5" style={{ color: 'var(--text)' }}>مراحل</div>
            <ol className="space-y-1.5">
              {card.recipe.steps.map((step, index) => (
                <li key={index} className="text-xs leading-[1.9]" style={{ color: 'var(--neutral-600)' }}>
                  {fa(index + 1)}. {step}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {card.saves > 0 && (
          <div className="text-xs text-center" style={{ color: 'var(--neutral-500)' }}>
            {fa(card.saves)} نفر این را به دفترشان اضافه کرده‌اند
          </div>
        )}
      </div>

      <div className="px-5" style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
        <button className="btn-primary flex items-center justify-center gap-2" onClick={onKeep}>
          <BookmarkPlus size={17} />
          به دفتر خودم اضافه کن
        </button>
      </div>
    </div>,
    document.body
  );
}
