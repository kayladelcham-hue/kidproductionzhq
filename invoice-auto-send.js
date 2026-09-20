// KP HQ invoice review + Stripe send workflow.
(function(){
  const originalSave=window.save;
  const originalSaveClientDocument=window.saveClientDocument;
  const originalClientDocModal=window.clientDocModal;
  const originalModal=window.modal;

  const meta=new Map();

  function invoicePayload(d){
    return {
      action:'prepare',
      invoice_id:d.id,
      title:d.title,
      amount:d.amount,
      customer_email:d.customer_email,
      description:d.body||d.title||'KidProductionz services',
      terms:d.terms||'',
      stripe_invoice_id:String(d.stripe_session_id||'').startsWith('in_')?d.stripe_session_id:null
    };
  }

  async function prepareStripeInvoice(d){
    const {data,error}=await sb.functions.invoke('create-stripe-invoice',{body:invoicePayload(d)});
    if(error||data?.error) throw new Error(data?.error||error?.message||'Could not prepare the Stripe invoice.');
    const {error:updateError}=await sb.from('documents').update({
      payment_url:data.url||null,
      stripe_session_id:data.stripe_invoice_id||data.session_id||null,
      status:'Draft'
    }).eq('id',d.id);
    if(updateError) throw updateError;
    meta.set(d.id,data);
    return data;
  }

  async function ensurePrepared(id){
    let d=D.documents.find(x=>x.id===id);
    if(!d) throw new Error('Invoice not found.');
    if(!d.customer_email) throw new Error('Add a client email before reviewing the invoice.');
    if(!d.amount||Number(d.amount)<=0) throw new Error('Add an invoice amount greater than $0.');
    const result=await prepareStripeInvoice(d);
    await loadAll();
    d=D.documents.find(x=>x.id===id)||d;
    return {d,result};
  }

  function injectPreviewStyles(){
    if(document.getElementById('kpEmailPreviewStyles')) return;
    const style=document.createElement('style');
    style.id='kpEmailPreviewStyles';
    style.textContent=`
      .emailpreviewpage{position:fixed;inset:0;z-index:9999;background:#eef0f2;overflow:auto;color:#111318;font-family:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
      .emailpreviewbar{position:sticky;top:0;z-index:4;background:rgba(255,255,255,.96);backdrop-filter:blur(16px);border-bottom:1px solid #dfe2e6;padding:14px 22px;display:flex;align-items:center;justify-content:space-between;gap:16px}
      .emailpreviewbar h2{margin:0;font-size:18px}.emailpreviewbar p{margin:3px 0 0;color:#6b7178;font-size:12px}
      .emailpreviewactions{display:flex;gap:8px}.emailpreviewactions button,.emailpreviewactions a{border:1px solid #d7dbe0;background:#fff;color:#111;padding:10px 14px;border-radius:10px;font-weight:700;font-size:12px;text-decoration:none;cursor:pointer}.emailpreviewactions .sendnow{background:#111318;color:#fff;border-color:#111318}
      .emailpreviewwrap{width:min(920px,calc(100% - 28px));margin:34px auto 70px}
      .previewnotice{background:#fff8db;border:1px solid #eadb97;border-radius:12px;padding:13px 15px;font-size:12px;line-height:1.5;margin-bottom:18px}
      .previewnotice.test{background:#fff0f0;border-color:#efb7b7;color:#8b2424}
      .emailclient{background:#fff;border:1px solid #dfe3e8;border-radius:16px;box-shadow:0 18px 50px #17202b14;overflow:hidden}
      .emailmeta{padding:18px 22px;border-bottom:1px solid #e7e9ec;background:#fafafa}.emailmeta .subject{font-size:20px;font-weight:800;margin-bottom:12px}.emailmeta .line{display:flex;gap:10px;font-size:12px;line-height:1.7}.emailmeta .k{width:54px;color:#777;flex:0 0 auto}.emailmeta .v{font-weight:650;word-break:break-all}
      .emailbody{padding:42px 28px 48px}.mailcard{width:min(610px,100%);margin:auto;border:1px solid #e2e5e8;border-radius:14px;overflow:hidden}.mailbrand{background:#111318;color:#fff;padding:25px 28px}.mailbrand .kp{font-size:23px;font-weight:900;letter-spacing:4px}.mailbrand .sub{font-size:9px;letter-spacing:2.4px;margin-top:6px;color:#b8bcc2}.mailcopy{padding:30px 28px}.mailcopy h1{font-size:24px;line-height:1.15;margin:0 0 8px}.mailcopy .amount{font-size:32px;font-weight:850;margin:18px 0}.mailcopy p{font-size:13px;line-height:1.65;color:#4c5259;margin:10px 0}.paybutton{display:block;background:#111318;color:#fff;text-align:center;text-decoration:none;padding:14px 18px;border-radius:9px;font-weight:800;margin:24px 0 18px}.detailbox{background:#f6f7f8;border-radius:10px;padding:14px 16px;margin:18px 0}.detailbox strong{display:block;font-size:12px;margin-bottom:5px}.detailbox span{font-size:11px;color:#636970;line-height:1.55;white-space:pre-wrap}.mailfoot{border-top:1px solid #e6e8eb;padding:18px 28px;color:#80858b;font-size:10px;line-height:1.5}.reviewfooter{display:flex;justify-content:flex-end;gap:9px;margin-top:18px}
      @media(max-width:650px){.emailpreviewbar{align-items:flex-start;flex-direction:column}.emailpreviewactions{width:100%}.emailpreviewactions button,.emailpreviewactions a{flex:1;text-align:center}.emailpreviewwrap{width:min(100% - 16px,920px);margin-top:14px}.emailbody{padding:18px 10px 26px}.mailcopy{padding:24px 18px}.mailbrand{padding:22px 18px}.emailmeta{padding:15px 14px}.emailmeta .subject{font-size:17px}.reviewfooter{flex-direction:column}.reviewfooter button{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function emailSubject(d,info){
    return `${info?.invoice_number?`Invoice ${info.invoice_number}`:'Invoice'} from KidProductionz`;
  }

  function closeEmailPreview(){document.getElementById('invoiceEmailPreview')?.remove()}
  window.closeEmailPreview=closeEmailPreview;

  window.previewInvoiceEmail=async function(id){
    try{
      const {d,result}=await ensurePrepared(id);
      injectPreviewStyles();
      closeEmailPreview();
      const subject=emailSubject(d,result);
      const previewNotice=result?.livemode
        ?`This review page shows the invoice details before delivery. Stripe applies its own final email formatting around this information.`
        :`TEST MODE: this invoice can be reviewed, but Stripe will not deliver a real customer email until your live Stripe key is connected.`;
      const scope=esc(d.body||d.title||'KidProductionz services').replace(/\n/g,'<br>');
      const terms=esc(d.terms||'').replace(/\n/g,'<br>');
      document.body.insertAdjacentHTML('beforeend',`<div id="invoiceEmailPreview" class="emailpreviewpage">
        <div class="emailpreviewbar">
          <div><h2>Email Preview</h2><p>Review exactly who it is going to and what invoice they are receiving.</p></div>
          <div class="emailpreviewactions"><button onclick="closeEmailPreview()">Back</button>${d.payment_url?`<a href="${esc(d.payment_url)}" target="_blank">Preview invoice</a>`:''}<button class="sendnow" onclick="confirmSendInvoice('${d.id}',this)">Send Invoice</button></div>
        </div>
        <div class="emailpreviewwrap">
          <div class="previewnotice ${result?.livemode?'':'test'}">${previewNotice}</div>
          <section class="emailclient">
            <div class="emailmeta">
              <div class="subject">${esc(subject)}</div>
              <div class="line"><span class="k">From</span><span class="v">KidProductionz via Stripe</span></div>
              <div class="line"><span class="k">To</span><span class="v">${esc(d.customer_email)}</span></div>
              <div class="line"><span class="k">Reply-to</span><span class="v">kid.productionz1@gmail.com</span></div>
            </div>
            <div class="emailbody">
              <div class="mailcard">
                <div class="mailbrand"><div class="kp">KIDPRODUCTIONZ</div><div class="sub">CREATIVE • MARKETING • SALES</div></div>
                <div class="mailcopy">
                  <h1>Your invoice is ready</h1>
                  <p>Hi,</p>
                  <p>KidProductionz has sent you an invoice for the services below.</p>
                  <div class="amount">${money(d.amount)}</div>
                  <div class="detailbox"><strong>${esc(d.title||'KidProductionz Invoice')}</strong><span>${scope}</span></div>
                  ${d.payment_url?`<a class="paybutton" href="${esc(d.payment_url)}" target="_blank">Pay ${money(d.amount)} securely</a>`:'<div class="paybutton">Pay securely</div>'}
                  ${terms?`<div class="detailbox"><strong>Terms</strong><span>${terms}</span></div>`:''}
                  <p>Thank you for trusting KidProductionz.</p>
                </div>
                <div class="mailfoot">Secure invoice and payment processing powered by Stripe. Final Stripe email styling and system wording may vary slightly from this KP HQ preview.</div>
              </div>
            </div>
          </section>
          <div class="reviewfooter"><button class="secondary" onclick="closeEmailPreview()">Go back and edit</button><button class="btn" onclick="confirmSendInvoice('${d.id}',this)">Send Invoice</button></div>
        </div>
      </div>`);
    }catch(e){alert(`Could not prepare the email preview. ${e?.message||e}`)}
  };

  window.confirmSendInvoice=async function(id,button){
    const d=D.documents.find(x=>x.id===id);
    if(!d) return;
    if(button){button.disabled=true;button.textContent='Sending…';}
    try{
      const prepared=String(d.stripe_session_id||'').startsWith('in_')?d:((await ensurePrepared(id)).d);
      const r=await sb.functions.invoke('create-stripe-invoice',{body:{action:'send',stripe_invoice_id:prepared.stripe_session_id}});
      if(r.error||r.data?.error) throw new Error(r.data?.error||r.error?.message||'Could not send the Stripe invoice.');
      await sb.from('documents').update({
        payment_url:r.data.url||prepared.payment_url||null,
        stripe_session_id:r.data.stripe_invoice_id||prepared.stripe_session_id,
        status:r.data.email_sent?'Sent':'Draft'
      }).eq('id',id);
      await loadAll();
      closeEmailPreview();
      page();
      if(r.data?.email_sent) alert(`Invoice${r.data.invoice_number?' '+r.data.invoice_number:''} sent to ${prepared.customer_email}.`);
      else alert('This invoice is still in Stripe TEST MODE, so no real client email was delivered. It remains Draft in KP HQ.');
    }catch(e){
      alert(`Invoice was not sent. ${e?.message||e}`);
      if(button){button.disabled=false;button.textContent='Send Invoice';}
    }
  };

  async function insertAndReview(row,after){
    if(!row.customer_email) return alert('Add the client email before creating the invoice.');
    if(!row.amount||Number(row.amount)<=0) return alert('Add an invoice amount greater than $0.');
    row.owner_id=OWNER;
    row.status='Draft';
    const {data:doc,error}=await sb.from('documents').insert(row).select().single();
    if(error) return alert(error.message);
    closeM();
    try{
      await prepareStripeInvoice(doc);
      await loadAll();
      if(after) after(); else page();
      await previewInvoiceEmail(doc.id);
    }catch(e){
      await loadAll();
      if(after) after(); else page();
      alert(`Invoice saved to KP HQ as a draft, but the email preview could not be prepared. ${e?.message||e}`);
    }
  }

  // New invoices are saved + prepared, then stopped at the review page.
  window.save=async function(table,row){
    if(table==='documents'&&row?.type==='Invoice') return insertAndReview(row,()=>page());
    return originalSave(table,row);
  };

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
    return insertAndReview(row,()=>openClient(clientId));
  };

  // Existing invoice Send buttons now open review first; nothing emails until Send Invoice is confirmed there.
  window.sendInvoice=function(id){return previewInvoiceEmail(id)};

  // Creating a payment link prepares Stripe and opens the review page instead of emailing immediately.
  window.stripePay=async function(id){
    const d=D.documents.find(x=>x.id===id);
    if(!d) return;
    if(d.payment_url&&String(d.stripe_session_id||'').startsWith('in_')) return previewInvoiceEmail(id);
    return previewInvoiceEmail(id);
  };

  // Make the invoice creation action match the new workflow.
  window.clientDocModal=function(clientId,type){
    originalClientDocModal(clientId,type);
    if(type==='Invoice'){
      const b=document.querySelector('#modalbg .modal > .btn');
      if(b) b.textContent='Review Invoice';
    }
  };

  window.modal=function(type,arg){
    originalModal(type,arg);
    if(type==='document'&&arg==='Invoice'){
      const b=document.querySelector('#modalbg .modal > .btn');
      if(b) b.textContent='Review Invoice';
    }
  };

  // Rename row action buttons so you know they open review, not instant-send.
  function relabel(){
    document.querySelectorAll('[data-send-invoice]').forEach(b=>b.textContent='Review & Send');
  }
  const observer=new MutationObserver(relabel);observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',relabel);setTimeout(relabel,400);
})();