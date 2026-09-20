// KP HQ automatic Stripe invoice sending.
(function(){
  const originalSave=window.save;
  const originalSaveClientDocument=window.saveClientDocument;
  const originalClientDocModal=window.clientDocModal;
  const originalModal=window.modal;

  function invoicePayload(d){
    return {
      invoice_id:d.id,
      title:d.title,
      amount:d.amount,
      customer_email:d.customer_email,
      description:d.body||d.title||'KidProductionz services',
      terms:d.terms||''
    };
  }

  async function createAndSendStripeInvoice(d){
    const {data,error}=await sb.functions.invoke('create-stripe-invoice',{body:invoicePayload(d)});
    if(error||data?.error) throw new Error(data?.error||error?.message||'Could not create the Stripe invoice.');
    const {error:updateError}=await sb.from('documents').update({
      payment_url:data.url||null,
      stripe_session_id:data.stripe_invoice_id||data.session_id||null,
      status:data.email_sent?'Sent':'Draft'
    }).eq('id',d.id);
    if(updateError) throw updateError;
    return data;
  }

  function confirmation(data,email){
    if(data?.email_sent){
      alert(`Invoice${data.invoice_number?' '+data.invoice_number:''} sent to ${email}.`);
    }else{
      alert(`Invoice created in Stripe TEST MODE, but Stripe does not send customer emails in test mode. The invoice is saved in KP HQ as Draft. Switch the Supabase STRIPE_SECRET_KEY to a live Stripe key before sending real client invoices.`);
    }
  }

  async function insertAndSend(row,after){
    if(!row.customer_email) return alert('Add the client email before creating the invoice.');
    if(!row.amount||Number(row.amount)<=0) return alert('Add an invoice amount greater than $0.');
    row.owner_id=OWNER;
    row.status='Draft';
    const {data:doc,error}=await sb.from('documents').insert(row).select().single();
    if(error) return alert(error.message);
    closeM();
    try{
      const result=await createAndSendStripeInvoice(doc);
      await loadAll();
      if(after) after(); else page();
      confirmation(result,doc.customer_email);
    }catch(e){
      await loadAll();
      if(after) after(); else page();
      alert(`Invoice saved to KP HQ as a draft, but it was not emailed. ${e?.message||e}`);
    }
  }

  // Main Documents page: creating an Invoice now creates + emails it automatically.
  window.save=async function(table,row){
    if(table==='documents'&&row?.type==='Invoice') return insertAndSend(row,()=>page());
    return originalSave(table,row);
  };

  // Client profile: same automatic create + send behavior.
  window.saveClientDocument=async function(clientId,type){
    if(type!=='Invoice') return originalSaveClientDocument(clientId,type);
    const row={
      owner_id:OWNER,
      client_id:clientId,
      project_id:val('a0')||null,
      type:'Invoice',
      title:val('a1'),
      amount:+val('a2')||0,
      body:val('a3'),
      terms:val('a4'),
      customer_email:val('a5'),
      status:'Draft'
    };
    return insertAndSend(row,()=>openClient(clientId));
  };

  // Existing invoices: the Send button now sends through Stripe instead of opening a mailto draft.
  window.sendInvoice=async function(id){
    const d=D.documents.find(x=>x.id===id);
    if(!d) return;
    if(!d.customer_email) return alert('Add a client email before sending.');
    try{
      let result;
      if(d.stripe_session_id&&String(d.stripe_session_id).startsWith('in_')){
        const r=await sb.functions.invoke('create-stripe-invoice',{body:{action:'resend',stripe_invoice_id:d.stripe_session_id}});
        if(r.error||r.data?.error) throw new Error(r.data?.error||r.error?.message||'Could not resend the Stripe invoice.');
        result=r.data;
        await sb.from('documents').update({
          payment_url:result.url||d.payment_url||null,
          stripe_session_id:result.stripe_invoice_id||d.stripe_session_id,
          status:result.email_sent?'Sent':'Draft'
        }).eq('id',id);
      }else{
        result=await createAndSendStripeInvoice(d);
      }
      await loadAll();
      page();
      confirmation(result,d.customer_email);
    }catch(e){
      alert(`Invoice was not sent. ${e?.message||e}`);
    }
  };

  // The payment-link action also creates/sends a true Stripe invoice when one does not exist yet.
  window.stripePay=async function(id){
    const d=D.documents.find(x=>x.id===id);
    if(!d) return;
    if(d.payment_url) return window.open(d.payment_url,'_blank');
    if(!d.customer_email) return alert('Add a client email before creating the payment invoice.');
    try{
      const result=await createAndSendStripeInvoice(d);
      await loadAll();
      page();
      confirmation(result,d.customer_email);
    }catch(e){
      alert(`Stripe invoice could not be created. ${e?.message||e}`);
    }
  };

  // Make the action unmistakable in both invoice creation screens.
  window.clientDocModal=function(clientId,type){
    originalClientDocModal(clientId,type);
    if(type==='Invoice'){
      const b=document.querySelector('#modalbg .modal > .btn');
      if(b) b.textContent='Create & Send Invoice';
    }
  };

  window.modal=function(type,arg){
    originalModal(type,arg);
    if(type==='document'&&arg==='Invoice'){
      const b=document.querySelector('#modalbg .modal > .btn');
      if(b) b.textContent='Create & Send Invoice';
    }
  };
})();