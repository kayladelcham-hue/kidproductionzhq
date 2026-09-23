// KP HQ invoice/document reliability patch.
// Loaded last so document + invoice actions do not depend on older chained overrides.
(function(){
  const baseModal = window.modal;

  const el = (id) => document.getElementById(id);
  const get = (id) => el(id)?.value ?? '';

  function closeDocModal(){ el('kpDocModalBg')?.remove(); }
  window.closeDocModal = closeDocModal;

  function clientOptions(selected=''){
    return ['<option value="">No client selected</option>', ...D.clients.map(c=>`<option value="${esc(c.id)}" ${c.id===selected?'selected':''}>${esc(c.name||c.business_name||'Client')}</option>`)].join('');
  }
  function projectOptions(selected=''){
    return ['<option value="">No project selected</option>', ...D.projects.map(p=>`<option value="${esc(p.id)}" ${p.id===selected?'selected':''}>${esc(p.name||'Project')}</option>`)].join('');
  }

  function syncInvoiceClient(){
    const clientId=get('kpDocClient');
    const c=D.clients.find(x=>x.id===clientId);
    if(c?.email && !get('kpDocEmail')) el('kpDocEmail').value=c.email;
    const project=el('kpDocProject');
    if(project){
      [...project.options].forEach(opt=>{
        if(!opt.value) return;
        const p=D.projects.find(x=>x.id===opt.value);
        opt.hidden=!!clientId && p?.client_id!==clientId;
      });
      const current=D.projects.find(x=>x.id===project.value);
      if(current && clientId && current.client_id!==clientId) project.value='';
    }
  }
  window.syncInvoiceClient=syncInvoiceClient;

  function openDocumentModal(type='Invoice'){
    closeDocModal();
    const isInvoice=type==='Invoice';
    const today=new Date().toISOString().slice(0,10);
    const html=`<div id="kpDocModalBg" class="modalbg" role="dialog" aria-modal="true">
      <div class="modal">
        <div class="modalhead"><div><div class="eyebrow">${esc(type.toUpperCase())}</div><h2>Create ${esc(type)}</h2></div><button class="x" type="button" onclick="closeDocModal()">×</button></div>
        <label>Client<select id="kpDocClient" onchange="syncInvoiceClient()">${clientOptions()}</select></label>
        <label>Project<select id="kpDocProject">${projectOptions()}</select></label>
        <label>Title<input id="kpDocTitle" type="text" placeholder="${isInvoice?'e.g. ETP Content Production':'e.g. Photography Services Agreement'}"></label>
        <label>Amount<input id="kpDocAmount" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0.00"></label>
        ${isInvoice?`<label>Client email<input id="kpDocEmail" type="email" placeholder="client@example.com"></label><label>Due date<input id="kpDocDue" type="date"></label>`:''}
        <label>Scope / details<textarea id="kpDocBody" rows="5" placeholder="What is included?"></textarea></label>
        <label>Terms<textarea id="kpDocTerms" rows="4" placeholder="Payment terms, delivery terms, cancellation policy, etc."></textarea></label>
        <div id="kpDocError" class="formerror" style="display:none"></div>
        <button id="kpDocSave" class="btn" type="button">Save ${esc(type.toLowerCase())}</button>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend',html);
    el('kpDocSave').addEventListener('click',()=>saveDocument(type));
    el('kpDocModalBg').addEventListener('mousedown',e=>{if(e.target===e.currentTarget)closeDocModal()});
    if(isInvoice) el('kpDocDue').value=today;
  }
  window.openDocumentModal=openDocumentModal;

  async function saveDocument(type){
    const btn=el('kpDocSave'), err=el('kpDocError');
    const title=get('kpDocTitle').trim();
    const amount=Number(get('kpDocAmount'));
    if(!title){err.textContent='Add a title.';err.style.display='block';return;}
    if(!Number.isFinite(amount)||amount<0){err.textContent='Add a valid amount.';err.style.display='block';return;}
    btn.disabled=true;btn.textContent='Saving…';err.style.display='none';
    const row={
      owner_id:OWNER,
      client_id:get('kpDocClient')||null,
      project_id:get('kpDocProject')||null,
      type,
      title,
      amount,
      document_date:new Date().toISOString().slice(0,10),
      customer_email:type==='Invoice'?(get('kpDocEmail').trim()||null):null,
      due_date:type==='Invoice'?(get('kpDocDue')||null):null,
      body:get('kpDocBody').trim()||null,
      terms:get('kpDocTerms').trim()||null,
      status:'Draft'
    };
    const {data,error}=await sb.from('documents').insert(row).select().single();
    if(error){btn.disabled=false;btn.textContent=`Save ${type.toLowerCase()}`;err.textContent=error.message;err.style.display='block';return;}
    closeDocModal();
    await loadAll();
    page();
    if(type==='Invoice' && data?.id) setTimeout(()=>kpPreviewDocument(data.id),80);
  }
  window.saveDocument=saveDocument;

  window.kpPreviewDocument=function(id){
    const d=D.documents.find(x=>x.id===id);
    if(!d)return alert('Document not found. Refresh KP HQ and try again.');
    try{
      if(d.type==='Invoice' && typeof window.previewInvoice==='function') return window.previewInvoice(id);
      if(typeof window.previewDocument==='function') return window.previewDocument(id);
      alert('Preview is still loading. Refresh KP HQ and try again.');
    }catch(e){
      console.error('Document preview failed',e);
      alert(`Could not open preview: ${e?.message||e}`);
    }
  };

  window.kpStripePay=async function(id,button){
    const d=D.documents.find(x=>x.id===id);
    if(!d)return alert('Invoice not found.');
    if(d.payment_url){window.open(d.payment_url,'_blank');return;}
    const old=button?.textContent;
    if(button){button.disabled=true;button.textContent='Creating…';}
    try{
      const {data,error}=await sb.functions.invoke('create-stripe-invoice',{body:{
        invoice_id:d.id,title:d.title,amount:d.amount,customer_email:d.customer_email,due_date:d.due_date,description:d.body
      }});
      if(error||data?.error) throw new Error(data?.error||error?.message||'Could not create payment link.');
      const {error:updateError}=await sb.from('documents').update({payment_url:data.url,stripe_session_id:data.session_id,status:'Sent'}).eq('id',id);
      if(updateError) throw updateError;
      await loadAll();page();
      if(data?.url) window.open(data.url,'_blank');
    }catch(e){
      alert(`Payment link failed: ${e?.message||e}`);
      if(button){button.disabled=false;button.textContent=old||'Create payment link';}
    }
  };

  window.documents=function(v){
    v.innerHTML=`<div class="sectionhead"><div><h2>Documents & invoicing</h2><p>Create, preview, send, and collect payment from one place.</p></div><div class="actions"><button id="kpNewContract" class="secondary" type="button">+ Contract</button><button id="kpNewInvoice" class="btn" type="button">+ Invoice</button></div></div>
      ${rows(D.documents,d=>`<div class="docrow-main" style="min-width:0;flex:1"><span>${esc(d.type)}</span><strong>${esc(d.title)}</strong><span>${esc(d.status)}${d.customer_email?' • '+esc(d.customer_email):''}</span></div><div class="rowactions"><strong>${money(d.amount)}</strong><button class="secondary mini" type="button" data-preview="${d.id}">Preview</button>${d.type==='Invoice'?`<button class="pay mini" type="button" data-pay="${d.id}">${d.payment_url?'Open payment':'Create payment link'}</button>`:''}</div>`)}`;
    el('kpNewContract')?.addEventListener('click',()=>openDocumentModal('Contract'));
    el('kpNewInvoice')?.addEventListener('click',()=>openDocumentModal('Invoice'));
    v.querySelectorAll('[data-preview]').forEach(b=>b.addEventListener('click',()=>kpPreviewDocument(b.dataset.preview)));
    v.querySelectorAll('[data-pay]').forEach(b=>b.addEventListener('click',()=>kpStripePay(b.dataset.pay,b)));
  };

  // Keep old calls elsewhere in the app working, but route document creation through the reliable controller.
  window.modal=function(type,arg){
    if(type==='document') return openDocumentModal(arg||'Invoice');
    return baseModal(type,arg);
  };

  if(window.current==='Documents' && document.getElementById('view')) window.documents(document.getElementById('view'));
})();