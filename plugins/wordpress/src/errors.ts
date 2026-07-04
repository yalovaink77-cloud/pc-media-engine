/**
 * WordPressApiError — thrown when the WordPress REST API returns a non-2xx
 * status. Contains the HTTP status code and the WP error code from the
 * response body.
 */
export class WordPressApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'WordPressApiError';
  }
}
