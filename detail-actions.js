(function(){
  const safeLines=s=>esc(s||'').replace(/\n/g,'<br>');
  const fmtDate=s=>s?new Date(s+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'TBD';
  const detailStyle=`<style>
    .detailmodal{max-width:760px;max-height:88vh;overflow:auto}
    .detailgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0}
    .detailstat{padding:14px;border:1px solid #deded8;border-radius:14px;background:#fafaf8}
    .detailstat span{display:block;font-size:12px;color:#777;margin-bottom:5px}
    .detailstat strong{display:block;line-height:1.35}
    .detailsection{margin-top:18px;padding-top:16px;border-top:1px solid #e7e7e1}
    .detailcopy{line-height:1.55;white-space:normal;font-size:14px}
    .detailactions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
    @media(max-width:640px){.detailgrid{grid-template-columns:1fr}.detailmodal{max-width:94vw}}
  </style>`;
  if(!document.getElementById('kp-detail-style')){
    const s=document.createElement('div');s.id='kp-detail-style';s.innerHTML=detailStyle;document.head.appendChild(s.firstElementChild);
  }

  window.closeDetail=function(){document.getElementById('detailbg')?.remove()};

  window.openClientProfile=function(id){
    const c=D.clients.find(x=>x.id===id);if(!c)return;
    const ps=D.projects.filter(p=>p.client_id===id);
    const docs=D.documents.filter(d=>d.client_id===id||ps.some(p=>p.id===d.project_id));
    const projectHtml=ps.length?ps.map(p=>`<div class="row"><div><strong>${esc(p.name)}</strong><span>${esc(p.status)} • ${fmtDate(p.start_date)}${p.end_date&&p.end_date!==p.start_date?'–'+fmtDate(p.end_date):''}</span><span>${esc(p.next_action||'No next action')}</span></div><strong>${money(p.value)}</strong></div>`).join(''):'<div class="empty">No projects yet.</div>';
    const docHtml=docs.length?docs.map(d=>`<div class="row"><div><span>${esc(d.type)}</span><strong>${esc(d.title)}</strong><span>${esc(d.status)}</span></div><button class="secondary mini" onclick="openDocument('${d.id}')">View</button></div>`).join(''):'<div class="empty">No documents yet.</div>';
    document.body.insertAdjacentHTML('beforeend',`<div id="detailbg" class="modalbg"><div class="modal detailmodal"><div class="modalhead"><div><div class="eyebrow">CLIENT PROFILE</div><h2>${esc(c.name)}</h2></div><button class="x" onclick="closeDetail()">×</button></div><div class="detailgrid"><div class="detailstat"><span>Status</span><strong>${esc(c.status)}</strong></div><div class="detailstat"><span>Account value</span><strong>${money(c.base_value)}</strong></div><div class="detailstat" style="grid-column:1/-1"><span>Next action</span><strong>${esc(c.next_action||'None')}</strong></div></div><div class="detailsection"><h3>Projects</h3><div class="list">${projectHtml}</div></div><div class="detailsection"><h3>Documents</h3><div class="list">${docHtml}</div></div></div></div>`);
  };

  window.openDocument=function(id){
    document.getElementById('detailbg')?.remove();
    const d=D.documents.find(x=>x.id===id);if(!d)return;
    const c=D.clients.find(x=>x.id===d.client_id),p=D.projects.find(x=>x.id===d.project_id);
    document.body.insertAdjacentHTML('beforeend',`<div id="detailbg" class="modalbg"><div class="modal detailmodal"><div class="modalhead"><div><div class="eyebrow">${esc(d.type||'DOCUMENT')}</div><h2>${esc(d.title)}</h2></div><button class="x" onclick="closeDetail()">×</button></div><div class="detailgrid"><div class="detailstat"><span>Client</span><strong>${esc(c?.name||'Unassigned')}</strong></div><div class="detailstat"><span>Project</span><strong>${esc(p?.name||'Unassigned')}</strong></div><div class="detailstat"><span>Status</span><strong>${esc(d.status)}</strong></div><div class="detailstat"><span>Amount</span><strong>${money(d.amount)}</strong></div></div><div class="detailsection"><h3>Scope / Agreement</h3><div class="detailcopy">${safeLines(d.body||'No scope entered.')}</div></div><div class="detailsection"><h3>Terms</h3><div class="detailcopy">${safeLines(d.terms||'No terms entered.')}</div></div><div class="detailsection detailactions"><button class="secondary" onclick="printDocument('${d.id}')">Print / Save PDF</button><button class="btn" onclick="closeDetail()">Close</button></div></div></div>`);
  };

  window.printDocument=function(id){
    const d=D.documents.find(x=>x.id===id);if(!d)return;
    const c=D.clients.find(x=>x.id===d.client_id),p=D.projects.find(x=>x.id===d.project_id);
    const w=window.open('','_blank');if(!w)return alert('Allow pop-ups to print this document.');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(d.title)}</title><style>body{font-family:Arial,sans-serif;max-width:850px;margin:40px auto;padding:0 28px;color:#111;line-height:1.55}h1{font-size:26px;margin-bottom:6px}h2{font-size:17px;margin-top:28px;border-top:1px solid #ddd;padding-top:18px}.meta{margin:16px 0 24px;padding:14px;background:#f5f5f3;border-radius:10px}.copy{white-space:pre-wrap;font-size:14px}button{margin:20px 0;padding:10px 14px}@media print{button{display:none}body{margin:0}}</style></head><body><div style="font-size:12px;letter-spacing:1.5px">KIDPRODUCTIONZ</div><h1>${esc(d.title)}</h1><div class="meta"><b>Client:</b> ${esc(c?.name||'Unassigned')}<br><b>Project:</b> ${esc(p?.name||'Unassigned')}<br><b>Amount:</b> ${money(d.amount)}<br><b>Status:</b> ${esc(d.status)}</div><h2>Scope / Agreement</h2><div class="copy">${esc(d.body||'')}</div><h2>Terms</h2><div class="copy">${esc(d.terms||'')}</div><button onclick="window.print()">Print / Save PDF</button></body></html>`);w.document.close();
  };

  clients=function(v){v.innerHTML=`<div class="sectionhead"><div><h2>Client roster</h2><p>Clients and engagements.</p></div><button class="btn" onclick="modal('client')">+ Client</button></div>${rows(D.clients,c=>`<div><strong>${esc(c.name)}</strong><span>${D.projects.filter(p=>p.client_id===c.id).length} projects • ${esc(c.status)}</span></div><div class="rowactions"><button class="secondary mini" onclick="openClientProfile('${c.id}')">Open</button><button class="secondary mini" onclick="modal('project','${c.id}')">+ Project</button></div>`)}`};

  documents=function(v){v.innerHTML=`<div class="sectionhead"><div><h2>Documents & invoicing</h2><p>Create contracts and Stripe-ready invoices.</p></div><div class="actions"><button class="secondary" onclick="modal('document','Contract')">+ Contract</button><button class="btn" onclick="modal('document','Invoice')">+ Invoice</button></div></div>${rows(D.documents,d=>`<div><span>${esc(d.type)}</span><strong>${esc(d.title)}</strong><span>${esc(d.status)}${d.customer_email?' • '+esc(d.customer_email):''}</span></div><div class="rowactions"><strong>${money(d.amount)}</strong><button class="secondary mini" onclick="openDocument('${d.id}')">View</button>${d.type==='Invoice'?`<button class="pay mini" onclick="stripePay('${d.id}')">${d.payment_url?'Open payment':'Create payment link'}</button>`:''}</div>`)}`};
})();
