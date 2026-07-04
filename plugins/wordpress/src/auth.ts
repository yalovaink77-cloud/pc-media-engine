/**
 * Build the HTTP Basic Authorization header value for WordPress REST API.
 *
 * WordPress Application Passwords may contain spaces (e.g. "xxxx xxxx xxxx").
 * Spaces are intentionally kept — they are part of the password and must be
 * included in the base64-encoded credentials string.
 */
export function buildBasicAuth(username: string, appPassword: string): string {
  const credentials = `${username}:${appPassword}`;
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}
