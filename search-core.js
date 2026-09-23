const STOP_WORDS = new Set([
  "ve", "veya", "ile", "icin", "bir", "bu", "su", "the", "and", "of", "to", "in",
  "is", "on", "da", "de", "mi", "mu", "olarak", "tum", "modeller",
]);

export function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ı/g, "i");
}

export function words(value) {
  return (normalize(value).match(/[a-z0-9çğıöşü-]{2,}/g) || []).filter((word) => !STOP_WORDS.has(word));
}

export function extractErrorCodes(value) {
  return String(value || "").match(/\b(?:err(?:or)?|e)\s*[-:]?\s*\d{1,4}[a-z]?\b/gi) || [];
}

export function canonicalCode(value) {
  return normalize(value).replace(/[\s:-]/g, "").replace(/^error/, "err");
}

export function recordContainsCode(record, codes) {
  if (!codes.length) return true;
  const found = extractErrorCodes(record.t).map(canonicalCode);
  const wanted = new Set(codes.map(canonicalCode));
  return found.some((code) => wanted.has(code));
}

export function focusedErrorExcerpt(text, query) {
  const wanted = new Set(extractErrorCodes(query).map(canonicalCode));
  if (!wanted.size) return String(text || "").trim();
  const codePattern = /\b(?:err(?:or)?|e)\s*[-:]?\s*\d{1,4}[a-z]?\b/gi;
  const matches = [...String(text || "").matchAll(codePattern)];
  const matchIndex = matches.findIndex((match) => wanted.has(canonicalCode(match[0])));
  if (matchIndex < 0) return String(text || "").trim();
  const current = matches[matchIndex];
  const next = matches.slice(matchIndex + 1).find((match) => !wanted.has(canonicalCode(match[0])));
  const start = Math.max(0, current.index - 100);
  const end = Math.min(text.length, next ? next.index : current.index + 950);
  return text.slice(start, end).replace(/^\S*\s/, "").trim();
}

function scoreRecord(tokens, record, selectedModel) {
  const pathText = normalize(record.p);
  const body = normalize(record.t);
  let score = 0;
  for (const token of tokens) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const bodyCount = Math.min((body.match(new RegExp(escaped, "g")) || []).length, 4);
    score += bodyCount;
    if (pathText.includes(token)) score += 5;
  }
  if (selectedModel && selectedModel !== "__all__" && pathText.includes(normalize(selectedModel))) score += 18;
  return score;
}

export function searchRecords(records, { query, model = "__all__", limit = 8 } = {}) {
  const tokens = words(`${model === "__all__" ? "" : model} ${query}`);
  const codes = extractErrorCodes(query);
  if (!tokens.length) return [];
  return records
    .filter((record) => recordContainsCode(record, codes))
    .map((record) => ({ score: scoreRecord(tokens, record, model), record }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, codes.length ? Math.min(limit, 5) : limit)
    .map((item) => ({ ...item, excerpt: focusedErrorExcerpt(item.record.t, query) }));
}

const TOPICS = [
  { words: ["co2", "carbon dioxide"], meaning: "CO₂ ölçümü veya gaz kontrol devresiyle ilgili bir anormallik bildiriliyor.", checks: ["CO₂ beslemesini, tüp basıncını ve bağlantıları görsel olarak kontrol edin.", "Sensör çevresinde yoğuşma, kir veya gevşek bağlantı olup olmadığını kontrol edin."] },
  { words: ["temperature", "temp", "heat", "heater", "sicaklik", "isitici"], meaning: "Sıcaklık ölçümü ya da ısıtma devresi beklenen aralıkta çalışmıyor olabilir.", checks: ["Kapının tam kapandığını ve hava dolaşımının engellenmediğini doğrulayın.", "Ortam sıcaklığı, ayar değeri ve cihazın dengeye gelme süresini kontrol edin."] },
  { words: ["sensor", "probe", "thermistor", "sensör"], meaning: "Bir sensörden beklenen sinyal alınamıyor veya ölçüm normal aralığın dışında.", checks: ["Cihazı enerjisiz bırakarak erişilebilir sensör kablolarında gevşeme veya hasar olup olmadığını gözle kontrol edin.", "Sensörü köprülemeyin; ölçüm ve parça testi için servis kılavuzundaki yöntemi kullanın."] },
  { words: ["fan", "blower", "motor"], meaning: "Fan, üfleyici veya motor devrinde/geri bildiriminde sorun algılanmış olabilir.", checks: ["Hava giriş ve çıkışlarının engellenmediğini kontrol edin.", "Olağandışı ses, sürtme veya fanın dönmesini engelleyen yabancı madde olup olmadığına bakın."] },
  { words: ["door", "lid", "kapi", "kapı"], meaning: "Kapı/kapak durumu veya kapı ısıtıcısı beklenen koşulu sağlamıyor olabilir.", checks: ["Kapının tam kapandığını, contanın temiz ve hasarsız olduğunu kontrol edin.", "Kapı anahtarını ya da emniyet mekanizmasını devre dışı bırakmayın."] },
  { words: ["compressor", "refriger", "cooling", "sogut"], meaning: "Soğutma devresi veya kompresörle ilişkili bir çalışma sorunu bildiriliyor.", checks: ["Havalandırma boşluklarını ve kondenserin görünür temizliğini kontrol edin.", "Soğutucu akışkan devresini açmayın; basınç ve kaçak işlemlerini yetkili servise bırakın."] },
  { words: ["pressure", "basinc", "gas", "valve"], meaning: "Basınç, gaz beslemesi veya valf kontrolüyle ilişkili bir uyarı olabilir.", checks: ["Harici gaz kaynağı basıncını ve erişilebilir bağlantıları üretici sınırlarına göre kontrol edin.", "Basınç emniyetlerini ve valfleri kesinlikle köprülemeyin."] },
  { words: ["power", "voltage", "fuse", "electrical", "pcb"], meaning: "Elektrik beslemesi veya elektronik kontrol devresinde anormallik algılanmış olabilir.", checks: ["Priz, güç kablosu ve tesisat beslemesini güvenli biçimde kontrol edin.", "Sigorta/PCB ölçümlerini yalnızca yetkin teknik personel yapmalıdır."] },
];

export function turkishInterpretation(record, query) {
  const source = normalize(`${record.t} ${query}`);
  const codes = extractErrorCodes(query);
  const matched = TOPICS.filter((topic) => topic.words.some((word) => source.includes(normalize(word))));
  const meaning = matched.length
    ? matched.slice(0, 2).map((topic) => topic.meaning).join(" ")
    : "Kaynak metin, seçilen hata koduyla ilişkili bir çalışma anormalliği bildiriyor. Kesin tanı için aynı modelin servis kılavuzundaki hata tablosu esas alınmalıdır.";
  const checks = [...new Set(matched.flatMap((topic) => topic.checks))].slice(0, 4);
  if (!checks.length) {
    checks.push("Hata kodunu ve oluştuğu çalışma koşulunu kaydedin.", "Cihazı güvenli şekilde yeniden başlatın; hata tekrarlanırsa servis prosedürüne geçin.");
  }
  return {
    title: codes.length ? `${codes[0]} için muhtemel anlam` : "Muhtemel anlam",
    meaning,
    checks,
    service: "Uyarı yeniden oluşuyorsa, cihaz ayar değerini koruyamıyorsa, yanık kokusu/sızıntı/olağandışı ses varsa veya elektrik-gaz-soğutma devresine müdahale gerekiyorsa cihazı güvenli duruma alıp yetkili teknik servise başvurun.",
  };
}
