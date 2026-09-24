import { searchRecords, turkishInterpretation } from "./search-core.js";

const ui = {
  authShell: document.querySelector("#auth-shell"),
  appShell: document.querySelector("#app-shell"),
  loginForm: document.querySelector("#login-form"),
  username: document.querySelector("#username-input"),
  password: document.querySelector("#password-input"),
  loginStatus: document.querySelector("#login-status"),
  logout: document.querySelector("#logout-button"),
  form: document.querySelector("#search-form"),
  brand: document.querySelector("#brand-select"),
  model: document.querySelector("#model-select"),
  query: document.querySelector("#error-input"),
  clear: document.querySelector("#clear-query"),
  search: document.querySelector("#search-button"),
  status: document.querySelector("#status"),
  catalogSummary: document.querySelector("#catalog-summary"),
  dataVersion: document.querySelector("#data-version"),
  welcome: document.querySelector("#welcome"),
  workspace: document.querySelector("#results-section"),
  results: document.querySelector("#results-list"),
  count: document.querySelector("#result-count"),
  detailEmpty: document.querySelector("#detail-empty"),
  detail: document.querySelector("#detail-content"),
  detailTitle: document.querySelector("#detail-title"),
  sourcePath: document.querySelector("#source-path"),
  sourceText: document.querySelector("#source-text"),
  comment: document.querySelector("#turkish-comment"),
  copy: document.querySelector("#copy-button"),
};

let catalog;
let currentResults = [];
let selectedIndex = -1;
let appInitialized = false;
const shardCache = new Map();
const AUTH_STORAGE_KEY = "servis-bilgi-katalogu-authenticated";
const VALID_USERNAME = "admin";
const VALID_PASSWORD = "43214321";

function setStatus(message, type = "ready") {
  ui.status.className = `status ${type}`;
  ui.status.lastElementChild.textContent = message;
}

function setLoginStatus(message, type = "ready") {
  ui.loginStatus.className = `auth-status ${type}`;
  ui.loginStatus.lastElementChild.textContent = message;
}

function formatNumber(value) {
  return new Intl.NumberFormat("tr-TR").format(value);
}

function selectedBrand() {
  return catalog?.brands.find((brand) => brand.name === ui.brand.value);
}

function refreshSearchState() {
  ui.clear.hidden = !ui.query.value;
  ui.search.disabled = !(catalog && ui.brand.value && ui.model.value && ui.query.value.trim());
}

function isAuthenticated() {
  return sessionStorage.getItem(AUTH_STORAGE_KEY) === "true";
}

function setAuthenticated(value) {
  if (value) {
    sessionStorage.setItem(AUTH_STORAGE_KEY, "true");
    return;
  }
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

function updateAuthView(authenticated) {
  ui.authShell.hidden = authenticated;
  ui.appShell.hidden = !authenticated;
}

function initializeApp() {
  if (appInitialized) return;
  appInitialized = true;
  loadCatalog();
}

async function loadCatalog() {
  try {
    const response = await fetch("./data/catalog.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    catalog = await response.json();
    for (const brand of catalog.brands) ui.brand.add(new Option(brand.name, brand.name));
    ui.brand.disabled = false;
    ui.catalogSummary.textContent = `${formatNumber(catalog.sourceDocuments)} belge • ${formatNumber(catalog.totalChunks)} aranabilir bölüm`;
    ui.dataVersion.textContent = `Veri: ${new Date(catalog.generatedAt).toLocaleDateString("tr-TR")}`;
    setStatus("Hazır. Önce marka, ardından cihaz modelini seçin.");
  } catch (error) {
    setStatus(`Katalog yüklenemedi: ${error.message}`, "error");
  }
}

ui.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const username = ui.username.value.trim();
  const password = ui.password.value;

  if (username !== VALID_USERNAME || password !== VALID_PASSWORD) {
    ui.password.value = "";
    ui.password.focus();
    setLoginStatus("Kullanıcı adı veya şifre hatalı.", "error");
    return;
  }

  setAuthenticated(true);
  updateAuthView(true);
  setLoginStatus("Giriş başarılı.", "ready");
  initializeApp();
});

ui.brand.addEventListener("change", () => {
  ui.model.replaceChildren();
  const brand = selectedBrand();
  if (!brand) {
    ui.model.add(new Option("Önce marka seçin", ""));
    ui.model.disabled = true;
    refreshSearchState();
    return;
  }
  ui.model.add(new Option("Tüm modeller", "__all__"));
  for (const model of brand.models) ui.model.add(new Option(model.name, model.name));
  ui.model.disabled = false;
  ui.model.value = brand.models.length ? "" : "__all__";
  if (brand.models.length) {
    ui.model.insertBefore(new Option("Model seçin", ""), ui.model.firstChild);
    ui.model.value = "";
  }
  setStatus(`${brand.name}: ${formatNumber(brand.models.length)} model, ${formatNumber(brand.chunks)} belge bölümü.`);
  refreshSearchState();
});

ui.model.addEventListener("change", refreshSearchState);
ui.query.addEventListener("input", refreshSearchState);
ui.clear.addEventListener("click", () => {
  ui.query.value = "";
  ui.query.focus();
  refreshSearchState();
});

async function fetchShard(file) {
  if (shardCache.has(file)) return shardCache.get(file);
  const promise = fetch(`./data/${file}`).then((response) => {
    if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
    return response.json();
  });
  shardCache.set(file, promise);
  return promise;
}

async function loadShards(files, concurrency = 4) {
  const output = new Array(files.length);
  let cursor = 0;
  async function worker() {
    while (cursor < files.length) {
      const index = cursor++;
      output[index] = await fetchShard(files[index]);
      setStatus(`Belge verileri yükleniyor: ${index + 1}/${files.length}`, "loading");
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, files.length) }, worker));
  return output.flat();
}

function filesForSelection(brand, modelName) {
  if (modelName === "__all__") return brand.shards.map((shard) => shard.file);
  return brand.models.find((model) => model.name === modelName)?.files || brand.shards.map((shard) => shard.file);
}

function baseName(filePath) {
  return filePath.split(/[\\/]/).pop();
}

function renderResults() {
  ui.results.replaceChildren();
  ui.count.textContent = currentResults.length;
  currentResults.forEach((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "result-card";
    button.dataset.index = index;

    const rank = document.createElement("span");
    rank.className = "result-rank";
    rank.textContent = index + 1;

    const content = document.createElement("span");
    const name = document.createElement("span");
    name.className = "result-name";
    name.textContent = baseName(item.record.p);
    const meta = document.createElement("span");
    meta.className = "result-meta";
    meta.textContent = `Uygunluk puanı: ${item.score}`;
    const preview = document.createElement("span");
    preview.className = "result-preview";
    preview.textContent = item.excerpt;
    content.append(name, meta, preview);
    button.append(rank, content);
    button.addEventListener("click", () => showDetail(index));
    ui.results.append(button);
  });
}

function addCommentBlock(title, content) {
  const block = document.createElement("div");
  block.className = "comment-block";
  const heading = document.createElement("h4");
  heading.textContent = title;
  block.append(heading);
  if (Array.isArray(content)) {
    const list = document.createElement("ul");
    for (const text of content) {
      const item = document.createElement("li");
      item.textContent = text;
      list.append(item);
    }
    block.append(list);
  } else {
    const paragraph = document.createElement("p");
    paragraph.textContent = content;
    block.append(paragraph);
  }
  ui.comment.append(block);
}

function showDetail(index) {
  selectedIndex = index;
  const item = currentResults[index];
  document.querySelectorAll(".result-card").forEach((card, cardIndex) => card.classList.toggle("active", cardIndex === index));
  ui.detailEmpty.hidden = true;
  ui.detail.hidden = false;
  ui.detailTitle.textContent = baseName(item.record.p);
  ui.sourcePath.textContent = `KAYNAK: ${item.record.p}`;
  ui.sourceText.textContent = item.excerpt;
  ui.comment.replaceChildren();
  const interpretation = turkishInterpretation(item.record, ui.query.value);
  addCommentBlock(interpretation.title, interpretation.meaning);
  addCommentBlock("Güvenli ilk kontroller", interpretation.checks);
  addCommentBlock("Ne zaman servis çağrılmalı?", interpretation.service);
}

ui.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const brand = selectedBrand();
  const query = ui.query.value.trim();
  if (!brand || !ui.model.value || !query) return;
  ui.search.disabled = true;
  setStatus("İlgili belge verileri yükleniyor…", "loading");
  try {
    const files = filesForSelection(brand, ui.model.value);
    const records = await loadShards(files);
    setStatus(`${formatNumber(records.length)} bölümde eşleşme aranıyor…`, "loading");
    await new Promise((resolve) => requestAnimationFrame(resolve));
    currentResults = searchRecords(records, { query, model: ui.model.value, limit: 10 });
    selectedIndex = -1;
    renderResults();
    ui.welcome.hidden = true;
    ui.workspace.hidden = false;
    if (currentResults.length) {
      showDetail(0);
      setStatus(`${currentResults.length} ilgili kaynak bulundu. En güçlü eşleşme açıldı.`);
    } else {
      ui.detail.hidden = true;
      ui.detailEmpty.hidden = false;
      ui.detailEmpty.querySelector("h2").textContent = "Eşleşme bulunamadı";
      ui.detailEmpty.querySelector("p").textContent = "Hata kodunun yazımını kontrol edin veya arızayı birkaç kelimeyle tarif edin.";
      setStatus("Seçilen model ve hata için eşleşme bulunamadı.", "error");
    }
  } catch (error) {
    setStatus(`Arama tamamlanamadı: ${error.message}`, "error");
  } finally {
    refreshSearchState();
  }
});

ui.logout.addEventListener("click", () => {
  setAuthenticated(false);
  window.location.reload();
});

ui.copy.addEventListener("click", async () => {
  if (selectedIndex < 0) return;
  const item = currentResults[selectedIndex];
  try {
    await navigator.clipboard.writeText(`KAYNAK: ${item.record.p}\n\n${item.excerpt}`);
    ui.copy.textContent = "Kopyalandı";
    setTimeout(() => { ui.copy.textContent = "Metni kopyala"; }, 1400);
  } catch {
    setStatus("Metin panoya kopyalanamadı.", "error");
  }
});

updateAuthView(isAuthenticated());
if (isAuthenticated()) {
  initializeApp();
} else {
  setLoginStatus("Devam etmek için giriş yapın.");
}
