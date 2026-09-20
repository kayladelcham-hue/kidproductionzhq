// KP HQ client profiles + printable contract/invoice documents.
(function(){
  const baseClients=window.clients;
  if(typeof baseClients!=='function') return;

  window.clients=function(v){
    v.innerHTML=`<div class="sectionhead"><div><h2>Client roster</h2><p>Open a client to see their complete KP history.</p></div><button class="btn" onclick="modal('client')">+ Client</button></div>${rows(D.clients,c=>`<button class="clientopen" onclick="openClient('${c.id}')"><div><strong>${esc(c.name)}</strong><span>${D.projects.filter(p=>p.client_id===c.id).length} projects • ${esc(c.status)}</span></div><span class="profilearrow">View profile →</span></button>`)}`;
  };

  window.openClient=function(id){
    const c=D.clients.find(x=>x.id===id); if(!c)return;
    const ps=D.projects.filter(p=>p.client_id===id);
    const pids=ps.map(p=>p.id);
    const docs=D.documents.filter(d=>d.client_id===id || (d.project_id&&pids.includes(d.project_id)));
    const prods=D.productions.filter(p=>p.project_id&&pids.includes(p.project_id));
    const evs=D.events.filter(e=>e.project_id&&pids.includes(e.project_id));
    const total=docs.filter(d=>d.type==='Invoice').reduce((a,d)=>a+(+d.amount||0),0);
    const paid=docs.filter(d=>d.type==='Invoice'&&['Paid','Complete'].includes(d.status)).reduce((a,d)=>a+(+d.amount||0),0);
    $('view').innerHTML=`<div class="profiletop"><button class="secondary" onclick="page()">← Clients</button><div class="profileactions"><button class="secondary" onclick="clientDocModal('${id}','Contract')">+ Contract</button><button class="btn" onclick="clientDocModal('${id}','Invoice')">+ Invoice</button></div></div><div class="clienthero"><div><div class="eyebrow">CLIENT PROFILE</div><h2>${esc(c.name)}</h2><p>${esc(c.status||'Client')} • ${ps.length} project${ps.length===1?'':'s'}</p></div><span class="tag">${esc(c.status||'Active')}</span></div><div class="metrics profilemetrics"><div class="card metric"><span>Projects</span><strong>${ps.length}</strong></div><div class="card metric"><span>Contracts</span><strong>${docs.filter(d=>d.type==='Contract').length}</strong></div><div class="card metric"><span>Invoiced</span><strong>${money(total)}</strong></div><div class="card metric"><span>Paid</span><strong>${money(paid)}</strong></div></div>${profileSection('Projects',ps,p=>`<div><strong>${esc(p.name)}</strong><span>${esc(p.status)} • ${money(p.value)} • ${esc(p.next_action||'No next action')}</span></div>`)}${profileSection('Contracts',docs.filter(d=>d.type==='Contract'),d=>docRow(d))}${profileSection('Invoices',docs.filter(d=>d.type==='Invoice'),d=>docRow(d))}${profileSection('Productions',prods,p=>`<div><strong>${esc(p.name)}</strong><span>${esc(p.production_date||'Date TBD')} • ${esc(p.status)}</span></div>`)}${profileSection('Calendar',evs,e=>`<div><strong>${esc(e.title)}</strong><span>${esc(e.event_date||'')} ${esc(e.event_time||'')}</span></div>`)}`;
  };

  function profileSection(title,a,render){return `<div class="sectionhead"><div><h2>${title}</h2></div></div>${rows(a,render)}`}
  function docRow(d){return `<div><strong>${esc(d.title)}</strong><span>${esc(d.status)}${d.amount?' • '+money(d.amount):''}</span></div><div class="rowactions"><button class="secondary mini" onclick="previewDocument('${d.id}')">View PDF</button>${d.type==='Invoice'?`<button class="pay mini" onclick="stripePay('${d.id}')">${d.payment_url?'Pay link':'Create payment link'}</button>`:''}</div>`}

  window.clientDocModal=function(clientId,type){
    const c=D.clients.find(x=>x.id===clientId), ps=D.projects.filter(p=>p.client_id===clientId);
    let h=`<div class="modalhead"><h2>New ${type}</h2><button class="x" onclick="closeM()">×</button></div>${select('a0','Project',[['','General / no project'],...ps.map(p=>[p.id,p.name])])}${input('a1','Title','text',`${c.name} — ${type}`)}${input('a2','Amount','number')}${type==='Invoice'?input('a5','Client email','email'):''}<label>Scope / details<textarea id="a3"></textarea></label><label>Terms<textarea id="a4">Payment and services are subject to the agreed KidProductionz scope and terms.</textarea></label><button class="btn" onclick="saveClientDocument('${clientId}','${type}')">Create ${type}</button>`;
    document.body.insertAdjacentHTML('beforeend',`<div id="modalbg" class="modalbg"><div class="modal">${h}</div></div>`);
  };
  window.saveClientDocument=async function(clientId,type){
    const row={owner_id:OWNER,client_id:clientId,project_id:val('a0')||null,type,title:val('a1'),amount:+val('a2')||0,body:val('a3'),terms:val('a4'),customer_email:type==='Invoice'?val('a5'):null,status:'Draft'};
    let{error}=await sb.from('documents').insert(row);if(error)return alert(error.message);closeM();await loadAll();openClient(clientId);
  };

  window.previewDocument=function(id){
    const d=D.documents.find(x=>x.id===id);if(!d)return;
    const c=D.clients.find(x=>x.id===d.client_id)||D.clients.find(c=>D.projects.some(p=>p.id===d.project_id&&p.client_id===c.id));
    const p=D.projects.find(x=>x.id===d.project_id);
    const w=window.open('','_blank'); if(!w)return alert('Allow pop-ups to view the document.');
    const title=esc(d.title||d.type),client=esc(c?.name||'Client'),scope=esc(d.body||'').replace(/\n/g,'<br>'),terms=esc(d.terms||'').replace(/\n/g,'<br>');
    w.document.write(`<!doctype html><html><head><title>${title}</title><style>@page{size:letter;margin:.65in}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#151515;margin:0;font-size:11pt;line-height:1.55}.head{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:18px;margin-bottom:32px}.brand{font-size:24px;font-weight:800}.brand small{display:block;font-size:9px;letter-spacing:2px;font-weight:600}.doctype{font-size:11px;letter-spacing:2px;text-transform:uppercase}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px}.label{font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#777;margin-bottom:4px}h1{font-size:27px;margin:0 0 28px}h2{font-size:13px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #ddd;padding-bottom:7px;margin-top:28px}.amount{font-size:25px;font-weight:700}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:70px}.line{border-top:1px solid #111;padding-top:7px}.controls{position:fixed;right:18px;top:18px}@media print{.controls{display:none}}</style></head><body><button class="controls" onclick="window.print()">Save / Print PDF</button><div class="head"><div class="brand">KP <small>KIDPRODUCTIONZ HEADQUARTERS</small></div><div class="doctype">${esc(d.type)}</div></div><h1>${title}</h1><div class="grid"><div><div class="label">Prepared for</div><strong>${client}</strong>${p?`<div>${esc(p.name)}</div>`:''}</div><div><div class="label">Status</div><strong>${esc(d.status||'Draft')}</strong>${d.amount?`<div class="amount">${money(d.amount)}</div>`:''}</div></div><h2>Scope / Details</h2><div>${scope||'—'}</div><h2>Terms</h2><div>${terms||'—'}</div>${d.type==='Contract'?`<div class="signatures"><div class="line">Client signature / Date</div><div class="line">KidProductionz / Date</div></div>`:''}${d.type==='Invoice'&&d.payment_url?`<h2>Payment</h2><div>Secure Stripe payment link:<br>${esc(d.payment_url)}</div>`:''}</body></html>`);w.document.close();
  };
})();