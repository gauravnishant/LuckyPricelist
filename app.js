// =========================================================================
// 1. DATABASE CONFIGURATION
// REST API endpoint for Firebase Realtime Database
// =========================================================================
const FIREBASE_DB_URL = "https://lucky-catalog-default-rtdb.firebaseio.com/";

let catalog = [];
let lastDeleted = null;
let toastTimeout = null;
let activeModalItem = null;

let activeSeries = "all";
let activeCategory = "all";
let searchQuery = "";
let activeSort = "default";
let viewMode = "grid";

let drawerSeries = "all";
let drawerSearchQuery = "";

const CATEGORY_LABELS = {
  switch: "Switches & Bell Push",
  socket: "Power Sockets",
  regulator: "Fan Regulators",
  mcb: "Mini MCBs",
  plate: "Plates & Frames",
  surfacebox: "Surface Boxes",
  hospitality: "Hospitality & Aux",
};

function formatCategoryLabel(catKey) {
  if (CATEGORY_LABELS[catKey]) return CATEGORY_LABELS[catKey];
  return catKey
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

// =========================================================================
// 2. IMAGE & VECTOR RENDERING
// =========================================================================
function generateVisual(item) {
  if (item.image && item.image.trim() !== "") {
    return `<img src="${item.image}" alt="${item.name}" class="w-full h-full object-contain rounded-lg p-1" onerror="this.onerror=null; this.parentElement.innerHTML=generateVectorVisualFallback('${item.category}', '${item.series}', '${item.finish || ""}', ${item.modules || 1});" />`;
  }
  return generateVectorVisualFallback(
    item.category,
    item.series,
    item.finish,
    item.modules,
  );
}

function generateVectorVisualFallback(
  category,
  series,
  finish = "",
  modules = 1,
) {
  const isGrey = (finish || "").toLowerCase().includes("grey");
  const isBliss = series === "bliss";
  const plateBg = isGrey ? "#475569" : "#f8fafc";
  const borderCol = isGrey ? "#334155" : isBliss ? "#cbd5e1" : "#e2e8f0";
  const rockerBg = isGrey ? "#334155" : "#ffffff";
  const strokeLine = isGrey ? "#64748b" : "#cbd5e1";

  if (category === "surfacebox") {
    return `<svg viewBox="0 0 160 120" class="w-full h-full object-contain"><rect x="25" y="15" width="110" height="90" rx="8" fill="#f1f5f9" stroke="#94a3b8" stroke-width="2.5" /><text x="80" y="65" font-size="10" font-family="monospace" font-weight="bold" fill="#475569" text-anchor="middle">${modules}M BOX</text></svg>`;
  }
  if (category === "plate") {
    return `<svg viewBox="0 0 160 120" class="w-full h-full object-contain"><rect x="20" y="20" width="120" height="80" rx="${isBliss ? "12" : "6"}" fill="${plateBg}" stroke="${borderCol}" stroke-width="2.5" /><text x="80" y="64" font-size="11" font-weight="bold" fill="#64748b" text-anchor="middle">${modules} MODULE</text></svg>`;
  }
  if (category === "mcb") {
    return `<svg viewBox="0 0 160 120" class="w-full h-full object-contain"><rect x="52" y="15" width="56" height="90" rx="5" fill="${plateBg}" stroke="${borderCol}" stroke-width="2" /><circle cx="80" cy="80" r="4" fill="#10b981" /><text x="80" y="100" font-size="8" font-family="monospace" font-weight="bold" fill="#64748b" text-anchor="middle">MCB SP</text></svg>`;
  }
  return `<svg viewBox="0 0 160 120" class="w-full h-full object-contain"><rect x="35" y="15" width="90" height="90" rx="${isBliss ? "12" : "6"}" fill="${plateBg}" stroke="${borderCol}" stroke-width="2" /><rect x="48" y="25" width="64" height="70" rx="${isBliss ? "6" : "3"}" fill="${rockerBg}" stroke="${strokeLine}" stroke-width="1.5" /><line x1="48" y1="60" x2="112" y2="60" stroke="${strokeLine}" stroke-width="1" /><text x="80" y="85" font-size="7" font-family="sans-serif" font-weight="bold" fill="#94a3b8" text-anchor="middle">${(series || "").toUpperCase()}</text></svg>`;
}

// =========================================================================
// 3. WHATSAPP SHARE ENGINE
// =========================================================================
function shareToWhatsApp(id, event) {
  if (event) event.stopPropagation();

  const item = catalog.find((i) => i.id === id);
  if (!item) return;

  const discountPct = calculateDiscount(item.mrp, item.offerPrice);

  let imageLink = "";
  if (item.image && item.image.trim() !== "") {
    imageLink = item.image.startsWith("http")
      ? item.image
      : `${window.location.origin}/${item.image.replace(/^\//, "")}`;
  }

  let message = `*LUCKY CEMENT AND ELECTRIC*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `*Product:* ${item.name}\n`;
  if (item.nameHi) message += `*विवरण:* ${item.nameHi}\n`;
  message += `*SKU Code:* ${item.sku}\n`;
  message += `*Series:* ${item.series.toUpperCase()} | Finish: ${item.finish || "Standard"}\n`;
  message += `*Module / Pack:* ${item.modules || 1}M | ${item.packing || "Standard Unit"}\n\n`;

  

  message += `*PRICING DETAILS:*\n`;
  message += `MRP: ₹${Number(item.mrp).toFixed(2)}\n`;
  message += `*Special Offer Price: ₹${Number(item.offerPrice).toFixed(2)}*\n`;
  message += `*Promotional Savings: ${discountPct}% OFF*\n`;

  message += `Lucky Cement & Electric • Havells Authorized Dealer`;

  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
  window.open(waUrl, "_blank");
}

// =========================================================================
// 4. CLOUD SYNC ENGINE
// =========================================================================
async function initCatalog() {
  if (
    FIREBASE_DB_URL &&
    !FIREBASE_DB_URL.includes("console.firebase.google.com")
  ) {
    try {
      const res = await fetch(`${FIREBASE_DB_URL}catalog.json`);
      const remoteData = await res.json();
      if (remoteData && Array.isArray(remoteData)) {
        catalog = remoteData;
        renderAll();
        return;
      }
    } catch (e) {
      console.warn("Cloud catalog unreachable, loading local catalog.json.", e);
    }
  }

  try {
    const res = await fetch("catalog.json");
    catalog = await res.json();
    if (
      FIREBASE_DB_URL &&
      !FIREBASE_DB_URL.includes("console.firebase.google.com")
    ) {
      await syncCatalogToCloud();
    }
  } catch (err) {
    catalog = [];
  }
  renderAll();
}

async function syncCatalogToCloud() {
  if (
    FIREBASE_DB_URL &&
    !FIREBASE_DB_URL.includes("console.firebase.google.com")
  ) {
    try {
      await fetch(`${FIREBASE_DB_URL}catalog.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(catalog),
      });
      showToast("Synced with all devices 🌐");
    } catch (e) {
      showToast("Failed to reach cloud database.");
    }
  }
  updateCounters();
}

// =========================================================================
// 5. DYNAMIC CATEGORY FILTERS
// =========================================================================
function renderCategoryFilters() {
  const container = document.getElementById("categoryContainer");
  const datalist = document.getElementById("categoryDatalist");
  if (!container) return;

  const activeSet =
    activeSeries === "all"
      ? catalog
      : catalog.filter((item) => item.series === activeSeries);

  const allCategories = Array.from(
    new Set(catalog.map((item) => item.category).filter(Boolean)),
  ).sort();

  if (activeCategory !== "all" && !allCategories.includes(activeCategory)) {
    activeCategory = "all";
  }

  let html = `
    <button onclick="setCategoryFilter('all')" data-cat="all" 
      class="cat-pill px-3 py-1.5 rounded-xl text-xs font-bold transition ${
        activeCategory === "all"
          ? "bg-brand-600 text-white shadow-xs"
          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
      }">
      All Categories 
      <span class="ml-1 px-1.5 py-0.2 rounded-full ${activeCategory === "all" ? "bg-white/20" : "bg-slate-200"} text-[10px]">
        ${activeSet.length}
      </span>
    </button>
  `;

  allCategories.forEach((cat) => {
    const count = activeSet.filter((item) => item.category === cat).length;
    const isSelected = activeCategory === cat;
    html += `
      <button onclick="setCategoryFilter('${cat}')" data-cat="${cat}" 
        class="cat-pill px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
          isSelected
            ? "bg-brand-600 text-white shadow-xs"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
        }">
        ${formatCategoryLabel(cat)} 
        <span class="ml-1 px-1.5 py-0.2 rounded-full ${isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"} text-[10px]">
          ${count}
        </span>
      </button>
    `;
  });

  container.innerHTML = html;

  if (datalist) {
    datalist.innerHTML = allCategories
      .map(
        (cat) => `<option value="${cat}">${formatCategoryLabel(cat)}</option>`,
      )
      .join("");
  }
}

// =========================================================================
// 6. RENDERING & USER ACTIONS
// =========================================================================
function formatCurrency(val) {
  return "₹ " + Number(val).toFixed(2);
}

function calculateDiscount(mrp, offerPrice) {
  if (!mrp || mrp <= 0) return 0;
  return Math.round(((mrp - offerPrice) / mrp) * 100);
}

function showToast(msg, allowUndo = false) {
  const toast = document.getElementById("undoToast");
  const msgEl = document.getElementById("toastMessage");
  const undoBtn = document.getElementById("toastUndoBtn");
  msgEl.innerText = msg;
  undoBtn.classList.toggle("hidden", !allowUndo);
  toast.classList.remove("hidden");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.add("hidden"), 4500);
}

function getFilteredList() {
  return catalog
    .filter((item) => {
      const matchesSeries =
        activeSeries === "all" || item.series === activeSeries;
      const matchesCat =
        activeCategory === "all" || item.category === activeCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (item.sku && item.sku.toLowerCase().includes(q)) ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.nameHi && item.nameHi.toLowerCase().includes(q));

      return matchesSeries && matchesCat && matchesSearch;
    })
    .sort((a, b) => {
      if (activeSort === "price-asc") return a.offerPrice - b.offerPrice;
      if (activeSort === "price-desc") return b.offerPrice - a.offerPrice;
      if (activeSort === "discount-desc")
        return (b.mrp - b.offerPrice) / b.mrp - (a.mrp - a.offerPrice) / a.mrp;
      if (activeSort === "sku-asc")
        return (a.sku || "").localeCompare(b.sku || "");
      return 0;
    });
}

function renderGrid(items) {
  const container = document.getElementById("gridContainer");
  container.innerHTML = items
    .map((item) => {
      const discountPct = calculateDiscount(item.mrp, item.offerPrice);
      const seriesBadge =
        item.series === "bliss"
          ? '<span class="bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-md">Reo Bliss</span>'
          : item.series === "marvel"
            ? '<span class="bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-bold px-2 py-0.5 rounded-md">Reo Marvel</span>'
            : '<span class="bg-rose-100 text-rose-800 border border-rose-200 text-[10px] font-bold px-2 py-0.5 rounded-md">Crabtree Adiva</span>';

      return `
      <div onclick="openProductModal('${item.id}')" class="bg-white rounded-2xl border border-slate-200 p-4 card-hover flex flex-col justify-between group relative shadow-xs cursor-pointer">
        <button onclick="handleDeleteProduct('${item.id}', event)" title="Remove SKU" class="absolute top-2.5 right-2.5 text-slate-300 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition p-1 rounded-md no-print z-10">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
        </button>

        <div>
          <div class="flex items-center justify-between gap-1 mb-2">
            ${seriesBadge}
            <span class="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">${item.sku}</span>
          </div>

          <div class="bg-slate-50 rounded-xl p-2 mb-3 border border-slate-100 flex items-center justify-center h-28 overflow-hidden">
            ${generateVisual(item)}
          </div>

          <h4 class="font-bold text-xs text-slate-900 leading-snug line-clamp-2">${item.name}</h4>
          <p class="text-xs font-hindi text-brand-700 mt-0.5 font-bold leading-tight line-clamp-1">${item.nameHi || ""}</p>
        </div>

        <div class="mt-4 pt-3 border-t border-slate-100">
          <div class="flex items-baseline justify-between">
            <span class="text-xs font-bold text-rose-500 line-through">${formatCurrency(item.listPrice)}</span>
            <span class="text-xs font-bold text-slate-700 font-mono">${formatCurrency(item.mrp)}</span>
          </div>
          <div class="flex items-center justify-between mt-2 pt-2 border-t border-dashed border-slate-200">
            <span class="text-base font-black text-brand-600 tracking-tight font-mono">${formatCurrency(item.offerPrice)}</span>
            <span class="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-black px-2 py-0.5 rounded-full">${discountPct}% OFF</span>
          </div>

          <!-- WhatsApp Share Tab -->
          <button onclick="shareToWhatsApp('${item.id}', event)" 
            class="mt-3 w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition">
            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.074-2.131-.527-1.745-.729-2.87-2.506-2.956-2.622-.086-.117-.714-.951-.714-1.815 0-.865.452-1.289.613-1.464.162-.175.352-.22.469-.22.117 0 .234.001.336.006.107.005.25.04.39.378.145.349.497 1.21.54 1.299.044.088.073.19.015.305-.058.117-.087.19-.174.292-.087.102-.183.228-.261.306-.088.087-.179.182-.077.357.102.175.455.751.977 1.216.671.597 1.236.782 1.411.87.175.088.277.073.38-.044.102-.117.438-.51.555-.685.117-.175.234-.146.394-.088.161.058 1.021.481 1.196.569.175.087.292.131.336.204.043.073.043.424-.101.829z"/>
            </svg>
            <span>Share on WhatsApp</span>
          </button>
        </div>
      </div>`;
    })
    .join("");
}

function renderTable(items) {
  const tbody = document.getElementById("tableBody");
  tbody.innerHTML = items
    .map((item, idx) => {
      const discountPct = calculateDiscount(item.mrp, item.offerPrice);
      return `
      <tr onclick="openProductModal('${item.id}')" class="hover:bg-amber-50/50 transition border-b border-slate-100 cursor-pointer">
        <td class="p-2.5 text-center text-slate-400 text-[11px] font-mono">${idx + 1}</td>
        <td class="p-1.5 text-center w-16">
          <div class="w-12 h-10 bg-slate-50 rounded border border-slate-200 p-0.5 mx-auto flex items-center justify-center overflow-hidden">
            ${generateVisual(item)}
          </div>
        </td>
        <td class="p-2.5">
          <div class="font-bold text-slate-900 text-xs">${item.name}</div>
          <span class="font-mono text-[10px] text-slate-600 font-bold bg-slate-100 px-1.5 py-0.2 rounded">${item.sku}</span>
        </td>
        <td class="p-2.5 capitalize text-slate-800 text-xs font-bold">${item.series}</td>
        <td class="p-2.5 text-slate-600 text-[11px] font-mono">${item.packing || "—"}</td>
        <td class="p-2.5 text-right text-rose-500 font-bold line-through font-mono">${formatCurrency(item.listPrice)}</td>
        <td class="p-2.5 text-right text-slate-700 font-bold font-mono">${formatCurrency(item.mrp)}</td>
        <td class="p-2.5 text-right font-black text-brand-600 text-sm font-mono">${formatCurrency(item.offerPrice)}</td>
        <td class="p-2.5 text-center"><span class="bg-emerald-50 text-emerald-700 font-black px-2 py-0.5 rounded-full text-[10px] border border-emerald-200">${discountPct}%</span></td>
        <td class="p-2.5 text-center no-print" onclick="event.stopPropagation()">
          <div class="flex items-center justify-center gap-1">
            <button onclick="shareToWhatsApp('${item.id}', event)" title="Share on WhatsApp" class="text-emerald-600 hover:text-emerald-700 p-1">
              <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.694.074-2.131-.527-1.745-.729-2.87-2.506-2.956-2.622-.086-.117-.714-.951-.714-1.815 0-.865.452-1.289.613-1.464.162-.175.352-.22.469-.22.117 0 .234.001.336.006.107.005.25.04.39.378.145.349.497 1.21.54 1.299.044.088.073.19.015.305-.058.117-.087.19-.174.292-.087.102-.183.228-.261.306-.088.087-.179.182-.077.357.102.175.455.751.977 1.216.671.597 1.236.782 1.411.87.175.088.277.073.38-.044.102-.117.438-.51.555-.685.117-.175.234-.146.394-.088.161.058 1.021.481 1.196.569.175.087.292.131.336.204.043.073.043.424-.101.829z"/></svg>
            </button>
            <button onclick="handleDeleteProduct('${item.id}', event)" title="Delete SKU" class="text-slate-300 hover:text-rose-600 p-1">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </td>
      </tr>`;
    })
    .join("");
}

function getDrawerFilteredList() {
  return catalog.filter((item) => {
    const matchesSeries =
      drawerSeries === "all" || item.series === drawerSeries;
    const q = drawerSearchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      (item.sku && item.sku.toLowerCase().includes(q)) ||
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.nameHi && item.nameHi.toLowerCase().includes(q));

    return matchesSeries && matchesSearch;
  });
}

function renderDrawer() {
  const tbody = document.getElementById("drawerTableBody");
  const items = getDrawerFilteredList();

  document.getElementById("dcount-all").innerText = catalog.length;
  document.getElementById("dcount-adiva").innerText = catalog.filter(
    (i) => i.series === "adiva",
  ).length;
  document.getElementById("dcount-marvel").innerText = catalog.filter(
    (i) => i.series === "marvel",
  ).length;
  document.getElementById("dcount-bliss").innerText = catalog.filter(
    (i) => i.series === "bliss",
  ).length;
  document.getElementById("drawerBadgeCount").innerText =
    `${items.length} of ${catalog.length} items`;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400">No products match your search.</td></tr>`;
    return;
  }

  tbody.innerHTML = items
    .map((item) => {
      const discountPct = calculateDiscount(item.mrp, item.offerPrice);
      return `
      <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
        <td class="p-2 text-center">
          <div class="w-8 h-8 bg-slate-100 rounded border border-slate-200 p-0.5 mx-auto flex items-center justify-center overflow-hidden">
            ${generateVisual(item)}
          </div>
        </td>
        <td class="p-2">
          <div class="font-bold text-slate-900 text-xs">${item.name}</div>
          <span class="font-mono font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded text-[10px]">${item.sku}</span>
        </td>
        <td class="p-1 text-right">
          <input type="number" step="0.5" value="${item.listPrice}" onchange="updateItemPrice('${item.id}', 'listPrice', this.value)" class="w-24 text-right bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs font-bold text-rose-600">
        </td>
        <td class="p-1 text-right">
          <input type="number" step="0.5" value="${item.mrp}" onchange="updateItemPrice('${item.id}', 'mrp', this.value)" class="w-24 text-right bg-white border border-slate-300 rounded px-2 py-1 font-mono text-xs font-bold text-slate-700">
        </td>
        <td class="p-1 text-right">
          <input type="number" step="0.5" value="${item.offerPrice}" onchange="updateItemPrice('${item.id}', 'offerPrice', this.value)" class="w-24 text-right bg-white border border-brand-300 rounded px-2 py-1 font-mono text-xs font-extrabold text-brand-600">
        </td>
        <td class="p-2 text-center font-mono font-bold text-emerald-600 text-[11px]">${discountPct}%</td>
        <td class="p-2 text-center">
          <button onclick="handleDeleteProduct('${item.id}', event)" class="text-slate-300 hover:text-rose-600 p-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </td>
      </tr>`;
    })
    .join("");
}

function renderAll() {
  const items = getFilteredList();
  document.getElementById("visibleCount").innerText = items.length;
  document.getElementById("topManagerCount").innerText = catalog.length;

  const empty = document.getElementById("emptyState");
  const grid = document.getElementById("gridContainer");
  const table = document.getElementById("tableContainer");

  if (items.length === 0) {
    empty.classList.remove("hidden");
    grid.classList.add("hidden");
    table.classList.add("hidden");
  } else {
    empty.classList.add("hidden");
    if (viewMode === "grid") {
      grid.classList.remove("hidden");
      table.classList.add("hidden");
      renderGrid(items);
    } else {
      grid.classList.add("hidden");
      table.classList.remove("hidden");
      renderTable(items);
    }
  }

  updateCounters();
  renderCategoryFilters();
}

function updateCounters() {
  document.getElementById("statTotalItems").innerText =
    `${catalog.length} SKUs`;
  document.getElementById("statAdivaCount").innerText =
    `${catalog.filter((i) => i.series === "adiva").length} SKUs`;
  document.getElementById("statMarvelCount").innerText =
    `${catalog.filter((i) => i.series === "marvel").length} SKUs`;
  document.getElementById("statBlissCount").innerText =
    `${catalog.filter((i) => i.series === "bliss").length} SKUs`;

  document.getElementById("count-all").innerText = catalog.length;
  document.getElementById("count-adiva").innerText = catalog.filter(
    (i) => i.series === "adiva",
  ).length;
  document.getElementById("count-marvel").innerText = catalog.filter(
    (i) => i.series === "marvel",
  ).length;
  document.getElementById("count-bliss").innerText = catalog.filter(
    (i) => i.series === "bliss",
  ).length;
}

function updateItemPrice(id, field, value) {
  const item = catalog.find((i) => i.id === id);
  if (item) {
    item[field] = parseFloat(value) || 0;
    syncCatalogToCloud();
    renderAll();
    renderDrawer();
  }
}

function handleDeleteProduct(id, e) {
  if (e) e.stopPropagation();
  const idx = catalog.findIndex((i) => i.id === id);
  if (idx !== -1) {
    lastDeleted = { item: catalog[idx], index: idx };
    catalog.splice(idx, 1);
    syncCatalogToCloud();
    renderAll();
    renderDrawer();
    showToast(`Deleted ${lastDeleted.item.sku}`, true);
  }
}

function undoLastDelete() {
  if (lastDeleted) {
    catalog.splice(lastDeleted.index, 0, lastDeleted.item);
    syncCatalogToCloud();
    renderAll();
    renderDrawer();
    lastDeleted = null;
    document.getElementById("undoToast").classList.add("hidden");
  }
}

function handleCreateProduct(e) {
  e.preventDefault();
  const series = document.getElementById("newSeries").value;
  const sku = document.getElementById("newSku").value.trim().toUpperCase();
  const name = document.getElementById("newName").value.trim();
  const nameHi = document.getElementById("newNameHi").value.trim();
  const category = document
    .getElementById("newCategory")
    .value.trim()
    .toLowerCase();
  const packing = document.getElementById("newPacking").value.trim();
  const image = document.getElementById("newImage").value.trim();
  const listPrice =
    parseFloat(document.getElementById("newListPrice").value) || 0;
  const mrp = parseFloat(document.getElementById("newMrp").value) || 0;
  const offerPrice = parseFloat(document.getElementById("newOffer").value) || 0;

  catalog.unshift({
    id: `custom-${Date.now()}`,
    series,
    sku,
    name,
    nameHi,
    category,
    finish: "Standard",
    modules: 1,
    packing,
    listPrice,
    mrp,
    offerPrice,
    image,
  });

  syncCatalogToCloud();
  closeAddModal();
  setSeriesFilter(series);
  renderAll();
  renderDrawer();
  showToast(`Added ${sku} to ${series}`);
}

function promptSetBaseline() {
  const modal = document.getElementById("setBaselineModal");
  const input = document.getElementById("baselinePasswordInput");
  input.value = "";
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  input.focus();
}

function closeSetBaselineModal() {
  const modal = document.getElementById("setBaselineModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

async function verifyAndSaveBaseline() {
  const pass = document.getElementById("baselinePasswordInput").value;
  if (pass === "952593") {
    closeSetBaselineModal();
    await syncCatalogToCloud();
    showMessageBox(
      "Baseline Saved",
      `Catalog synced across all devices!`,
      true,
    );
  } else {
    closeSetBaselineModal();
    showMessageBox("Access Denied", "Incorrect baseline password.", false);
  }
}

function openProductModal(id) {
  const item = catalog.find((i) => i.id === id);
  if (!item) return;
  activeModalItem = item;

  document.getElementById("modalSkuBadge").innerText = item.sku;
  document.getElementById("modalVisualContainer").innerHTML =
    generateVisual(item);
  document.getElementById("modalEnglishName").innerText = item.name;
  document.getElementById("modalHindiName").innerText = item.nameHi || "";
  document.getElementById("modalListPrice").innerText = formatCurrency(
    item.listPrice,
  );
  document.getElementById("modalMrpPrice").innerText = formatCurrency(item.mrp);
  document.getElementById("modalOfferPrice").innerText = formatCurrency(
    item.offerPrice,
  );
  document.getElementById("modalDiscountBadge").innerText =
    `${calculateDiscount(item.mrp, item.offerPrice)}% OFF MRP`;

  const modal = document.getElementById("productQuickModal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeProductModal() {
  document.getElementById("productQuickModal").classList.add("hidden");
  document.getElementById("productQuickModal").classList.remove("flex");
  activeModalItem = null;
}

function setSeriesFilter(series) {
  activeSeries = series;
  document.querySelectorAll(".series-tab").forEach((tab) => {
    const s = tab.getAttribute("data-series");
    tab.className =
      s === series
        ? "series-tab px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 bg-brand-600 text-white shadow-xs"
        : "series-tab px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition flex items-center gap-1.5";
  });
  renderAll();
}

function setCategoryFilter(cat) {
  activeCategory = cat;
  renderAll();
}

function handleSearch(val) {
  searchQuery = val;
  renderAll();
}

function handleSort(val) {
  activeSort = val;
  renderAll();
}

function setViewMode(mode) {
  viewMode = mode;
  document.getElementById("viewGridBtn").className =
    mode === "grid"
      ? "px-3 py-1.5 rounded-lg text-slate-900 bg-white shadow-xs font-bold text-xs flex items-center gap-1.5 transition"
      : "px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 font-bold text-xs flex items-center gap-1.5 transition";

  document.getElementById("viewTableBtn").className =
    mode === "table"
      ? "px-3 py-1.5 rounded-lg text-slate-900 bg-white shadow-xs font-bold text-xs flex items-center gap-1.5 transition"
      : "px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 font-bold text-xs flex items-center gap-1.5 transition";
  renderAll();
}

function toggleManageDrawer() {
  document.getElementById("manageDrawer").classList.toggle("translate-x-full");
}

function setDrawerSeriesFilter(series) {
  drawerSeries = series;
  renderDrawer();
}

function handleDrawerSearch(val) {
  drawerSearchQuery = val;
  renderDrawer();
}

function openAddModal() {
  document.getElementById("addProductForm").reset();
  document.getElementById("addModal").classList.remove("hidden");
  document.getElementById("addModal").classList.add("flex");
}

function closeAddModal() {
  document.getElementById("addModal").classList.add("hidden");
  document.getElementById("addModal").classList.remove("flex");
}

function showMessageBox(title, msg, success = true) {
  document.getElementById("messageBoxTitle").innerText = title;
  document.getElementById("messageBoxText").innerText = msg;
  document.getElementById("messageBoxModal").classList.remove("hidden");
  document.getElementById("messageBoxModal").classList.add("flex");
}

function closeMessageBox() {
  document.getElementById("messageBoxModal").classList.add("hidden");
  document.getElementById("messageBoxModal").classList.remove("flex");
}

window.addEventListener("DOMContentLoaded", () => {
  initCatalog();
  const pDate = document.getElementById("printDate");
  if (pDate) {
    pDate.innerText = new Date().toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
});
