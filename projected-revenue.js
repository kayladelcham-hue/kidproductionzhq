// KP HQ projected revenue sync: open deals + sent invoices awaiting payment.
(function(){
  if(window.__kpProjectedRevenueFix) return;
  window.__kpProjectedRevenueFix=true;

  const baseDashboard=window.dashboard;
  const baseFinance=window.finance;
  const closedDealStatuses=new Set(['booked','active','complete','cancelled']);
  const outstandingInvoiceStatuses=new Set(['sent','open','overdue','past_due']);
  const handledInvoiceStatuses=new Set(['sent','open','overdue','past_due','paid','complete']);
  const norm=v=>String(v||'').trim().toLowerCase();

  function clientForProject(project){
    return project ? D.clients.find(c=>c.id===project.client_id) : null;
  }

  function clientForInvoice(invoice){
    let client=D.clients.find(c=>c.id===invoice.client_id);
    if(client) return client;
    const project=D.projects.find(p=>p.id===invoice.project_id);
    return clientForProject(project);
  }

  function projectedRevenueData(){
    const invoices=D.documents.filter(d=>d.type==='Invoice'&&(+d.amount||0)>0);
    const outstandingInvoices=invoices.filter(d=>outstandingInvoiceStatuses.has(norm(d.status)));
    const handledProjectIds=new Set(
      invoices
        .filter(d=>d.project_id&&handledInvoiceStatuses.has(norm(d.status)))
        .map(d=>d.project_id)
    );

    const openDeals=D.projects.filter(p=>
      (+p.value||0)>0 &&
      !closedDealStatuses.has(norm(p.status)) &&
      !handledProjectIds.has(p.id)
    );

    const invoiceEntries=outstandingInvoices.map(d=>{
      const project=D.projects.find(p=>p.id===d.project_id);
      const client=clientForInvoice(d);
      return {
        kind:'invoice',
        id:d.id,
        title:d.title||project?.name||'Invoice',
        amount:+d.amount||0,
        client:client?.name||d.customer_email||'Client',
        status:d.status||'Sent',
        detail:project?.name||'Awaiting payment'
      };
    });

    const dealEntries=openDeals.map(p=>{
      const client=clientForProject(p);
      return {
        kind:'deal',
        id:p.id,
        title:p.name||'Open deal',
        amount:+p.value||0,
        client:client?.name||'Client',
        status:p.status||'Open',
        detail:p.next_action||'Open deal'
      };
    });

    const entries=[...invoiceEntries,...dealEntries]
      .sort((a,b)=>b.amount-a.amount);

    return {
      total:entries.reduce((sum,item)=>sum+item.amount,0),
      entries,
      outstandingInvoices,
      openDeals
    };
  }

  function pipelineCardHTML(full=false){
    const data=projectedRevenueData();
    const entries=full?data.entries:data.entries.slice(0,5);
    return `<div class="pipeline-card card ${full?'finance-pipeline-card':''}">
      <div class="pipeline-head"><div><div class="eyebrow">PROJECTED REVENUE</div><h2>Open Pipeline</h2><p>Sent invoices awaiting payment plus open deals that have not already been invoiced.</p></div><span class="tag">${data.entries.length} item${data.entries.length===1?'':'s'}</span></div>
      <div class="pipeline-total">${money(data.total)}</div>
      <div class="pipeline-deals">${entries.length?entries.map(item=>`<div class="pipeline-deal"><div><strong>${esc(item.title)}</strong><span>${esc(item.client)} • ${item.kind==='invoice'?'Invoice '+esc(item.status):esc(item.status)}${item.detail?' • '+esc(item.detail):''}</span></div><strong>${money(item.amount)}</strong></div>`).join(''):'<div class="empty compact">No open deals or sent unpaid invoices yet.</div>'}</div>
    </div>`;
  }

  function updateFinanceMetric(v,total){
    const metrics=[...v.querySelectorAll('.metric')];
    const projected=metrics.find(card=>card.querySelector('span')?.textContent.trim()==='Projected Revenue');
    const value=projected?.querySelector('strong');
    if(value) value.textContent=money(total);
  }

  function removeLegacyFinancePipeline(v){
    const heading=[...v.querySelectorAll('.sectionhead h2')].find(h=>h.textContent.trim()==='Active revenue pipeline');
    if(!heading) return;
    const section=heading.closest('.sectionhead');
    const next=section?.nextElementSibling;
    if(next?.classList.contains('list')) next.remove();
    section?.remove();
  }

  window.dashboard=function(v){
    baseDashboard(v);
    const existing=v.querySelector('.pipeline-card');
    if(existing){
      existing.outerHTML=pipelineCardHTML(false);
      return;
    }

    /* Partnership Pulse is the primary relationship snapshot on Overview, so
       keep it directly under the KPI cards and place projected revenue after it. */
    const partnerships=v.querySelector('.dash-partnerships');
    if(partnerships) partnerships.insertAdjacentHTML('afterend',pipelineCardHTML(false));
    else v.querySelector('.metrics')?.insertAdjacentHTML('afterend',pipelineCardHTML(false));
  };

  window.finance=function(v){
    baseFinance(v);
    const data=projectedRevenueData();
    updateFinanceMetric(v,data.total);
    removeLegacyFinancePipeline(v);
    v.querySelector('.metrics')?.insertAdjacentHTML('afterend',pipelineCardHTML(true));
  };

  window.getProjectedRevenueData=projectedRevenueData;
})();
