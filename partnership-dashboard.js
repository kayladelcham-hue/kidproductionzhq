(() => {
  const baseDashboard = dashboard;
  const OVERVIEW_ACTIVE = new Set([
    'Warm Lead','Form Submitted','Under Review','Redirected / Referred','Proposal Sent',
    'Invoice Sent','Invoice Sent / Follow-Up Scheduled','Application Started','Active / Onboarding',
    'Affiliate Approved','Consultation Held','Booked / Active'
  ]);
  const REVIEW = new Set(['Form Submitted','Under Review','Redirected / Referred','Application Started']);

  function statusTone(status){
    if (['Warm Lead','Under Review','Form Submitted','Booked / Active'].includes(status)) return 'good';
    if (['Proposal Sent','Invoice Sent','Invoice Sent / Follow-Up Scheduled','Affiliate Approved','Active / Onboarding'].includes(status)) return 'blue';
    if (status === 'Delivery Failed') return 'warn';
    if (['Rejected — Not Now','Closed Lost'].includes(status)) return 'bad';
    return '';
  }

  function hotPartnerships(){
    return [...(D.partnerships||[])]
      .filter(x => OVERVIEW_ACTIVE.has(x.status))
      .sort((a,b) => {
        const score = x => (x.priority==='High'?100:0) + (x.status==='Warm Lead'?40:0) + (x.status==='Booked / Active'?35:0) + (new Date(x.last_activity||0).getTime()/1e13);
        return score(b)-score(a);
      })
      .slice(0,4);
  }

  dashboard = function kpDashboard(v){
    baseDashboard(v);
    if (role !== 'owner' || !v) return;

    const p = D.partnerships || [];
    const warm = p.filter(x => x.status === 'Warm Lead').length;
    const active = p.filter(x => OVERVIEW_ACTIVE.has(x.status)).length;
    const review = p.filter(x => REVIEW.has(x.status)).length;
    const booked = p.filter(x => x.status === 'Booked / Active').length;
    const hot = hotPartnerships();

    const wrap = document.createElement('section');
    wrap.className = 'dash-partnerships';
    wrap.innerHTML = `
      <div class="dashp-head">
        <div>
          <span class="dashp-kicker">PARTNERSHIPS</span>
          <h2>Partnership pulse</h2>
          <p>Live snapshot of creator, hospitality and brand outreach.</p>
        </div>
        <button class="secondary dashp-view" onclick="go('Partnerships')">View pipeline →</button>
      </div>

      <div class="dashp-metrics">
        <div><span>Warm leads</span><strong>${warm}</strong></div>
        <div><span>Active</span><strong>${active}</strong></div>
        <div><span>In review</span><strong>${review}</strong></div>
        <div><span>Booked</span><strong>${booked}</strong></div>
      </div>

      <div class="dashp-card">
        <div class="dashp-cardhead"><strong>Top opportunities</strong><span>${hot.length ? 'Needs attention' : 'No active opportunities'}</span></div>
        ${hot.length ? hot.map(x => `
          <button class="dashp-row" onclick="go('Partnerships');setTimeout(()=>openPartnershipEditor('${x.id}'),0)">
            <div class="dashp-business">
              <span>${esc(x.category||'Partnership')}</span>
              <strong>${esc(x.business)}</strong>
              <small>${esc(x.next_action||'Review opportunity')}</small>
            </div>
            <div class="dashp-rowright">
              <span class="pstatus ${statusTone(x.status)}">${esc(x.status)}</span>
              ${x.priority==='High'?'<span class="dashp-priority">High</span>':''}
            </div>
          </button>`).join('') : '<div class="dashp-empty">No active partnership opportunities yet.</div>'}
      </div>`;

    const metrics = v.querySelector('.metrics');
    if (metrics) metrics.insertAdjacentElement('afterend', wrap);
    else v.prepend(wrap);
  };
})();
