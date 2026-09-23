(() => {
  if (window.__kpPartnershipVisuals) return;
  window.__kpPartnershipVisuals = true;

  const ACTIVE = new Set([
    'Warm Lead','Form Submitted','Under Review','Redirected / Referred','Proposal Sent',
    'Invoice Sent','Invoice Sent / Follow-Up Scheduled','Application Started','Active / Onboarding',
    'Affiliate Approved','Consultation Held','Booked / Active'
  ]);
  const ATTENTION = new Set([
    'Warm Lead','Form Submitted','Under Review','Redirected / Referred','Proposal Sent',
    'Invoice Sent','Invoice Sent / Follow-Up Scheduled','Application Started','Affiliate Approved','Consultation Held'
  ]);
  const RESPONDED = new Set([
    'Warm Lead','Form Submitted','Under Review','Redirected / Referred','Rejected — Not Now','Affiliate Approved',
    'Affiliate Offered','Application Started','Active / Onboarding','Nurture','Proposal Sent','Invoice Sent',
    'Invoice Sent / Follow-Up Scheduled','Consultation Held','Closed Lost','Booked / Active'
  ]);
  const ADVANCED = new Set([
    'Proposal Sent','Invoice Sent','Invoice Sent / Follow-Up Scheduled','Consultation Held','Affiliate Approved',
    'Active / Onboarding','Booked / Active'
  ]);

  let visualMode = 'Dashboard';
  const basePage = window.page;
  const baseRefresh = window.refreshPartnerships;
  const baseSetFilter = window.setPartnershipFilter;
  const baseSearch = window.searchPartnerships;

  const pct = (n,d) => d ? Math.round((n/d)*100) : 0;
  const fmt = n => new Intl.NumberFormat('en-US').format(n || 0);
  const safeDate = v => { const d=new Date(v||0); return Number.isNaN(d.getTime()) ? null : d; };
  const niceDate = v => { const d=safeDate(v); return d ? d.toLocaleDateString('en-US',{month:'short',day:'numeric'}) : '—'; };
  const statusTone = status => {
    if (['Warm Lead','Under Review','Form Submitted','Booked / Active'].includes(status)) return 'good';
    if (['Proposal Sent','Invoice Sent','Invoice Sent / Follow-Up Scheduled','Affiliate Approved','Active / Onboarding'].includes(status)) return 'blue';
    if (status === 'Delivery Failed') return 'warn';
    if (['Rejected — Not Now','Closed Lost'].includes(status)) return 'bad';
    return '';
  };

  function rows(){ return D.partnerships || []; }
  function count(status){ return rows().filter(x=>x.status===status).length; }
  function active(){ return rows().filter(x=>ACTIVE.has(x.status)).length; }
  function responded(){ return rows().filter(x=>RESPONDED.has(x.status)).length; }
  function booked(){ return count('Booked / Active'); }
  function highPriority(){ return rows().filter(x=>x.priority==='High' && !['Rejected — Not Now','Closed Lost'].includes(x.status)).length; }

  function dashboardTabs(){
    return `<div class="pv-topbar">
      <div class="pv-tabs" role="tablist" aria-label="Partnership views">
        ${['Dashboard','Pipeline','Analytics'].map(x=>`<button class="pv-tab ${visualMode===x?'active':''}" onclick="setPartnershipVisualMode('${x}')">${x}</button>`).join('')}
      </div>
      <div class="pv-actions">
        <button class="secondary mini" onclick="refreshPartnerships()">Refresh</button>
        <button class="btn mini" onclick="openPartnershipEditor()">+ Opportunity</button>
      </div>
    </div>`;
  }

  function funnel(){
    const total=rows().length;
    const stages=[
      ['Outreach', total],
      ['Responses', responded()],
      ['Active / warm', active()],
      ['Advanced', rows().filter(x=>ADVANCED.has(x.status)).length],
      ['Booked', booked()]
    ];
    const max=Math.max(total,1);
    return `<div class="pv-panel pv-funnel-panel">
      <div class="pv-panelhead"><div><span class="pv-kicker">CONVERSION</span><h3>Partnership funnel</h3></div><span class="pv-subtle">${pct(booked(),total)}% outreach → booked</span></div>
      <div class="pv-funnel">${stages.map(([label,value],i)=>`<div class="pv-funnel-step">
        <div class="pv-funnel-copy"><span>${label}</span><strong>${fmt(value)}</strong></div>
        <div class="pv-funnel-track"><i style="width:${Math.max(value?8:0,(value/max)*100)}%"></i></div>
        ${i<stages.length-1?`<small>${value?pct(stages[i+1][1],value):0}% advance</small>`:'<small>Closed partnership</small>'}
      </div>`).join('')}</div>
    </div>`;
  }

  function statusChart(){
    const keys=['Awaiting Reply','Warm Lead','Under Review','Proposal Sent','Invoice Sent','Booked / Active','Rejected — Not Now'];
    const data=keys.map(k=>[k,count(k)]).filter(([,v])=>v>0);
    const max=Math.max(...data.map(x=>x[1]),1);
    return `<div class="pv-panel">
      <div class="pv-panelhead"><div><span class="pv-kicker">PIPELINE</span><h3>Status distribution</h3></div></div>
      <div class="pv-bars">${data.length?data.map(([label,value])=>`<div class="pv-barrow"><span>${esc(label)}</span><div class="pv-bartrack"><i style="width:${(value/max)*100}%"></i></div><strong>${value}</strong></div>`).join(''):'<div class="pv-empty">No pipeline data yet.</div>'}</div>
    </div>`;
  }

  function categoryData(){
    const map={};
    rows().forEach(x=>{ const k=(x.category||'Other').trim()||'Other'; map[k]=(map[k]||0)+1; });
    return Object.entries(map).sort((a,b)=>b[1]-a[1]);
  }

  function categoryDonut(){
    const data=categoryData().slice(0,6);
    const total=data.reduce((a,[,v])=>a+v,0);
    const palette=['#8fd3ff','#4776ff','#79f2c0','#b894ff','#ffb86b','#94a3b8'];
    let cursor=0;
    const stops=data.map(([,v],i)=>{ const start=cursor; cursor += total ? (v/total)*100 : 0; return `${palette[i%palette.length]} ${start}% ${cursor}%`; });
    const gradient=stops.length?`conic-gradient(${stops.join(',')})`:'conic-gradient(#273247 0 100%)';
    return `<div class="pv-panel">
      <div class="pv-panelhead"><div><span class="pv-kicker">MIX</span><h3>Outreach by category</h3></div></div>
      <div class="pv-donutwrap">
        <div class="pv-donut" style="background:${gradient}"><div><strong>${total}</strong><span>tracked</span></div></div>
        <div class="pv-legend">${data.length?data.map(([label,value],i)=>`<div><i style="background:${palette[i%palette.length]}"></i><span>${esc(label)}</span><strong>${value}</strong></div>`).join(''):'<span class="pv-subtle">No categories yet.</span>'}</div>
      </div>
    </div>`;
  }

  function opportunityMap(){
    const items=[...rows()]
      .filter(x=>ACTIVE.has(x.status) || x.priority==='High')
      .sort((a,b)=>{
        const pa=a.priority==='High'?3:a.priority==='Normal'?2:1;
        const pb=b.priority==='High'?3:b.priority==='Normal'?2:1;
        if(pa!==pb) return pb-pa;
        return (safeDate(b.last_activity)?.getTime()||0)-(safeDate(a.last_activity)?.getTime()||0);
      }).slice(0,12);
    return `<div class="pv-panel pv-map-panel">
      <div class="pv-panelhead"><div><span class="pv-kicker">OPPORTUNITY MAP</span><h3>What deserves attention</h3></div><span class="pv-subtle">Bubble size = priority</span></div>
      <div class="pv-bubbles">${items.length?items.map(x=>{
        const size=x.priority==='High'?'xl':x.priority==='Low'?'sm':'md';
        return `<button class="pv-bubble ${size} ${statusTone(x.status)}" onclick="openPartnershipEditor('${x.id}')" title="${esc(x.status||'Opportunity')}"><strong>${esc(x.business)}</strong><span>${esc(x.status||'Open')}</span></button>`;
      }).join(''):'<div class="pv-empty">No active opportunities yet.</div>'}</div>
    </div>`;
  }

  function attentionCards(){
    const list=[...rows()].filter(x=>ATTENTION.has(x.status)||x.priority==='High')
      .sort((a,b)=>{
        const pa=a.priority==='High'?1:0,pb=b.priority==='High'?1:0;
        if(pa!==pb) return pb-pa;
        return (safeDate(b.last_activity)?.getTime()||0)-(safeDate(a.last_activity)?.getTime()||0);
      }).slice(0,5);
    return `<div class="pv-panel pv-attention-panel">
      <div class="pv-panelhead"><div><span class="pv-kicker">NEXT MOVES</span><h3>Needs attention</h3></div><button class="pv-textbtn" onclick="setPartnershipVisualMode('Pipeline')">View pipeline →</button></div>
      <div class="pv-attention-list">${list.length?list.map(x=>`<button class="pv-attention-card" onclick="openPartnershipEditor('${x.id}')"><div><span>${esc(x.category||'Partnership')}</span><strong>${esc(x.business)}</strong><small>${esc(x.next_action||'Review opportunity')}</small></div><div class="pv-attention-meta"><span class="pstatus ${statusTone(x.status)}">${esc(x.status||'Open')}</span><small>${niceDate(x.last_activity)}</small></div></button>`).join(''):'<div class="pv-empty">Nothing urgent right now.</div>'}</div>
    </div>`;
  }

  function renderDashboard(v){
    const total=rows().length;
    v.innerHTML=`${dashboardTabs()}
      <div class="pv-hero">
        <div><span class="pv-kicker">PARTNERSHIP COMMAND CENTER</span><h2>See the pipeline, not the clutter.</h2><p>Fast read on outreach health, conversion and the opportunities most likely to move.</p></div>
        <div class="pv-health"><strong>${pct(responded(),total)}%</strong><span>response rate</span></div>
      </div>
      <div class="pv-metrics">
        <div class="pv-metric"><span>Total outreach</span><strong>${fmt(total)}</strong><small>${count('Awaiting Reply')} awaiting reply</small></div>
        <div class="pv-metric"><span>Response rate</span><strong>${pct(responded(),total)}%</strong><small>${responded()} meaningful responses</small></div>
        <div class="pv-metric"><span>Active / warm</span><strong>${active()}</strong><small>${highPriority()} high priority</small></div>
        <div class="pv-metric"><span>Booked</span><strong>${booked()}</strong><small>${pct(booked(),Math.max(active(),1))}% of active pipeline</small></div>
      </div>
      ${funnel()}
      <div class="pv-grid">${statusChart()}${categoryDonut()}</div>
      ${opportunityMap()}
      ${attentionCards()}`;
  }

  function weekBuckets(){
    const now=new Date();
    const weeks=[];
    for(let i=5;i>=0;i--){
      const end=new Date(now); end.setDate(now.getDate()-i*7);
      const start=new Date(end); start.setDate(end.getDate()-6); start.setHours(0,0,0,0); end.setHours(23,59,59,999);
      weeks.push({start,end,label:start.toLocaleDateString('en-US',{month:'short',day:'numeric'}),value:0});
    }
    rows().forEach(x=>{
      const d=safeDate(x.first_outreach||x.created_at||x.last_activity); if(!d) return;
      weeks.forEach(w=>{ if(d>=w.start&&d<=w.end) w.value++; });
    });
    return weeks;
  }

  function categoryPerformance(){
    const map={};
    rows().forEach(x=>{
      const category=(x.category||'Other').trim()||'Other';
      if(!map[category]) map[category]={category,sent:0,responses:0,active:0,booked:0,awaiting:0,rejected:0,failed:0};
      const s=map[category];
      s.sent++;
      if(RESPONDED.has(x.status)) s.responses++;
      if(ACTIVE.has(x.status)) s.active++;
      if(x.status==='Booked / Active') s.booked++;
      if(x.status==='Awaiting Reply') s.awaiting++;
      if(['Rejected — Not Now','Closed Lost'].includes(x.status)) s.rejected++;
      if(x.status==='Delivery Failed') s.failed++;
    });
    return Object.values(map).map(s=>({
      ...s,
      responseRate:pct(s.responses,s.sent),
      responseToActive:pct(s.active,s.responses),
      activeRate:pct(s.active,s.sent),
      bookedRate:pct(s.booked,s.sent),
      rejectRate:pct(s.rejected,s.sent),
      failureRate:pct(s.failed,s.sent)
    })).sort((a,b)=>b.sent-a.sent||b.responseRate-a.responseRate);
  }

  function followupAge(){
    const now=new Date();
    const out={fresh:0,follow:0,stale:0,unknown:0};
    rows().filter(x=>x.status==='Awaiting Reply').forEach(x=>{
      const d=safeDate(x.first_outreach||x.created_at||x.last_activity);
      if(!d){out.unknown++;return;}
      const days=Math.max(0,Math.floor((now-d)/86400000));
      if(days<=2) out.fresh++;
      else if(days<=6) out.follow++;
      else out.stale++;
    });
    return out;
  }

  function analytics(){
    const total=rows().length;
    const categories=categoryData().slice(0,8);
    const catMax=Math.max(...categories.map(x=>x[1]),1);
    const weeks=weekBuckets();
    const weekMax=Math.max(...weeks.map(x=>x.value),1);
    const stats=categoryPerformance();
    const responseLeader=[...stats].filter(x=>x.sent>=5&&x.responses>0).sort((a,b)=>b.responseRate-a.responseRate||b.responses-a.responses)[0];
    const activeLeader=[...stats].filter(x=>x.responses>=3).sort((a,b)=>b.responseToActive-a.responseToActive||b.active-a.active)[0];
    const pipelineLeader=[...stats].sort((a,b)=>b.active-a.active||b.sent-a.sent)[0];
    const bookedLeader=[...stats].filter(x=>x.booked>0).sort((a,b)=>b.booked-a.booked||b.bookedRate-a.bookedRate)[0];
    const age=followupAge();
    return `<div class="pv-analytics-grid">
      <div class="pv-panel pv-analytics-wide">
        <div class="pv-panelhead"><div><span class="pv-kicker">ACTIVITY</span><h3>Outreach volume — last 6 weeks</h3></div></div>
        <div class="pv-weekchart">${weeks.map(w=>`<div><strong>${w.value}</strong><i style="height:${Math.max(w.value?8:2,(w.value/weekMax)*100)}%"></i><span>${w.label}</span></div>`).join('')}</div>
      </div>
      <div class="pv-panel">
        <div class="pv-panelhead"><div><span class="pv-kicker">CATEGORY SHARE</span><h3>Where you're prospecting</h3></div></div>
        <div class="pv-bars">${categories.length?categories.map(([label,value])=>`<div class="pv-barrow"><span>${esc(label)}</span><div class="pv-bartrack"><i style="width:${(value/catMax)*100}%"></i></div><strong>${value}</strong></div>`).join(''):'<div class="pv-empty">No category data yet.</div>'}</div>
      </div>
      <div class="pv-panel">
        <div class="pv-panelhead"><div><span class="pv-kicker">EFFICIENCY</span><h3>Conversion snapshot</h3></div></div>
        <div class="pv-rategrid">
          <div><strong>${pct(responded(),total)}%</strong><span>Response</span></div>
          <div><strong>${pct(active(),Math.max(responded(),1))}%</strong><span>Response → active</span></div>
          <div><strong>${pct(booked(),Math.max(active(),1))}%</strong><span>Active → booked</span></div>
          <div><strong>${pct(count('Delivery Failed'),Math.max(total,1))}%</strong><span>Delivery failure</span></div>
        </div>
      </div>
      <div class="pv-panel pv-analytics-wide pv-category-performance">
        <div class="pv-panelhead"><div><span class="pv-kicker">CATEGORY PERFORMANCE</span><h3>Which lanes are actually working</h3><span class="pv-subtle">Compare response quality and pipeline movement, not just volume.</span></div></div>
        <div class="pv-leadergrid">
          <div><span>Best response rate</span><strong>${responseLeader?esc(responseLeader.category):'—'}</strong><b>${responseLeader?responseLeader.responseRate+'%':'—'}</b></div>
          <div><span>Best response → active</span><strong>${activeLeader?esc(activeLeader.category):'—'}</strong><b>${activeLeader?activeLeader.responseToActive+'%':'—'}</b></div>
          <div><span>Largest active pipeline</span><strong>${pipelineLeader?esc(pipelineLeader.category):'—'}</strong><b>${pipelineLeader?pipelineLeader.active:'—'}</b></div>
          <div><span>Most booked wins</span><strong>${bookedLeader?esc(bookedLeader.category):'—'}</strong><b>${bookedLeader?bookedLeader.booked:'—'}</b></div>
        </div>
        <div class="pv-cat-table">
          <div class="pv-cat-head"><span>Category</span><span>Sent</span><span>Replies</span><span>Reply %</span><span>Active</span><span>Reply → active</span><span>Booked</span><span>Awaiting</span></div>
          ${stats.length?stats.map(s=>`<div class="pv-cat-row">
            <span class="pv-cat-name"><strong>${esc(s.category)}</strong><small>${s.failureRate}% failed · ${s.rejectRate}% rejected/lost</small></span>
            <span data-label="Sent">${s.sent}</span><span data-label="Replies">${s.responses}</span><span data-label="Reply %"><strong>${s.responseRate}%</strong></span><span data-label="Active">${s.active}</span><span data-label="Reply → active"><strong>${s.responseToActive}%</strong></span><span data-label="Booked">${s.booked}</span><span data-label="Awaiting">${s.awaiting}</span>
          </div>`).join(''):'<div class="pv-empty">No category performance data yet.</div>'}
        </div>
      </div>
      <div class="pv-panel">
        <div class="pv-panelhead"><div><span class="pv-kicker">FOLLOW-UP HEALTH</span><h3>Awaiting reply by age</h3></div></div>
        <div class="pv-aging-grid">
          <div><strong>${age.fresh}</strong><span>0–2 days</span><small>Fresh outreach</small></div>
          <div><strong>${age.follow}</strong><span>3–6 days</span><small>Follow-up window</small></div>
          <div><strong>${age.stale}</strong><span>7+ days</span><small>Needs another touch</small></div>
          ${age.unknown?`<div><strong>${age.unknown}</strong><span>No date</span><small>Missing outreach date</small></div>`:''}
        </div>
      </div>
      <div class="pv-panel">
        <div class="pv-panelhead"><div><span class="pv-kicker">DEFINITIONS</span><h3>How KP HQ counts conversion</h3></div></div>
        <div class="pv-definition-list">
          <div><strong>Response</strong><span>Meaningful human reply or an opportunity that moved beyond awaiting/auto-reply.</span></div>
          <div><strong>Active / warm</strong><span>Warm, review, referred, proposal, invoice, consultation, onboarding or booked.</span></div>
          <div><strong>Booked</strong><span>Only <b>Booked / Active</b> counts as a win, keeping close rate clean.</span></div>
        </div>
      </div>
    </div>`;
  }

  function renderAnalytics(v){
    v.innerHTML=`${dashboardTabs()}<div class="pv-hero compact"><div><span class="pv-kicker">PARTNERSHIP ANALYTICS</span><h2>What's actually working.</h2><p>Use this view to decide where to spend the next block of outreach.</p></div></div>${analytics()}`;
  }

  function cleanPipeline(v){
    const metrics=v.querySelector('.pmetrics'); if(metrics) metrics.remove();
    const heads=[...v.querySelectorAll('.sectionhead.psectionhead')];
    if(heads[0]) heads[0].remove();
    const attention=v.querySelector('.pattention'); if(attention) attention.remove();
    if(!v.querySelector('.pv-topbar')) v.insertAdjacentHTML('afterbegin',dashboardTabs());
    const remainingHead=v.querySelector('.sectionhead.psectionhead');
    if(remainingHead){
      const h=remainingHead.querySelector('h2'); if(h) h.textContent='Pipeline';
      const p=remainingHead.querySelector('p'); if(p) p.textContent='Search, filter and edit the full partnership CRM.';
    }
  }

  function renderVisual(){
    const v=$('view'); if(!v) return;
    if(visualMode==='Pipeline'){
      basePage();
      cleanPipeline(v);
    } else if(visualMode==='Analytics') renderAnalytics(v);
    else renderDashboard(v);
  }

  window.setPartnershipVisualMode=function(mode){
    visualMode=mode;
    if(current==='Partnerships') renderVisual();
  };

  window.page=function kpVisualPage(){
    if(current==='Partnerships') return renderVisual();
    return basePage();
  };

  if(typeof baseRefresh==='function'){
    window.refreshPartnerships=async function(){
      await baseRefresh();
      if(current==='Partnerships') renderVisual();
    };
  }

  if(typeof baseSetFilter==='function'){
    window.setPartnershipFilter=function(name){
      baseSetFilter(name);
      if(current==='Partnerships'&&visualMode==='Pipeline') cleanPipeline($('view'));
    };
  }

  if(typeof baseSearch==='function'){
    window.searchPartnerships=function(q){
      baseSearch(q);
      if(current==='Partnerships'&&visualMode==='Pipeline') cleanPipeline($('view'));
      const i=$('partnershipSearch'); if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}
    };
  }
})();
