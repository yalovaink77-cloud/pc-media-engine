import type { DashboardPageData, PublishersPageData, RecentItem } from './types.js';

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

function renderNav(active: 'dashboard' | 'publishers'): string {
  const dashCls = active === 'dashboard' ? 'nav-active' : '';
  const pubCls = active === 'publishers' ? 'nav-active' : '';
  return `
    <nav class="nav" data-testid="dashboard-nav">
      <a href="/" class="${dashCls}">Dashboard</a>
      <a href="/publishers" class="${pubCls}">Publishers</a>
    </nav>`;
}

function capabilityBadges(caps: PublishersPageData['publishers'][0]['capabilities']): string {
  const labels: Array<[keyof typeof caps, string]> = [
    ['mediaUpload', 'Media'],
    ['postCreation', 'Posts'],
    ['drafts', 'Drafts'],
    ['tags', 'Tags'],
    ['categories', 'Categories'],
    ['featuredImages', 'Featured'],
    ['scheduling', 'Scheduling'],
    ['update', 'Update'],
    ['delete', 'Delete'],
  ];
  return labels
    .filter(([key]) => caps[key])
    .map(([, label]) => badge(label, 'neutral'))
    .join(' ');
}

function renderFlash(flash: DashboardPageData['flash'] | PublishersPageData['flash']): string {
  if (!flash) return '';
  const cls = flash.type === 'ok' ? 'flash-ok' : 'flash-err';
  return `
  <section>
    <div class="flash-banner ${cls}" data-testid="flash-banner" data-flash-type="${esc(flash.type)}">
      <strong>${flash.type === 'ok' ? 'Success' : 'Error'}</strong>
      <p style="margin-top:.35rem">${esc(flash.message)}</p>
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
// Queue operations panel (Sprint 36)
// ---------------------------------------------------------------------------

function renderQueueOperations(data: DashboardPageData): string {
  const keyHint = data.apiKeyConfigured
    ? '<p class="ops-hint ok" data-testid="api-key-configured">API key configured — queue operations will authenticate via DASHBOARD_API_KEY.</p>'
    : '<p class="ops-hint warn" data-testid="api-key-missing">No DASHBOARD_API_KEY configured. Queue operations may return 401 Unauthorized when API auth is enabled.</p>';

  return `
  <section>
    <h2>Queue Operations</h2>
    ${keyHint}
    <div class="ops-panel" data-testid="queue-operations-panel">
      <div class="ops-row">
        <form method="POST" action="/ops/queue/pause" data-testid="form-pause">
          <button type="submit" class="btn btn-warn">Pause Queue</button>
        </form>
        <form method="POST" action="/ops/queue/resume" data-testid="form-resume">
          <button type="submit" class="btn btn-ok">Resume Queue</button>
        </form>
        <form method="POST" action="/ops/queue/drain" data-testid="form-drain">
          <button type="submit" class="btn btn-neutral">Drain Queue</button>
        </form>
      </div>
      <div class="ops-row ops-forms">
        <form method="POST" action="/ops/queue/retry" class="ops-form" data-testid="form-retry">
          <label for="retry-job-id">Retry failed job</label>
          <div class="ops-input-row">
            <input id="retry-job-id" name="jobId" type="text" placeholder="Job ID" required />
            <button type="submit" class="btn btn-neutral">Retry</button>
          </div>
        </form>
        <form method="POST" action="/ops/queue/remove" class="ops-form" data-testid="form-remove">
          <label for="remove-job-id">Remove job</label>
          <div class="ops-input-row">
            <input id="remove-job-id" name="jobId" type="text" placeholder="Job ID" required />
            <button type="submit" class="btn btn-danger">Remove</button>
          </div>
        </form>
      </div>
    </div>
  </section>`;
}

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
// Queue status section (Sprint 32)
// ---------------------------------------------------------------------------

function renderQueueStatus(data: DashboardPageData): string {
  const q = data.queueStatus;
  if (!q) {
    return `
  <section>
    <h2>Queue Status</h2>
    <p class="empty" data-testid="queue-status-unavailable">Queue status unavailable (no Redis connection or auth required)</p>
  </section>`;
  }
  const pausedBadge = q.paused
    ? `<span class="badge warn" data-testid="queue-paused-badge">Paused</span>`
    : `<span class="badge ok" data-testid="queue-running-badge">Running</span>`;
  return `
  <section>
    <h2>Queue Status</h2>
    <p style="margin-bottom:.75rem">State: ${pausedBadge}</p>
    <div class="cards" data-testid="queue-status-cards">
      <div class="card">
        <div class="label">Waiting</div>
        <div class="value" data-testid="queue-waiting">${esc(q.waiting)}</div>
      </div>
      <div class="card">
        <div class="label">Active</div>
        <div class="value" data-testid="queue-active">${esc(q.active)}</div>
      </div>
      <div class="card">
        <div class="label">Delayed</div>
        <div class="value" data-testid="queue-delayed">${esc(q.delayed)}</div>
      </div>
      <div class="card">
        <div class="label">Completed</div>
        <div class="value" data-testid="queue-completed">${esc(q.completed)}</div>
      </div>
      <div class="card">
        <div class="label">Failed</div>
        <div class="value" data-testid="queue-failed">${esc(q.failed)}</div>
      </div>
    </div>
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
  .flash-banner{border-radius:8px;padding:1rem 1.25rem;margin-bottom:0}
  .flash-ok{background:#d1fae5;border:1px solid #6ee7b7;color:#065f46}
  .flash-err{background:#fee2e2;border:1px solid #fca5a5;color:#991b1b}
  .ops-panel{background:#fff;border-radius:8px;padding:1.25rem;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .ops-row{display:flex;flex-wrap:wrap;gap:.75rem;margin-bottom:1rem}
  .ops-forms{gap:1.5rem}
  .ops-form{flex:1;min-width:220px}
  .ops-form label{display:block;font-size:.75rem;color:#6b7280;margin-bottom:.35rem}
  .ops-input-row{display:flex;gap:.5rem}
  .ops-input-row input{flex:1;padding:.45rem .6rem;border:1px solid #d1d5db;border-radius:6px;font-size:.875rem}
  .ops-hint{font-size:.8rem;margin-bottom:.75rem;padding:.5rem .75rem;border-radius:6px}
  .ops-hint.ok{background:#ecfdf5;color:#065f46}
  .ops-hint.warn{background:#fffbeb;color:#92400e}
  .btn{padding:.45rem 1rem;border:none;border-radius:6px;font-size:.8rem;font-weight:600;cursor:pointer}
  .btn-ok{background:#059669;color:#fff}
  .btn-warn{background:#d97706;color:#fff}
  .btn-neutral{background:#e5e7eb;color:#374151}
  .btn-danger{background:#dc2626;color:#fff}
  .nav{margin-top:.75rem;display:flex;gap:1rem;font-size:.85rem}
  .nav a{color:#cbd5e1;opacity:.8}
  .nav a.nav-active,.nav a:hover{opacity:1;color:#fff;text-decoration:none}
  .publisher-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1rem}
  .publisher-card{background:#fff;border-radius:8px;padding:1.25rem;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .publisher-card h3{font-size:1rem;font-weight:600;margin-bottom:.35rem}
  .publisher-meta{font-size:.8rem;color:#6b7280;margin-bottom:.75rem}
  .publisher-caps{margin:.75rem 0;display:flex;flex-wrap:wrap;gap:.35rem}
  .config-list{margin:.5rem 0 0;padding-left:1.1rem;font-size:.8rem;color:#4b5563}
  .config-list li{margin-bottom:.25rem}
  .publisher-actions{margin-top:1rem}
  footer{max-width:1200px;margin:0 auto;padding:0 2rem 2rem;font-size:.75rem;color:#9ca3af}
`.trim();

function renderPublisherCard(
  publisher: PublishersPageData['publishers'][0],
  detail: PublishersPageData['details'][string] | null | undefined,
): string {
  const statusBadge = publisher.enabled ? badge('Enabled', 'ok') : badge('Disabled', 'warn');
  const unavailable = detail === null;
  const configSection =
    detail && detail.configurationRequirements.length > 0
      ? `<ul class="config-list" data-testid="config-${esc(publisher.id)}">${detail.configurationRequirements
          .map(
            (req) =>
              `<li><code>${esc(req.envVar)}</code>${req.required ? ' (required)' : ' (optional)'} — ${esc(req.description)}</li>`,
          )
          .join('')}</ul>`
      : unavailable
        ? `<p class="empty" data-testid="detail-unavailable-${esc(publisher.id)}">Provider details unavailable</p>`
        : `<p class="empty">No configuration requirements listed</p>`;

  const healthForm = publisher.supportsHealthCheck
    ? `<form method="post" action="/ops/publishers/${esc(publisher.id)}/health" data-testid="health-form-${esc(publisher.id)}">
        <button type="submit" class="btn btn-neutral">Check Health</button>
      </form>`
    : `<span class="empty">Health check not supported</span>`;

  const homepage = detail?.homepageUrl
    ? ` &middot; <a href="${esc(detail.homepageUrl)}" target="_blank" rel="noopener">Docs</a>`
    : '';

  return `
    <article class="publisher-card" data-testid="publisher-card-${esc(publisher.id)}">
      <h3>${esc(publisher.displayName)}</h3>
      <p class="publisher-meta">
        ${statusBadge}
        &middot; v${esc(publisher.version)}
        &middot; <code>${esc(publisher.id)}</code>
        ${homepage}
      </p>
      ${detail?.description ? `<p style="font-size:.85rem;margin-bottom:.5rem">${esc(detail.description)}</p>` : ''}
      <div class="publisher-caps" data-testid="caps-${esc(publisher.id)}">${capabilityBadges(publisher.capabilities) || badge('None', 'neutral')}</div>
      <h4 style="font-size:.7rem;text-transform:uppercase;color:#9ca3af;margin-top:.75rem">Configuration Requirements</h4>
      ${configSection}
      <div class="publisher-actions">${healthForm}</div>
    </article>`;
}

function renderPublishersSection(data: PublishersPageData): string {
  if (!data.publishers.length) {
    return `
  <section>
    <h2>Registered Publishers</h2>
    <p class="empty" data-testid="publishers-unavailable">No publishers available — API may be unreachable</p>
  </section>`;
  }

  const cards = data.publishers.map((p) => renderPublisherCard(p, data.details[p.id])).join('');

  return `
  <section data-testid="publishers-section">
    <h2>Registered Publishers (${esc(data.publishers.length)})</h2>
    <p style="font-size:.85rem;color:#6b7280;margin-bottom:1rem">Read-only view of Publisher SDK providers. No editing or credentials management.</p>
    <div class="publisher-grid">${cards}</div>
  </section>`;
}

export function renderPublishersPage(data: PublishersPageData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PC Media Engine — Publisher Management</title>
  <style>${CSS}</style>
</head>
<body>
  <header>
    <h1>PC Media Engine — Publisher Management</h1>
    <p>Read-only provider registry &middot; Last fetched: ${esc(data.fetchedAt)}</p>
    ${renderNav('publishers')}
  </header>
  <main>
    ${renderErrors(data.errors)}
    ${renderFlash(data.flash)}
    ${renderPublishersSection(data)}
  </main>
  <footer>
    <p>Reload to refresh &middot; Health checks call provider APIs when configured</p>
  </footer>
</body>
</html>`;
}

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
    <p>Operations UI &middot; Queue controls &middot; Last fetched: ${esc(data.fetchedAt)}</p>
    ${renderNav('dashboard')}
  </header>
  <main>
    ${renderErrors(data.errors)}
    ${renderFlash(data.flash)}
    ${renderHealth(data)}
    ${renderMetrics(data)}
    ${renderSummary(data)}
    ${renderRecent(data)}
    ${renderQueueStatus(data)}
    ${renderQueueOperations(data)}
  </main>
  <footer>
    <p>Version: ${esc(version)} &middot; Env: ${esc(env)} &middot; Reload to refresh</p>
  </footer>
</body>
</html>`;
}
