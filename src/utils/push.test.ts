import { describe, expect, it } from 'vitest';
import { pushSupported, urlBase64ToUint8Array } from './push';

describe('urlBase64ToUint8Array', () => {
  it('decodes a key that needs padding restored', () => {
    // "hi" is "aGk=" in standard base64; VAPID keys arrive with the = stripped.
    expect([...urlBase64ToUint8Array('aGk')]).toEqual([104, 105]);
  });

  it('accepts the URL-safe alphabet', () => {
    // 0xfb 0xff decodes from "+/8=" in standard base64, "-_8" URL-safe.
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([251, 255]);
  });

  it('produces the 65 bytes an uncompressed P-256 public key takes', () => {
    const key =
      'BLcaGRi2VFE0h1Z2h6wwuT3r0aLKXqDvJ2RkYZvQmdUHT9lhAs0sOcLOChKgMuCRVXAHxvwrIsftbPf6Su4fGNU';
    expect(urlBase64ToUint8Array(key)).toHaveLength(65);
  });

  it('tolerates surrounding whitespace', () => {
    expect([...urlBase64ToUint8Array('  aGk  ')]).toEqual([104, 105]);
  });
});

describe('pushSupported', () => {
  it('reports honestly for the environment it is running in', () => {
    // jsdom has no PushManager, so this must be false rather than throwing —
    // the settings screen calls it on every render.
    expect(pushSupported()).toBe(false);
  });
});
