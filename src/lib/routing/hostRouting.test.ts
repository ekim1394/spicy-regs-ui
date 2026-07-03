import { describe, it, expect } from 'vitest';
import { resolveHostRouting, isApexPath, APEX_HOST, APP_HOST } from './hostRouting';

describe('isApexPath', () => {
  it('treats / and the About tree as front-door paths', () => {
    expect(isApexPath('/')).toBe(true);
    expect(isApexPath('/about')).toBe(true);
    expect(isApexPath('/about/methodology')).toBe(true);
  });

  it('treats app routes as non-front-door', () => {
    for (const p of ['/feed', '/agencies', '/search', '/federal-register', '/lab', '/sr/EPA']) {
      expect(isApexPath(p)).toBe(false);
    }
  });
});

describe('resolveHostRouting — apex (spicy-regs.dev)', () => {
  it('serves the front door in place', () => {
    expect(resolveHostRouting(APEX_HOST, '/')).toEqual({ type: 'next' });
    expect(resolveHostRouting(APEX_HOST, '/about')).toEqual({ type: 'next' });
  });

  it('redirects app routes to the app subdomain, preserving path + query', () => {
    expect(resolveHostRouting(APEX_HOST, '/feed', '?agency=EPA')).toEqual({
      type: 'redirect',
      url: `https://${APP_HOST}/feed?agency=EPA`,
      status: 308,
    });
    expect(resolveHostRouting(APEX_HOST, '/sr/EPA/EPA-HQ-OAR-2021-0257')).toEqual({
      type: 'redirect',
      url: `https://${APP_HOST}/sr/EPA/EPA-HQ-OAR-2021-0257`,
      status: 308,
    });
  });

  it('ignores a port on the Host header', () => {
    expect(resolveHostRouting(`${APEX_HOST}:443`, '/about')).toEqual({ type: 'next' });
  });
});

describe('resolveHostRouting — app (app.spicy-regs.dev)', () => {
  it('lands the root on the feed', () => {
    expect(resolveHostRouting(APP_HOST, '/')).toEqual({
      type: 'redirect',
      url: `https://${APP_HOST}/feed`,
      status: 307,
    });
  });

  it('serves app routes in place', () => {
    expect(resolveHostRouting(APP_HOST, '/feed')).toEqual({ type: 'next' });
    expect(resolveHostRouting(APP_HOST, '/agencies')).toEqual({ type: 'next' });
  });

  it('bounces the front-door pages back to the apex', () => {
    expect(resolveHostRouting(APP_HOST, '/about')).toEqual({
      type: 'redirect',
      url: `https://${APEX_HOST}/about`,
      status: 308,
    });
  });
});

describe('resolveHostRouting — www + other hosts', () => {
  it('canonicalizes www to the apex', () => {
    expect(resolveHostRouting('www.spicy-regs.dev', '/about', '?x=1')).toEqual({
      type: 'redirect',
      url: `https://${APEX_HOST}/about?x=1`,
      status: 308,
    });
  });

  it('leaves localhost and preview hosts untouched', () => {
    expect(resolveHostRouting('localhost:3000', '/feed')).toEqual({ type: 'next' });
    expect(resolveHostRouting('spicy-regs-ui.vercel.app', '/about')).toEqual({ type: 'next' });
    expect(resolveHostRouting(null, '/feed')).toEqual({ type: 'next' });
  });
});
