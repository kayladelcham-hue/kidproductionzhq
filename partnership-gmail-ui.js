// Make the Partnerships refresh control run the native Gmail reconciliation before reloading Supabase.
(function(){
  if (typeof window.refreshPartnerships !== 'function') return;

  const reloadPartnerships = window.refreshPartnerships;
  let syncing = false;
  let lastSummary = '';

  function syncButton(){
    return document.querySelector('button[data-kp-gmail-sync="1"],button[onclick="refreshPartnerships(true)"]');
  }

  function applySyncUi(){
    document.querySelectorAll('button[onclick="refreshPartnerships()"],button[onclick="refreshPartnerships(true)"]').forEach(btn => {
      btn.setAttribute('onclick','refreshPartnerships(true)');
      btn.dataset.kpGmailSync = '1';
      btn.disabled = syncing;
      btn.textContent = syncing ? 'Syncing Gmail…' : 'Sync Gmail';
      btn.title = 'Check KidProductionz Gmail for new partnership activity, reconcile it into Supabase, then reload this page.';
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
      if (data?.baseline) lastSummary = `Gmail sync initialized • ${time}`;
      else if (data?.baseline_reset) lastSummary = `Gmail sync reset • ${time}`;
      else lastSummary = `Gmail checked • ${Number(data?.processed||0)} new • ${Number(data?.matched||0)} matched • ${Number(data?.updated||0)} updated • ${time}`;
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
