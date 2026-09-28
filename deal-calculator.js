(() => {
  'use strict';

  const STORAGE_KEY = 'kpDealCalculator.v1';
  const NAV_ID = 'kp-deal-calculator-nav';
  const PAGE_NAME = 'Deal Calculator';

  const CATEGORIES = {
    local: { label: 'Small local business content', floor: 450, target: '$550–$700', note: 'Package the outcome; avoid cheap hourly pricing.' },
    hospitality: { label: 'Hospitality / travel content', floor: 500, target: '$750–$1,250 + hosted stay', note: 'Hosted value is tracked separately from cash.' },
    luxury: { label: 'Luxury experience / yacht / car', floor: 450, target: '$700–$1,200', note: 'Premium commercial value supports stronger pricing.' },
    event: { label: 'Event photography', floor: 350, target: '$125–$150/hr', note: 'Use a 2–3 hour minimum when practical.' },
    corporate: { label: 'Corporate event / B2B', floor: 500, target: '$150–$200/hr', note: 'Higher commercial value; do not default to consumer rates.' },
    brand: { label: 'Brand campaign', floor: 750, target: '$1,000–$2,000+', note: 'Multiple deliverables and campaign value justify campaign pricing.' },
    headshots: { label: 'Headshot activation', floor: 500, target: '$750–$1,500', note: 'Scale by headcount, setup, retouching and delivery.' },
    contentday: { label: 'Full content day', floor: 1000, target: '$1,250–$1,750', note: 'Typically 4–6 hours with multiple concepts.' },
    productionday: { label: 'Full production day', floor: 1500, target: '$1,800–$2,500+', note: 'Typically 6–8 hours / heavier production scope.' }
  };

  const PACKAGES = {
    starter: { label: 'Social Starter', base: 450, hours: 1.5, videos: 1, photos: 10 },
    campaign: { label: 'Content Campaign', base: 700, hours: 2, videos: 2, photos: 20 },
    story: { label: 'Brand Story', base: 1000, hours: 3, videos: 3, photos: 30 },
    contentday: { label: 'Content Day', base: 1500, hours: 5, videos: 6, photos: 40 },
    custom: { label: 'Custom base', base: 0, hours: 0, videos: 0, photos: 0 }
  };

  const DEFAULTS = {
    clientName: '',
    category: 'hospitality',
    package: 'campaign',
    customBase: 700,
    shootHours: 2,
    videos: 2,
    photos: 20,
    extraLocations: 0,
    turnaround: 'standard',
    usage: 'organic',
    whitelistMonths: 0,
    rawFiles: false,
    travel: 0,
    hostedValue: 0,
    commissionPct: 0,
    expectedBookingRevenue: 0,
    proposedCash: 0,
    strategicDiscount: 0,
    discountReason: ''
  };

  let state = loadState();

  function loadState() {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
    } catch (_) {
      return { ...DEFAULTS };
    }
  }

  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
  }

  const num = v => Number.isFinite(+v) ? +v : 0;
  const money = v => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(num(v));
  const pct = v => `${Math.round(num(v) * 100)}%`;
  const esc = s => String(s ?? '').replace(/[&<>\"]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '\"':'&quot;' }[m]));

  function selectedCategory() { return CATEGORIES[state.category] || CATEGORIES.hospitality; }
  function selectedPackage() { return PACKAGES[state.package] || PACKAGES.campaign; }

  function calc() {
    const category = selectedCategory();
    const pkg = selectedPackage();
    const enteredBase = state.package === 'custom' ? num(state.customBase) : pkg.base;
    const base = Math.max(enteredBase, category.floor);

    const extraHours = Math.max(0, num(state.shootHours) - pkg.hours);
    const extraVideos = Math.max(0, num(state.videos) - pkg.videos);
    const extraPhotoBlocks = Math.max(0, Math.ceil((num(state.photos) - pkg.photos) / 10));
    const extraLocations = Math.max(0, num(state.extraLocations));

    const hourFee = extraHours * 150;
    const videoFee = extraVideos * 150;
    const photoFee = extraPhotoBlocks * 150;
    const locationFee = extraLocations * 150;

    const scopeSubtotal = base + hourFee + videoFee + photoFee + locationFee;
    const rushRate = state.turnaround === 'same' ? 0.50 : state.turnaround === 'rush' ? 0.25 : 0;
    const rushFee = scopeSubtotal * rushRate;
    const productionSubtotal = scopeSubtotal + rushFee;

    const usageRate = state.usage === 'paid30' ? 0.50 : state.usage === 'paid90' ? 1 : state.usage === 'paid180' ? 1.5 : state.usage === 'perpetual' ? 3 : 0;
    const usageFee = productionSubtotal * usageRate;
    const whitelistFee = Math.max(0, num(state.whitelistMonths)) * 250;
    const rawFee = state.rawFiles ? Math.max(250, productionSubtotal * 0.30) : 0;
    const travel = Math.max(0, num(state.travel));

    const normalValue = productionSubtotal + usageFee + whitelistFee + rawFee + travel;
    const strategicDiscount = Math.min(Math.max(0, num(state.strategicDiscount)), normalValue);
    const recommendedQuote = Math.max(0, normalValue - strategicDiscount);
    const cashFloor = Math.max(category.floor, base) + hourFee + videoFee + photoFee + locationFee + rushFee + usageFee + whitelistFee + rawFee + travel - strategicDiscount;

    const proposedCash = Math.max(0, num(state.proposedCash));
    const hostedValue = Math.max(0, num(state.hostedValue));
    const expectedCommission = Math.max(0, num(state.expectedBookingRevenue)) * Math.max(0, num(state.commissionPct)) / 100;
    const guaranteedComp = proposedCash + hostedValue;
    const potentialTotal = guaranteedComp + expectedCommission;
    const cashGap = proposedCash - recommendedQuote;
    const valueGap = guaranteedComp - recommendedQuote;
    const potentialGap = potentialTotal - recommendedQuote;
    const discountPct = normalValue > 0 ? strategicDiscount / normalValue : 0;
    const effectiveHours = Math.max(1, num(state.shootHours));
    const effectiveCashHourly = proposedCash / effectiveHours;

    let status = 'Needs offer';
    let statusClass = 'neutral';
    let statusText = 'Enter the client’s proposed cash fee to evaluate the deal.';
    if (proposedCash > 0) {
      if (proposedCash >= recommendedQuote) {
        if (strategicDiscount > 0) {
          status = 'Strategic discount'; statusClass = 'strategic'; statusText = 'The cash offer meets the intentionally discounted quote. Keep the reason for the concession documented.';
        } else {
          status = 'Strong deal'; statusClass = 'strong'; statusText = 'Cash compensation meets or exceeds the calculated quote.';
        }
      } else if (guaranteedComp >= recommendedQuote && hostedValue > 0) {
        status = 'Strategic deal'; statusClass = 'strategic'; statusText = 'Cash is below quote, but guaranteed cash + in-kind value reaches the calculated value. Confirm the hosted value is genuinely useful.';
      } else if (potentialTotal >= recommendedQuote && expectedCommission > 0) {
        status = 'Commission-dependent'; statusClass = 'strategic'; statusText = 'The deal only reaches target value if projected performance commission materializes. Treat that commission as upside, not guaranteed compensation.';
      } else if (proposedCash >= cashFloor * 0.85 && state.discountReason.trim()) {
        status = 'Strategic discount'; statusClass = 'strategic'; statusText = 'Below target, but a documented strategic concession is recorded.';
      } else {
        status = 'Underpriced'; statusClass = 'under'; statusText = 'The proposed cash fee is below KidProductionz’s calculated value.';
      }
    }

    return {
      category, pkg, base, hourFee, videoFee, photoFee, locationFee,
      scopeSubtotal, rushFee, productionSubtotal, usageFee, whitelistFee, rawFee, travel,
      normalValue, strategicDiscount, discountPct, recommendedQuote, cashFloor,
      proposedCash, hostedValue, expectedCommission, guaranteedComp, potentialTotal, cashGap, valueGap, potentialGap,
      effectiveCashHourly, status, statusClass, statusText
    };
  }

  function optionMap(obj, selected) {
    return Object.entries(obj).map(([key, item]) => `<option value="${key}" ${key === selected ? 'selected' : ''}>${esc(item.label)}</option>`).join('');
  }

  function render() {
    const view = document.getElementById('view');
    if (!view) return;
    const c = calc();
    const customHidden = state.package === 'custom' ? '' : ' hidden';
    const discountWarning = c.strategicDiscount > 0 && !state.discountReason.trim()
      ? '<div class="dc-alert warn"><strong>Discount reason required.</strong> If you intentionally reduce the normal value, document what KidProductionz is receiving in return.</div>' : '';

    view.innerHTML = `
      <div class="dc-wrap">
        <div class="dc-hero">
          <div>
            <div class="eyebrow">KIDPRODUCTIONZ PRICING BRAIN</div>
            <h2>Deal Value Calculator</h2>
            <p>Build the scope, price the rights, and compare the client offer without mixing cash and in-kind value.</p>
          </div>
          <div class="dc-hero-actions">
            <button class="secondary" id="dcReset">Reset</button>
            <button class="btn" id="dcCopy">Copy deal summary</button>
          </div>
        </div>

        <div class="dc-metrics">
          <div class="dc-metric primary"><span>Recommended quote</span><strong>${money(c.recommendedQuote)}</strong><small>After any deliberate discount</small></div>
          <div class="dc-metric"><span>Normal commercial value</span><strong>${money(c.normalValue)}</strong><small>Before strategic discount</small></div>
          <div class="dc-metric"><span>Guaranteed compensation</span><strong>${money(c.guaranteedComp)}</strong><small>Cash + in-kind • potential with commission: ${money(c.potentialTotal)}</small></div>
          <div class="dc-metric status ${c.statusClass}"><span>Deal status</span><strong>${esc(c.status)}</strong><small>${esc(c.statusText)}</small></div>
        </div>

        ${discountWarning}

        <div class="dc-grid">
          <section class="dc-panel">
            <div class="dc-panel-head"><div><h3>1. Scope builder</h3><p>Start with what the client is actually buying.</p></div></div>
            <div class="dc-fields two">
              <label>Client / deal name<input data-dc="clientName" value="${esc(state.clientName)}" placeholder="e.g. YATR Miami"></label>
              <label>Deal category<select data-dc="category">${optionMap(CATEGORIES, state.category)}</select></label>
              <label>Starting package<select data-dc="package">${optionMap(PACKAGES, state.package)}</select></label>
              <label class="dc-custom-base${customHidden}">Custom base fee<input data-dc="customBase" type="number" min="0" step="50" value="${num(state.customBase)}"></label>
              <label>Shoot hours<input data-dc="shootHours" type="number" min="0" step="0.5" value="${num(state.shootHours)}"></label>
              <label>Vertical videos<input data-dc="videos" type="number" min="0" step="1" value="${num(state.videos)}"></label>
              <label>Edited photos<input data-dc="photos" type="number" min="0" step="1" value="${num(state.photos)}"></label>
              <label>Additional locations<input data-dc="extraLocations" type="number" min="0" step="1" value="${num(state.extraLocations)}"></label>
            </div>
            <div class="dc-guideline"><span>Category floor</span><strong>${money(c.category.floor)}</strong><span>Target</span><strong>${esc(c.category.target)}</strong><p>${esc(c.category.note)}</p></div>
          </section>

          <section class="dc-panel">
            <div class="dc-panel-head"><div><h3>2. Rights + production extras</h3><p>These items should not disappear inside the base fee.</p></div></div>
            <div class="dc-fields two">
              <label>Turnaround<select data-dc="turnaround"><option value="standard" ${state.turnaround==='standard'?'selected':''}>Standard (3–5 business days)</option><option value="rush" ${state.turnaround==='rush'?'selected':''}>48–72 hour rush (+25%)</option><option value="same" ${state.turnaround==='same'?'selected':''}>Same / next day (+50%)</option></select></label>
              <label>Usage<select data-dc="usage"><option value="organic" ${state.usage==='organic'?'selected':''}>Organic social + website (included)</option><option value="paid30" ${state.usage==='paid30'?'selected':''}>30-day paid ads (+50%)</option><option value="paid90" ${state.usage==='paid90'?'selected':''}>3-month paid ads (+100%)</option><option value="paid180" ${state.usage==='paid180'?'selected':''}>6-month paid ads (+150%)</option><option value="perpetual" ${state.usage==='perpetual'?'selected':''}>Perpetual commercial use (min 3×)</option></select></label>
              <label>Whitelisting months<input data-dc="whitelistMonths" type="number" min="0" step="1" value="${num(state.whitelistMonths)}"><small>$250/month minimum</small></label>
              <label>Travel / parking / tolls<input data-dc="travel" type="number" min="0" step="25" value="${num(state.travel)}"></label>
            </div>
            <label class="dc-check"><input data-dc="rawFiles" type="checkbox" ${state.rawFiles?'checked':''}><span><strong>Raw files requested</strong><small>Adds $250 or 30% of production subtotal, whichever is higher.</small></span></label>
          </section>

          <section class="dc-panel">
            <div class="dc-panel-head"><div><h3>3. Client offer</h3><p>Keep cash, hosted value, and performance upside separate.</p></div></div>
            <div class="dc-fields two">
              <label>Proposed cash fee<input data-dc="proposedCash" type="number" min="0" step="50" value="${num(state.proposedCash)}"></label>
              <label>Hosted / in-kind value<input data-dc="hostedValue" type="number" min="0" step="50" value="${num(state.hostedValue)}"><small>Track it — do not silently treat it as cash.</small></label>
              <label>Performance commission %<input data-dc="commissionPct" type="number" min="0" step="1" value="${num(state.commissionPct)}"></label>
              <label>Expected tracked booking revenue<input data-dc="expectedBookingRevenue" type="number" min="0" step="100" value="${num(state.expectedBookingRevenue)}"></label>
            </div>
          </section>

          <section class="dc-panel">
            <div class="dc-panel-head"><div><h3>4. Strategic concession</h3><p>Discount only on purpose — and write down the trade.</p></div></div>
            <div class="dc-fields two">
              <label>Strategic discount ($)<input data-dc="strategicDiscount" type="number" min="0" step="50" value="${num(state.strategicDiscount)}"></label>
              <div class="dc-mini-stat"><span>Discount from normal value</span><strong>${pct(c.discountPct)}</strong></div>
            </div>
            <label>Reason / what KP gets in return<textarea data-dc="discountReason" placeholder="Example: hosted stay + testimonial + portfolio rights + warm referral">${esc(state.discountReason)}</textarea></label>
          </section>
        </div>

        <div class="dc-bottom-grid">
          <section class="dc-panel">
            <div class="dc-panel-head"><div><h3>Price breakdown</h3><p>How the quote was built.</p></div></div>
            <div class="dc-breakdown">
              <div><span>Base production</span><strong>${money(c.base)}</strong></div>
              <div><span>Extra hours</span><strong>${money(c.hourFee)}</strong></div>
              <div><span>Extra video deliverables</span><strong>${money(c.videoFee)}</strong></div>
              <div><span>Extra photo blocks</span><strong>${money(c.photoFee)}</strong></div>
              <div><span>Additional locations</span><strong>${money(c.locationFee)}</strong></div>
              <div><span>Rush premium</span><strong>${money(c.rushFee)}</strong></div>
              <div><span>Usage / licensing</span><strong>${money(c.usageFee)}</strong></div>
              <div><span>Whitelisting</span><strong>${money(c.whitelistFee)}</strong></div>
              <div><span>Raw files</span><strong>${money(c.rawFee)}</strong></div>
              <div><span>Travel / parking / tolls</span><strong>${money(c.travel)}</strong></div>
              <div class="total"><span>Normal commercial value</span><strong>${money(c.normalValue)}</strong></div>
              <div class="discount"><span>Strategic discount</span><strong>−${money(c.strategicDiscount)}</strong></div>
              <div class="grand"><span>Recommended quote</span><strong>${money(c.recommendedQuote)}</strong></div>
            </div>
          </section>

          <section class="dc-panel">
            <div class="dc-panel-head"><div><h3>Decision readout</h3><p>Use this before sending a quote or accepting a deal.</p></div></div>
            <div class="dc-decision ${c.statusClass}">
              <span>${esc(c.status)}</span><strong>${money(c.proposedCash)} cash</strong><p>${esc(c.statusText)}</p>
            </div>
            <div class="dc-kpis">
              <div><span>Cash vs quote</span><strong class="${c.cashGap >= 0 ? 'positive' : 'negative'}">${c.cashGap >= 0 ? '+' : ''}${money(c.cashGap)}</strong></div>
              <div><span>Guaranteed comp vs quote</span><strong class="${c.valueGap >= 0 ? 'positive' : 'negative'}">${c.valueGap >= 0 ? '+' : ''}${money(c.valueGap)}</strong></div>
              <div><span>Potential comp vs quote</span><strong class="${c.potentialGap >= 0 ? 'positive' : 'negative'}">${c.potentialGap >= 0 ? '+' : ''}${money(c.potentialGap)}</strong></div>
              <div><span>Est. commission upside</span><strong>${money(c.expectedCommission)}</strong></div>
              <div><span>Cash per shoot hour</span><strong>${money(c.effectiveCashHourly)}</strong></div>
            </div>
            <div class="dc-rules">
              <strong>KP rules in effect</strong>
              <p>50% non-refundable retainer. Within 72 hours: 100% upfront unless intentionally overridden. Organic social + website usage only is included by default. Paid usage, raw files, extra locations, extended time, travel and rush delivery are separate.</p>
            </div>
          </section>
        </div>
      </div>`;

    bindInputs();
    document.getElementById('dcReset')?.addEventListener('click', resetCalculator);
    document.getElementById('dcCopy')?.addEventListener('click', copySummary);
  }

  function bindInputs() {
    document.querySelectorAll('[data-dc]').forEach(el => {
      el.addEventListener('change', () => {
        const key = el.dataset.dc;
        state[key] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? num(el.value) : el.value);
        if (key === 'package' && PACKAGES[state.package] && state.package !== 'custom') {
          const p = PACKAGES[state.package];
          state.shootHours = p.hours;
          state.videos = p.videos;
          state.photos = p.photos;
          state.customBase = p.base;
        }
        saveState();
        render();
      });
    });
  }

  function resetCalculator() {
    if (!confirm('Reset this deal calculator?')) return;
    state = { ...DEFAULTS };
    saveState();
    render();
  }

  async function copySummary() {
    const c = calc();
    const lines = [
      `KidProductionz Deal Value Summary${state.clientName ? ` — ${state.clientName}` : ''}`,
      `Category: ${c.category.label}`,
      `Package: ${c.pkg.label}`,
      `Normal commercial value: ${money(c.normalValue)}`,
      `Strategic discount: ${money(c.strategicDiscount)}${state.discountReason ? ` — ${state.discountReason}` : ''}`,
      `Recommended quote: ${money(c.recommendedQuote)}`,
      `Client cash offer: ${money(c.proposedCash)}`,
      `Hosted / in-kind value: ${money(c.hostedValue)}`,
      `Estimated performance commission: ${money(c.expectedCommission)}`,
      `Guaranteed compensation: ${money(c.guaranteedComp)}`,
      `Potential total with estimated commission: ${money(c.potentialTotal)}`,
      `Status: ${c.status}`,
      `Usage: ${document.querySelector('[data-dc="usage"]')?.selectedOptions?.[0]?.textContent || state.usage}`
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      const btn = document.getElementById('dcCopy');
      if (btn) { const old = btn.textContent; btn.textContent = 'Copied ✓'; setTimeout(() => btn.textContent = old, 1200); }
    } catch (_) {
      alert(lines.join('\n'));
    }
  }

  function openCalculator() {
    window.__kpDealCalculatorOpen = true;
    const nav = document.querySelector('.side nav');
    if (nav) nav.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.id === NAV_ID));
    const h1 = document.querySelector('.shell header h1');
    if (h1) h1.textContent = PAGE_NAME;
    render();
  }

  function injectNav() {
    const nav = document.querySelector('.side nav');
    if (!nav || document.getElementById(NAV_ID)) return;
    const button = document.createElement('button');
    button.id = NAV_ID;
    button.type = 'button';
    button.textContent = PAGE_NAME;
    button.addEventListener('click', openCalculator);
    nav.appendChild(button);
  }

  function syncAfterShell() {
    injectNav();
    if (window.__kpDealCalculatorOpen) {
      const view = document.getElementById('view');
      const h1 = document.querySelector('.shell header h1');
      if (view && h1 && h1.textContent !== PAGE_NAME) {
        window.__kpDealCalculatorOpen = false;
      }
    }
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      syncAfterShell();
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      syncAfterShell();
      observer.observe(document.body, { childList: true, subtree: true });
    }, { once: true });
  } else {
    syncAfterShell();
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();