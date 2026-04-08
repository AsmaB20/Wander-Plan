// ──────────────────────────────────────────────
//  STATE
// ──────────────────────────────────────────────
let trips = [], activeId = null, aiDayId = null;
let picks = { people: null, type: null, budget: null };
let suggestions = [], chosen = new Set();

// ──────────────────────────────────────────────
//  STORAGE
// ──────────────────────────────────────────────
const save = () => {
  localStorage.setItem('wp_trips', JSON.stringify(trips));
  localStorage.setItem('wp_active', activeId || '');
};
const load = () => {
  try {
    const t = localStorage.getItem('wp_trips');
    if (t) trips = JSON.parse(t);
    const a = localStorage.getItem('wp_active');
    if (a && trips.find(x => x.id === a)) activeId = a;
    else if (trips.length) activeId = trips[0].id;
  } catch { trips = []; }
};

// ──────────────────────────────────────────────
//  HELPERS
// ──────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const trip = () => trips.find(t => t.id === activeId);
const day  = id => trip()?.days.find(d => d.id === id);

function stats(tr) {
  let total = 0, done = 0, all = 0;
  tr.days.forEach(d => {
    total += parseFloat(d.hotel?.cost) || 0;
    d.places.forEach(p => { total += parseFloat(p.cost) || 0; all++; if (p.done) done++; });
  });
  return { total: total.toFixed(0), done, all };
}
function dayTotal(d) {
  let t = parseFloat(d.hotel?.cost) || 0;
  d.places.forEach(p => t += parseFloat(p.cost) || 0);
  return t.toFixed(0);
}

// ──────────────────────────────────────────────
//  RENDER
// ──────────────────────────────────────────────
function render() { renderSidebar(); renderMain(); save(); }

function renderSidebar() {
  document.getElementById('tripList').innerHTML =
    (trips.length ? '<div class="sidebar-label">My Trips</div>' : '') +
    trips.map(t => {
      const s = stats(t);
      return `<div class="trip-row ${t.id===activeId?'active':''}" onclick="select('${t.id}')">
        <div class="trip-row-inner">
          <div class="trip-row-name">${esc(t.name)}</div>
          <div class="trip-row-meta">${t.days.length} day${t.days.length!==1?'s':''} · $${s.total}</div>
        </div>
        <button class="trip-del" onclick="delTrip(event,'${t.id}')">✕</button>
      </div>`;
    }).join('');
}

function renderMain() {
  const tr = trip();
  const empty = document.getElementById('emptyState');
  const view  = document.getElementById('tripView');
  if (!tr) { empty.style.display='flex'; view.style.display='none'; return; }
  empty.style.display='none'; view.style.display='block';
  const s = stats(tr);
  view.innerHTML = `
    <div class="trip-hero">
      <div class="hero-top">
        <div class="hero-left">
          <input class="trip-name-input" value="${esc(tr.name)}" placeholder="Trip name…"
            oninput="upTrip('name',this.value)" />
          <div class="hero-meta">
            <div class="hero-meta-item">📍<input value="${esc(tr.city)}" placeholder="City / Country"
              oninput="upTrip('city',this.value)" /></div>
            <div class="hero-meta-item">📅
              <input type="date" value="${tr.startDate}" oninput="upTrip('startDate',this.value)" />
              &nbsp;→&nbsp;
              <input type="date" value="${tr.endDate}" oninput="upTrip('endDate',this.value)" />
            </div>
          </div>
          <div class="hero-stats">
            <div class="stat-pill budget" id="spBudget">💰 $${s.total} total</div>
            <div class="stat-pill progress" id="spProgress">✅ ${s.done}/${s.all} done</div>
            <div class="stat-pill days" id="spDays">${tr.days.length} day${tr.days.length!==1?'s':''}</div>
          </div>
        </div>
        <div class="hero-actions">
          <button class="btn-hero btn-outline" onclick="downloadPDF()">⬇ PDF</button>
        </div>
      </div>
    </div>
    <div class="days-area">
      ${tr.days.map((d, i) => renderDay(d, i+1)).join('')}
      <button class="add-day-row" onclick="addDay()">＋ Add Day</button>
    </div>`;
}

function renderDay(d, n) {
  const h = d.hotel || {};
  return `<div class="day-card" id="day-${d.id}">
    <div class="day-head">
      <div class="day-num">${n}</div>
      <div class="day-head-middle">
        <input class="day-title-input" value="${esc(d.title)}" placeholder="Day title…"
          oninput="upDay('${d.id}','title',this.value)" />
        <input class="day-date-input" type="date" value="${d.date}"
          oninput="upDay('${d.id}','date',this.value)" />
      </div>
      <div class="day-head-right">
        <div class="day-total-tag" id="dt-${d.id}">$${dayTotal(d)}</div>
        <button class="btn-day-del" onclick="delDay('${d.id}')" title="Remove day">🗑</button>
      </div>
    </div>
    <div class="hotel-strip">
      <span class="hotel-icon">🏨</span>
      <input class="h-in hn" placeholder="Hotel / Accommodation"
        value="${esc(h.name||'')}" oninput="upHotel('${d.id}','name',this.value)" />
      <input class="h-in hc" type="number" placeholder="$/night"
        value="${h.cost||''}" oninput="upHotel('${d.id}','cost',this.value)" />
      <input class="h-in hk" placeholder="Confirmation #"
        value="${esc(h.confirm||'')}" oninput="upHotel('${d.id}','confirm',this.value)" />
    </div>
    <div class="places-list" id="pl-${d.id}">
      ${d.places.map(p => renderPlace(d.id, p)).join('')}
    </div>
    <div class="day-foot">
      <button class="btn-sm btn-ghost-sm" onclick="addPlace('${d.id}')">＋ Add Place</button>
      <button class="btn-sm btn-ai-sm" onclick="openAi('${d.id}')">✦ AI Suggest</button>
    </div>
  </div>`;
}

function renderPlace(dayId, p) {
  const cat = (p.category||'').replace(/\s/g,'');
  return `<div class="place-row ${p.done?'done':''}" id="p-${p.id}">
    <div class="chk ${p.done?'on':''}" onclick="toggleDone('${dayId}','${p.id}')">${p.done?'✓':''}</div>
    <div class="place-fields">
      <input class="p-in place-in-name" value="${esc(p.name)}" placeholder="Place name"
        oninput="upPlace('${dayId}','${p.id}','name',this.value)" />
      <input class="p-in place-in-time" value="${esc(p.time||'')}" placeholder="⏰ Time"
        oninput="upPlace('${dayId}','${p.id}','time',this.value)" />
      <input class="p-in place-in-dur" value="${esc(p.duration||'')}" placeholder="⌛ Duration"
        oninput="upPlace('${dayId}','${p.id}','duration',this.value)" />
      <input class="p-in place-in-cost" type="number" value="${p.cost||''}" placeholder="💰 Cost $"
        oninput="upPlace('${dayId}','${p.id}','cost',this.value)" />
      <input class="p-in place-in-note" value="${esc(p.notes||'')}" placeholder="Notes…"
        oninput="upPlace('${dayId}','${p.id}','notes',this.value)" />
    </div>
    ${cat ? `<span class="cat-tag cat-${cat}">${p.category}</span>` : ''}
    <button class="btn-place-del" onclick="delPlace('${dayId}','${p.id}')">✕</button>
  </div>`;
}

// ──────────────────────────────────────────────
//  TRIP CRUD
// ──────────────────────────────────────────────
function openNewTrip() { document.getElementById('newTripVeil').style.display='flex'; setTimeout(()=>document.getElementById('ntName').focus(),50); }
function closeNewTrip() { document.getElementById('newTripVeil').style.display='none'; }

function createTrip() {
  const name = document.getElementById('ntName').value.trim();
  const city = document.getElementById('ntCity').value.trim();
  if (!name) { toast('Enter a trip name','err'); return; }
  const tr = { id: uid(), name, city, startDate: document.getElementById('ntStart').value, endDate: document.getElementById('ntEnd').value, days: [] };
  trips.unshift(tr); activeId = tr.id;
  closeNewTrip();
  ['ntName','ntCity','ntStart','ntEnd'].forEach(id => document.getElementById(id).value = '');
  render(); toast('Trip created! 🎉','ok');
}
function select(id) { activeId = id; render(); }
function delTrip(e, id) {
  e.stopPropagation();
  if (!confirm('Delete this trip?')) return;
  trips = trips.filter(t => t.id !== id);
  if (activeId === id) activeId = trips[0]?.id || null;
  render();
}
function upTrip(f, v) {
  const tr = trip(); if (!tr) return;
  tr[f] = v; renderSidebar();
  refreshHeroStats(); save();
}

// ──────────────────────────────────────────────
//  DAY CRUD
// ──────────────────────────────────────────────
function addDay() {
  const tr = trip(); if (!tr) return;
  tr.days.push({ id: uid(), title: '', date: '', hotel: {}, places: [] });
  render();
}
function delDay(id) {
  if (!confirm('Delete this day?')) return;
  const tr = trip(); if (!tr) return;
  tr.days = tr.days.filter(d => d.id !== id); render();
}
function upDay(id, f, v) { const d = day(id); if (!d) return; d[f] = v; save(); }
function upHotel(dayId, f, v) {
  const d = day(dayId); if (!d) return;
  if (!d.hotel) d.hotel = {};
  d.hotel[f] = v;
  refreshDayTotal(d); refreshHeroStats(); save();
}

// ──────────────────────────────────────────────
//  PLACE CRUD
// ──────────────────────────────────────────────
function addPlace(dayId) {
  const d = day(dayId); if (!d) return;
  const p = { id: uid(), name: '', time: '', duration: '', cost: '', notes: '', done: false, category: '' };
  d.places.push(p);
  const list = document.getElementById(`pl-${dayId}`);
  const div = document.createElement('div');
  div.innerHTML = renderPlace(dayId, p);
  list.appendChild(div.firstChild);
  list.lastChild.querySelector('.place-in-name')?.focus();
  save();
}
function toggleDone(dayId, pid) {
  const d = day(dayId);
  const p = d?.places.find(x => x.id === pid);
  if (!p) return; p.done = !p.done;
  const el = document.getElementById(`p-${pid}`);
  el.classList.toggle('done', p.done);
  const chk = el.querySelector('.chk');
  chk.classList.toggle('on', p.done); chk.textContent = p.done ? '✓' : '';
  el.querySelector('.place-in-name').style.textDecoration = p.done ? 'line-through' : '';
  refreshHeroStats(); save();
}
function upPlace(dayId, pid, f, v) {
  const d = day(dayId); const p = d?.places.find(x => x.id === pid);
  if (!p) return; p[f] = v;
  if (f === 'cost') { refreshDayTotal(d); refreshHeroStats(); }
  save();
}
function delPlace(dayId, pid) {
  const d = day(dayId); if (!d) return;
  d.places = d.places.filter(p => p.id !== pid);
  document.getElementById(`p-${pid}`)?.remove();
  refreshDayTotal(d); refreshHeroStats(); save();
}

function refreshDayTotal(d) {
  const el = document.getElementById(`dt-${d.id}`);
  if (el) el.textContent = `$${dayTotal(d)}`;
}
function refreshHeroStats() {
  const tr = trip(); if (!tr) return;
  const s = stats(tr);
  const b = document.getElementById('spBudget');
  const p = document.getElementById('spProgress');
  const dy = document.getElementById('spDays');
  if (b) b.textContent = `💰 $${s.total} total`;
  if (p) p.textContent = `✅ ${s.done}/${s.all} done`;
  if (dy) dy.textContent = `${tr.days.length} day${tr.days.length!==1?'s':''}`;
  renderSidebar();
}

// ──────────────────────────────────────────────
//  AI
// ──────────────────────────────────────────────
function openAi(dayId) {
  aiDayId = dayId;
  picks = { people: null, type: null, budget: null };
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
  document.getElementById('aiCity').textContent = trip()?.city || 'your city';
  document.getElementById('aiVeil').style.display = 'flex';
}
function closeAi()    { document.getElementById('aiVeil').style.display='none'; }
function closeAiRes() { document.getElementById('aiResVeil').style.display='none'; }

function pick(group, val) {
  picks[group] = picks[group] === val ? null : val;
  const map = { people: 'cPeople', type: 'cType', budget: 'cBudget' };
  document.getElementById(map[group]).querySelectorAll('.chip').forEach(c => {
    const v = c.getAttribute('onclick').match(/'([^']+)'\)$/)?.[1];
    c.classList.toggle('on', v === picks[group]);
  });
}

async function fetchSuggestions(skip) {
  closeAi();
  const city = trip()?.city;
  if (!city) { toast('Set a destination city first','err'); return; }
  suggestions = []; chosen = new Set();
  document.getElementById('aiResVeil').style.display = 'flex';
  document.getElementById('aiResSub').textContent = `Finding top spots in ${city}…`;
  document.getElementById('aiResBody').innerHTML = `<div class="spin-wrap"><div class="spinner"></div>Asking Gemini AI…</div>`;
  document.getElementById('btnAddSugg').style.display = 'none';

  try {
    const res = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city, skip, people: picks.people, travelType: picks.type, budget: picks.budget })
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error);
    suggestions = data.suggestions;
    document.getElementById('aiResSub').textContent = 'Select the places you want to add.';
    document.getElementById('btnAddSugg').style.display = '';
    document.getElementById('aiResBody').innerHTML = `<div class="sugg-grid">${
      suggestions.map((s, i) => `<div class="sugg-card" id="sc-${i}" onclick="toggleSugg(${i})">
        <div class="sugg-name">${esc(s.name)}</div>
        <div class="sugg-desc">${esc(s.description)}</div>
        <div class="sugg-meta">
          <span class="cat-tag cat-${(s.category||'').replace(/\s/g,'')}">${s.category}</span>
          <span class="dur">⌛ ${s.duration}</span>
          <span class="sugg-cost">${s.cost > 0 ? '$'+s.cost : 'Free'}</span>
        </div>
      </div>`).join('')
    }</div>`;
  } catch(e) {
    document.getElementById('aiResBody').innerHTML = `<div style="padding:32px;text-align:center;color:var(--coral);"><div style="font-size:36px;margin-bottom:12px;">⚠️</div>Couldn't reach Gemini. Make sure <strong>GEMINI_API_KEY</strong> is set.</div>`;
  }
}

function toggleSugg(i) {
  chosen.has(i) ? chosen.delete(i) : chosen.add(i);
  document.getElementById(`sc-${i}`).classList.toggle('picked', chosen.has(i));
}

function addSuggestions() {
  if (!chosen.size) { toast('Select at least one place','err'); return; }
  const d = day(aiDayId); if (!d) return;
  chosen.forEach(i => {
    const s = suggestions[i];
    d.places.push({ id: uid(), name: s.name, time: '', duration: s.duration, cost: s.cost||'', notes: s.description, done: false, category: s.category||'' });
  });
  closeAiRes(); render();
  toast(`Added ${chosen.size} place${chosen.size>1?'s':''}! ✦`, 'ok');
}

// ──────────────────────────────────────────────
//  PDF DOWNLOAD
// ──────────────────────────────────────────────
function downloadPDF() {
  const tr = trip(); if (!tr) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, margin = 18, contentW = W - margin * 2;
  let y = 0;

  const checkPage = (needed = 10) => {
    if (y + needed > 272) { doc.addPage(); y = margin; }
  };

  // ── Cover block ──────────────────────────────
  // Dark header
  doc.setFillColor(30, 33, 48);
  doc.rect(0, 0, W, 55, 'F');

  // Gold accent line
  doc.setFillColor(201, 151, 58);
  doc.rect(0, 55, W, 2, 'F');

  // Logo mark
  doc.setTextColor(201, 151, 58);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('✦ WANDERPLAN', margin, 13);

  // Trip name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  const nameLines = doc.splitTextToSize(tr.name || 'My Trip', contentW);
  doc.text(nameLines, margin, 26);
  const nameH = nameLines.length * 10;

  // Meta pills
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 185, 200);
  let metaY = 26 + nameH - 2;
  if (tr.city)      doc.text(`📍 ${tr.city}`, margin, metaY);
  if (tr.startDate) doc.text(`📅 ${tr.startDate}  →  ${tr.endDate || '?'}`, margin + (tr.city ? 55 : 0), metaY);

  y = 66;

  // Stats bar
  const s = stats(tr);
  doc.setFillColor(247, 243, 236);
  doc.rect(margin, y, contentW, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(196, 90, 62);
  doc.text(`💰 Total: $${s.total}`, margin + 4, y + 9);
  doc.setTextColor(58, 122, 85);
  doc.text(`✅ ${s.done}/${s.all} completed`, margin + 52, y + 9);
  doc.setTextColor(100, 110, 130);
  doc.text(`${tr.days.length} day${tr.days.length !== 1 ? 's' : ''}`, margin + 120, y + 9);
  y += 22;

  // ── Days ────────────────────────────────────
  tr.days.forEach((d, di) => {
    checkPage(30);

    // Day header bar
    doc.setFillColor(30, 33, 48);
    doc.roundedRect(margin, y, contentW, 12, 2, 2, 'F');
    doc.setFillColor(201, 151, 58);
    doc.roundedRect(margin, y, 10, 12, 2, 2, 'F');
    doc.setTextColor(201, 151, 58);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(`${di + 1}`, margin + 3.5, y + 8);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    const dayLabel = d.title ? `Day ${di+1} — ${d.title}` : `Day ${di+1}`;
    doc.text(dayLabel, margin + 14, y + 8);
    if (d.date) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(170, 178, 200);
      doc.text(d.date, W - margin - 2, y + 8, { align: 'right' });
    }
    y += 16;

    // Hotel row
    if (d.hotel?.name) {
      checkPage(10);
      doc.setFillColor(230, 244, 244);
      doc.roundedRect(margin, y, contentW, 9, 1, 1, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(42, 122, 122);
      doc.text('🏨', margin + 2, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(26, 28, 40);
      let hotelTxt = d.hotel.name;
      if (d.hotel.cost) hotelTxt += `  ·  $${d.hotel.cost}/night`;
      if (d.hotel.confirm) hotelTxt += `  ·  Conf# ${d.hotel.confirm}`;
      doc.text(hotelTxt, margin + 8, y + 6);
      // Day total right
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(196, 90, 62);
      doc.text(`Day total: $${dayTotal(d)}`, W - margin - 2, y + 6, { align: 'right' });
      y += 13;
    } else {
      // Just day total
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(196, 90, 62);
      doc.text(`Day total: $${dayTotal(d)}`, W - margin - 2, y - 3, { align: 'right' });
    }

    // Places
    if (d.places.length === 0) {
      checkPage(8);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.setTextColor(160, 165, 175);
      doc.text('No places added yet.', margin + 4, y + 5);
      y += 10;
    } else {
      d.places.forEach((p, pi) => {
        checkPage(12);
        const rowH = p.notes ? 13 : 9;
        const bg = pi % 2 === 0 ? [252, 250, 247] : [255, 255, 255];
        doc.setFillColor(...bg);
        doc.rect(margin, y, contentW, rowH, 'F');

        // Checkbox
        if (p.done) {
          doc.setFillColor(58, 122, 85);
          doc.roundedRect(margin + 2, y + 2, 5, 5, 1, 1, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(6);
          doc.text('✓', margin + 3.2, y + 6);
        } else {
          doc.setDrawColor(200, 195, 185);
          doc.roundedRect(margin + 2, y + 2, 5, 5, 1, 1, 'S');
        }

        // Place name
        doc.setFont('helvetica', p.done ? 'normal' : 'bold');
        doc.setFontSize(9);
        doc.setTextColor(p.done ? 130 : 26, p.done ? 135 : 28, p.done ? 150 : 40);
        const nameW = contentW - 70;
        const pName = doc.splitTextToSize(p.name || 'Unnamed', nameW)[0];
        doc.text(pName, margin + 10, y + 6.5);

        // Time / duration
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(110, 115, 130);
        let meta = [];
        if (p.time) meta.push(`⏰ ${p.time}`);
        if (p.duration) meta.push(`⌛ ${p.duration}`);
        if (meta.length) doc.text(meta.join('   '), margin + 10, y + 12);

        // Cost
        if (p.cost) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8);
          doc.setTextColor(196, 90, 62);
          doc.text(`$${p.cost}`, W - margin - 2, y + 6.5, { align: 'right' });
        }

        // Category
        if (p.category) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(100, 110, 130);
          doc.text(p.category, W - margin - 2, y + 12, { align: 'right' });
        }

        // Notes
        if (p.notes) {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(7.5);
          doc.setTextColor(140, 148, 165);
          const noteLines = doc.splitTextToSize(p.notes, contentW - 14);
          doc.text(noteLines[0], margin + 10, y + (rowH - 2));
        }

        y += rowH + 1;
      });
    }

    y += 10; // gap between days
  });

  // Footer
  checkPage(16);
  doc.setFillColor(247, 243, 236);
  doc.rect(0, 285, W, 12, 'F');
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(160, 155, 145);
  doc.text('Generated by WanderPlan ✦  wanderplan.app', W/2, 292, { align: 'center' });

  doc.save(`${(tr.name||'trip').replace(/[^a-z0-9]/gi,'_')}.pdf`);
  toast('PDF downloaded 📄', 'ok');
}

// ──────────────────────────────────────────────
//  TOAST
// ──────────────────────────────────────────────
function toast(msg, type = 'ok') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${type==='ok'?'✓':'!'}</span>${msg}`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition='opacity .3s'; t.style.opacity='0'; setTimeout(()=>t.remove(),300); }, 2800);
}

// ──────────────────────────────────────────────
//  KEYBOARD
// ──────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeNewTrip(); closeAi(); closeAiRes(); }
  if (e.key === 'Enter' && document.getElementById('newTripVeil').style.display==='flex') createTrip();
});

// ──────────────────────────────────────────────
//  INIT
// ──────────────────────────────────────────────
load(); render();
