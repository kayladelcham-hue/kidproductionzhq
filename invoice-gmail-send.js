// Route reviewed invoice delivery through connected Google Workspace Gmail.
(function(){
  const oldPreview=window.previewInvoiceEmail;

  function htmlEmail(d){
    const title=esc(d.title||'KidProductionz Invoice');
    const scope=esc(d.body||'KidProductionz services').replace(/\n/g,'<br>');
    const terms=esc(d.terms||'').replace(/\n/g,'<br>');
    const pay=esc(d.payment_url||'');
    return `<!doctype html><html><body style="margin:0;background:#f3f4f5;font-family:Arial,Helvetica,sans-serif;color:#111318">
      <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f3f4f5;padding:28px 12px"><tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#ffffff;border:1px solid #e3e5e8;border-radius:14px;overflow:hidden">
        <tr><td style="background:#111318;color:#ffffff;padding:28px 30px"><div style="font-size:21px;font-weight:800;letter-spacing:4px">KIDPRODUCTIONZ</div><div style="font-size:9px;letter-spacing:2px;color:#b9bdc3;margin-top:7px">CREATIVE • MARKETING • SALES</div></td></tr>
        <tr><td style="padding:32px 30px">
          <h1 style="font-size:25px;line-height:1.2;margin:0 0 10px">Your invoice is ready</h1>
          <p style="font-size:14px;line-height:1.6;color:#555c64;margin:0 0 20px">Thank you for choosing KidProductionz. Your invoice for the services below is ready for review and payment.</p>
          <div style="font-size:34px;font-weight:800;margin:18px 0 22px">${money(d.amount)}</div>
          <div style="background:#f6f7f8;border-radius:10px;padding:16px;margin:0 0 20px"><strong style="font-size:13px">${title}</strong><div style="font-size:12px;line-height:1.6;color:#60666d;margin-top:7px">${scope}</div></div>
          ${pay?`<a href="${pay}" style="display:block;background:#111318;color:#ffffff;text-decoration:none;text-align:center;padding:15px 18px;border-radius:9px;font-size:14px;font-weight:700;margin:22px 0">Pay ${money(d.amount)} securely</a>`:''}
          ${terms?`<div style="border-top:1px solid #e6e8eb;padding-top:18px;margin-top:24px"><div style="font-size:11px;font-weight:700;margin-bottom:6px">Terms</div><div style="font-size:11px;line-height:1.55;color:#6a7077">${terms}</div></div>`:''}
          <p style="font-size:13px;line-height:1.6;color:#555c64;margin:24px 0 0">Thank you for trusting KidProductionz.</p>
        </td></tr>
        <tr><td style="border-top:1px solid #e6e8eb;padding:18px 30px;font-size:10px;line-height:1.5;color:#858a90">Sent from KidProductionz Headquarters. Secure payment processing is provided by Stripe.</td></tr>
      </table></td></tr></table>
    </body></html>`;
  }

  function textEmail(d){
    return `Your KidProductionz invoice is ready.\n\n${d.title||'Invoice'}\nAmount: ${money(d.amount)}\n\n${d.body||''}\n\nPay securely: ${d.payment_url||''}\n\nThank you for trusting KidProductionz.`;
  }

  function subjectFor(d){return `Invoice from KidProductionz — ${d.title||'Services'}`}

  function updatePreviewGoogleState(){
    const root=document.getElementById('invoiceEmailPreview');if(!root)return;
    const lines=root.querySelectorAll('.emailmeta .line');
    if(lines[0]){
      const v=lines[0].querySelector('.v');
      if(v) v.textContent=KPGoogle?.connected?`KidProductionz <${KPGoogle.email}>`:'Gmail not connected';
    }
    if(lines[2]){
      const v=lines[2].querySelector('.v');
      if(v) v.textContent=KPGoogle?.connected?(KPGoogle.email||'Connected Gmail'):'—';
    }
    const notice=root.querySelector('.previewnotice');
    if(notice){
      notice.classList.remove('test');
      if(KPGoogle?.connected){
        notice.textContent=`Ready to send from ${KPGoogle.email}. Stripe will host the secure payment page; Gmail will deliver this branded email.`;
      }else{
        notice.classList.add('test');
        notice.innerHTML=`Gmail is not connected yet. Connect Google Workspace before sending this invoice. <button class="secondary mini" style="margin-left:8px" onclick="closeEmailPreview();go('Resources')">Connect Gmail</button>`;
      }
    }
    root.querySelectorAll('.sendnow,.reviewfooter .btn').forEach(b=>{b.disabled=!KPGoogle?.connected;b.title=KPGoogle?.connected?'Send from Gmail':'Connect Gmail first'});
    const foot=root.querySelector('.mailfoot');
    if(foot) foot.textContent='This is the email your client will receive from your connected KidProductionz Gmail. The payment button opens the secure Stripe invoice.';
  }

  window.previewInvoiceEmail=async function(id){
    await oldPreview(id);
    if(window.refreshGoogleIntegration) await refreshGoogleIntegration(false);
    updatePreviewGoogleState();
  };

  window.confirmSendInvoice=async function(id,button){
    const d=D.documents.find(x=>x.id===id);if(!d)return;
    if(window.refreshGoogleIntegration) await refreshGoogleIntegration(false);
    if(!KPGoogle?.connected){alert('Connect Gmail in Resources → Google Workspace before sending invoices.');return;}
    if(!d.payment_url){alert('The Stripe payment page is not ready yet. Close this preview and reopen it.');return;}
    if(button){button.disabled=true;button.textContent='Sending from Gmail…'}
    try{
      const {data,error}=await sb.functions.invoke('google-gmail',{body:{action:'send',to:d.customer_email,subject:subjectFor(d),html:htmlEmail(d),text:textEmail(d)}});
      if(error||data?.error) throw new Error(data?.error||error?.message||'Gmail could not send the invoice.');
      const {error:updateError}=await sb.from('documents').update({status:'Sent'}).eq('id',id);
      if(updateError) throw updateError;
      await loadAll();closeEmailPreview();page();
      alert(`Invoice sent to ${d.customer_email} from ${data.from||KPGoogle.email}.`);
    }catch(e){
      alert(`Invoice was not sent. ${e?.message||e}`);
      if(button){button.disabled=false;button.textContent='Send Invoice'}
    }
  };
})();