(() => {
  if (window.__kpPartnershipAttentionEnhancer) return;
  window.__kpPartnershipAttentionEnhancer = true;

  const AUTO_ATTENTION = new Set([
    'Warm Lead','Form Submitted','Under Review','Redirected / Referred','Proposal Sent',
    'Invoice Sent','Invoice Sent / Follow-Up Scheduled','Application Started','Affiliate Approved',
    'Consultation Held'
  ]);

  function needsAttention(x){
    const mode = x?.attention_override || 'Auto';
    if (mode === 'Hide') return false;
    if (mode === 'Show') return true;
    return AUTO_ATTENTION.has(x?.status) || x?.priority === 'High';
  }

  function attentionRows(limit){
    const rows = [...(D.partnerships || [])]
      .filter(needsAttention)
      .sort((a,b) => {
        const manualA = a.attention_override === 'Show' ? 1 : 0;
        const manualB = b.attention_override === 'Show' ? 1 : 0;
        if (manualA !== manualB) return manualB - manualA;
        const highA = a.priority === 'High' ? 1 : 0;
        const highB = b.priority === 'High' ? 1 : 0;
        if (highA !== highB) return highB - highA;
        return new Date(b.last_activity || 0) - new Date(a.last_activity || 0);
      });
    return Number.isFinite(limit) ? rows.slice(0, limit) : rows;
  }

  function tone(status){
    if (['Warm Lead','Under Review','Form Submitted','Booked / Active'].includes(status)) return 'good';
    if (['Rejected — Not Now','Closed Lost'].includes(status)) return 'bad';
    if (status === 'Delivery Failed') return 'warn';
    if (['Proposal Sent','Invoice Sent','Invoice Sent / Follow-Up Scheduled','Affiliate Approved','Active / Onboarding'].includes(status)) return 'blue';
    return '';
  }

  window.partnershipNeedsAttention = needsAttention;
  window.getPartnershipAttentionRows = attentionRows;

  window.setPartnershipAttention = async function(id, mode){
    if (!['Auto','Show','Hide'].includes(mode)) return;
    const {error} = await sb.from('partnership_outreach')
      .update({attention_override: mode})
      .eq('id', id)
      .eq('owner_id', OWNER);
    if (error) return alert(error.message);
    const row = (D.partnerships || []).find(x => x.id === id);
    if (row) row.attention_override = mode;
    if (typeof window.refreshPartnerships === 'function') await window.refreshPartnerships();
    if (current === 'Dashboard') page();
    if (current === 'Partnerships') enhancePartnerships();
  };

  function partnershipAttentionMarkup(x){
    const manual = x.attention_override === 'Show';
    return `
      <div class="pattention-card pat-manual-card" onclick="openPartnershipEditor('${x.id}')">
        <div class="pattention-main">
          <span class="pattention-category">${esc(x.category || 'Partnership')}</span>
          <strong>${esc(x.business)}</strong>
          <div class="pattention-meta">
            <span class="pstatus ${tone(x.status)}">${esc(x.status)}</span>
            ${x.priority === 'High' ? '<span class="ppriority">High priority</span>' : ''}
            ${manual ? '<span class="pmanualbadge">Pinned manually</span>' : ''}
          </div>
        </div>
        <div class="pattention-action">
          <span class="pattention-label">Next action</span>
          <small>${esc(x.next_action || 'Review opportunity')}</small>
          <div class="pattention-tools">
            <button class="pattention-tool" onclick="event.stopPropagation();openPartnershipEditor('${x.id}')">Edit</button>
            <button class="pattention-tool handled" onclick="event.stopPropagation();setPartnershipAttention('${x.id}','Hide')">Mark handled</button>
          </div>
        </div>
      </div>`;
  }

  function enhancePartnerships(){
    if (current !== 'Partnerships') return;
    const view = $('view');
    const box = view?.querySelector('.pattention');
    if (!box) return;
    const rows = attentionRows(8);
    box.innerHTML = rows.length ? rows.map(partnershipAttentionMarkup).join('') : '<div class="empty">Nothing urgent right now.</div>';

    const heads = [...view.querySelectorAll('.psectionhead')];
    const head = heads.find(h => h.querySelector('h2')?.textContent.trim() === 'Needs attention');
    const copy = head?.querySelector('p');
    if (copy) copy.textContent = 'Auto-detected opportunities plus anything you manually pin. Edit a lead to change this, or mark it handled here.';
  }

  const basePage = window.page;
  window.page = function kpAttentionPage(){
    const result = basePage();
    if (current === 'Partnerships') setTimeout(enhancePartnerships, 0);
    return result;
  };

  const baseOpen = window.openPartnershipEditor;
  window.openPartnershipEditor = function kpAttentionOpen(id=''){
    baseOpen(id);
    setTimeout(() => {
      const grid = document.querySelector('#partnershipModal .pformgrid');
      if (!grid || document.getElementById('pAttentionOverride')) return;
      const x = (D.partnerships || []).find(p => p.id === id) || {};
      const selected = x.attention_override || 'Auto';
      grid.insertAdjacentHTML('beforeend', `
        <label>Needs attention
          <select id="pAttentionOverride">
            <option value="Auto" ${selected === 'Auto' ? 'selected' : ''}>Auto</option>
            <option value="Show" ${selected === 'Show' ? 'selected' : ''}>Always show</option>
            <option value="Hide" ${selected === 'Hide' ? 'selected' : ''}>Hide / handled</option>
          </select>
          <small class="pattention-help">Auto follows the lead status and priority. You can manually pin or clear it anytime.</small>
        </label>`);
    }, 0);
  };

  const baseSave = window.savePartnership;
  window.savePartnership = async function kpAttentionSave(id=''){
    const mode = document.getElementById('pAttentionOverride')?.value || 'Auto';
    const business = document.getElementById('pBusiness')?.value?.trim() || '';
    await baseSave(id);
    if (id) {
      await sb.from('partnership_outreach').update({attention_override: mode}).eq('id', id).eq('owner_id', OWNER);
    } else if (business && mode !== 'Auto') {
      await sb.from('partnership_outreach').update({attention_override: mode}).eq('owner_id', OWNER).ilike('business', business);
    }
    if (typeof window.refreshPartnerships === 'function') await window.refreshPartnerships();
    if (current === 'Dashboard') page();
    if (current === 'Partnerships') enhancePartnerships();
  };

  const baseRefresh = window.refreshPartnerships;
  window.refreshPartnerships = async function kpAttentionRefresh(){
    await baseRefresh();
    if (current === 'Dashboard') page();
    if (current === 'Partnerships') enhancePartnerships();
  };

  const baseDashboard = window.dashboard;
  window.dashboard = function kpAttentionDashboard(v){
    baseDashboard(v);
    if (role !== 'owner' || !v) return;
    const card = v.querySelector('.dashp-card');
    if (!card) return;
    const rows = attentionRows(4);
    card.innerHTML = `
      <div class="dashp-cardhead">
        <div><strong>Needs attention</strong><span>${rows.length ? `${attentionRows().length} open` : 'All clear'}</span></div>
        <button class="dashp-refresh" onclick="event.stopPropagation();refreshPartnerships()">Refresh</button>
      </div>
      ${rows.length ? rows.map(x => `
        <div class="dashp-row dashp-manual-row" onclick="go('Partnerships');setTimeout(()=>openPartnershipEditor('${x.id}'),0)">
          <div class="dashp-business">
            <span>${esc(x.category || 'Partnership')}</span>
            <strong>${esc(x.business)}</strong>
            <small>${esc(x.next_action || 'Review opportunity')}</small>
          </div>
          <div class="dashp-rowright">
            <span class="pstatus ${tone(x.status)}">${esc(x.status)}</span>
            ${x.priority === 'High' ? '<span class="dashp-priority">High</span>' : ''}
            <button class="dashp-handled" onclick="event.stopPropagation();setPartnershipAttention('${x.id}','Hide')">Handled</button>
          </div>
        </div>`).join('') : '<div class="dashp-empty">Nothing needs your attention right now.</div>'}
    `;
  };

  setTimeout(() => {
    if (current === 'Partnerships') enhancePartnerships();
    if (current === 'Dashboard') page();
  }, 50);
})();
