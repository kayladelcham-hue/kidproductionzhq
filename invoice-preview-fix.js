// Final invoice preview patch: preview must never depend on Stripe.
(function(){
  const escHtml=(s)=>esc(s||'');
  const subjectFor=(d)=>`Invoice from KidProductionz — ${d.title||'Services'}`;
  const htmlEmail=(d)=>`<!doctype html><html><body style="margin:0;background:#f3f4f5;font-family:Arial,Helvetica,sans-serif;color:#111318"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f5;padding:28px 12px"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #e3e5e8;border-radius:14px;overflow:hidden"><tr><td style="background:#111318;color:#fff;padding:26px 30px"><div style="font-size:21px;font-weight:800;letter-spacing:4px">KIDPRODUCTIONZ</div><div style="font-size:9px;letter-spacing:2px;color:#b9bdc3;margin-top:7px">CREATIVE • MARKETING • SALES</div></td></tr><tr><td style="padding:32px 30px"><h1 style="font-size:24px;margin:0 0 12px">Your invoice is ready</h1><p style="font-size:14px;line-height:1.6;color:#555">Thank you for choosing KidProductionz. Your invoice is ready for review.</p><div style="font-size:34px;font-weight:800;margin:20px 0">${money(d.amount)}</div><div style="background:#f6f7f8;border-radius:10px;padding:16px"><strong>${escHtml(d.title||'KidProductionz Invoice')}</strong><div style="font-size:12px;line-height:1.6;color:#60666d;margin-top:7px">${escHtml(d.body||'KidProductionz services').replace(/\n/g,'<br>')}</div></div>${d.payment_url?`<a href="${escHtml(d.payment_url)}" style="display:block;background:#111318;color:#fff;text-decoration:none;text-align:center;padding:15px 18px;border-radius:9px;font-weight:700;margin:24px 0">Pay ${money(d.amount)} securely</a>`:`<div style="margin:24px 0;padding:12px;border-radius:9px;background:#fff7df;border:1px solid #ead7a0;font-size:12px">Payment link has not been created yet.</div>`}${d.terms?`<div style="border-top:1px solid #e6e8eb;padding-top:18px;margin-top:24px"><div style="font-size:11px;font-weight:700;margin-bottom:6px">Terms</div><div style="font-size:11px;line-height:1.55;color:#6a7077">${escHtml(d.terms).replace(/\n/g,'<br>')}</div></div>`:''}<p style="font-size:13px;line-height:1.6;color:#555;margin:24px 0 0">Thank you for trusting KidProductionz.</p></td></tr></table></td></tr></table></body></html>`;
  const textEmail=(d)=>`Your KidProductionz invoice is ready.\n\n${d.title||'Invoice'}\nAmount: ${money(d.amount)}\n\n${d.body||''}${d.payment_url?`\n\nPay securely: ${d.payment_url}`:''}\n\nThank you for trusting KidProductionz.`;

  function closePreview(){document.getElementById('invoiceEmailPreview')?.remove()}
  window.closeEmailPreview=closePreview;

  window.previewInvoiceEmail=async function(id){
    const d=D.documents.find(x=>x.id===id);
    if(!d)return alert('Invoice not found. Refresh KP HQ and try again.');
    closePreview();
    if(window.refreshGoogleIntegration){try{await refreshGoogleIntegration(false)}catch(_e){}}
    const connected=!!window.KPGoogle?.connected;
    const from=connected?(window.KPGoogle.email||'Connected Gmail'):'Gmail not connected';
    document.body.insertAdjacentHTML('beforeend',`<div id="invoiceEmailPreview" class="emailpreviewpage" style="position:fixed;inset:0;z-index:9999;background:#eef0f2;overflow:auto;color:#111318;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif"><div style="position:sticky;top:0;z-index:4;background:#fff;border-bottom:1px solid #dfe2e6;padding:14px 22px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap"><div><h2 style="margin:0;font-size:18px">Email Preview</h2><p style="margin:3px 0 0;color:#6b7178;font-size:12px">Preview works independently of Stripe.</p></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="secondary" onclick="closeEmailPreview()">Back</button><button class="secondary" onclick="kpPreviewDocument('${d.id}')">Invoice preview</button>${d.payment_url?`<a class="secondary linkbtn" href="${escHtml(d.payment_url)}" target="_blank">Open payment</a>`:`<button class="secondary" onclick="kpCreatePaymentAndRefresh('${d.id}',this)">Create payment link</button>`}<button class="btn" onclick="confirmSendInvoice('${d.id}',this)" ${connected&&d.customer_email?'':'disabled'}>Send Invoice</button></div></div><div style="width:min(920px,calc(100% - 28px));margin:34px auto 70px"><div style="background:#fff;border:1px solid #dfe3e8;border-radius:16px;box-shadow:0 18px 50px #17202b14;overflow:hidden"><div style="padding:18px 22px;border-bottom:1px solid #e7e9ec;background:#fafafa"><div style="font-size:20px;font-weight:800;margin-bottom:12px">${escHtml(subjectFor(d))}</div><div style="font-size:12px;line-height:1.8"><b>From:</b> ${escHtml(from)}<br><b>To:</b> ${escHtml(d.customer_email||'No client email')}<br><b>Payment:</b> ${d.payment_url?'Ready':'Not created yet'}</div></div><div style="padding:24px">${htmlEmail(d)}</div></div></div></div>`);
  };

  window.kpCreatePaymentAndRefresh=async function(id,button){
    const d=D.documents.find(x=>x.id===id);if(!d)return;
    if(!d.customer_email)return alert('Add a client email before creating the payment link.');
    const old=button?.textContent;if(button){button.disabled=true;button.textContent='Creating…'}
    try{
      const {data,error}=await sb.functions.invoke('create-stripe-invoice',{body:{action:'prepare',invoice_id:d.id,title:d.title,amount:d.amount,customer_email:d.customer_email,due_date:d.due_date,description:d.body,terms:d.terms,stripe_invoice_id:String(d.stripe_session_id||'').startsWith('in_')?d.stripe_session_id:null}});
      if(error||data?.error){
        let msg=data?.error||error?.message||'Could not create payment link.';
        try{const ctx=error?.context;if(ctx&&typeof ctx.clone==='function'){const j=await ctx.clone().json();if(j?.error)msg=j.error}}catch(_e){}
        throw new Error(msg);
      }
      const {error:updateError}=await sb.from('documents').update({payment_url:data.url||null,stripe_session_id:data.stripe_invoice_id||data.session_id||null,status:'Draft'}).eq('id',id);
      if(updateError)throw updateError;
      await loadAll();
      await previewInvoiceEmail(id);
    }catch(e){alert(`Payment link failed: ${e?.message||e}`);if(button){button.disabled=false;button.textContent=old||'Create payment link'}}
  };

  window.confirmSendInvoice=async function(id,button){
    const d=D.documents.find(x=>x.id===id);if(!d)return;
    if(!d.customer_email)return alert('Add a client email before sending.');
    if(window.refreshGoogleIntegration){try{await refreshGoogleIntegration(false)}catch(_e){}}
    if(!window.KPGoogle?.connected)return alert('Connect Gmail in Resources → Google Workspace before sending invoices.');
    if(!d.payment_url)return alert('Create the payment link first, then send the invoice.');
    const old=button?.textContent;if(button){button.disabled=true;button.textContent='Sending…'}
    try{
      const {data,error}=await sb.functions.invoke('google-gmail',{body:{action:'send',to:d.customer_email,subject:subjectFor(d),html:htmlEmail(d),text:textEmail(d)}});
      if(error||data?.error){let msg=data?.error||error?.message||'Gmail could not send the invoice.';try{const ctx=error?.context;if(ctx&&typeof ctx.clone==='function'){const j=await ctx.clone().json();if(j?.error)msg=j.error}}catch(_e){}throw new Error(msg)}
      const {error:updateError}=await sb.from('documents').update({status:'Sent'}).eq('id',id);if(updateError)throw updateError;
      await loadAll();closePreview();page();alert(`Invoice sent to ${d.customer_email}.`);
    }catch(e){alert(`Invoice was not sent: ${e?.message||e}`);if(button){button.disabled=false;button.textContent=old||'Send Invoice'}}
  };

  window.sendInvoice=function(id){return previewInvoiceEmail(id)};
})();
