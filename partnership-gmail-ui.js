// Make the Partnerships refresh control run the native Gmail reconciliation before reloading Supabase.
(function(){
  if (typeof window.refreshPartnerships !== 'function') return;

  const reloadPartnerships = window.refreshPartnerships;
  let syncing = false;
  let lastSummary = '';
  let applyQueued = false;

  function applySyncUi(){
    applyQueued = false;
    const desiredText = syncing ? 'Syncing Gmail…' : 'Sync Gmail';
    const desiredTitle = 'Sync sent partnership outreach plus new Gmail replies into the KP HQ partnership pipeline.';

    document.querySelectorAll('button[onclick="refreshPartnerships()"],button[onclick="refreshPartnerships(true)"],button[data-kp-gmail-sync="1"]').forEach(btn => {
      // Only mutate the DOM when a value actually changed. This is important because
      // the page observer below watches child-list changes; repeatedly assigning
      // textContent would otherwise trigger itself forever and freeze the page.
      if (btn.getAttribute('onclick') !== 'refreshPartnerships(true)') btn.setAttribute('onclick','refreshPartnerships(true)');
      if (btn.dataset.kpGmailSync !== '1') btn.dataset.kpGmailSync = '1';
      if (btn.disabled !== syncing) btn.disabled = syncing;
      if (btn.textContent !== desiredText) btn.textContent = desiredText;
      if (btn.title !== desiredTitle) btn.title = desiredTitle;
    });

    if (lastSummary && typeof current !== 'undefined' && current === 'Partnerships') {
      const status = document.querySelector('.psync');
      const desiredStatus = `<span class="pdot"></span>${esc(lastSummary)}`;
      if (status && status.innerHTML !== desiredStatus) status.innerHTML = desiredStatus;
    }
  }

  function queueApplySyncUi(){
    if (applyQueued) return;
    applyQueued = true;
    requestAnimationFrame(applySyncUi);
  }

  window.refreshPartnerships = async function(syncGmail = false){
    // Background refreshes and post-save refreshes should stay lightweight.
    if (!syncGmail) {
      await reloadPartnerships();
      queueApplySyncUi();
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
      queueApplySyncUi();
    }
  };

  const host = document.getElementById('app') || document.body;
  // Navigation replaces page markup dynamically, so keep a lightweight observer.
  // Debouncing + idempotent writes prevents the observer from feeding itself.
  new MutationObserver(queueApplySyncUi).observe(host,{childList:true,subtree:true});
  queueApplySyncUi();
})();
