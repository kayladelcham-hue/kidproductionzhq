(()=>{
  const SW_URL='./service-worker.js';

  function b64ToUint8Array(base64){
    const padding='='.repeat((4-base64.length%4)%4);
    const normalized=(base64+padding).replace(/-/g,'+').replace(/_/g,'/');
    const raw=atob(normalized);
    return Uint8Array.from([...raw].map(ch=>ch.charCodeAt(0)));
  }

  async function getRegistration(){
    if(!('serviceWorker' in navigator)) throw new Error('Service workers are not supported on this device.');
    await navigator.serviceWorker.register(SW_URL,{scope:'./'});
    return navigator.serviceWorker.ready;
  }

  async function getCurrentSubscription(){
    try{
      const reg=await getRegistration();
      return await reg.pushManager.getSubscription();
    }catch(_e){
      return null;
    }
  }

  async function getPublicKey(){
    const {data,error}=await sb.functions.invoke('push-send',{body:{action:'get-public-key'}});
    if(error) throw error;
    if(!data?.publicKey) throw new Error(data?.error||'HQ could not load its push key.');
    return data.publicKey;
  }

  async function saveSubscription(subscription){
    const j=subscription.toJSON();
    if(!j?.endpoint||!j?.keys?.p256dh||!j?.keys?.auth) throw new Error('This device returned an incomplete push subscription.');
    const payload={
      owner_id:user.id,
      endpoint:j.endpoint,
      p256dh:j.keys.p256dh,
      auth:j.keys.auth,
      user_agent:navigator.userAgent,
      updated_at:new Date().toISOString()
    };
    const {error}=await sb.from('push_subscriptions').upsert(payload,{onConflict:'endpoint'});
    if(error) throw error;
  }

  async function sendTest(){
    const {data,error}=await sb.functions.invoke('push-send',{body:{
      action:'send',
      title:'KP HQ',
      body:'Push notifications are live. HQ can reach you now.',
      url:'./',
      tag:'kp-hq-test'
    }});
    if(error) throw error;
    if(data?.error) throw new Error(data.error);
    return data;
  }

  function statusText(permission,sub){
    if(permission==='denied') return '🔕 Alerts blocked';
    if(permission==='granted'&&sub) return '🔔 Alerts on';
    return '🔔 Enable alerts';
  }

  async function refreshButton(){
    const btn=document.getElementById('kpPushBtn');
    if(!btn) return;
    const sub=await getCurrentSubscription();
    btn.textContent=statusText(Notification.permission,sub);
    btn.dataset.enabled=Notification.permission==='granted'&&!!sub?'true':'false';
  }

  async function enablePush(){
    if(!user) throw new Error('Sign in to HQ first.');
    if(!('Notification' in window)||!('PushManager' in window)) throw new Error('Push notifications are not supported on this device.');

    const isIOS=/iPad|iPhone|iPod/.test(navigator.userAgent);
    const standalone=window.matchMedia?.('(display-mode: standalone)')?.matches||navigator.standalone===true;
    if(isIOS&&!standalone) throw new Error('Open KP HQ from the Home Screen, then enable alerts there.');

    const permission=await Notification.requestPermission();
    if(permission!=='granted') throw new Error('Notifications were not allowed in iPhone settings.');

    const reg=await getRegistration();
    let sub=await reg.pushManager.getSubscription();
    if(!sub){
      const publicKey=await getPublicKey();
      sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToUint8Array(publicKey)});
    }
    await saveSubscription(sub);
    await refreshButton();
    const result=await sendTest();
    if(!result?.sent) throw new Error('The device registered, but the test push was not delivered.');
  }

  async function handleButton(){
    const btn=document.getElementById('kpPushBtn');
    if(btn) btn.disabled=true;
    try{
      const sub=await getCurrentSubscription();
      if(Notification.permission==='granted'&&sub){
        const result=await sendTest();
        if(!result?.sent) throw new Error('No registered device was available for the test.');
      }else{
        await enablePush();
      }
    }catch(e){
      alert(e?.message||String(e));
    }finally{
      if(btn) btn.disabled=false;
      refreshButton();
    }
  }

  function injectButton(){
    if(!user||role!=='owner'||document.getElementById('kpPushBtn')) return;
    const header=document.querySelector('.shell main header');
    if(!header) return;
    const btn=document.createElement('button');
    btn.id='kpPushBtn';
    btn.className='secondary';
    btn.type='button';
    btn.textContent='🔔 Enable alerts';
    btn.title='HQ push notifications';
    btn.style.marginLeft='auto';
    btn.addEventListener('click',handleButton);
    const avatar=header.querySelector('.avatar');
    if(avatar) header.insertBefore(btn,avatar); else header.appendChild(btn);
    refreshButton();
  }

  if('serviceWorker' in navigator) getRegistration().catch(()=>{});
  const observer=new MutationObserver(()=>injectButton());
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',injectButton);
  window.kpEnablePush=enablePush;
  window.kpTestPush=sendTest;
})();
