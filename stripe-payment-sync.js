// Live Stripe payment updates for KP HQ.
(function(){
  let channel=null;

  function toast(message){
    let el=document.getElementById('kpPaymentToast');
    if(!el){
      el=document.createElement('div');
      el.id='kpPaymentToast';
      el.style.cssText='position:fixed;right:18px;top:18px;z-index:20000;background:#111318;color:#fff;padding:14px 16px;border-radius:12px;box-shadow:0 12px 36px #0003;font:700 13px/1.4 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:320px;opacity:0;transform:translateY(-8px);transition:.2s ease';
      document.body.appendChild(el);
    }
    el.textContent=message;
    requestAnimationFrame(()=>{el.style.opacity='1';el.style.transform='translateY(0)'});
    clearTimeout(el._kpTimer);
    el._kpTimer=setTimeout(()=>{el.style.opacity='0';el.style.transform='translateY(-8px)'},5000);
  }

  function refreshVisiblePage(){
    if(document.getElementById('modalbg')||document.getElementById('invoiceEmailPreview')) return;
    if(['Dashboard','Documents','Finance'].includes(current)) page();
  }

  async function setupWebhook(){
    try{
      const {data,error}=await sb.functions.invoke('create-stripe-invoice',{body:{action:'setup_webhook'}});
      if(error||data?.error) throw new Error(data?.error||error?.message||'Webhook setup failed.');
      sessionStorage.setItem('kp_stripe_webhook_ready','1');
    }catch(e){console.warn('KP Stripe webhook setup:',e)}
  }

  async function start(){
    const {data:{session}}=await sb.auth.getSession();
    if(!session?.user||session.user.id!==OWNER) return;

    if(!sessionStorage.getItem('kp_stripe_webhook_ready')) setupWebhook();

    if(channel) return;
    channel=sb.channel('kp-hq-payment-sync')
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'documents',filter:`owner_id=eq.${OWNER}`},payload=>{
        const next=payload.new;
        const i=D.documents.findIndex(x=>x.id===next.id);
        if(i>=0) D.documents[i]={...D.documents[i],...next}; else D.documents.unshift(next);
        if(next.status==='Paid'&&payload.old?.status!=='Paid') toast(`Payment received — ${next.title||'Invoice'} ${money(next.amount)}`);
        refreshVisiblePage();
      })
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'transactions',filter:`owner_id=eq.${OWNER}`},payload=>{
        const next=payload.new;
        if(!D.transactions.some(x=>x.id===next.id)) D.transactions.unshift(next);
        refreshVisiblePage();
      })
      .subscribe();
  }

  document.addEventListener('DOMContentLoaded',()=>setTimeout(start,700));
  sb.auth.onAuthStateChange((_event,session)=>{if(session?.user?.id===OWNER)setTimeout(start,500)});
})();