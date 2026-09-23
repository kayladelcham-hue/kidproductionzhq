(() => {
  if (window.__kpAppVisuals) return;
  window.__kpAppVisuals = true;

  const norm = v => String(v || '').trim().toLowerCase();
  const num = v => +v || 0;
  const sum = (rows, key) => rows.reduce((t, x) => t + num(typeof key === 'function' ? key(x) : x[key]), 0);
  const unique = arr => [...new Set(arr.filter(Boolean))];
  const fmt = n => new Intl.NumberFormat('en-US').format(num(n));
  const cash = n => money(num(n));
  const safeDate = v => { const d = new Date(v || 0); return Number.isNaN(d.getTime()) ? null : d; };
  const pct = (n, d) => d ? Math.round((n / d) * 100) : 0;

  function countsBy(rows, getter) {
    const out = {};
    rows.forEach(x => {
      const k = String(getter(x) || 'Other').trim() || 'Other';
      out[k] = (out[k] || 0) + 1;
    });
    return Object.entries(out).sort((a,b) => b[1] - a[1]);
  }

  function panel(title, kicker, body, note='') {
    return `<section class="av-panel">
      <div class="av-head"><div><span class="av-kicker">${esc(kicker)}</span><h3>${esc(title)}</h3></div>${note ? `<span class="av-note">${esc(note)}</span>` : ''}</div>
      ${body}
    </section>`;
  }

  function metrics(items) {
    return `<div class="av-metrics">${items.map(([label,value,sub]) => `<div class="av-metric"><span>${esc(label)}</span><strong>${value}</strong>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`).join('')}</div>`;
  }

  function bars(rows, formatter=v=>fmt(v), limit=7) {
    const list = rows.slice(0, limit);
    const max = Math.max(...list.map(x=>num(x[1])), 1);
    return `<div class="av-bars">${list.length ? list.map(([label,value]) => `<div class="av-barrow"><span title="${esc(label)}">${esc(label)}</span><div class="av-track"><i style="width:${Math.max(value ? 5 : 0, (num(value)/max)*100)}%"></i></div><strong>${formatter(value)}</strong></div>`).join('') : '<div class="av-empty">No data yet.</div>'}</div>`;
  }

  function donut(rows, centerLabel='tracked') {
    const list = rows.slice(0,6);
    const total = list.reduce((t,x)=>t+num(x[1]),0);
    const colors = ['#8fd3ff','#4776ff','#79f2c0','#b894ff','#ffb86b','#94a3b8'];
    let cursor = 0;
    const stops = list.map(([,value],i)=>{
      const start = cursor;
      cursor += total ? (num(value)/total)*100 : 0;
      return `${colors[i % colors.length]} ${start}% ${cursor}%`;
    });
    const gradient = stops.length ? `conic-gradient(${stops.join(',')})` : 'conic-gradient(#273247 0 100%)';
    return `<div class="av-donutwrap"><div class="av-donut" style="background:${gradient}"><div><strong>${fmt(total)}</strong><span>${esc(centerLabel)}</span></div></div><div class="av-legend">${list.length ? list.map(([label,value],i)=>`<div><i style="background:${colors[i%colors.length]}"></i><span>${esc(label)}</span><strong>${fmt(value)}</strong></div>`).join('') : '<span class="av-note">No data yet.</span>'}</div></div>`;
  }

  function trendBars(points, valueFormatter=v=>fmt(v)) {
    const max = Math.max(...points.map(x=>Math.max(num(x.income),num(x.expense),num(x.value))),1);
    return `<div class="av-trend">${points.map(x=>`<div class="av-trendcol"><div class="av-trendbars">${x.income != null ? `<i class="income" style="height:${Math.max(x.income?5:2,(num(x.income)/max)*100)}%" title="${cash(x.income)} income"></i>`:''}${x.expense != null ? `<i class="expense" style="height:${Math.max(x.expense?5:2,(num(x.expense)/max)*100)}%" title="${cash(x.expense)} expense"></i>`:''}${x.value != null ? `<i class="single" style="height:${Math.max(x.value?5:2,(num(x.value)/max)*100)}%" title="${valueFormatter(x.value)}"></i>`:''}</div><strong>${x.income != null ? valueFormatter(num(x.income)-num(x.expense)) : valueFormatter(x.value)}</strong><span>${esc(x.label)}</span></div>`).join('')}</div>`;
  }

  function insertVisual(v, html, afterMetrics=false) {
    const wrap = document.createElement('div');
    wrap.className = 'av-section';
    wrap.innerHTML = html;
    if (afterMetrics) {
      const m = v.querySelector('.metrics');
      if (m) return m.insertAdjacentElement('afterend', wrap);
    }
    v.prepend(wrap);
  }

  const baseClients = window.clients;
  window.clients = function kpVisualClients(v){
    baseClients(v);
    if (!v || role !== 'owner') return;
    const clients = D.clients || [], projects = D.projects || [];
    const activeProjects = projects.filter(p=>!['complete','cancelled'].includes(norm(p.status)));
    const statusData = countsBy(clients, x=>x.status || 'Lead');
    const load = clients.map(c=>[c.name, activeProjects.filter(p=>p.client_id===c.id).length]).sort((a,b)=>b[1]-a[1]);
    const engaged = clients.filter(c=>projects.some(p=>p.client_id===c.id)).length;
    insertVisual(v,
      metrics([
        ['Total clients', fmt(clients.length), `${engaged} with projects`],
        ['Active projects', fmt(activeProjects.length), 'Across client roster'],
        ['Engagement rate', `${pct(engaged, clients.length)}%`, 'Clients with a project'],
        ['Avg. projects/client', clients.length ? (projects.length/clients.length).toFixed(1) : '0.0', `${projects.length} total projects`]
      ]) + `<div class="av-grid">${panel('Client status','PORTFOLIO',donut(statusData,'clients'))}${panel('Project load by client','CAPACITY',bars(load,v=>fmt(v)))}</div>`
    );
  };

  const baseProjects = window.projects;
  window.projects = function kpVisualProjects(v){
    baseProjects(v);
    if (!v || role !== 'owner') return;
    const rows = D.projects || [];
    const active = rows.filter(x=>!['complete','cancelled'].includes(norm(x.status)));
    const totalValue = sum(active,'value');
    const statusData = countsBy(rows,x=>x.status||'Open');
    const valueData = active.filter(x=>num(x.value)>0).map(x=>[x.name,num(x.value)]).sort((a,b)=>b[1]-a[1]);
    const nextActions = active.filter(x=>String(x.next_action||'').trim()).length;
    insertVisual(v,
      metrics([
        ['Active projects', fmt(active.length), `${rows.length} total`],
        ['Open value', cash(totalValue), 'Active project value'],
        ['Avg. active value', cash(active.length ? totalValue/active.length : 0), 'Per active project'],
        ['Next actions set', `${pct(nextActions,active.length)}%`, `${nextActions} of ${active.length} active`]
      ]) + `<div class="av-grid">${panel('Project status','PIPELINE',donut(statusData,'projects'))}${panel('Largest active projects','VALUE',bars(valueData,v=>cash(v)))}</div>`
    );
  };

  const baseProductions = window.productions;
  window.productions = function kpVisualProductions(v){
    baseProductions(v);
    if (!v || role !== 'owner') return;
    const rows = D.productions || [];
    const upcoming = rows.filter(x=>norm(x.status)!=='complete');
    const clientValue = sum(rows,'client_value');
    const cost = sum(rows,'production_cost');
    const margin = clientValue - cost;
    const statusData = countsBy(rows,x=>x.status||'Planning');
    const marginData = rows.map(x=>[x.name,num(x.client_value)-num(x.production_cost)]).sort((a,b)=>b[1]-a[1]);
    insertVisual(v,
      metrics([
        ['Upcoming', fmt(upcoming.length), `${rows.length} total productions`],
        ['Client value', cash(clientValue), 'Across productions'],
        ['Production cost', cash(cost), 'Tracked cost'],
        ['Gross margin', cash(margin), clientValue ? `${pct(margin,clientValue)}% margin` : 'No booked value yet']
      ]) + `<div class="av-grid">${panel('Production status','OPERATIONS',donut(statusData,'shoots'))}${panel('Margin by production','PROFITABILITY',bars(marginData,v=>cash(v)))}</div>`
    );
  };

  const baseTeam = window.team;
  window.team = function kpVisualTeam(v){
    baseTeam(v);
    if (!v || role !== 'owner') return;
    const contractors = D.contractors || [], agreements = D.agreements || [];
    const roles = countsBy(contractors,x=>x.role||'General');
    const markets = unique(contractors.map(x=>x.market));
    const contractorLoads = contractors.map(c=>[c.name, agreements.filter(a=>a.contractor_id===c.id).length]).sort((a,b)=>b[1]-a[1]);
    const signed = agreements.filter(a=>['signed','active','complete'].includes(norm(a.status))).length;
    insertVisual(v,
      metrics([
        ['Contractors', fmt(contractors.length), `${roles.length} role types`],
        ['Agreements', fmt(agreements.length), `${signed} signed / active`],
        ['Markets', fmt(markets.length), markets.slice(0,2).join(' • ') || 'No markets set'],
        ['Agreement rate', `${pct(signed,agreements.length)}%`, 'Signed / active agreements']
      ]) + `<div class="av-grid">${panel('Team by role','ROSTER',donut(roles,'people'))}${panel('Agreement load','WORKLOAD',bars(contractorLoads,v=>fmt(v)))}</div>`
    );
  };

  const baseDocuments = window.documents;
  window.documents = function kpVisualDocuments(v){
    baseDocuments(v);
    if (!v || role !== 'owner') return;
    const docs = D.documents || [];
    const invoices = docs.filter(x=>x.type==='Invoice');
    const contracts = docs.filter(x=>x.type==='Contract');
    const outstanding = invoices.filter(x=>['sent','open','overdue','past_due','draft'].includes(norm(x.status)));
    const paid = invoices.filter(x=>['paid','complete'].includes(norm(x.status)));
    const statusData = countsBy(invoices,x=>x.status||'Draft');
    const typeData = [['Invoices',invoices.length],['Contracts',contracts.length],['Other',Math.max(0,docs.length-invoices.length-contracts.length)]].filter(x=>x[1]>0);
    insertVisual(v,
      metrics([
        ['Documents', fmt(docs.length), `${invoices.length} invoices`],
        ['Outstanding', cash(sum(outstanding,'amount')), `${outstanding.length} open invoices`],
        ['Paid', cash(sum(paid,'amount')), `${paid.length} paid invoices`],
        ['Contracts', fmt(contracts.length), 'Agreement documents']
      ]) + `<div class="av-grid">${panel('Document mix','LIBRARY',donut(typeData,'documents'))}${panel('Invoice status','COLLECTIONS',bars(statusData,v=>fmt(v)))}</div>`
    );
  };

  function sixWeekCashflow(){
    const tx = D.transactions || [], now = new Date(), buckets=[];
    for(let i=5;i>=0;i--){
      const end = new Date(now); end.setDate(now.getDate()-i*7); end.setHours(23,59,59,999);
      const start = new Date(end); start.setDate(end.getDate()-6); start.setHours(0,0,0,0);
      buckets.push({start,end,label:start.toLocaleDateString('en-US',{month:'short',day:'numeric'}),income:0,expense:0});
    }
    tx.forEach(t=>{
      const d=safeDate(t.transaction_date||t.created_at); if(!d) return;
      const b=buckets.find(x=>d>=x.start&&d<=x.end); if(!b) return;
      if(norm(t.type)==='income') b.income += num(t.amount); else if(norm(t.type)==='expense') b.expense += num(t.amount);
    });
    return buckets;
  }

  const baseFinance = window.finance;
  window.finance = function kpVisualFinance(v){
    baseFinance(v);
    if (!v || role !== 'owner') return;
    const tx = D.transactions || [];
    const income = sum(tx.filter(x=>norm(x.type)==='income'),'amount');
    const expense = sum(tx.filter(x=>norm(x.type)==='expense'),'amount');
    const mix = [['Income',income],['Expenses',expense]].filter(x=>x[1]>0);
    const html = `<div class="av-grid av-finance-grid">${panel('Cash flow — last 6 weeks','TREND',trendBars(sixWeekCashflow(),v=>cash(v)))}${panel('Money in vs. out','MIX',donut(mix,'cash flow'), income ? `${pct(expense,income)}% expense ratio` : '')}</div>`;
    insertVisual(v,html,true);
  };

  function currentMonthLoad(){
    const now = calDate || new Date();
    const y=now.getFullYear(), m=now.getMonth();
    const events=(D.events||[]).filter(x=>{const d=safeDate(x.event_date);return d&&d.getFullYear()===y&&d.getMonth()===m;});
    const prods=(D.productions||[]).filter(x=>{const d=safeDate(x.production_date);return d&&d.getFullYear()===y&&d.getMonth()===m;});
    const dayNames=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const counts=dayNames.map(x=>[x,0]);
    [...events.map(x=>x.event_date),...prods.map(x=>x.production_date)].forEach(v=>{const d=safeDate(v);if(d) counts[d.getDay()][1]++;});
    return {events,prods,counts};
  }

  const baseCalendar = window.calendar;
  window.calendar = function kpVisualCalendar(v){
    baseCalendar(v);
    if (!v || role !== 'owner') return;
    const data=currentMonthLoad();
    const dates=unique([...data.events.map(x=>x.event_date),...data.prods.map(x=>x.production_date)]);
    const total=data.events.length+data.prods.length;
    insertVisual(v,
      metrics([
        ['Month activity', fmt(total), 'Events + productions'],
        ['Events', fmt(data.events.length), 'Calendar events'],
        ['Productions', fmt(data.prods.length), 'Shoot / production dates'],
        ['Active days', fmt(dates.length), total ? `${(total/Math.max(dates.length,1)).toFixed(1)} items per active day` : 'No scheduled activity']
      ]) + panel('Activity by weekday','SCHEDULE',bars(data.counts,v=>fmt(v)))
    );
  };

  // Dashboard stays intentionally compact. The visual language is already represented
  // there by Partnership Pulse and the compact revenue summary; other pages carry the deeper charts.
})();
