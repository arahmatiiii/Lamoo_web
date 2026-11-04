import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

const ROOT = '/workspace/chats/73ac18d32000228e326f5d0e/.libs';
mkdirSync(`${ROOT}/debs`, { recursive: true });
mkdirSync(`${ROOT}/root`, { recursive: true });

const read = (p) => gunzipSync(readFileSync(p)).toString('utf8');
const stanzas = (text) => text.split('\n\n').map((block) => {
  const out = {};
  let key = null;
  for (const line of block.split('\n')) {
    if (/^[A-Za-z-]+:/.test(line)) {
      const [k, ...rest] = line.split(':');
      key = k.trim();
      out[key] = rest.join(':').trim();
    } else if (key && line.startsWith(' ')) {
      out[key] += ' ' + line.trim();
    }
  }
  return out;
});

const index = new Map();
for (const file of ['/tmp/main.gz', '/tmp/universe.gz']) {
  for (const s of stanzas(read(file))) {
    if (!s.Package || !s.Filename) continue;
    if (!index.has(s.Package)) index.set(s.Package, s);
    if (!index.has(`${s.Package}:${s.Architecture}`)) index.set(`${s.Package}:${s.Architecture}`, s);
  }
}
console.log('index size', index.size);

const SKIP = new Set([
  'libc6', 'libc-bin', 'libgcc-s1', 'libstdc++6', 'base-files', 'base-passwd', 'hostname',
  'dpkg', 'debconf', 'libcrypt1', 'libselinux1', 'zlib1g', 'liblzma5', 'libzstd1',
  'libpcre2-8-0', 'libmd0', 'libbsd0', 'libtinfo6', 'libcap2', 'libmount1', 'libblkid1',
  'libsystemd0', 'libuuid1', 'libffi8', 'libudev1', 'libdbus-1-3', 'libexpat1',
]);

const seeds = [
  'libasound2t64', 'libatk1.0-0t64', 'libatk-bridge2.0-0t64', 'libatspi2.0-0t64',
  'libcairo2', 'libcups2t64', 'libdrm2', 'libgbm1', 'libglib2.0-0t64', 'libnspr4',
  'libnss3', 'libpango-1.0-0', 'libx11-6', 'libxcb1', 'libxcomposite1', 'libxdamage1',
  'libxext6', 'libxfixes3', 'libxkbcommon0', 'libxrandr2', 'libxshmfence1', 'libxss1',
  'libfontconfig1', 'libfreetype6', 'libpixman-1-0', 'libpng16-16t64', 'libharfbuzz0b',
  'libfribidi0', 'libthai0', 'libxrender1', 'libxcb-render0', 'libxcb-shm0', 'libxcb-shape0',
  'libxcb-xfixes0', 'libxi6', 'libxtst6', 'libwayland-client0', 'libwayland-server0',
  'libwayland-cursor0', 'libwayland-egl1', 'libxau6', 'libxdmcp6', 'libglvnd0',
  'libgraphite2-3', 'libdatrie1', 'libbrotli1', 'libunwind8', 'libnuma1',
];

const queue = [...seeds];
const picked = new Map();
while (queue.length) {
  const name = queue.shift();
  const base = name.split(':')[0];
  if (SKIP.has(base) || picked.has(base)) continue;
  const pkg = index.get(base) || index.get(name);
  if (!pkg) {
    console.log('MISSING IN INDEX', name);
    continue;
  }
  picked.set(base, pkg);
  for (const field of ['Depends', 'Pre-Depends']) {
    for (const group of (pkg[field] ?? '').split(',')) {
      const first = group.split('|')[0].trim();
      const dep = first.split(' ')[0].split(':')[0];
      if (dep && !picked.has(dep)) queue.push(dep);
    }
  }
}

console.log('picked', picked.size);
let failed = 0;
for (const [name, pkg] of picked) {
  const url = `https://archive.ubuntu.com/ubuntu/${pkg.Filename}`;
  const deb = `${ROOT}/debs/${pkg.Filename.split('/').pop()}`;
  if (!existsSync(deb)) {
    try {
      execFileSync('curl', ['-sfL', '--retry', '2', '-o', deb, url], { stdio: 'ignore' });
    } catch {
      console.log('download failed', name, url);
      failed++;
      continue;
    }
  }
  try {
    execFileSync('dpkg-deb', ['-x', deb, `${ROOT}/root`], { stdio: 'ignore' });
  } catch (error) {
    console.log('extract failed', name, String(error).slice(0, 120));
    failed++;
  }
}
console.log('downloaded+extracted, failures:', failed);
writeFileSync(
  `${ROOT}/ldpath.txt`,
  [`${ROOT}/root/usr/lib/x86_64-linux-gnu`, `${ROOT}/root/lib/x86_64-linux-gnu`].join(':')
);
