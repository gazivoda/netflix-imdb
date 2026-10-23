import { spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, writeFileSync, copyFileSync, symlinkSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import { PAGES } from '../../lib/pages';
import { SITE_URL } from '../../lib/content';

describe('seo:links command', () => {
  let fixture: string;
  const root = resolve(__dirname, '../..');

  beforeEach(() => {
    fixture = mkdtempSync(join(tmpdir(), 'rating-watch-link-cli-'));
    mkdirSync(join(fixture, 'scripts'));
    symlinkSync(join(root, 'node_modules'), join(fixture, 'node_modules'), 'dir');
    symlinkSync(join(root, 'lib'), join(fixture, 'lib'), 'dir');
    copyFileSync(join(root, 'scripts/check-links.mjs'), join(fixture, 'scripts/check-links.mjs'));
    for (const page of PAGES) {
      // The AR route needs the running server because it reads session cookies.
      if (page.path === '/camera-vision/ar') continue;
      const file = join(fixture, '.next/server/app', page.path === '/' ? 'index.html' : `${page.path.slice(1)}.html`);
      mkdirSync(resolve(file, '..'), { recursive: true });
      const links = PAGES.map((p) => `<a href="${p.path}">${p.title}</a>`).join('');
      writeFileSync(file, `<head><title>${page.title}</title><meta name="description" content="${page.description}">` +
        `<link rel="canonical" href="${SITE_URL}${page.path === '/' ? '' : page.path}"></head>` +
        `<main><h1>${page.title}</h1>${links}</main>`);
    }
    writeFileSync(join(fixture, 'fetch.cjs'), `global.fetch = async (url) => {
      if (url !== 'http://audit.test/camera-vision/ar') throw new Error('unexpected URL: ' + url);
      return new Response('<title>AR ratings</title><meta name="description" content="Camera ratings">' +
        '<link rel="canonical" href="${SITE_URL}/camera-vision/ar"><h1>AR ratings</h1><a href="/">Home</a>',
        {status: Number(process.env.AUDIT_STATUS || 200)});
    };`);
  });

  afterEach(() => rmSync(fixture, { recursive: true, force: true }));

  const run = (status = '200', withServer = true) => spawnSync(process.execPath,
    ['--require', join(fixture, 'fetch.cjs'), join(fixture, 'scripts/check-links.mjs')], {
      encoding: 'utf8', timeout: 15000,
      env: { ...process.env, SEO_BASE_URL: withServer ? 'http://audit.test' : '', AUDIT_STATUS: status },
    });

  it('loads the TypeScript registry and checks static plus server-rendered pages', () => {
    const result = run();
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`Checked ${PAGES.length} pages`);
    expect(result.stdout).toContain('OK: no findings.');
  });

  it('fails when a server-rendered page returns a non-200 response', () => {
    const result = run('503');
    expect(result.status).toBe(1);
    expect(result.stderr + result.stdout).toContain('503');
  });

  it('does not silently pass missing server-rendered pages without SEO_BASE_URL', () => {
    const result = run('200', false);
    expect(result.status).toBe(1);
    expect(result.stderr + result.stdout).toContain('SEO_BASE_URL');
  });
});
