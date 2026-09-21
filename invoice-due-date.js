// Invoice due date support across KP HQ, Stripe, previews, and Gmail delivery.
(function(){
  const fmt=(date)=>{
    if(!date)return '';
    const d=new Date(`${date}T12:00:00`);
    return Number.isNaN(d.getTime())?date:new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric'}).format(d);
  };
  const isPast=(date)=>date&&date<new Date().toISOString().slice(0,10);

  function injectDue(id,value=''){
    if(document.getElementById(id))return;
    const modal=document.querySelector('#modalbg .modal');if(!modal)return;
    const label=document.createElement('label');
    label.innerHTML=`Invoice due date<input id="${id}" type="date" value="${esc(value||'')}">`;
    const labels=[...modal.querySelectorAll('label')];
    const anchor=labels.find(x=>(x.textContent||'').trim().startsWith('Scope'))||modal.querySelector('.btn');
    if(anchor)modal.insertBefore(label,anchor);else modal.appendChild(label);
  }

  const baseModal=window.modal;
  window.modal=function(type,arg){
    baseModal(type,arg);
    if(type==='document'&&arg==='Invoice')injectDue('a6');
  };

  const baseClientDocModal=window.clientDocModal;
  window.clientDocModal=function(clientId,type){
    baseClientDocModal(clientId,type);
    if(type==='Invoice')injectDue('a6');
  };

  const baseSave=window.save;
  window.save=async function(table,row){
    if(table==='documents'&&row?.type==='Invoice'){
      const due=val('a6')||null;
      if(isPast(due))return alert('Invoice due date cannot be in the past.');
      row.due_date=due;
    }
    return baseSave(table,row);
  };

  const baseSaveClient=window.saveClientDocument;
  window.saveClientDocument=async function(clientId,type){
    if(type!=='Invoice')return baseSaveClient(clientId,type);
    const due=val('a6')||null;
    if(isPast(due))return alert('Invoice due date cannot be in the past.');
    const row={owner_id:OWNER,client_id:clientId,project_id:val('a0')||null,type:'Invoice',title:val('a1'),amount:+val('a2')||0,body:val('a3'),terms:val('a4'),customer_email:val('a5'),due_date:due,status:'Draft'};
    if(!row.customer_email)return alert('Add the client email before creating the invoice.');
    if(!row.amount||row.amount<=0)return alert('Add an invoice amount greater than $0.');
    const {data:doc,error}=await sb.from('documents').insert(row).select().single();
    if(error)return alert(error.message);
    closeM();await loadAll();openClient(clientId);
    try{await previewInvoiceEmail(doc.id)}catch(e){alert(`Invoice saved as a draft, but the preview could not be prepared. ${e?.message||e}`)}
  };

  window.saveInvoiceDueEdit=async function(id,clientId){
    const due=val('e7')||null;
    if(isPast(due))return alert('Invoice due date cannot be in the past.');
    const row={title:val('e1'),amount:+val('e2')||0,customer_email:val('e3'),status:val('e4'),body:val('e5'),terms:val('e6'),due_date:due};
    const {error}=await sb.from('documents').update(row).eq('id',id);if(error)return alert(error.message);
    closeM();await loadAll();if(clientId)openClient(clientId);else page();
  };

  const baseEditDocument=window.editDocument;
  window.editDocument=function(id,clientId){
    const x=D.documents.find(d=>d.id===id);if(!x)return;
    baseEditDocument(id,clientId);
    if(x.type!=='Invoice')return;
    injectDue('e7',x.due_date||'');
    const modal=document.querySelector('#modalbg .modal');
    const save=[...modal.querySelectorAll('button.btn')].pop();
    if(save)save.setAttribute('onclick',`saveInvoiceDueEdit('${id}','${clientId||''}')`);
  };

  // Add due date to the visual PDF/print preview without replacing the existing document renderer.
  const basePreviewDocument=window.previewDocument;
  window.previewDocument=function(id){
    const d=D.documents.find(x=>x.id===id);
    let opened=null;const realOpen=window.open;
    window.open=function(...args){opened=realOpen.apply(window,args);return opened};
    try{basePreviewDocument(id)}finally{window.open=realOpen}
    if(opened&&d?.type==='Invoice'&&d.due_date){
      setTimeout(()=>{
        try{
          const summary=opened.document.querySelector('.summary');
          const cell=summary?.children?.[1];
          if(cell&&!cell.querySelector('[data-kp-due]'))cell.insertAdjacentHTML('beforeend',`<div data-kp-due><div class="label" style="margin-top:13px">Due date</div><div class="value">${fmt(d.due_date)}</div></div>`);
        }catch(_e){}
      },30);
    }
  };

  // Keep the final Gmail implementation, but add the due date to both HTML/text content during send.
  const baseConfirm=window.confirmSendInvoice;
  window.confirmSendInvoice=async function(id,button){
    const d=D.documents.find(x=>x.id===id);if(!d||!d.due_date)return baseConfirm(id,button);
    const original=d.body;
    const dueLine=`Payment due: ${fmt(d.due_date)}`;
    d.body=[original,dueLine].filter(Boolean).join('\n\n');
    try{return await baseConfirm(id,button)}finally{d.body=original}
  };

  // Show the due date clearly on the on-screen email review.
  const baseEmailPreview=window.previewInvoiceEmail;
  window.previewInvoiceEmail=async function(id){
    await baseEmailPreview(id);
    const d=D.documents.find(x=>x.id===id);if(!d?.due_date)return;
    const amount=document.querySelector('#invoiceEmailPreview .mailcopy .amount');
    if(amount&&!document.querySelector('#invoiceEmailPreview [data-kp-due-email]'))amount.insertAdjacentHTML('afterend',`<div data-kp-due-email class="detailbox"><strong>Payment due</strong><span>${fmt(d.due_date)}</span></div>`);
  };
})();