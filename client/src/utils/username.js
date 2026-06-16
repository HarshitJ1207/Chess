export function formatUsername(username) {
  if (!username) return '';
  if (username.startsWith('anon-')) return 'Anonymous';
  return username;
}
