// Auto-create a KP HQ client when a partnership becomes Booked / Active.
(function(){
  const BOOKED_STATUS = 'Booked / Active';

  function normalizeName(value){
    return String(value || '').trim().replace(/\s+/g,' ').toLowerCase();
  }

  async function ensureClientForBookedPartnership(partnership){
    if (!partnership || partnership.status !== BOOKED_STATUS) return null;

    const business = String(partnership.business || '').trim();
    if (!business) return null;

    // Prefer the already-loaded client roster, then confirm against Supabase.
    let existing = (D.clients || []).find(c => normalizeName(c.name) === normalizeName(business));
    if (!existing) {
      const { data, error } = await sb.from('clients').select('*');
      if (error) {
        console.warn('Partnership → client lookup failed', error);
        return null;
      }
      existing = (data || []).find(c => normalizeName(c.name) === normalizeName(business));
      if (existing) {
        D.clients = data || D.clients;
        return existing;
      }
    } else {
      return existing;
    }

    const { data, error } = await sb.from('clients').insert({
      owner_id: OWNER,
      name: business,
      status: 'Active',
      base_value: 0
    }).select().single();

    if (error) {
      console.warn('Partnership → client creation failed', error);
      alert(`Partnership was saved, but the client profile could not be created: ${error.message}`);
      return null;
    }

    D.clients = [data, ...(D.clients || []).filter(c => c.id !== data.id)];
    return data;
  }

  function install(){
    if (typeof window.savePartnership !== 'function') {
      setTimeout(install, 50);
      return;
    }
    if (window.savePartnership.__kpClientSyncInstalled) return;

    const baseSavePartnership = window.savePartnership;
    const wrapped = async function(id=''){
      const partnership = {
        id,
        business: val('pBusiness').trim(),
        contact_email: val('pEmail').trim() || null,
        status: val('pStatus') || 'Awaiting Reply'
      };

      await baseSavePartnership(id);

      if (partnership.status === BOOKED_STATUS) {
        await ensureClientForBookedPartnership(partnership);
      }
    };

    wrapped.__kpClientSyncInstalled = true;
    window.savePartnership = wrapped;
  }

  window.ensureClientForBookedPartnership = ensureClientForBookedPartnership;
  install();
})();
