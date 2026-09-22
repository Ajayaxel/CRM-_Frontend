// Build first: npx tsc src/lib/tenant-host.ts --outDir .tenant-build --module esnext --target es2020 --moduleResolution bundler
// Plain node checks — the resolver decides which tenant a request belongs to,
// so getting it wrong shows one broker's branding to another's customers.
const { tenantFromHost, RESERVED_SUBDOMAINS } = await import('../.tenant-build/tenant-host.js');
let pass = 0, fail = 0;
const check = (n, c, d = '') => { c ? pass++ : fail++; console.log((c ? '  ok    ' : '  FAIL  ') + n + (d ? ` — ${d}` : '')); };

check('a tenant subdomain resolves', tenantFromHost('avera.bmnconnects.bmntechnology.com') === 'avera');
check('the platform host is not a tenant', tenantFromHost('bmnconnects.bmntechnology.com') === null,
  'otherwise "bmnconnects" would be read as a tenant slug');
check('the port is stripped', tenantFromHost('avera.bmnconnects.bmntechnology.com:443') === 'avera');
check('case is normalised', tenantFromHost('AVERA.bmnconnects.bmntechnology.com') === 'avera');
check('www is never a tenant', tenantFromHost('www.bmnconnects.bmntechnology.com') === null);
check('reserved names are refused', tenantFromHost('api.bmnconnects.bmntechnology.com') === null,
  `${RESERVED_SUBDOMAINS.size} reserved`);
check("Railway's own domain is not a tenant", tenantFromHost('web-production-f83a76.up.railway.app') === null,
  'the deploy URL would otherwise resolve to a tenant named after the build');
check('localhost is the platform', tenantFromHost('localhost:3400') === null);
check('avera.localhost works for local development', tenantFromHost('avera.localhost:3400') === 'avera');
check('an empty host is safe', tenantFromHost('') === null && tenantFromHost(null) === null);
check('a bare hostname is safe', tenantFromHost('somehost') === null);
check('a two-label domain is not a tenant', tenantFromHost('bmntechnology.com') === null,
  'the apex must not resolve to a tenant called "bmntechnology"');

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail ? 1 : 0);
