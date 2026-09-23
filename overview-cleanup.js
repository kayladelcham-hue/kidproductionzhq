(() => {
  if (window.__kpOverviewCleanup) return;
  window.__kpOverviewCleanup = true;

  const ACTIVE = new Set([
    'Warm Lead','Form Submitted','Under Review','Redirected / Referred','Proposal Sent',
    'Invoice Sent','Invoice Sent / Follow-Up Scheduled','Application Started','Active / Onboarding',
    'Affiliate Approved','Consultation Held','Booked / Active'
  ]);
  const REVIEW = new Set(['Form Submitted','Under Review','Redirected / Referred','Application Started']);
  const ATTENTION = new Set([
    'Warm Lead','Form Submitted','Under Review','Redirected / Referred','Proposal Sent',
    'Invoice Sent','Invoice Sent / Follow-Up Scheduled','Application Started','Affiliate Approved','Consultation Held'
  ]);

  function partnershipSnapshot(){
    const p = D.partnerships || [];
    const warm = p.filter(x => x.status === 'Warm Lead').length;
    const active = p.filter(x => ACTIVE.has(x.status)).length;
    const review = p.filter(x => REVIEW.has(x.status)).length;
    const booked = p.filter(x => x.status === 'Booked / Active').length;
    const attention = p.filter(x => ATTENTION.has(x.status) || x.priority === 'High').length;

    return `<section class="ov-card ov-partnerships">
      <div class="ov-cardhead">
        <div><span class="ov-kicker">PARTNERSHIPS</span><h2>Pipeline pulse</h2></div>
        <button class="ov-link" onclick="go('Partnerships')">Open →</button>
      </div>
      <div class="ov-pstats">
        <div><span>Warm</span><strong>${warm}</strong></div>
        <div><span>Active</span><strong>${active}</strong></div>
        <div><span>Review</span><strong>${review}</strong></div>
        <div><span>Booked</span><strong>${booked}</strong></div>
      </div>
      <button class="ov-attention" onclick="go('Partnerships')"><span>${attention ? `${attention} need attention` : 'Nothing urgent'}</span><b>View pipeline</b></button>
    </section>`;
  }

  function revenueSnapshot(){
    const data = typeof window.getProjectedRevenueData === 'function'
      ? window.getProjectedRevenueData()
      : {total:0,entries:[]};
    const top = data.entries?.[0];
    return `<section class="ov-card ov-revenue">
      <div class="ov-cardhead">
        <div><span class="ov-kicker">PROJECTED REVENUE</span><h2>Open pipeline</h2></div>
        <button class="ov-link" onclick="go('Finance')">Finance →</button>
      </div>
      <div class="ov-money">${money(data.total||0)}</div>
      <div class="ov-revenue-meta"><span>${data.entries?.length||0} open item${(data.entries?.length||0)===1?'':'s'}</span>${top?`<span>Top: ${esc(top.title)} · ${money(top.amount)}</span>`:''}</div>
    </section>`;
  }

  function cleanDashboard(){
    if (current !== 'Dashboard') return;
    const v = $('view');
    if (!v) return;
    const metrics = v.querySelector('.metrics');
    if (!metrics) return;

    v.querySelectorAll('.dash-partnerships,.pipeline-card,.ov-snapshot-grid').forEach(el => el.remove());

    const grid = document.createElement('div');
    grid.className = 'ov-snapshot-grid';
    grid.innerHTML = partnershipSnapshot() + revenueSnapshot();
    metrics.insertAdjacentElement('afterend', grid);
  }

  const basePage = window.page;
  window.page = function kpCleanOverviewPage(){
    const result = basePage();
    if (current === 'Dashboard') setTimeout(cleanDashboard, 0);
    return result;
  };

  const baseRefresh = window.refreshPartnerships;
  if (typeof baseRefresh === 'function') {
    window.refreshPartnerships = async function kpCleanOverviewRefresh(){
      const result = await baseRefresh();
      if (current === 'Dashboard') setTimeout(cleanDashboard, 0);
      return result;
    };
  }

  setTimeout(cleanDashboard, 0);
  setTimeout(cleanDashboard, 120);
})();
