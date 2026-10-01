// The websites Phoenix is allowed to read, and to recommend from. Nothing else is ever crawled or recommended.
//   neurohubcommunity.org   NeuroHub Community's own site
//   autisticrealms.com      Helen Edgar's Autistic Realms (Helen Edgar has given permission for anything she has written or made)
//   morerealms.com          Helen Edgar's More Realms (same permission)
// To add a website, the owner's permission is needed first; then add it here and re-run `npm run sync-site` and `npm run crawl`.
export const SOURCES = [
  { key: 'neurohub', base: 'https://neurohubcommunity.org', label: 'NeuroHub Community', permission: 'own site', ownAuthorOnly: false },
  { key: 'autisticrealms', base: 'https://autisticrealms.com', label: 'Autistic Realms (Helen Edgar)', permission: 'Helen Edgar has given permission', ownAuthorOnly: true },
  { key: 'morerealms', base: 'https://morerealms.com', label: 'More Realms (Helen Edgar)', permission: 'Helen Edgar has given permission', ownAuthorOnly: true },
];
export const UA = 'PhoenixAssistantBuild/1.0 (+https://phoenix.neurohubcommunity.org)';
export const HOSTS = SOURCES.map((s) => new URL(s.base).hostname);
