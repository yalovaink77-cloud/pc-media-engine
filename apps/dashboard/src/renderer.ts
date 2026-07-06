import type {
  AssetDetailPageData,
  AssetDimensions,
  AssetsPageData,
  AssetThumbnail,
  BulkPublishPageData,
  CalendarEvent,
  CalendarPageData,
  CalendarTimelineResult,
  ComposerBulkPublishResult,
  ComposerPageData,
  ComposerPublishResult,
  DashboardPageData,
  JobDetailPageData,
  JobsPageData,
  PublishersPageData,
  RecentItem,
  TimelineEntry,
} from './types.js';

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

function renderNav(
  active: 'dashboard' | 'publishers' | 'jobs' | 'assets' | 'composer' | 'bulk-publish' | 'calendar',
): string {
  const dashCls = active === 'dashboard' ? 'nav-active' : '';
  const pubCls = active === 'publishers' ? 'nav-active' : '';
  const jobsCls = active === 'jobs' ? 'nav-active' : '';
  const assetsCls = active === 'assets' ? 'nav-active' : '';
  const composerCls = active === 'composer' ? 'nav-active' : '';
  const bulkCls = active === 'bulk-publish' ? 'nav-active' : '';
  const calendarCls = active === 'calendar' ? 'nav-active' : '';
  return `
    <nav class="nav" data-testid="dashboard-nav">
      <a href="/" class="${dashCls}">Dashboard</a>
      <a href="/publishers" class="${pubCls}">Publishers</a>
      <a href="/jobs" class="${jobsCls}">Jobs</a>
      <a href="/assets" class="${assetsCls}">Assets</a>
      <a href="/composer" class="${composerCls}">Composer</a>
      <a href="/bulk-publish" class="${bulkCls}">Bulk Publish</a>
      <a href="/calendar" class="${calendarCls}">Calendar</a>
    </nav>`;
}

function jobStatusBadge(status: string): string {
  if (status === 'completed') return badge(status, 'ok');
  if (status === 'failed') return badge(status, 'err');
  if (status === 'active') return badge(status, 'ok');
  if (status === 'delayed') return badge(status, 'warn');
  return badge(status, 'neutral');
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

function renderFlash(
  flash: DashboardPageData['flash'] | PublishersPageData['flash'] | JobsPageData['flash'],
): string {
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
  .filter-form{background:#fff;border-radius:8px;padding:1rem 1.25rem;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:1rem;display:flex;flex-wrap:wrap;gap:.75rem;align-items:flex-end}
  .filter-form label{font-size:.75rem;color:#6b7280;display:block;margin-bottom:.25rem}
  .filter-form input,.filter-form select{padding:.4rem .55rem;border:1px solid #d1d5db;border-radius:6px;font-size:.85rem}
  .detail-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem}
  .detail-card{background:#fff;border-radius:8px;padding:1.25rem;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .detail-card h3{font-size:.75rem;text-transform:uppercase;color:#9ca3af;margin-bottom:.5rem}
  .detail-list{font-size:.85rem;color:#374151}
  .detail-list dt{font-weight:600;margin-top:.5rem}
  .detail-list dd{margin-left:0;color:#6b7280;word-break:break-all}
  .retry-list{margin:.5rem 0 0;padding-left:1.1rem;font-size:.8rem}
  .retry-list li{margin-bottom:.35rem}
  .asset-thumb{width:48px;height:48px;object-fit:cover;border-radius:4px;background:#f3f4f6;display:block}
  .asset-thumb-placeholder{width:48px;height:48px;border-radius:4px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-size:.65rem;color:#9ca3af}
  .asset-preview{max-width:320px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .publisher-checklist{list-style:none;padding:0;margin:.5rem 0}
  .publisher-checklist li{margin-bottom:.35rem;font-size:.85rem}
  .confirm-panel{border:1px solid #fcd34d;background:#fffbeb;border-radius:8px;padding:1rem 1.25rem;margin-top:1rem}
  footer{max-width:1200px;margin:0 auto;padding:0 2rem 2rem;font-size:.75rem;color:#9ca3af}
`.trim();

function renderJobFilters(filters: JobsPageData['filters']): string {
  const v = (key: keyof JobsPageData['filters']) => esc(filters[key] ?? '');
  return `
  <form class="filter-form" method="get" action="/jobs" data-testid="jobs-filter-form">
    <div>
      <label for="status">Status</label>
      <select name="status" id="status">
        <option value="">All</option>
        ${['waiting', 'active', 'delayed', 'failed', 'completed']
          .map(
            (s) => `<option value="${s}"${filters.status === s ? ' selected' : ''}>${s}</option>`,
          )
          .join('')}
      </select>
    </div>
    <div>
      <label for="publisher">Publisher</label>
      <input type="text" name="publisher" id="publisher" value="${v('publisher')}" placeholder="mock">
    </div>
    <div>
      <label for="projectId">Project ID</label>
      <input type="text" name="projectId" id="projectId" value="${v('projectId')}">
    </div>
    <div>
      <label for="assetId">Asset ID</label>
      <input type="text" name="assetId" id="assetId" value="${v('assetId')}">
    </div>
    <div>
      <label for="limit">Limit</label>
      <input type="number" name="limit" id="limit" value="${v('limit') || '50'}" min="1" max="200">
    </div>
    <button type="submit" class="btn btn-neutral">Filter</button>
  </form>`;
}

function renderJobsTable(data: JobsPageData): string {
  if (!data.result) {
    return `<p class="empty" data-testid="jobs-unavailable">Jobs unavailable — configure DASHBOARD_API_KEY and Redis</p>`;
  }
  if (!data.result.jobs.length) {
    return `<p class="empty" data-testid="jobs-empty">No publishing jobs match the current filters</p>`;
  }

  const rows = data.result.jobs
    .map(
      (job) => `
    <tr data-testid="job-row-${esc(job.id)}">
      <td><a href="/jobs/${esc(job.id)}">${esc(job.id)}</a></td>
      <td>${jobStatusBadge(job.status)}</td>
      <td>${esc(job.publisher)}</td>
      <td>${esc(job.title)}</td>
      <td>${esc(job.retryCount)} / ${esc(job.maxAttempts)}</td>
      <td>${formatDate(job.createdAt)}</td>
      <td>${formatDate(job.updatedAt)}</td>
    </tr>`,
    )
    .join('');

  return `
  <p style="font-size:.85rem;color:#6b7280;margin-bottom:.75rem">
    Showing ${esc(data.result.jobs.length)} of ${esc(data.result.total)} jobs
    (offset ${esc(data.result.offset)}, limit ${esc(data.result.limit)})
  </p>
  <table data-testid="jobs-table">
    <thead>
      <tr>
        <th>Job ID</th><th>Status</th><th>Publisher</th><th>Title</th>
        <th>Retries</th><th>Created</th><th>Updated</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderJobDetailSection(data: JobDetailPageData): string {
  const job = data.job;
  if (!job) {
    return `<p class="empty" data-testid="job-unavailable">Job not found or API unavailable</p>`;
  }

  const retryRows = job.retryHistory.length
    ? `<ol class="retry-list">${job.retryHistory
        .map((r) => `<li>Attempt ${esc(r.attempt)}: ${esc(r.error ?? '—')}</li>`)
        .join('')}</ol>`
    : `<p class="empty">No retry attempts recorded</p>`;

  const errorBlock = job.error
    ? `<p><strong>${esc(job.error.message ?? 'Unknown error')}</strong></p>${
        job.error.stacktrace?.length
          ? `<pre style="font-size:.75rem;overflow:auto;margin-top:.5rem">${esc(job.error.stacktrace.join('\n'))}</pre>`
          : ''
      }`
    : `<p class="empty">No error recorded</p>`;

  const retryForm =
    job.status === 'failed'
      ? `<form method="post" action="/ops/jobs/${esc(job.id)}/retry" data-testid="job-retry-form">
          <button type="submit" class="btn btn-ok">Retry Job</button>
        </form>`
      : '';

  const removeForm = `<form method="post" action="/ops/jobs/${esc(job.id)}/remove" data-testid="job-remove-form">
      <button type="submit" class="btn btn-danger">Remove Job</button>
    </form>`;

  return `
  <section data-testid="job-detail-section">
    <p style="margin-bottom:1rem">
      <a href="/jobs">&larr; Back to jobs</a>
    </p>
    <div class="cards" style="margin-bottom:1rem">
      <div class="card">
        <div class="label">Status</div>
        <div class="value small">${jobStatusBadge(job.status)}</div>
      </div>
      <div class="card">
        <div class="label">Publisher</div>
        <div class="value small">${esc(job.publisher)}</div>
      </div>
      <div class="card">
        <div class="label">Retries</div>
        <div class="value small">${esc(job.retryCount)} / ${esc(job.maxAttempts)}</div>
      </div>
      <div class="card">
        <div class="label">Queue</div>
        <div class="value small">${job.queuePaused ? badge('Paused', 'warn') : badge('Running', 'ok')}</div>
      </div>
    </div>
    <div class="detail-grid">
      <div class="detail-card">
        <h3>Metadata</h3>
        <dl class="detail-list">
          <dt>Job ID</dt><dd>${esc(job.id)}</dd>
          <dt>Name</dt><dd>${esc(job.name)}</dd>
          <dt>Queue State</dt><dd>${esc(job.queueState)}</dd>
          <dt>Created</dt><dd>${formatDate(job.createdAt)}</dd>
          <dt>Processed</dt><dd>${formatDate(job.processedAt)}</dd>
          <dt>Finished</dt><dd>${formatDate(job.finishedAt)}</dd>
          <dt>Scheduled</dt><dd>${formatDate(job.scheduledTime ?? job.scheduledFor)}</dd>
        </dl>
      </div>
      <div class="detail-card">
        <h3>Payload Summary</h3>
        <dl class="detail-list">
          <dt>Title</dt><dd>${esc(job.payload.title)}</dd>
          <dt>Slug</dt><dd>${esc(job.payload.slug)}</dd>
          <dt>Project ID</dt><dd>${esc(job.payload.projectId ?? '—')}</dd>
          <dt>Asset ID</dt><dd>${esc(job.payload.assetId ?? '—')}</dd>
          <dt>Processing Job</dt><dd>${esc(job.payload.processingJobId ?? '—')}</dd>
          <dt>Media</dt><dd>${job.payload.hasMedia ? esc(job.payload.mediaMimeType ?? 'yes') : '—'}</dd>
        </dl>
      </div>
      <div class="detail-card">
        <h3>Error Information</h3>
        ${errorBlock}
      </div>
      <div class="detail-card">
        <h3>Retry History</h3>
        ${retryRows}
      </div>
    </div>
    <div class="ops-row" style="margin-top:1.25rem" data-testid="job-ops-panel">
      ${retryForm}
      ${removeForm}
    </div>
    ${!data.apiKeyConfigured ? `<p class="ops-hint warn" data-testid="jobs-api-key-hint">Set DASHBOARD_API_KEY to run queue actions</p>` : ''}
  </section>`;
}

export function renderJobsPage(data: JobsPageData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PC Media Engine — Publishing Jobs</title>
  <style>${CSS}</style>
</head>
<body>
  <header>
    <h1>PC Media Engine — Publishing Jobs</h1>
    <p>Queue job inspection &middot; Last fetched: ${esc(data.fetchedAt)}</p>
    ${renderNav('jobs')}
  </header>
  <main>
    ${renderErrors(data.errors)}
    ${renderFlash(data.flash)}
    <section data-testid="jobs-section">
      <h2>Publishing Jobs</h2>
      ${renderJobFilters(data.filters)}
      ${renderJobsTable(data)}
    </section>
  </main>
  <footer>
    <p>Read-only list &middot; Use job detail page for retry/remove actions</p>
  </footer>
</body>
</html>`;
}

export function renderJobDetailPage(data: JobDetailPageData): string {
  const title = data.job?.title ?? 'Job Detail';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PC Media Engine — ${esc(title)}</title>
  <style>${CSS}</style>
</head>
<body>
  <header>
    <h1>PC Media Engine — Job Detail</h1>
    <p>${esc(title)} &middot; Last fetched: ${esc(data.fetchedAt)}</p>
    ${renderNav('jobs')}
  </header>
  <main>
    ${renderErrors(data.errors)}
    ${renderFlash(data.flash)}
    ${renderJobDetailSection(data)}
  </main>
  <footer>
    <p>Queue actions use existing Sprint 32 retry/remove APIs</p>
  </footer>
</body>
</html>`;
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

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDimensions(dims?: AssetDimensions): string {
  if (!dims?.width && !dims?.height) return '—';
  return `${dims.width ?? '?'} × ${dims.height ?? '?'}`;
}

function assetStatusBadge(status: string): string {
  if (status === 'ready') return badge(status, 'ok');
  if (status === 'failed') return badge(status, 'err');
  if (status === 'processing') return badge(status, 'warn');
  return badge(status, 'neutral');
}

function assetMediaUrl(apiBaseUrl: string, path?: string): string {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const base = apiBaseUrl.replace(/\/$/, '');
  const rel = path.startsWith('/') ? path : `/${path}`;
  return `${base}${rel}`;
}

function renderAssetThumbnail(apiBaseUrl: string, thumbnail?: AssetThumbnail): string {
  if (!thumbnail?.url) {
    return `<span class="asset-thumb-placeholder" data-testid="asset-thumb-missing">—</span>`;
  }
  const src = assetMediaUrl(apiBaseUrl, thumbnail.url);
  return `<img class="asset-thumb" src="${esc(src)}" alt="thumbnail" data-testid="asset-thumb" loading="lazy">`;
}

function renderAssetFilters(filters: AssetsPageData['filters']): string {
  const v = (key: keyof AssetsPageData['filters']) => esc(filters[key] ?? '');
  return `
  <form class="filter-form" method="get" action="/assets" data-testid="assets-filter-form">
    <div>
      <label for="status">Status</label>
      <select name="status" id="status">
        <option value="">All</option>
        ${['pending', 'processing', 'ready', 'failed']
          .map(
            (s) => `<option value="${s}"${filters.status === s ? ' selected' : ''}>${s}</option>`,
          )
          .join('')}
      </select>
    </div>
    <div>
      <label for="mimeType">MIME type</label>
      <input type="text" name="mimeType" id="mimeType" value="${v('mimeType')}" placeholder="image/jpeg">
    </div>
    <div>
      <label for="projectId">Project ID</label>
      <input type="text" name="projectId" id="projectId" value="${v('projectId')}">
    </div>
    <div>
      <label for="offset">Offset</label>
      <input type="number" name="offset" id="offset" value="${v('offset') || '0'}" min="0">
    </div>
    <div>
      <label for="limit">Limit</label>
      <input type="number" name="limit" id="limit" value="${v('limit') || '50'}" min="1" max="200">
    </div>
    <button type="submit" class="btn btn-neutral">Filter</button>
  </form>`;
}

function renderAssetsTable(data: AssetsPageData): string {
  if (!data.result) {
    return `<p class="empty" data-testid="assets-unavailable">Assets unavailable — is the API database configured?</p>`;
  }
  if (!data.result.assets.length) {
    return `<p class="empty" data-testid="assets-empty">No assets match the current filters</p>`;
  }

  const rows = data.result.assets
    .map(
      (asset) => `
    <tr data-testid="asset-row-${esc(asset.id)}">
      <td>${renderAssetThumbnail(data.apiBaseUrl, asset.thumbnail)}</td>
      <td><a href="/assets/${esc(asset.id)}">${esc(asset.filename)}</a></td>
      <td>${esc(asset.mimeType)}</td>
      <td>${formatDimensions(asset.dimensions)}</td>
      <td>${esc(formatBytes(asset.sizeBytes))}</td>
      <td>${assetStatusBadge(asset.status)}</td>
      <td>${esc(asset.publisherCount)}</td>
      <td>${formatDate(asset.createdAt)}</td>
    </tr>`,
    )
    .join('');

  return `
  <p style="font-size:.85rem;color:#6b7280;margin-bottom:.75rem">
    Showing ${esc(data.result.assets.length)} of ${esc(data.result.total)} assets
    (offset ${esc(data.result.offset)}, limit ${esc(data.result.limit)})
  </p>
  <table data-testid="assets-table">
    <thead>
      <tr>
        <th>Preview</th><th>Filename</th><th>MIME</th><th>Dimensions</th>
        <th>Size</th><th>Status</th><th>Publishers</th><th>Created</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderAssetDetailSection(data: AssetDetailPageData): string {
  const asset = data.asset;
  if (!asset) {
    return `<p class="empty" data-testid="asset-unavailable">Asset not found or API unavailable</p>`;
  }

  const preview = asset.thumbnail?.url
    ? `<img class="asset-preview" src="${esc(assetMediaUrl(data.apiBaseUrl, asset.thumbnail.url))}" alt="${esc(asset.filename)}" data-testid="asset-detail-preview">`
    : `<p class="empty" data-testid="asset-detail-preview-missing">No thumbnail available</p>`;

  const downloadLink = asset.downloadUrl
    ? `<a href="${esc(assetMediaUrl(data.apiBaseUrl, asset.downloadUrl))}" data-testid="asset-download-link">Download original</a>`
    : `<p class="empty" data-testid="asset-download-unavailable">Download unavailable</p>`;

  const timelineRows = asset.processingTimeline.length
    ? asset.processingTimeline
        .map(
          (entry) => `
      <tr data-testid="processing-row-${esc(entry.id)}">
        <td>${esc(entry.processingType)}</td>
        <td>${assetStatusBadge(entry.status)}</td>
        <td>${esc(entry.retryCount)}</td>
        <td>${formatDate(entry.startedAt)}</td>
        <td>${formatDate(entry.completedAt)}</td>
        <td>${esc(entry.failureReason ?? '—')}</td>
      </tr>`,
        )
        .join('')
    : `<tr><td colspan="6" class="empty">No processing jobs recorded</td></tr>`;

  const publishRows = asset.publishingHistory.length
    ? asset.publishingHistory
        .map(
          (item) => `
      <tr data-testid="publish-row-${esc(item.id)}">
        <td>${esc(item.publisher)}</td>
        <td>${badge(item.status, item.status === 'published' ? 'ok' : 'neutral')}</td>
        <td><a href="${esc(item.url)}" target="_blank" rel="noopener">${esc(item.slug)}</a></td>
        <td>${formatDate(item.publishedAt)}</td>
      </tr>`,
        )
        .join('')
    : `<tr><td colspan="4" class="empty">No publishing history</td></tr>`;

  const metadataEntries = Object.entries(asset.metadata)
    .map(
      ([ns, fields]) => `
      <div class="detail-card" data-testid="metadata-ns-${esc(ns)}">
        <h3>${esc(ns)}</h3>
        <dl class="detail-list">
          ${Object.entries(fields)
            .map(([key, value]) => `<dt>${esc(key)}</dt><dd>${esc(String(value))}</dd>`)
            .join('')}
        </dl>
      </div>`,
    )
    .join('');

  const metadataSection = metadataEntries
    ? `<div class="detail-grid">${metadataEntries}</div>`
    : `<p class="empty">No metadata records</p>`;

  const publisherSummary = asset.publishingSummary.publishers.length
    ? asset.publishingSummary.publishers
        .map((p) => `<li>${esc(p.publisher)}: ${esc(p.count)}</li>`)
        .join('')
    : '<li class="empty">None</li>';

  return `
  <section data-testid="asset-detail-section">
    <p style="margin-bottom:1rem">
      <a href="/assets">&larr; Back to assets</a>
    </p>
    <div class="cards" style="margin-bottom:1rem">
      <div class="card">
        <div class="label">Status</div>
        <div class="value small">${assetStatusBadge(asset.status)}</div>
      </div>
      <div class="card">
        <div class="label">Size</div>
        <div class="value small">${esc(formatBytes(asset.sizeBytes))}</div>
      </div>
      <div class="card">
        <div class="label">Dimensions</div>
        <div class="value small">${formatDimensions(asset.dimensions)}</div>
      </div>
      <div class="card">
        <div class="label">Publishers</div>
        <div class="value small">${esc(asset.publisherCount)}</div>
      </div>
    </div>
    <div class="detail-grid" style="margin-bottom:1.5rem">
      <div class="detail-card">
        <h3>Preview</h3>
        ${preview}
        <div style="margin-top:1rem">${downloadLink}</div>
      </div>
      <div class="detail-card">
        <h3>Metadata</h3>
        <dl class="detail-list">
          <dt>Asset ID</dt><dd>${esc(asset.id)}</dd>
          <dt>Project ID</dt><dd>${esc(asset.projectId)}</dd>
          <dt>Filename</dt><dd>${esc(asset.filename)}</dd>
          <dt>Original filename</dt><dd>${esc(asset.originalFilename)}</dd>
          <dt>MIME type</dt><dd>${esc(asset.mimeType)}</dd>
          <dt>Storage</dt><dd>${esc(asset.storageProvider)} / ${esc(asset.storageKey)}</dd>
          <dt>Checksum</dt><dd>${esc(asset.checksum ?? '—')}</dd>
          <dt>Tags</dt><dd>${asset.tags.length ? esc(asset.tags.join(', ')) : '—'}</dd>
          <dt>Alt text</dt><dd>${esc(asset.altText ?? '—')}</dd>
          <dt>Created</dt><dd>${formatDate(asset.createdAt)}</dd>
          <dt>Updated</dt><dd>${formatDate(asset.updatedAt)}</dd>
        </dl>
      </div>
      <div class="detail-card">
        <h3>Publishing summary</h3>
        <p style="margin-bottom:.5rem">Total publishes: ${esc(asset.publishingSummary.total)}</p>
        <ul class="config-list">${publisherSummary}</ul>
      </div>
    </div>
    <div class="detail-card" style="margin-bottom:1.5rem">
      <h3>Processing timeline</h3>
      <table data-testid="processing-timeline-table">
        <thead>
          <tr>
            <th>Type</th><th>Status</th><th>Retries</th>
            <th>Started</th><th>Completed</th><th>Failure</th>
          </tr>
        </thead>
        <tbody>${timelineRows}</tbody>
      </table>
    </div>
    <div class="detail-card" style="margin-bottom:1.5rem">
      <h3>Publishing history</h3>
      <table data-testid="publishing-history-table">
        <thead>
          <tr><th>Publisher</th><th>Status</th><th>Slug</th><th>Published</th></tr>
        </thead>
        <tbody>${publishRows}</tbody>
      </table>
    </div>
    <section>
      <h2>Extended metadata</h2>
      ${metadataSection}
    </section>
  </section>`;
}

export function renderAssetsPage(data: AssetsPageData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PC Media Engine — Asset Library</title>
  <style>${CSS}</style>
</head>
<body>
  <header>
    <h1>PC Media Engine — Asset Library</h1>
    <p>Read-only media browser &middot; Last fetched: ${esc(data.fetchedAt)}</p>
    ${renderNav('assets')}
  </header>
  <main>
    ${renderErrors(data.errors)}
    <section data-testid="assets-section">
      <h2>Uploaded Assets</h2>
      ${renderAssetFilters(data.filters)}
      ${renderAssetsTable(data)}
    </section>
  </main>
  <footer>
    <p>Read-only &middot; Upload and processing workflows unchanged</p>
  </footer>
</body>
</html>`;
}

export function renderAssetDetailPage(data: AssetDetailPageData): string {
  const title = data.asset?.filename ?? 'Asset Detail';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PC Media Engine — ${esc(title)}</title>
  <style>${CSS}</style>
</head>
<body>
  <header>
    <h1>PC Media Engine — Asset Detail</h1>
    <p>${esc(title)} &middot; Last fetched: ${esc(data.fetchedAt)}</p>
    ${renderNav('assets')}
  </header>
  <main>
    ${renderErrors(data.errors)}
    ${renderAssetDetailSection(data)}
  </main>
  <footer>
    <p>Read-only inspection &middot; No edit or delete actions</p>
  </footer>
</body>
</html>`;
}

function readinessBadge(ready: boolean): string {
  return ready ? badge('Ready', 'ok') : badge('Not Ready', 'err');
}

function renderComposerAssetSelector(data: ComposerPageData): string {
  if (!data.assets) {
    return `<p class="empty" data-testid="composer-unavailable">Composer unavailable — API not configured</p>`;
  }
  const options = data.assets.assets
    .map(
      (a) =>
        `<option value="${esc(a.id)}"${data.selectedAssetId === a.id ? ' selected' : ''}>${esc(a.filename)} (${esc(a.readiness)})</option>`,
    )
    .join('');
  return `
  <form class="filter-form" method="get" action="/composer" data-testid="composer-asset-selector">
    <div>
      <label for="assetId">Asset</label>
      <select name="assetId" id="assetId" onchange="this.form.submit()">
        <option value="">Select an asset…</option>
        ${options}
      </select>
    </div>
  </form>`;
}

function renderComposerDetail(data: ComposerPageData): string {
  const asset = data.selectedAsset;
  if (!asset) {
    return `<p class="empty" data-testid="composer-empty">Select an asset to preview publishable content</p>`;
  }

  const preview = asset.thumbnail?.url
    ? `<img class="asset-preview" src="${esc(assetMediaUrl(data.apiBaseUrl, asset.thumbnail.url))}" alt="${esc(asset.filename)}" data-testid="composer-preview">`
    : `<p class="empty" data-testid="composer-preview-missing">No thumbnail preview</p>`;

  const publisherRows = asset.compatiblePublishers.length
    ? asset.compatiblePublishers
        .map(
          (p) => `
      <tr data-testid="composer-publisher-${esc(p.id)}">
        <td>${esc(p.displayName)}</td>
        <td>${p.enabled ? badge('Enabled', 'ok') : badge('Disabled', 'warn')}</td>
        <td>${p.compatible ? badge('Compatible', 'ok') : badge('Gaps', 'warn')}</td>
        <td>${p.gaps.length ? esc(p.gaps.join('; ')) : '—'}</td>
      </tr>`,
        )
        .join('')
    : `<tr><td colspan="4" class="empty">No publishers registered</td></tr>`;

  const historyRows = asset.publishingHistory.length
    ? asset.publishingHistory
        .map(
          (h) => `
      <tr>
        <td>${esc(h.publisher)}</td>
        <td>${badge(h.status, h.status === 'published' ? 'ok' : 'neutral')}</td>
        <td>${esc(h.slug)}</td>
        <td>${formatDate(h.publishedAt)}</td>
      </tr>`,
        )
        .join('')
    : `<tr><td colspan="4" class="empty">No publishing history</td></tr>`;

  const publisherOptions = asset.compatiblePublishers
    .map((p) => {
      const checked = data.selectedPublisherIds?.includes(p.id) ? ' checked' : '';
      const disabled = !p.enabled || !p.compatible ? ' disabled' : '';
      return `<li>
        <label>
          <input type="checkbox" name="publisherIds" value="${esc(p.id)}"${checked}${disabled}>
          ${esc(p.displayName)} ${p.compatible ? badge('Compatible', 'ok') : badge('Gaps', 'warn')}
        </label>
      </li>`;
    })
    .join('');

  const confirmPanel = data.confirmPublish
    ? `<div class="confirm-panel" data-testid="composer-confirm-dialog">
        <h3>Confirm Publishing</h3>
        <p>Queue publishing jobs for: <strong>${esc((data.selectedPublisherIds ?? []).join(', '))}</strong></p>
        <p style="font-size:.85rem;color:#6b7280;margin:.5rem 0">Jobs are enqueued independently. Failures on one publisher do not block others.</p>
        <form method="post" action="/ops/composer/publish" data-testid="composer-confirm-form">
          <input type="hidden" name="assetId" value="${esc(asset.id)}">
          ${(data.selectedPublisherIds ?? [])
            .map((id) => `<input type="hidden" name="publisherIds" value="${esc(id)}">`)
            .join('')}
          <input type="hidden" name="confirm" value="true">
          <button type="submit" class="btn btn-ok" data-testid="composer-confirm-button">Confirm Publish</button>
          <a href="/composer?assetId=${esc(asset.id)}" style="margin-left:.75rem;font-size:.85rem">Cancel</a>
        </form>
      </div>`
    : '';

  const publishResultPanel = data.publishResult
    ? renderPublishResultSummary(data.publishResult)
    : '';

  const warningsList = asset.validationWarnings.length
    ? `<ul class="config-list">${asset.validationWarnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`
    : `<p class="empty">No validation warnings</p>`;

  return `
  <section data-testid="composer-detail-section">
    <div class="cards" style="margin-bottom:1rem">
      <div class="card">
        <div class="label">Readiness</div>
        <div class="value small" data-testid="composer-readiness-badge">${readinessBadge(asset.readiness.ready)}</div>
      </div>
      <div class="card">
        <div class="label">Status</div>
        <div class="value small">${assetStatusBadge(asset.status)}</div>
      </div>
      <div class="card">
        <div class="label">AI Provider</div>
        <div class="value small">${esc(asset.ai.provider)}${asset.ai.aiApplied ? ' (applied)' : ''}</div>
      </div>
    </div>
    <div class="detail-grid" style="margin-bottom:1.5rem">
      <div class="detail-card">
        <h3>Preview</h3>
        ${preview}
        <dl class="detail-list" style="margin-top:1rem">
          <dt>Title</dt><dd>${esc(asset.preview.title)}</dd>
          <dt>Slug</dt><dd>${esc(asset.preview.slug)}</dd>
          <dt>Body</dt><dd>${esc(asset.preview.body)}</dd>
        </dl>
      </div>
      <div class="detail-card" data-testid="composer-seo-section">
        <h3>SEO Metadata</h3>
        <dl class="detail-list">
          <dt>SEO Title</dt><dd>${esc(asset.seo.seoTitle)}</dd>
          <dt>Slug</dt><dd>${esc(asset.seo.slug)}</dd>
          <dt>Excerpt</dt><dd>${esc(asset.seo.excerpt)}</dd>
          <dt>Meta Description</dt><dd>${esc(asset.seo.metaDescription)}</dd>
          <dt>Reading Time</dt><dd>${esc(asset.seo.readingTimeMinutes)} min</dd>
          <dt>Tags</dt><dd>${asset.seo.tags.length ? esc(asset.seo.tags.join(', ')) : '—'}</dd>
          <dt>Categories</dt><dd>${asset.seo.categories.length ? esc(asset.seo.categories.join(', ')) : '—'}</dd>
        </dl>
      </div>
      <div class="detail-card" data-testid="composer-ai-section">
        <h3>AI Metadata</h3>
        <dl class="detail-list">
          <dt>Provider</dt><dd>${esc(asset.ai.provider)}</dd>
          <dt>Applied</dt><dd>${boolBadge(asset.ai.aiApplied)}</dd>
          <dt>Message</dt><dd>${esc(asset.ai.message ?? '—')}</dd>
        </dl>
      </div>
    </div>
    <div class="detail-card" style="margin-bottom:1.5rem" data-testid="composer-publisher-section">
      <h3>Publisher Compatibility</h3>
      <table>
        <thead><tr><th>Publisher</th><th>Status</th><th>Compatible</th><th>Gaps</th></tr></thead>
        <tbody>${publisherRows}</tbody>
      </table>
    </div>
    <div class="detail-grid" style="margin-bottom:1.5rem">
      <div class="detail-card" data-testid="composer-warnings-panel">
        <h3>Validation Warnings</h3>
        ${warningsList}
      </div>
      <div class="detail-card" data-testid="composer-history-section">
        <h3>Publishing History</h3>
        <p style="font-size:.85rem;margin-bottom:.5rem">Total: ${esc(asset.publishingSummary.total)}</p>
        <table>
          <thead><tr><th>Publisher</th><th>Status</th><th>Slug</th><th>Published</th></tr></thead>
          <tbody>${historyRows}</tbody>
        </table>
      </div>
    </div>
    <div class="detail-card ops-panel" data-testid="composer-publish-panel">
      <h3>Publish to Publishers</h3>
      <form method="post" action="/ops/composer/publish" data-testid="composer-publish-form">
        <input type="hidden" name="assetId" value="${esc(asset.id)}">
        <p style="font-size:.85rem;color:#6b7280;margin-bottom:.75rem">Select one or more publishers. Each selection creates an independent queue job.</p>
        <ul class="publisher-checklist" data-testid="composer-publisher-multiselect">${publisherOptions}</ul>
        <div class="ops-row" style="margin-top:1rem">
          <button type="submit" class="btn btn-ok" data-testid="composer-publish-button">Publish</button>
        </div>
      </form>
      ${confirmPanel}
      ${publishResultPanel}
    </div>
  </section>`;
}

function renderPublishResultSummary(result: ComposerPublishResult): string {
  const queued = result.accepted.length
    ? `<ul class="config-list">${result.accepted
        .map(
          (a) =>
            `<li data-testid="publish-queued-${esc(a.publisherId)}">${esc(a.publisherId)} — job <a href="/jobs/${esc(a.jobId)}">${esc(a.jobId)}</a></li>`,
        )
        .join('')}</ul>`
    : '<p class="empty">None</p>';

  const skipped = result.skipped.length
    ? `<ul class="config-list">${result.skipped
        .map(
          (s) =>
            `<li data-testid="publish-skipped-${esc(s.publisherId)}">${esc(s.publisherId)}: ${esc(s.reason)}</li>`,
        )
        .join('')}</ul>`
    : '<p class="empty">None</p>';

  const failures = result.failures.length
    ? `<ul class="config-list">${result.failures
        .map(
          (f) =>
            `<li data-testid="publish-failure-${esc(f.publisherId)}">${esc(f.publisherId)}: ${esc(f.reason)}</li>`,
        )
        .join('')}</ul>`
    : '<p class="empty">None</p>';

  return `
  <div class="detail-card" style="margin-top:1rem" data-testid="composer-publish-result">
    <h3>Publish Result</h3>
    <div class="detail-grid">
      <div>
        <h4 style="font-size:.75rem;text-transform:uppercase;color:#065f46;margin-bottom:.35rem">Queued (${esc(result.accepted.length)})</h4>
        ${queued}
      </div>
      <div>
        <h4 style="font-size:.75rem;text-transform:uppercase;color:#92400e;margin-bottom:.35rem">Skipped (${esc(result.skipped.length)})</h4>
        ${skipped}
      </div>
      <div>
        <h4 style="font-size:.75rem;text-transform:uppercase;color:#991b1b;margin-bottom:.35rem">Validation Failures (${esc(result.failures.length)})</h4>
        ${failures}
      </div>
    </div>
  </div>`;
}

export function renderComposerPage(data: ComposerPageData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PC Media Engine — Content Composer</title>
  <style>${CSS}</style>
</head>
<body>
  <header>
    <h1>PC Media Engine — Content Composer</h1>
    <p>Draft-first publish preparation &middot; Last fetched: ${esc(data.fetchedAt)}</p>
    ${renderNav('composer')}
  </header>
  <main>
    ${renderErrors(data.errors)}
    <section data-testid="composer-section">
      <h2>Content Composer</h2>
      ${renderComposerAssetSelector(data)}
      ${renderComposerDetail(data)}
    </section>
  </main>
  <footer>
    <p>Composer publish workflow &middot; Jobs enqueue independently per publisher</p>
  </footer>
</body>
</html>`;
}

function renderBulkPublishSummaryPanel(
  assetCount: number,
  publisherCount: number,
  pairCount: number,
): string {
  return `
  <div class="detail-card" data-testid="bulk-publish-summary-panel">
    <h3>Batch Summary</h3>
    <div class="cards">
      <div class="card"><div class="label">Assets</div><div class="value">${esc(assetCount)}</div></div>
      <div class="card"><div class="label">Publishers</div><div class="value">${esc(publisherCount)}</div></div>
      <div class="card"><div class="label">Pairs</div><div class="value" data-testid="bulk-pair-count">${esc(pairCount)}</div></div>
    </div>
    <p style="font-size:.85rem;color:#6b7280;margin-top:.75rem">Each valid asset × publisher pair creates one independent queue job.</p>
  </div>`;
}

function renderBulkPublishResultSummary(result: ComposerBulkPublishResult): string {
  const queued = result.accepted.length
    ? `<ul class="config-list">${result.accepted
        .map(
          (a) =>
            `<li data-testid="bulk-queued-${esc(a.assetId)}-${esc(a.publisherId)}">${esc(a.assetId)} → ${esc(a.publisherId)} — <a href="/jobs/${esc(a.jobId)}">${esc(a.jobId)}</a></li>`,
        )
        .join('')}</ul>`
    : '<p class="empty">None</p>';

  const skipped = result.skipped.length
    ? `<ul class="config-list">${result.skipped
        .map(
          (s) =>
            `<li data-testid="bulk-skipped-${esc(s.assetId)}-${esc(s.publisherId)}">${esc(s.assetId)} → ${esc(s.publisherId)}: ${esc(s.reason)}</li>`,
        )
        .join('')}</ul>`
    : '<p class="empty">None</p>';

  const failures = result.failures.length
    ? `<ul class="config-list">${result.failures
        .map(
          (f) =>
            `<li data-testid="bulk-failure-${esc(f.assetId)}-${esc(f.publisherId)}">${esc(f.assetId)} → ${esc(f.publisherId)}: ${esc(f.reason)}</li>`,
        )
        .join('')}</ul>`
    : '<p class="empty">None</p>';

  return `
  <div class="detail-card" style="margin-top:1rem" data-testid="bulk-publish-result">
    <h3>Bulk Publish Result</h3>
    <div class="cards" style="margin-bottom:1rem">
      <div class="card"><div class="label">Queued</div><div class="value">${esc(result.summary.accepted)}</div></div>
      <div class="card"><div class="label">Skipped</div><div class="value">${esc(result.summary.skipped)}</div></div>
      <div class="card"><div class="label">Failures</div><div class="value">${esc(result.summary.failures)}</div></div>
      <div class="card"><div class="label">Pairs</div><div class="value">${esc(result.summary.pairs)}</div></div>
    </div>
    <div class="detail-grid">
      <div>
        <h4 style="font-size:.75rem;text-transform:uppercase;color:#065f46;margin-bottom:.35rem">Queued Jobs (${esc(result.accepted.length)})</h4>
        ${queued}
      </div>
      <div>
        <h4 style="font-size:.75rem;text-transform:uppercase;color:#92400e;margin-bottom:.35rem">Duplicates (${esc(result.skipped.length)})</h4>
        ${skipped}
      </div>
      <div>
        <h4 style="font-size:.75rem;text-transform:uppercase;color:#991b1b;margin-bottom:.35rem">Validation Failures (${esc(result.failures.length)})</h4>
        ${failures}
      </div>
    </div>
  </div>`;
}

function renderBulkPublishForm(data: BulkPublishPageData): string {
  const assets = data.assets?.assets ?? [];
  const assetOptions = assets
    .map((a) => {
      const checked = data.selectedAssetIds?.includes(a.id) ? ' checked' : '';
      return `<li>
        <label>
          <input type="checkbox" name="assetIds" value="${esc(a.id)}"${checked}>
          ${esc(a.filename)} ${badge(a.readiness, a.readiness === 'ready' ? 'ok' : 'warn')}
        </label>
      </li>`;
    })
    .join('');

  const publisherOptions = data.publishers
    .map((p) => {
      const checked = data.selectedPublisherIds?.includes(p.id) ? ' checked' : '';
      const disabled = !p.enabled ? ' disabled' : '';
      return `<li>
        <label>
          <input type="checkbox" name="publisherIds" value="${esc(p.id)}"${checked}${disabled}>
          ${esc(p.displayName)} ${p.enabled ? badge('Enabled', 'ok') : badge('Disabled', 'warn')}
        </label>
      </li>`;
    })
    .join('');

  const selectedAssetCount = data.selectedAssetIds?.length ?? 0;
  const selectedPublisherCount = data.selectedPublisherIds?.length ?? 0;
  const pairCount = selectedAssetCount * selectedPublisherCount;

  const confirmPanel = data.confirmBulkPublish
    ? `<div class="confirm-panel" data-testid="bulk-confirm-dialog">
        <h3>Confirm Bulk Publish</h3>
        <p>Queue <strong>${esc(pairCount)}</strong> jobs for <strong>${esc(selectedAssetCount)}</strong> assets × <strong>${esc(selectedPublisherCount)}</strong> publishers.</p>
        <p style="font-size:.85rem;color:#6b7280;margin:.5rem 0">Failures on one pair do not block remaining jobs.</p>
        <form method="post" action="/ops/bulk-publish" data-testid="bulk-confirm-form">
          ${(data.selectedAssetIds ?? [])
            .map((id) => `<input type="hidden" name="assetIds" value="${esc(id)}">`)
            .join('')}
          ${(data.selectedPublisherIds ?? [])
            .map((id) => `<input type="hidden" name="publisherIds" value="${esc(id)}">`)
            .join('')}
          <input type="hidden" name="confirm" value="true">
          <button type="submit" class="btn btn-ok" data-testid="bulk-confirm-button">Confirm Bulk Publish</button>
          <a href="/bulk-publish" style="margin-left:.75rem;font-size:.85rem">Cancel</a>
        </form>
      </div>`
    : '';

  const resultPanel = data.bulkResult ? renderBulkPublishResultSummary(data.bulkResult) : '';

  return `
  <section data-testid="bulk-publish-section">
    <form method="post" action="/ops/bulk-publish" data-testid="bulk-publish-form">
      <div class="detail-grid" style="margin-bottom:1.5rem">
        <div class="detail-card">
          <h3>Select Assets</h3>
          <ul class="publisher-checklist" data-testid="bulk-asset-multiselect">${assetOptions || '<li class="empty">No ready assets</li>'}</ul>
        </div>
        <div class="detail-card">
          <h3>Select Publishers</h3>
          <ul class="publisher-checklist" data-testid="bulk-publisher-multiselect">${publisherOptions || '<li class="empty">No publishers</li>'}</ul>
        </div>
      </div>
      ${renderBulkPublishSummaryPanel(selectedAssetCount, selectedPublisherCount, pairCount)}
      <div class="ops-row" style="margin-top:1rem">
        <button type="submit" class="btn btn-ok" data-testid="bulk-publish-button">Bulk Publish</button>
      </div>
    </form>
    ${confirmPanel}
    ${resultPanel}
  </section>`;
}

export function renderBulkPublishPage(data: BulkPublishPageData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PC Media Engine — Bulk Publish</title>
  <style>${CSS}</style>
</head>
<body>
  <header>
    <h1>PC Media Engine — Bulk Publish</h1>
    <p>Batch publish multiple assets to multiple publishers &middot; Last fetched: ${esc(data.fetchedAt)}</p>
    ${renderNav('bulk-publish')}
  </header>
  <main>
    ${renderErrors(data.errors)}
    <section>
      <h2>Bulk Publish</h2>
      ${renderBulkPublishForm(data)}
    </section>
  </main>
  <footer>
    <p>One queue job per valid asset × publisher pair &middot; Duplicate detection per pair</p>
  </footer>
</body>
</html>`;
}

function timelineTypeBadge(type: TimelineEntry['type']): string {
  if (type === 'published') return badge(type, 'ok');
  if (type === 'scheduled') return badge(type, 'warn');
  if (type === 'failed') return badge(type, 'err');
  if (type === 'duplicate_skipped') return badge('duplicate', 'warn');
  return badge(type, 'neutral');
}

function renderCalendarViewTabs(
  view: CalendarPageData['view'],
  rangeStart: string,
  rangeEnd: string,
): string {
  const base = `/calendar?start=${encodeURIComponent(rangeStart)}&end=${encodeURIComponent(rangeEnd)}`;
  const tabs: Array<{ id: CalendarPageData['view']; label: string }> = [
    { id: 'month', label: 'Month' },
    { id: 'week', label: 'Week' },
    { id: 'list', label: 'List' },
    { id: 'timeline', label: 'Timeline' },
  ];
  return `<div class="view-tabs" data-testid="calendar-view-tabs">${tabs
    .map((t) => {
      const cls = view === t.id ? 'tab-active' : '';
      return `<a href="${base}&view=${t.id}" class="${cls}" data-testid="calendar-view-${t.id}">${t.label}</a>`;
    })
    .join('')}</div>`;
}

function renderEventDetail(event: CalendarEvent): string {
  return `
  <div class="detail-card" data-testid="calendar-event-detail">
    <h3>Event Detail</h3>
    <dl class="detail-list">
      <dt>Job</dt><dd><a href="/jobs/${esc(event.jobId)}">${esc(event.jobId)}</a></dd>
      <dt>Scheduled</dt><dd>${formatDate(event.scheduledFor)}</dd>
      <dt>Publisher</dt><dd>${esc(event.publisher)}</dd>
      <dt>Asset</dt><dd>${esc(event.assetId ?? '—')}</dd>
      <dt>Title</dt><dd>${esc(event.title)}</dd>
      <dt>Slug</dt><dd>${esc(event.slug)}</dd>
      <dt>Status</dt><dd>${jobStatusBadge(event.status)}</dd>
      <dt>Retries</dt><dd>${esc(event.retryCount)} / ${esc(event.maxAttempts - 1)}</dd>
    </dl>
  </div>`;
}

function renderCalendarMonthView(data: CalendarPageData): string {
  const events = data.events?.events ?? [];
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const day = event.scheduledFor.slice(0, 10);
    const list = byDay.get(day) ?? [];
    list.push(event);
    byDay.set(day, list);
  }
  const days = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([day, items]) => `
      <div class="calendar-day" data-testid="calendar-day-${esc(day)}">
        <h4>${esc(day)}</h4>
        <ul>${items
          .map(
            (e) =>
              `<li><a href="/calendar?view=month&start=${encodeURIComponent(data.rangeStart)}&end=${encodeURIComponent(data.rangeEnd)}&eventId=${esc(e.id)}">${esc(e.title)} (${esc(e.publisher)})</a></li>`,
          )
          .join('')}</ul>
      </div>`,
    )
    .join('');
  return `<div data-testid="calendar-month-view" class="calendar-grid">${days || '<p class="empty">No scheduled events in range</p>'}</div>`;
}

function renderCalendarListView(data: CalendarPageData): string {
  const events = data.events?.events ?? [];
  const rows = events.length
    ? events
        .map(
          (e) => `
        <tr data-testid="calendar-event-row-${esc(e.id)}">
          <td><a href="/calendar?view=list&start=${encodeURIComponent(data.rangeStart)}&end=${encodeURIComponent(data.rangeEnd)}&eventId=${esc(e.id)}">${esc(e.title)}</a></td>
          <td>${formatDate(e.scheduledFor)}</td>
          <td>${esc(e.publisher)}</td>
          <td>${esc(e.assetId ?? '—')}</td>
          <td>${jobStatusBadge(e.status)}</td>
          <td>${esc(e.retryCount)}</td>
        </tr>`,
        )
        .join('')
    : '<tr><td colspan="6" class="empty">No events</td></tr>';

  return `
  <div data-testid="calendar-list-view">
    <table>
      <thead><tr><th>Title</th><th>Scheduled</th><th>Publisher</th><th>Asset</th><th>Status</th><th>Retries</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderCalendarTimelineView(timeline: CalendarTimelineResult | null): string {
  const entries = timeline?.entries ?? [];
  const rows = entries.length
    ? entries
        .map(
          (e) => `
        <tr data-testid="timeline-entry-${esc(e.id)}">
          <td>${formatDate(e.timestamp)}</td>
          <td>${timelineTypeBadge(e.type)}</td>
          <td>${esc(e.title)}</td>
          <td>${esc(e.publisher)}</td>
          <td>${esc(e.assetId ?? '—')}</td>
          <td>${e.jobId ? `<a href="/jobs/${esc(e.jobId)}">${esc(e.jobId)}</a>` : '—'}</td>
          <td>${esc(e.retryCount ?? '—')}</td>
        </tr>`,
        )
        .join('')
    : '<tr><td colspan="7" class="empty">No timeline entries</td></tr>';

  return `
  <div data-testid="calendar-timeline-view">
    <table>
      <thead><tr><th>Time</th><th>Type</th><th>Title</th><th>Publisher</th><th>Asset</th><th>Job</th><th>Retries</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function renderCalendarBody(data: CalendarPageData): string {
  const detail = data.selectedEvent ? renderEventDetail(data.selectedEvent) : '';
  let viewContent = '';
  if (data.view === 'timeline') {
    viewContent = renderCalendarTimelineView(data.timeline);
  } else if (data.view === 'list' || data.view === 'week') {
    viewContent = renderCalendarListView(data);
  } else {
    viewContent = renderCalendarMonthView(data);
  }

  return `
  <section data-testid="calendar-section">
    ${renderCalendarViewTabs(data.view, data.rangeStart, data.rangeEnd)}
    <p style="font-size:.85rem;color:#6b7280;margin:1rem 0">Range: ${formatDate(data.rangeStart)} — ${formatDate(data.rangeEnd)}</p>
    ${viewContent}
    ${detail}
  </section>`;
}

export function renderCalendarPage(data: CalendarPageData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PC Media Engine — Publishing Calendar</title>
  <style>${CSS}
  .view-tabs { display:flex; gap:.5rem; margin-bottom:1rem; }
  .view-tabs a { padding:.35rem .75rem; border-radius:.35rem; text-decoration:none; color:#374151; background:#f3f4f6; font-size:.85rem; }
  .view-tabs a.tab-active { background:#1d4ed8; color:#fff; }
  .calendar-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:1rem; }
  .calendar-day { border:1px solid #e5e7eb; border-radius:.5rem; padding:.75rem; }
  </style>
</head>
<body>
  <header>
    <h1>PC Media Engine — Publishing Calendar</h1>
    <p>Scheduled publishing &amp; timeline &middot; Last fetched: ${esc(data.fetchedAt)}</p>
    ${renderNav('calendar')}
  </header>
  <main>
    ${renderErrors(data.errors)}
    <section>
      <h2>Publishing Calendar</h2>
      ${renderCalendarBody(data)}
    </section>
  </main>
  <footer>
    <p>Reuses Sprint 25 delayed-job scheduler &middot; No live polling in Sprint 43</p>
  </footer>
</body>
</html>`;
}
