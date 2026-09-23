(() => {
  if (window.__kpPartnershipCategoryAnalyticsSafe) return;
  window.__kpPartnershipCategoryAnalyticsSafe = true;

  const ACTIVE = new Set([
    'Warm Lead','Form Submitted','Under Review','Redirected / Referred','Proposal Sent',
    'Invoice Sent','Invoice Sent / Follow-Up Scheduled','Application Started','Active / Onboarding',
    'Affiliate Approved','Consultation Held','Booked / Active'
  ]);
  const RESPONDED = new Set([
    'Warm Lead','Form Submitted','Under Review','Redirected / Referred','Rejected — Not Now','Affiliate Approved',
    'Affiliate Offered','Application Started','Active / Onboarding','Nurture','Proposal Sent','Invoice Sent',
    'Invoice Sent / Follow-Up Scheduled','Consultation Held','Closed Lost','Booked / Active'
  ]);

  const pct=(n,d)=>d?Math.round((n/d)*100):0;
  const fmt=n=>new Intl.NumberFormat('en-US').format(n||0);
  const safe=v=>String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const rows=()=>window.D&&Array.isArray(D.partnerships)?D.partnerships:[];

  function categoryStats(){
    const map=new Map();
    rows().forEach(x=>{
      const category=(x.category||'Other').trim()||'Other';
      if(!map.has(category)) map.set(category,{category,sent:0,responses:0,active:0,booked:0,rejected:0,failed:0,awaiting:0});
      const s=map.get(category); s.sent++;
      if(RESPONDED.has(x.status)) s.responses++;
      if(ACTIVE.has(x.status)) s.active++;
      if(x.status==='Booked / Active') s.booked++;
      if(x.status==='Rejected — Not Now'||x.status==='Closed Lost') s.rejected++;
      if(x.status==='Delivery Failed') s.failed++;
      if(x.status==='Awaiting Reply') s.awaiting++;
    });
    return [...map.values()].map(s=>({...s,responseRate:pct(s.responses,s.sent),responseToActive:pct(s.active,s.responses),activeRate:pct(s.active,s.sent),bookedRate:pct(s.booked,s.sent),rejectRate:pct(s.rejected,s.sent),deliveryRate:pct(s.failed,s.sent)})).sort((a,b)=>b.sent-a.sent||b.responseRate-a.responseRate);
  }

  function leader(stats,metric,eligible=()=>true){
    return [...stats].filter(eligible).sort((a,b)=>b[metric]-a[metric]||b.sent-a.sent)[0];
  }

  function card(label,item,value,detail){
    return `<div class="pca-leader"><span>${safe(label)}</span><strong>${item?safe(item.category):'Not enough data yet'}</strong><b>${item?safe(value(item)):'—'}</b><small>${item?safe(detail(item)):'Keep collecting outcomes.'}</small></div>`;
  }

  function table(stats){
    if(!stats.length) return '<div class="pv-empty">No category performance data yet.</div>';
    return `<div class="pca-tablewrap"><div class="pca-table pca-head"><div>Category</div><div>Sent</div><div>Responses</div><div>Response %</div><div>Active</div><div>Resp → active</div><div>Booked</div><div>Awaiting</div></div>${stats.map(s=>`<div class="pca-table pca-row"><div class="pca-cat"><strong>${safe(s.category)}</strong><small>${s.deliveryRate}% delivery failure · ${s.rejectRate}% rejected/lost</small></div><div data-label="Sent">${fmt(s.sent)}</div><div data-label="Responses">${fmt(s.responses)}</div><div data-label="Response %"><strong>${s.responseRate}%</strong><i class="pca-meter"><em style="width:${Math.min(100,s.responseRate)}%"></em></i></div><div data-label="Active">${fmt(s.active)}</div><div data-label="Resp → active"><strong>${s.responseToActive}%</strong></div><div data-label="Booked">${fmt(s.booked)}</div><div data-label="Awaiting">${fmt(s.awaiting)}</div></div>`).join('')}</div>`;
  }

  function followupHealth(){
    const now=new Date(); const b={fresh:0,follow:0,stale:0,unknown:0};
    rows().filter(x=>x.status==='Awaiting Reply').forEach(x=>{
      const raw=x.first_outreach||x.created_at||x.last_activity; const d=new Date(raw||0);
      if(!raw||Number.isNaN(d.getTime())){b.unknown++;return;}
      const days=Math.max(0,Math.floor((now-d)/86400000));
      if(days<=2)b.fresh++; else if(days<=6)b.follow++; else b.stale++;
    });
    return `<div class="pv-panel pca-aging"><div class="pv-panelhead"><div><span class="pv-kicker">FOLLOW-UP HEALTH</span><h3>Awaiting reply by age</h3></div><span class="pv-subtle">Based on first outreach date</span></div><div class="pca-aging-grid"><div><strong>${b.fresh}</strong><span>0–2 days</span><small>Fresh outreach</small></div><div><strong>${b.follow}</strong><span>3–6 days</span><small>Follow-up window</small></div><div><strong>${b.stale}</strong><span>7+ days</span><small>Needs another touch or close-out</small></div>${b.unknown?`<div><strong>${b.unknown}</strong><span>No date</span><small>Missing outreach date</small></div>`:''}</div></div>`;
  }

  function definitions(){
    return `<div class="pv-panel pca-definitions"><div class="pv-panelhead"><div><span class="pv-kicker">METRIC DEFINITIONS</span><h3>What each conversion means</h3></div></div><div class="pca-def-grid"><div><strong>Response</strong><span>A meaningful human reply or an opportunity that progressed beyond awaiting/auto-reply.</span></div><div><strong>Active / warm</strong><span>Warm lead, review, referral, proposal, invoice, consultation, onboarding or booked.</span></div><div><strong>Response → active</strong><span>How often a meaningful reply becomes an active opportunity.</span></div><div><strong>Win / booked</strong><span>Only <b>Booked / Active</b> counts as a win so close rate stays clean.</span></div></div></div>`;
  }

  function fixCoreMetric(){
    const grid=document.querySelector('.pv-rategrid'); if(!grid) return;
    const cells=grid.querySelectorAll(':scope > div'); if(cells.length<3) return;
    const active=rows().filter(x=>ACTIVE.has(x.status)).length;
    const booked=rows().filter(x=>x.status==='Booked / Active').length;
    const strong=cells[2].querySelector('strong'); const label=cells[2].querySelector('span');
    const nextValue=`${pct(booked,active)}%`;
    if(strong&&strong.textContent!==nextValue) strong.textContent=nextValue;
    if(label&&label.textContent!=='Active → booked') label.textContent='Active → booked';
  }

  function enhanceAnalytics(){
    const grid=document.querySelector('.pv-analytics-grid'); if(!grid) return;
    fixCoreMetric();
    if(document.getElementById('pcaCategoryPerformance')) return;
    const stats=categoryStats();
    const responseLeader=leader(stats,'responseRate',s=>s.sent>=5&&s.responses>0);
    const activeLeader=leader(stats,'responseToActive',s=>s.responses>=3);
    const pipelineLeader=leader(stats,'active');
    const bookedLeader=leader(stats,'booked',s=>s.booked>0);
    const block=document.createElement('div'); block.id='pcaCategoryPerformance'; block.className='pca-extension';
    block.innerHTML=`<div class="pv-panel pca-wide"><div class="pv-panelhead"><div><span class="pv-kicker">CATEGORY PERFORMANCE</span><h3>Which lanes are actually working</h3><p class="pv-subtle">Compare response quality and pipeline movement by category.</p></div></div><div class="pca-leaders">${card('Best response rate',responseLeader,x=>`${x.responseRate}%`,x=>`${x.responses} responses from ${x.sent} outreaches`)}${card('Best response → active',activeLeader,x=>`${x.responseToActive}%`,x=>`${x.active} active from ${x.responses} responses`)}${card('Largest active pipeline',pipelineLeader,x=>`${x.active}`,x=>`${x.activeRate}% of outreach is active`)}${card('Most booked wins',bookedLeader,x=>`${x.booked}`,x=>`${x.bookedRate}% of outreach booked`)}</div>${table(stats)}</div>${followupHealth()}${definitions()}`;
    grid.appendChild(block);
  }

  const baseMode=window.setPartnershipVisualMode;
  if(typeof baseMode==='function'){
    window.setPartnershipVisualMode=function(mode){
      const result=baseMode.apply(this,arguments);
      if(mode==='Analytics') requestAnimationFrame(enhanceAnalytics);
      return result;
    };
  }

  const baseRefresh=window.refreshPartnerships;
  if(typeof baseRefresh==='function'){
    window.refreshPartnerships=async function(){
      const result=await baseRefresh.apply(this,arguments);
      requestAnimationFrame(enhanceAnalytics);
      return result;
    };
  }

  setTimeout(enhanceAnalytics,0);
})();
