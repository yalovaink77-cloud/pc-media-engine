import type { DashboardPageData, RecentItem } from './types.js';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function badge(text: string, variant: 'ok' | 'warn' | 'err' | 'neutral'): string {
  return `<span class="badge ${variant}">${esc(text)}</span>`;
}

function dbBadge(status: string | undefined): string {
  if (status === 'ok') return badge('ok', 'ok');
  if (status === 'unavailable') return badge('unavailable', 'err');
  return badge('skipped', 'neutral');
}

function boolBadge(v: boolean | undefined): string {
  return v ? badge('yes', 'ok') : badge('no', 'neutral');
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? esc(iso) : esc(d.toLocaleString('en-US', { timeZoneName: 'short' }));
}

// ---------------------------------------------------------------------------
// Section renderers
// ---------------------------------------------------------------------------

function renderErrors(errors: string[]): string {
  if (!errors.length) return '';
  const items = errors.map((e) => `<li>${esc(e)}</li>`).join('');
  return `
  <section>
    <div class="error-banner" data-testid="error-banner">
      <strong>API errors</strong>
      <ul style="margin-top:0.4rem;padding-left:1.25rem">${items}</ul>
    </div>
  </section>`;
}

function renderHealth(data: DashboardPageData): string {
  const h = data.health;
  if (!h) {
    return `
  <section>
    <h2>System Health</h2>
    <p class="empty" data-testid="health-unavailable">Health data unavailable</p>
  </section>`;
  }
  return `
  <section>
    <h2>System Health</h2>
    <div class="cards" data-testid="health-cards">
      <div class="card">
        <div class="label">API</div>
        <div class="value">${badge('ok', 'ok')}</div>
      </div>
      <div class="card">
        <div class="label">Database</div>
        <div class="value">${dbBadge(h.database)}</div>
      </div>
      <div class="card">
        <div class="label">Publisher Driver</div>
        <div class="value small">${esc(h.publishing.publisherDriver)}</div>
      </div>
      <div class="card">
        <div class="label">Queue Enabled</div>
        <div class="value">${boolBadge(h.publishing.queueEnabled)}</div>
      </div>
      <div class="card">
        <div class="label">Max Retries</div>
        <div class="value">${esc(h.publishing.retryConfig.maxRetries)}</div>
      </div>
      <div class="card">
        <div class="label">Backoff (ms)</div>
        <div class="value">${esc(h.publishing.retryConfig.backoffMs)}</div>
      </div>
      <div class="card">
        <div class="label">Version</div>
        <div class="value small">${esc(h.version)}</div>
      </div>
      <div class="card">
        <div class="label">Env</div>
        <div class="value small">${esc(h.env)}</div>
      </div>
    </div>
  </section>`;
}

function renderSummary(data: DashboardPageData): string {
  const s = data.summary;
  if (!s) {
    return `
  <section>
    <h2>Summary</h2>
    <p class="empty" data-testid="summary-unavailable">Summary data unavailable</p>
  </section>`;
  }
  const publisherRows = s.publishers.length
    ? s.publishers
        .map(
          (p) =>
            `<tr><td>${esc(p.publisher)}</td><td style="text-align:right">${esc(p.count)}</td></tr>`,
        )
        .join('')
    : `<tr><td colspan="2" class="empty">No publishers yet</td></tr>`;

  return `
  <section>
    <h2>Publishing Summary</h2>
    <div class="cards" data-testid="summary-cards">
      <div class="card">
        <div class="label">Total Published</div>
        <div class="value" data-testid="total-published">${esc(s.totalPublished)}</div>
      </div>
      <div class="card">
        <div class="label">Total Drafts</div>
        <div class="value" data-testid="total-drafts">${esc(s.totalDrafts)}</div>
      </div>
      <div class="card">
        <div class="label">Total Failed</div>
        <div class="value" data-testid="total-failed">${esc(s.totalFailed)}</div>
      </div>
      <div class="card">
        <div class="label">Last Published</div>
        <div class="value small" data-testid="latest-published-at">${formatDate(s.latestPublishedAt)}</div>
      </div>
      <div class="card">
        <div class="label">AI Provider</div>
        <div class="value small">${esc(s.aiProvider)}</div>
      </div>
      <div class="card">
        <div class="label">Publisher Driver</div>
        <div class="value small">${esc(s.publisherDriver)}</div>
      </div>
    </div>
  </section>
  <section>
    <h2>System Capabilities</h2>
    <div class="cards" data-testid="capabilities-cards">
      <div class="card">
        <div class="label">Duplicate Detection</div>
        <div class="value">${boolBadge(s.duplicateDetectionEnabled)}</div>
      </div>
      <div class="card">
        <div class="label">Scheduler</div>
        <div class="value">${boolBadge(s.schedulerEnabled)}</div>
      </div>
      <div class="card">
        <div class="label">Retry Engine</div>
        <div class="value">${boolBadge(s.retryEnabled)}</div>
      </div>
    </div>
  </section>
  <section>
    <h2>Publisher Breakdown</h2>
    <table data-testid="publisher-table">
      <thead><tr><th>Publisher</th><th style="text-align:right">Count</th></tr></thead>
      <tbody>${publisherRows}</tbody>
    </table>
  </section>`;
}

function renderRecent(data: DashboardPageData): string {
  const r = data.recent;
  if (!r) {
    return `
  <section>
    <h2>Recent Published Content</h2>
    <p class="empty" data-testid="recent-unavailable">Recent data unavailable</p>
  </section>`;
  }
  if (r.items.length === 0) {
    return `
  <section>
    <h2>Recent Published Content</h2>
    <p class="empty" data-testid="recent-empty">No published content yet</p>
  </section>`;
  }

  const rows = r.items
    .map(
      (item: RecentItem) => `<tr data-testid="recent-row">
        <td style="font-family:monospace;font-size:0.8rem">${esc(item.id.slice(0, 8))}…</td>
        <td>${esc(item.publisher)}</td>
        <td>${esc(item.status)}</td>
        <td><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.url)}</a></td>
        <td style="font-size:0.8rem">${formatDate(item.publishedAt)}</td>
      </tr>`,
    )
    .join('');

  return `
  <section>
    <h2>Recent Published Content (${esc(r.count)})</h2>
    <table data-testid="recent-table">
      <thead>
        <tr>
          <th>ID</th><th>Publisher</th><th>Status</th><th>URL</th><th>Published At</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

// ---------------------------------------------------------------------------
// Metrics section (Sprint 29)
// ---------------------------------------------------------------------------

function renderMetrics(data: DashboardPageData): string {
  const m = data.metrics;
  if (!m) {
    return `
  <section>
    <h2>Observability &amp; Metrics</h2>
    <p class="empty" data-testid="metrics-unavailable">Metrics data unavailable</p>
  </section>`;
  }
  return `
  <section>
    <h2>Observability &amp; Metrics</h2>
    <div class="cards" data-testid="metrics-cards">
      <div class="card">
        <div class="label">Uploads</div>
        <div class="value" data-testid="metric-uploads">${esc(m.uploadsTotal)}</div>
      </div>
      <div class="card">
        <div class="label">Processed</div>
        <div class="value" data-testid="metric-processed">${esc(m.processedTotal)}</div>
      </div>
      <div class="card">
        <div class="label">Published</div>
        <div class="value" data-testid="metric-published">${esc(m.publishedTotal)}</div>
      </div>
      <div class="card">
        <div class="label">Retries</div>
        <div class="value" data-testid="metric-retries">${esc(m.retriesTotal)}</div>
      </div>
      <div class="card">
        <div class="label">Failures</div>
        <div class="value" data-testid="metric-failures">${esc(m.failuresTotal)}</div>
      </div>
      <div class="card">
        <div class="label">Dup. Skips</div>
        <div class="value" data-testid="metric-duplicates">${esc(m.duplicateSkipsTotal)}</div>
      </div>
      <div class="card">
        <div class="label">Scheduled</div>
        <div class="value" data-testid="metric-scheduled">${esc(m.schedulerJobsTotal)}</div>
      </div>
    </div>
    <div class="cards" style="margin-top:1rem" data-testid="queue-cards">
      <div class="card">
        <div class="label">Queue Waiting</div>
        <div class="value">${esc(m.queueWaiting)}</div>
      </div>
      <div class="card">
        <div class="label">Queue Active</div>
        <div class="value">${esc(m.queueActive)}</div>
      </div>
      <div class="card">
        <div class="label">Queue Completed</div>
        <div class="value">${esc(m.queueCompleted)}</div>
      </div>
      <div class="card">
        <div class="label">Queue Failed</div>
        <div class="value">${esc(m.queueFailed)}</div>
      </div>
    </div>
    <p style="margin-top:.75rem;font-size:.75rem;color:#9ca3af">Collected at: ${esc(m.collectedAt)}</p>
  </section>`;
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------

const CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,sans-serif;background:#f5f5f5;color:#222;line-height:1.5}
  header{background:#1a1a2e;color:#fff;padding:1rem 2rem}
  header h1{font-size:1.25rem;font-weight:600}
  header p{font-size:0.8rem;opacity:.7;margin-top:.25rem}
  main{max-width:1200px;margin:0 auto;padding:2rem}
  section{margin-bottom:2rem}
  section h2{font-size:.8rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:.75rem}
  .cards{display:flex;flex-wrap:wrap;gap:1rem}
  .card{background:#fff;border-radius:8px;padding:1.25rem;min-width:150px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .card .label{font-size:.7rem;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.25rem}
  .card .value{font-size:1.5rem;font-weight:700;color:#1a1a2e}
  .card .value.small{font-size:.9rem;font-weight:400}
  .badge{display:inline-block;padding:.2rem .6rem;border-radius:99px;font-size:.75rem;font-weight:600}
  .badge.ok{background:#d1fae5;color:#065f46}
  .badge.warn{background:#fef3c7;color:#92400e}
  .badge.err{background:#fee2e2;color:#991b1b}
  .badge.neutral{background:#e5e7eb;color:#374151}
  table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  th{background:#f9fafb;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;padding:.6rem 1rem;text-align:left;border-bottom:1px solid #e5e7eb}
  td{padding:.75rem 1rem;font-size:.875rem;border-bottom:1px solid #f3f4f6;word-break:break-all}
  tr:last-child td{border-bottom:none}
  a{color:#2563eb;text-decoration:none}a:hover{text-decoration:underline}
  .empty{color:#9ca3af;font-style:italic;padding:1.5rem;text-align:center;display:block}
  .error-banner{background:#fee2e2;border:1px solid #fca5a5;border-radius:8px;padding:1rem 1.25rem;color:#991b1b}
  footer{max-width:1200px;margin:0 auto;padding:0 2rem 2rem;font-size:.75rem;color:#9ca3af}
`.trim();

export function renderDashboardPage(data: DashboardPageData): string {
  const version = data.health?.version ?? '—';
  const env = data.health?.env ?? '—';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PC Media Engine — Dashboard</title>
  <style>${CSS}</style>
</head>
<body>
  <header>
    <h1>PC Media Engine — Dashboard</h1>
    <p>Read-only &middot; No auth &middot; Last fetched: ${esc(data.fetchedAt)}</p>
  </header>
  <main>
    ${renderErrors(data.errors)}
    ${renderHealth(data)}
    ${renderSummary(data)}
    ${renderMetrics(data)}
    ${renderRecent(data)}
  </main>
  <footer>
    <p>Version: ${esc(version)} &middot; Env: ${esc(env)} &middot; Reload to refresh</p>
  </footer>
</body>
</html>`;
}
