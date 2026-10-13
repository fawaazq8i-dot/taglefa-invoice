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
  document.getElementById('badgeNum').value = num;
  const d = todayStr();
  document.getElementById('invoiceDate').textContent = d;
  document.getElementById('invoiceDateDisplay').value = d;
  updateRowCount();
}

function todayStr() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,'0')} / ${String(d.getMonth()+1).padStart(2,'0')} / ${d.getFullYear()}`;
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
  const date    = document.getElementById('invoiceDateDisplay').value || document.getElementById('invoiceDate').textContent;
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

/* ===== PDF / مشاركة ===== */
function loadScript(src) {
  return new Promise((ok, fail) => {
    if (document.querySelector(`script[src="${src}"]`)) { ok(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = fail;
    document.head.appendChild(s);
  });
}

async function sharePDF() {
  toast('جاري تجهيز الـ PDF…');
  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
  } catch {
    toast('تعذّر تحميل مكتبة PDF — تحقق من الاتصال بالإنترنت', 'err'); return;
  }

  const inv = document.getElementById('invoice');
  const noPrint = inv.querySelectorAll('.no-print');
  noPrint.forEach(el => el.style.display = 'none');

  // إزالة التحديد البنفسجي من الحقول
  if (document.activeElement) document.activeElement.blur();

  // تثبيت عرض الفاتورة بحجم desktop لتجنب الهوامش البيضاء
  const prevWidth    = inv.style.width;
  const prevMaxWidth = inv.style.maxWidth;
  inv.style.width    = '750px';
  inv.style.maxWidth = '750px';

  const prevScroll = window.scrollY;
  window.scrollTo(0, 0);

  // انتظار تحميل الخطوط العربية قبل الالتقاط
  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 200));

  try {
    const canvas = await html2canvas(inv, {
      scale: 2.5,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      width: 750,
      height: inv.scrollHeight,
      windowWidth: 750,
      windowHeight: inv.scrollHeight,
      onclone: (_, clone) => {
        // إزالة أنماط التحديد من الحقول في النسخة الملتقطة
        clone.querySelectorAll('input, textarea').forEach(inp => {
          inp.style.outline    = 'none';
          inp.style.boxShadow  = 'none';
          inp.style.background = 'transparent';
        });
        // التأكد من ظهور رقم الفاتورة الأحمر
        const badge = clone.querySelector('.red-badge');
        if (badge) {
          badge.style.display   = 'flex';
          badge.style.zIndex    = '9999';
          badge.style.position  = 'absolute';
          badge.style.top       = '0';
          badge.style.right     = '0';
          badge.style.minWidth  = '120px';
          badge.style.overflow  = 'visible';
          badge.style.padding   = '5px 16px 6px';
        }
        const lbl = clone.querySelector('.red-badge-lbl');
        if (lbl) {
          lbl.style.whiteSpace  = 'nowrap';
          lbl.style.direction   = 'rtl';
          lbl.style.textAlign   = 'center';
          lbl.style.width       = '100%';
          lbl.style.fontSize    = '8px';
          lbl.style.letterSpacing = '0';
        }
      }
    });

    // استعادة العرض الأصلي
    inv.style.width    = prevWidth;
    inv.style.maxWidth = prevMaxWidth;
    noPrint.forEach(el => el.style.display = '');
    window.scrollTo(0, prevScroll);

    const { jsPDF } = window.jspdf;
    const mmW = 210;
    const mmH = (canvas.height * mmW) / canvas.width;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [mmW, mmH] });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.97), 'JPEG', 0, 0, mmW, mmH);

    const num = document.getElementById('badgeNum').value || '0001';
    const filename = `فاتورة-${num}.pdf`;
    const blob = pdf.output('blob');
    const file = new File([blob], filename, { type: 'application/pdf' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: `فاتورة تغليفة #${num}` });
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    }
    toast('تم تجهيز الـ PDF ✓', 'ok');
  } catch (e) {
    inv.style.width    = prevWidth;
    inv.style.maxWidth = prevMaxWidth;
    noPrint.forEach(el => el.style.display = '');
    window.scrollTo(0, prevScroll);
    toast('حدث خطأ أثناء إنشاء الـ PDF', 'err');
    console.error(e);
  }
}

/* ===== طباعة عبر صورة — مضمونة على iOS ===== */
async function printInvoice() {
  toast('جاري تجهيز الطباعة…');
  try {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
  } catch { toast('تعذّر تحميل المكتبة — تحقق من الاتصال', 'err'); return; }

  const inv = document.getElementById('invoice');
  const noPrint = inv.querySelectorAll('.no-print');
  noPrint.forEach(el => el.style.display = 'none');
  if (document.activeElement) document.activeElement.blur();

  const prevWidth = inv.style.width, prevMax = inv.style.maxWidth;
  inv.style.width = '750px'; inv.style.maxWidth = '750px';
  const prevScroll = window.scrollY;
  window.scrollTo(0, 0);
  await document.fonts.ready;
  await new Promise(r => setTimeout(r, 200));

  try {
    const canvas = await html2canvas(inv, {
      scale: 2, useCORS: true, allowTaint: true,
      backgroundColor: '#ffffff',
      width: 750, height: inv.scrollHeight,
      windowWidth: 750, windowHeight: inv.scrollHeight,
      onclone: (_, clone) => {
        clone.querySelectorAll('input,textarea').forEach(el => {
          el.style.outline = 'none'; el.style.boxShadow = 'none'; el.style.background = 'transparent';
        });
        const b = clone.querySelector('.red-badge');
        if (b) { b.style.display='flex'; b.style.zIndex='9999'; b.style.overflow='visible'; }
      }
    });

    inv.style.width = prevWidth; inv.style.maxWidth = prevMax;
    noPrint.forEach(el => el.style.display = '');
    window.scrollTo(0, prevScroll);

    const img = canvas.toDataURL('image/jpeg', 0.95);
    const w = window.open('', '_blank');
    if (!w) { toast('يرجى السماح بالنوافذ المنبثقة في Safari', 'err'); return; }
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#fff}
img{width:100%;height:auto;display:block}
@page{size:auto;margin:5mm}
@media print{body{margin:0}img{width:100%;page-break-inside:avoid}}
</style></head><body><img src="${img}">
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close()}}<\/script>
</body></html>`);
    w.document.close();
  } catch(e) {
    inv.style.width = prevWidth; inv.style.maxWidth = prevMax;
    noPrint.forEach(el => el.style.display = '');
    window.scrollTo(0, prevScroll);
    toast('حدث خطأ في الطباعة', 'err'); console.error(e);
  }
}

/* ===== تشغيل ===== */
init().catch(err => { console.error(err); toast('خطأ في قاعدة البيانات', 'err'); });
