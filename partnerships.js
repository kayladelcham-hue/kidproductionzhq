(() => {
  const STATUSES = [
    'Awaiting Reply','Warm Lead','Form Submitted','Under Review','Auto Reply / Received',
    'Redirected / Referred','Rejected — Not Now','Delivery Failed','Affiliate Approved',
    'Affiliate Offered','Application Started','Active / Onboarding','Nurture','Proposal Sent',
    'Invoice Sent','Invoice Sent / Follow-Up Scheduled','Consultation Held','Closed Lost','Booked / Active'
  ];
  const ACTIVE = new Set(['Warm Lead','Form Submitted','Under Review','Redirected / Referred','Proposal Sent','Invoice Sent','Invoice Sent / Follow-Up Scheduled','Application Started','Active / Onboarding','Affiliate Approved','Consultation Held','Booked / Active']);
  const ATTENTION = new Set(['Warm Lead','Form Submitted','Under Review','Redirected / Referred','Proposal Sent','Invoice Sent','Invoice Sent / Follow-Up Scheduled','Application Started','Affiliate Approved','Consultation Held']);
  let partnershipFilter = 'All';
  let partnershipSearch = '';
  let partnershipTimer = null;
  let partnershipLastLoad = null;

  if (!D.partnerships) D.partnerships = [];
  if (!pages.includes('Partnerships')) {
    const i = pages.indexOf('Resources');
    if (i >= 0) pages.splice(i, 0, 'Partnerships'); else pages.push('Partnerships');
  }

  const baseLoadAll = loadAll;
  loadAll = async function kpLoadAll(){
    await baseLoadAll();
    if (role === 'owner') D.partnerships = await load('partnership_outreach');
    partnershipLastLoad = new Date();
  };

  const basePage = page;
  page = function kpPage(){
    if (current === 'Partnerships') return partnerships($('view'));
    return basePage();
  };

  function fmtDate(v){
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  }

  function countStatus(status){ return D.partnerships.filter(x => x.status === status).length; }
  function activeCount(){ return D.partnerships.filter(x => ACTIVE.has(x.status)).length; }
  function attentionRows(){
    return D.partnerships
      .filter(x => ATTENTION.has(x.status) || x.priority === 'High')
      .sort((a,b) => {
        const pa = a.priority === 'High' ? 1 : 0, pb = b.priority === 'High' ? 1 : 0;
        if (pa !== pb) return pb-pa;
        return new Date(b.last_activity||0)-new Date(a.last_activity||0);
      })
      .slice(0,6);
  }

  function statusClass(status){
    if (['Warm Lead','Under Review','Form Submitted','Booked / Active'].includes(status)) return 'good';
    if (['Rejected — Not Now','Closed Lost'].includes(status)) return 'bad';
    if (status === 'Delivery Failed') return 'warn';
    if (['Proposal Sent','Invoice Sent','Invoice Sent / Follow-Up Scheduled','Affiliate Approved','Active / Onboarding'].includes(status)) return 'blue';
    return '';
  }

  function filtersHtml(){
    const filters = [
      ['All', D.partnerships.length],
      ['Awaiting Reply', countStatus('Awaiting Reply')],
      ['Active', activeCount()],
      ['Warm Lead', countStatus('Warm Lead')],
      ['Delivery Failed', countStatus('Delivery Failed')],
      ['Rejected — Not Now', countStatus('Rejected — Not Now')]
    ];
    return filters.map(([name,count]) => `<button class="pfilter ${partnershipFilter===name?'active':''}" onclick="setPartnershipFilter('${esc(name)}')"><span>${esc(name)}</span><b>${count}</b></button>`).join('');
  }

  function filteredRows(){
    const q = partnershipSearch.trim().toLowerCase();
    return D.partnerships.filter(x => {
      let ok = true;
      if (partnershipFilter === 'Active') ok = ACTIVE.has(x.status);
      else if (partnershipFilter !== 'All') ok = x.status === partnershipFilter;
      if (!ok) return false;
      if (!q) return true;
      return [x.business,x.category,x.campaign,x.contact_email,x.status,x.next_action,x.notes]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    }).sort((a,b) => {
      const pa = a.priority === 'High' ? 2 : a.priority === 'Normal' ? 1 : 0;
      const pb = b.priority === 'High' ? 2 : b.priority === 'Normal' ? 1 : 0;
      if (pa !== pb) return pb-pa;
      return new Date(b.last_activity||0)-new Date(a.last_activity||0);
    });
  }

  function partnerships(v){
    if (!v) return;
    const attn = attentionRows();
    const list = filteredRows();
    v.innerHTML = `
      <div class="pmetrics metrics">
        <div class="card metric"><span>Total outreach</span><strong>${D.partnerships.length}</strong></div>
        <div class="card metric"><span>Awaiting reply</span><strong>${countStatus('Awaiting Reply')}</strong></div>
        <div class="card metric"><span>Active / warm</span><strong>${activeCount()}</strong></div>
        <div class="card metric"><span>Delivery failures</span><strong>${countStatus('Delivery Failed')}</strong></div>
      </div>

      <div class="sectionhead psectionhead">
        <div><h2>Needs attention</h2><p>Warm conversations, forms, proposals, invoices and high-priority follow-ups.</p></div>
        <div class="actions">
          <button class="secondary" onclick="refreshPartnerships()">Refresh</button>
          <button class="btn" onclick="openPartnershipEditor()">+ Opportunity</button>
        </div>
      </div>
      <div class="pattention">
        ${attn.length ? attn.map(x => `
          <button class="pattention-card" onclick="openPartnershipEditor('${x.id}')">
            <div><span>${esc(x.category||'Partnership')}</span><strong>${esc(x.business)}</strong></div>
            <div><span class="pstatus ${statusClass(x.status)}">${esc(x.status)}</span><small>${esc(x.next_action||'Review opportunity')}</small></div>
          </button>`).join('') : '<div class="empty">Nothing urgent right now.</div>'}
      </div>

      <div class="sectionhead psectionhead">
        <div><h2>Partnership pipeline</h2><p>Synced from KidProductionz Gmail into KP HQ.</p></div>
        <div class="psync"><span class="pdot"></span>Auto-sync on${partnershipLastLoad?` • refreshed ${partnershipLastLoad.toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`:''}</div>
      </div>

      <div class="ptoolbar card">
        <div class="pfilters">${filtersHtml()}</div>
        <label class="psearch"><span>Search</span><input id="partnershipSearch" value="${esc(partnershipSearch)}" placeholder="Hotel, restaurant, contact, status..." oninput="searchPartnerships(this.value)"></label>
      </div>

      <div class="ptablewrap">
        <div class="ptable pthead">
          <div>Business</div><div>Status</div><div>Last activity</div><div>Next action</div><div></div>
        </div>
        <div class="ptbody">
          ${list.length ? list.map(x => `
            <button class="ptable prow" onclick="openPartnershipEditor('${x.id}')">
              <div class="pbusiness"><strong>${esc(x.business)}</strong><span>${esc(x.category||'Uncategorized')}${x.contact_email?' • '+esc(x.contact_email):''}</span></div>
              <div><span class="pstatus ${statusClass(x.status)}">${esc(x.status)}</span></div>
              <div class="pdate">${fmtDate(x.last_activity)}</div>
              <div class="pnext">${esc(x.next_action||'—')}</div>
              <div class="pchev">›</div>
            </button>`).join('') : '<div class="empty">No opportunities match this view.</div>'}
        </div>
      </div>`;
  }

  window.setPartnershipFilter = function(name){ partnershipFilter = name; if (current==='Partnerships') partnerships($('view')); };
  window.searchPartnerships = function(q){ partnershipSearch = q; if (current==='Partnerships') partnerships($('view')); const i=$('partnershipSearch'); if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);} };

  window.refreshPartnerships = async function(){
    D.partnerships = await load('partnership_outreach');
    partnershipLastLoad = new Date();
    if (current==='Partnerships') partnerships($('view'));
  };

  function optionList(selected){ return STATUSES.map(s=>`<option ${s===selected?'selected':''}>${esc(s)}</option>`).join(''); }

  window.openPartnershipEditor = function(id=''){
    const x = D.partnerships.find(p=>p.id===id) || {};
    document.body.insertAdjacentHTML('beforeend',`<div class="modalbg partnership-modalbg" id="partnershipModal"><div class="modal partnership-modal">
      <div class="modalhead"><div><div class="eyebrow">PARTNERSHIP CRM</div><h2>${id?'Opportunity':'New opportunity'}</h2></div><button class="x" onclick="closePartnershipEditor()">×</button></div>
      <div class="pformgrid">
        <label>Business<input id="pBusiness" value="${esc(x.business||'')}"></label>
        <label>Category<input id="pCategory" value="${esc(x.category||'')}"></label>
        <label>Contact email<input id="pEmail" type="email" value="${esc(x.contact_email||'')}"></label>
        <label>Priority<select id="pPriority"><option ${x.priority==='High'?'selected':''}>High</option><option ${!x.priority||x.priority==='Normal'?'selected':''}>Normal</option><option ${x.priority==='Low'?'selected':''}>Low</option></select></label>
        <label>Status<select id="pStatus">${optionList(x.status||'Awaiting Reply')}</select></label>
        <label>Follow-up due<input id="pFollow" type="date" value="${esc(x.follow_up_due||'')}"></label>
      </div>
      <label>Next action<input id="pNext" value="${esc(x.next_action||'')}"></label>
      <label>Notes<textarea id="pNotes">${esc(x.notes||'')}</textarea></label>
      ${x.gmail_thread_url?`<a class="secondary linkbtn pgmail" href="${esc(x.gmail_thread_url)}" target="_blank">Open Gmail thread ↗</a>`:''}
      <div class="actions pmodalactions">
        ${id?`<button class="danger" onclick="deletePartnership('${id}')">Delete</button>`:''}
        <button class="btn" onclick="savePartnership('${id}')">${id?'Save changes':'Add opportunity'}</button>
      </div>
    </div></div>`);
  };

  window.closePartnershipEditor = function(){ document.getElementById('partnershipModal')?.remove(); };

  window.savePartnership = async function(id=''){
    const payload = {
      owner_id: OWNER,
      business: val('pBusiness').trim(),
      category: val('pCategory').trim() || null,
      contact_email: val('pEmail').trim() || null,
      priority: val('pPriority') || 'Normal',
      status: val('pStatus') || 'Awaiting Reply',
      follow_up_due: val('pFollow') || null,
      next_action: val('pNext').trim() || null,
      notes: val('pNotes').trim() || null,
      last_activity: new Date().toISOString(),
      source: id ? (D.partnerships.find(x=>x.id===id)?.source||'Manual') : 'Manual',
      first_outreach: id ? (D.partnerships.find(x=>x.id===id)?.first_outreach||new Date().toISOString().slice(0,10)) : new Date().toISOString().slice(0,10)
    };
    if (!payload.business) return alert('Add a business name first.');
    let error;
    if (id) ({error}=await sb.from('partnership_outreach').update(payload).eq('id',id));
    else ({error}=await sb.from('partnership_outreach').insert(payload));
    if (error) return alert(error.message);
    closePartnershipEditor();
    await refreshPartnerships();
  };

  window.deletePartnership = async function(id){
    if (!confirm('Delete this opportunity from the partnership pipeline?')) return;
    const {error}=await sb.from('partnership_outreach').delete().eq('id',id);
    if (error) return alert(error.message);
    closePartnershipEditor();
    await refreshPartnerships();
  };

  async function initializePartnerships(){
    try{
      if (user && role==='owner') {
        D.partnerships = await load('partnership_outreach');
        partnershipLastLoad = new Date();
        shell();
      }
    }catch(e){ console.warn('Partnership pipeline init',e); }
    clearInterval(partnershipTimer);
    partnershipTimer = setInterval(async()=>{
      if (user && role==='owner') await refreshPartnerships();
    },60000);
  }

  setTimeout(initializePartnerships,0);
})();
