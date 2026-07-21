// Mirrors the design's navDef + `group` map: several screens share one nav
// group (detail/report sit under Registry; run sits under Benchmarks).
const NAV_DEF = [
  { group: 'dashboard', label: 'Dashboard', target: 'dashboard' },
  { group: 'registry', label: 'Registry', target: 'registry' },
  { group: 'downloads', label: 'Downloads', target: 'downloads' },
  { group: 'bench', label: 'Benchmarks', target: 'setup' },
  { group: 'results', label: 'Results', target: 'results' },
  { group: 'settings', label: 'Settings', target: 'settings' },
];

export const SCREEN_GROUP = {
  dashboard: 'dashboard',
  registry: 'registry',
  detail: 'registry',
  report: 'registry',
  downloads: 'downloads',
  setup: 'bench',
  run: 'bench',
  results: 'results',
  settings: 'settings',
};

// activeDlCount drives the Downloads badge; the design derives it from the
// catalog rather than hardcoding a number.
// Pass the live catalog so the Downloads badge tracks real in-flight downloads.
export default function buildNavItems(screen, catalog = []) {
  const activeDlCount = catalog.filter((m) => m.status === 'downloading').length;
  const group = SCREEN_GROUP[screen] || screen;
  return NAV_DEF.map((item) => ({
    id: item.group,
    label: item.label,
    action: item.target,
    active: group === item.group,
    badge: item.group === 'downloads' ? activeDlCount || null : null,
  }));
}
