// Make the Partnerships refresh control run the native Gmail reconciliation before reloading Supabase.
(function(){
  if (typeof window.refreshPartnerships !== 'function') return;

  const reloadPartnerships = window.refreshPartnerships;
  let syncing = false;
  let lastSummary = '';

  function applySyncUi(){
    document.querySelectorAll('button[onclick="refreshPartnerships()"],button[onclick="refreshPartnerships(true)"]').forEach(btn => {
      btn.setAttribute('onclick','refreshPartnerships(true)');
      btn.dataset.kpGmailSync = '1';
      btn.disabled = syncing;
      btn.textContent = syncing ? 'Syncing Gmail…' : 'Sync Gmail';
      btn.title = 'Sync sent partnership outreach plus new Gmail replies into the KP HQ partnership pipeline.';
    });

    if (lastSummary && typeof current !== 'undefined' && current === 'Partnerships') {
      const status = document.querySelector('.psync');
      if (status) status.innerHTML = `<span class="pdot"></span>${esc(lastSummary)}`;
    }
  }

  window.refreshPartnerships = async function(syncGmail = false){
    // Background refreshes and post-save refreshes should stay lightweight.
    if (!syncGmail) {
      await reloadPartnerships();
      applySyncUi();
      return;
    }

    if (syncing) return;
    syncing = true;
    applySyncUi();

    try {
      const {data,error} = await sb.functions.invoke('partnership-gmail-sync',{body:{}});
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Gmail sync failed.');

      await reloadPartnerships();
      const time = new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
      const created = Number(data?.created||0);
      const sent = Number(data?.sent_processed||0);
      const incoming = Number(data?.incoming_processed||0);
      const updated = Number(data?.updated||0);
      lastSummary = `Gmail synced • ${created} outreach added • ${sent} sent processed • ${incoming} replies processed • ${updated} updated • ${time}`;
    } catch (e) {
      console.warn('Partnership Gmail sync failed', e);
      try { await reloadPartnerships(); } catch (_e) {}
      lastSummary = `Gmail sync failed • ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`;
      alert(`Gmail sync failed. ${e?.message || e}`);
    } finally {
      syncing = false;
      applySyncUi();
    }
  };

  const host = document.getElementById('app') || document.body;
  new MutationObserver(applySyncUi).observe(host,{childList:true,subtree:true});
  setTimeout(applySyncUi,0);
})();
