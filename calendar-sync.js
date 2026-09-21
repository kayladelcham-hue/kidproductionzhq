// KP HQ <-> Google Calendar sync layer.
(function(){
  const oldSave=window.save;
  const oldUpdateRecord=window.updateRecord;
  const oldDeleteRecord=window.deleteRecord;
  const oldCalendar=window.calendar;
  let autoSyncStarted=false;
  let calendarStatus=null;

  const timezone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone||'America/New_York';

  async function calendarCall(body){
    const {data,error}=await sb.functions.invoke('google-calendar-sync',{body:{timezone:timezone(),...body}});
    if(error||data?.error) throw new Error(data?.error||error?.message||'Google Calendar sync failed.');
    return data;
  }

  async function refreshCalendarStatus(){
    try{calendarStatus=await calendarCall({action:'status'})}
    catch(e){calendarStatus={connected:false,calendar_connected:false,error:e?.message||String(e)}}
    paintCalendarStatus();
    return calendarStatus;
  }

  function paintCalendarStatus(){
    const box=document.querySelector('#view .integration');if(!box||current!=='Calendar')return;
    const ok=!!calendarStatus?.calendar_connected;
    box.innerHTML=`<div><strong>Google Calendar</strong><p>${ok?`Connected to ${esc(calendarStatus.email||'Google Calendar')}. Events created or edited in KP HQ sync automatically, and Google Calendar events can be pulled into HQ.`:`${esc(calendarStatus?.error||'Google Calendar is not connected yet.')}`}</p></div><div class="actions"><span class="tag">${ok?'Connected':'Setup required'}</span>${ok?'<button class="secondary mini" onclick="syncGoogleCalendar()">Sync now</button>':''}</div>`;
  }

  async function pushLocalEvent(ev,quiet=false){
    if(!ev?.event_date||!ev?.title)return;
    try{
      const out=await calendarCall({action:'push',event:ev});
      if(out?.id){await sb.from('calendar_events').update({google_event_id:out.id,google_event_url:out.url||null}).eq('id',ev.id)}
      return out;
    }catch(e){if(!quiet)alert(`Saved in KP HQ, but Google Calendar did not sync: ${e?.message||e}`);return null}
  }

  window.syncGoogleCalendar=async function(silent=false){
    try{
      const out=await calendarCall({action:'full_sync'});
      await loadAll();
      if(current==='Calendar')window.calendar($('view'));
      if(!silent)alert(`Google Calendar synced. ${out.pushed||0} KP event${out.pushed===1?'':'s'} pushed, ${out.imported||0} Google event${out.imported===1?'':'s'} imported, ${out.updated||0} updated.`);
      return out;
    }catch(e){if(!silent)alert(`Google Calendar sync failed: ${e?.message||e}`);return null}
  };

  // Creating an HQ calendar event now creates the Google Calendar event too.
  window.save=async function(table,row){
    if(table!=='calendar_events')return oldSave(table,row);
    row.owner_id=OWNER;
    const {data:ev,error}=await sb.from('calendar_events').insert(row).select().single();
    if(error)return alert(error.message);
    closeM();
    await pushLocalEvent(ev);
    await loadAll();
    page();
  };

  // Editing an HQ calendar event updates its linked Google Calendar event.
  if(typeof oldUpdateRecord==='function'){
    window.updateRecord=async function(table,id,row,after){
      if(table!=='calendar_events')return oldUpdateRecord(table,id,row,after);
      const {data:ev,error}=await sb.from('calendar_events').update({...row,updated_at:new Date().toISOString()}).eq('id',id).select().single();
      if(error)return alert(error.message);
      closeM();
      await pushLocalEvent(ev);
      await loadAll();
      if(after&&after!=='page')openClient(after);else page();
    };
  }

  // Deleting a synced HQ calendar event removes it from Google Calendar first.
  if(typeof oldDeleteRecord==='function'){
    window.deleteRecord=async function(table,id,label){
      if(table!=='calendar_events')return oldDeleteRecord(table,id,label);
      if(!confirm(`Delete ${label}?\n\nThis will also remove the linked Google Calendar event.`))return;
      const ev=D.events.find(x=>x.id===id);
      if(ev?.google_event_id){
        try{await calendarCall({action:'delete',google_event_id:ev.google_event_id})}
        catch(e){alert(`Could not remove the Google Calendar event, so nothing was deleted: ${e?.message||e}`);return}
      }
      const {error}=await sb.from('calendar_events').delete().eq('id',id);
      if(error)return alert(`Could not delete ${label}: ${error.message}`);
      await loadAll();page();
    };
  }

  // Keep the existing KP calendar UI, but replace the staged setup card with live status/sync controls.
  window.calendar=function(v){
    oldCalendar(v);
    paintCalendarStatus();
    refreshCalendarStatus();
    if(!autoSyncStarted){
      autoSyncStarted=true;
      setTimeout(()=>syncGoogleCalendar(true),350);
    }
  };
})();