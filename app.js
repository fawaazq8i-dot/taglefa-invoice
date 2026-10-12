/* ===== تغليفة Invoice App ===== */

const DB   = 'TaglefaInvoice';
const VER  = 1;
const ROWS = 15;

let db = null;
let allCusts = [];
let curNum = 1;

/* ===== IndexedDB ===== */
function openDB() {
  return new Promise((ok, fail) => {
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains('customers'))
        d.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
      if (!d.objectStoreNames.contains('invoices'))
        d.createObjectStore('invoices', { keyPath: 'id', autoIncrement: true });
      if (!d.objectStoreNames.contains('settings'))
        d.createObjectStore('settings', { keyPath: 'key' });
    };
    r.onsuccess = e => ok(e.target.result);
    r.onerror   = e => fail(e.target.error);
  });
}

const tx = (store, mode = 'readonly') => db.transaction(store, mode).objectStore(store);

function dbGet(store, key)    { return new Promise((ok,f) => { const r=tx(store).get(key); r.onsuccess=e=>ok(e.target.result); r.onerror=e=>f(e.target.error); }); }
function dbGetAll(store)      { return new Promise((ok,f) => { const r=tx(store).getAll(); r.onsuccess=e=>ok(e.target.result); r.onerror=e=>f(e.target.error); }); }
function dbPut(store, val)    { return new Promise((ok,f) => { const r=tx(store,'readwrite').put(val); r.onsuccess=e=>ok(e.target.result); r.onerror=e=>f(e.target.error); }); }
function dbAdd(store, val)    { return new Promise((ok,f) => { const r=tx(store,'readwrite').add(val); r.onsuccess=e=>ok(e.target.result); r.onerror=e=>f(e.target.error); }); }
function dbDel(store, key)    { return new Promise((ok,f) => { const r=tx(store,'readwrite').delete(key); r.onsuccess=()=>ok(); r.onerror=e=>f(e.target.error); }); }

/* ===== بدء التطبيق ===== */
async function init() {
  db = await openDB();
  const s = await dbGet('settings', 'lastNum');
  curNum = s ? s.value + 1 : 1;
  allCusts = await dbGetAll('customers');
  buildTable(ROWS);
  resetInvoice();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
}

/* ===== بناء جدول البضاعة ===== */
function buildTable(n) {
  const tb = document.getElementById('itemsBody');
  tb.innerHTML = '';
  for (let i = 1; i <= n; i++) tb.appendChild(makeRow(i));
}

function makeRow(n, d = {}) {
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${n}</td>
    <td><input class="inp-desc" type="text" value="${d.desc||''}"></td>
    <td><input type="number" min="0" step="any" value="${d.qty||''}" oninput="calcRow(this)"></td>
    <td><input type="number" min="0" step="any" value="${d.price||''}" oninput="calcRow(this)"></td>
    <td class="row-total">${d.total||''}</td>
    <td class="no-print" style="padding:0;text-align:center"><button class="del-row-icon" onclick="deleteRow(this)">×</button></td>
  `;
  return tr;
}

function deleteRow(btn) {
  const tb = document.getElementById('itemsBody');
  if (tb.rows.length <= 1) { toast('يجب أن يبقى صف واحد على الأقل', 'err'); return; }
  btn.closest('tr').remove();
  Array.from(tb.rows).forEach((r, i) => r.cells[0].textContent = i + 1);
  updateRowCount();
  calcGrand();
}

function addRow() {
  const tb = document.getElementById('itemsBody');
  tb.appendChild(makeRow(tb.rows.length + 1));
  updateRowCount();
}

function removeRow() {
  const tb = document.getElementById('itemsBody');
  if (tb.rows.length > 1) tb.deleteRow(tb.rows.length - 1);
  updateRowCount();
}

function updateRowCount() {
  const el = document.getElementById('rowCount');
  if (el) el.textContent = document.getElementById('itemsBody').rows.length + ' صف';
}

/* ===== حساب المجاميع ===== */
function calcRow(inp) {
  const row   = inp.closest('tr');
  const qty   = parseFloat(row.cells[2].querySelector('input').value) || 0;
  const price = parseFloat(row.cells[3].querySelector('input').value) || 0;
  row.cells[4].textContent = (qty || price) ? (qty * price).toFixed(3) : '';
  calcGrand();
}

function calcGrand() {
  let g = 0;
  document.querySelectorAll('#itemsBody tr').forEach(r => {
    g += parseFloat(r.cells[4].textContent) || 0;
  });
  document.getElementById('grandTotal').textContent = g > 0 ? g.toFixed(3) : '';
}

/* ===== ملء بيانات الفاتورة ===== */
function resetInvoice() {
  const num = String(curNum).padStart(4, '0');
  document.getElementById('badgeNum').value  = num;
  const d = todayStr();
  document.getElementById('invoiceDate').textContent = d;
  document.getElementById('invoiceDateDisplay').value = d;
  document.getElementById('invoiceTime').value = nowTimeStr();
  updateRowCount();
}

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')} / ${String(d.getMonth()+1).padStart(2,'0')} / ${d.getFullYear()}`;
}

function nowTimeStr() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function syncNum(v) {
  // رقم الفاتورة في الشارة الحمراء فقط
}

/* ===== Autocomplete العملاء ===== */
function searchCustomers(q) {
  const box = document.getElementById('ac-box');
  if (!q.trim()) { box.style.display = 'none'; return; }
  const res = allCusts.filter(c => c.name.includes(q) || (c.phone||'').includes(q));
  if (!res.length) { box.style.display = 'none'; return; }
  box.innerHTML = res.map(c =>
    `<div class="ac-item" onclick="pickCustomer(${c.id})">${c.name} &nbsp;·&nbsp; ${c.phone||''}</div>`
  ).join('');
  box.style.display = 'block';
}

function pickCustomer(id) {
  const c = allCusts.find(x => x.id === id);
  if (!c) return;
  document.getElementById('customerName').value    = c.name;
  document.getElementById('customerPhone').value   = c.phone || '';
  document.getElementById('deliveryAddress').value = c.address || '';
  document.getElementById('ac-box').style.display  = 'none';
}

document.addEventListener('click', e => {
  if (!e.target.closest('.ac-wrap'))
    document.getElementById('ac-box').style.display = 'none';
});

/* ===== حفظ عميل حالي ===== */
async function saveCurrentCustomer() {
  const name    = (document.getElementById('customerName').value || '').trim();
  const phone   = (document.getElementById('customerPhone').value || '').trim();
  const address = (document.getElementById('deliveryAddress').value || '').trim();
  if (!name) { toast('أدخل اسم العميل', 'err'); return; }
  if (allCusts.some(c => c.name === name && c.phone === phone)) { toast('العميل موجود مسبقاً', 'err'); return; }
  const id = await dbAdd('customers', { name, phone, address });
  allCusts.push({ id, name, phone, address });
  toast('تم حفظ العميل ✓', 'ok');
}

/* ===== فاتورة جديدة ===== */
async function newInvoice() {
  if (!confirm('فاتورة جديدة؟ سيتم مسح الحقول الحالية.')) return;
  curNum++;
  await dbPut('settings', { key: 'lastNum', value: curNum - 1 });
  ['customerName','customerPhone','paymentMethod','deliveryAddress'].forEach(id => {
    document.getElementById(id).value = '';
  });
  buildTable(ROWS);
  calcGrand();
  resetInvoice();
  toast('فاتورة جديدة ✓', 'ok');
}

/* ===== حفظ الفاتورة ===== */
async function saveInvoice() {
  const number  = document.getElementById('badgeNum').value.trim();
  const dateVal = document.getElementById('invoiceDateDisplay').value || document.getElementById('invoiceDate').textContent;
  const timeVal = document.getElementById('invoiceTime').value;
  const date    = timeVal ? dateVal + ' ' + timeVal : dateVal;
  const customer= document.getElementById('customerName').value.trim();
  const phone   = document.getElementById('customerPhone').value.trim();
  const address = document.getElementById('deliveryAddress').value.trim();
  const payment = document.getElementById('paymentMethod').value.trim();
  const total   = document.getElementById('grandTotal').textContent;

  const items = [];
  document.querySelectorAll('#itemsBody tr').forEach((r,i) => {
    const desc  = r.cells[1].querySelector('input').value.trim();
    const qty   = r.cells[2].querySelector('input').value;
    const price = r.cells[3].querySelector('input').value;
    if (desc || qty || price)
      items.push({ n: i+1, desc, qty, price, total: r.cells[4].textContent });
  });

  await dbAdd('invoices', { number, date, customer, phone, address, payment, total, items, at: Date.now() });
  await dbPut('settings', { key: 'lastNum', value: parseInt(number) || curNum });
  toast(`تم حفظ الفاتورة #${number} ✓`, 'ok');
}

/* ===== نافذة العملاء ===== */
async function showCustomersModal() {
  allCusts = await dbGetAll('customers');
  renderCusts(allCusts);
  document.getElementById('modalCust').style.display = 'flex';
}

function renderCusts(list) {
  const el = document.getElementById('custList');
  if (!list.length) { el.innerHTML = '<p style="text-align:center;color:#aaa;padding:16px">لا يوجد عملاء</p>'; return; }
  el.innerHTML = list.map(c => `
    <div class="cust-card">
      <div>
        <div class="cust-name">${c.name}</div>
        <div class="cust-phone">${c.phone||''}${c.address?' · '+c.address:''}</div>
      </div>
      <div class="card-btns">
        <button class="btn-use" onclick="useCust(${c.id})">استخدام</button>
        <button class="btn-del" onclick="delCust(${c.id})">حذف</button>
      </div>
    </div>
  `).join('');
}

function filterCusts(q) {
  renderCusts(q ? allCusts.filter(c => c.name.includes(q)||c.phone.includes(q)) : allCusts);
}

function useCust(id) { pickCustomer(id); closeModal('modalCust'); }

async function delCust(id) {
  if (!confirm('حذف العميل؟')) return;
  await dbDel('customers', id);
  allCusts = allCusts.filter(c => c.id !== id);
  renderCusts(allCusts);
  toast('تم الحذف', 'ok');
}

/* ===== نافذة السجل ===== */
async function showHistoryModal() {
  const all = await dbGetAll('invoices');
  all.sort((a,b) => b.at - a.at);
  const el = document.getElementById('histList');
  if (!all.length) { el.innerHTML = '<p style="text-align:center;color:#aaa;padding:16px">لا توجد فواتير</p>'; }
  else el.innerHTML = all.map(inv => `
    <div class="hist-card">
      <div class="hist-top">
        <span class="hist-num">#${inv.number}</span>
        <span class="hist-date">${inv.date}</span>
      </div>
      <div class="hist-cust">${inv.customer||'بدون اسم'}</div>
      <div class="hist-bot">
        <span class="hist-amt">المجموع: ${inv.total} د.ك</span>
        <div class="card-btns">
          <button class="btn-load" onclick="loadInv(${inv.id})">تحميل</button>
          <button class="btn-del" onclick="delInv(${inv.id})">حذف</button>
        </div>
      </div>
    </div>
  `).join('');
  document.getElementById('modalHist').style.display = 'flex';
}

async function loadInv(id) {
  const all = await dbGetAll('invoices');
  const inv = all.find(x => x.id === id);
  if (!inv) return;
  if (!confirm('تحميل هذه الفاتورة؟ سيتم مسح الحقول الحالية.')) return;

  document.getElementById('badgeNum').value             = inv.number;
  document.getElementById('invoiceDate').textContent = inv.date;
  document.getElementById('invoiceDateDisplay').value = inv.date;
  document.getElementById('customerName').value         = inv.customer || '';
  document.getElementById('customerPhone').value        = inv.phone || '';
  document.getElementById('deliveryAddress').value      = inv.address || '';
  document.getElementById('paymentMethod').value        = inv.payment || '';

  const tb = document.getElementById('itemsBody');
  tb.innerHTML = '';
  const n = Math.max(ROWS, (inv.items||[]).length);
  for (let i = 0; i < n; i++) {
    const it = (inv.items||[])[i];
    tb.appendChild(makeRow(i+1, it || {}));
  }
  calcGrand();
  updateRowCount();
  closeModal('modalHist');
  toast(`تم تحميل #${inv.number}`, 'ok');
}

async function delInv(id) {
  if (!confirm('حذف هذه الفاتورة نهائياً؟')) return;
  await dbDel('invoices', id);
  showHistoryModal();
  toast('تم الحذف', 'ok');
}

/* ===== إغلاق نافذة ===== */
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
});

/* ===== إشعار ===== */
function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast no-print' + (type ? ' ' + type : '');
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ===== تشغيل ===== */
init().catch(err => { console.error(err); toast('خطأ في قاعدة البيانات', 'err'); });
