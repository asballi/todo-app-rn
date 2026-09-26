# Todo Uygulaması — Ürün ve Teknik Plan

Bu belge, "grill-me" oturumunda alınan kararları ve v1 uygulama planını içerir.

## Hedef

Web + mobilde çalışan, öğrenme amaçlı, kapsamlı bir todo uygulaması.
İlk sürümler tamamen yerel (offline) çalışır; senkronizasyon sonradan eklenebilecek şekilde tasarlanır.

## Kararlar

| # | Konu | Karar |
|---|------|-------|
| K1 | Platform | Web + mobil, öğrenme projesi |
| K2 | Senkronizasyon | Şimdilik yok; sonradan eklenebilecek şekilde tasarım (UUID, `updatedAt`, soft delete, repository katmanı) |
| K3 | Yol haritası | v1 temel + düzen → v2 alarm/tekrar/alt görev → v3 kullanım kolaylığı → v4 senkron |
| K4 | Kategori | Her görev tam olarak bir kategoride. "Gelen Kutusu" sistem kategorisi (silinemez, yeniden adlandırılabilir). Silinen kategorinin görevleri Gelen Kutusu'na taşınır. İç içe kategori yok. |
| K5 | Etiket | Görevde yazarak oluşturulur + ayrı yönetim ekranı. Ad büyük/küçük harfe duyarsız benzersiz. Renk isteğe bağlı (varsayılan gri). Silinince sadece bağlar kalkar. Çoklu etiket filtresi VE mantığıyla çalışır. `#etiket` sözdizimi v3'te. |
| K6 | Tarih | `dueDate` zorunlu değil; varsa gün zorunlu, saat isteğe bağlı. Yerel metin olarak saklanır (`"2026-09-25"`, `"15:00"`), UTC değil. |
| K7 | Öncelik | `0` yok, `1` düşük, `2` orta, `3` yüksek. Varsayılan `0`. Checkbox kenar rengiyle gösterilir. |
| K8 | Depolama | AsyncStorage, normalize koleksiyonlar, Zustand ile bellek içi state, şema sürümü + migration |
| K9 | Navigasyon | `expo-router`, alt sekmeler: Bugün · Yaklaşan · Listeler · Ara |
| K10 | Görev ekleme | Hızlı ekleme satırı (bağlama duyarlı varsayılanlar) + "+" ile tam form. Detay ve yeni görev aynı form bileşenini kullanır. Satır içi düzenleme kaldırılır. |
| K11 | Tamamlananlar | Her listenin altında katlanabilir "Tamamlananlar (n)" bölümü, varsayılan kapalı |

## Kurallar

### Tarih ve akıllı listeler
- Saatsiz görev, o gün bittiğinde gecikmiş sayılır; saatli görev, o saat geçince.
- **Bugün:** bugünün görevleri; gecikmişler en üstte ayrı bölümde; tamamlananlar bölümünde yalnızca bugün tamamlanan ve bitişi bugün ya da daha önce olan görevler (Bugün listesine ait olanlar).
- **Yaklaşan:** yarından başlayarak 7 gün, güne göre gruplu; boş günler de listelenir ve her günün "+" butonu o güne görev ekler. Bugünün görevleri yalnızca Bugün'de görünür.
- Ekranlar "şimdi"yi dakikada bir günceller (`useNow`): saatli görev ekran açıkken gecikmişe geçer, gece yarısı gün değişir.
- **Gecikmiş:** Listeler sekmesinden erişilen akıllı liste.
- Tarihsiz görevler akıllı listelerde görünmez, yalnızca kendi kategorisinde görünür.
- Tamamlanan görev gecikmiş sayılmaz.
- `new Date("YYYY-MM-DD")` kullanılmaz (UTC gece yarısı olarak yorumlanır). Tarih yardımcıları tek bir modülde toplanır.

### Varsayılan sıralama
1. Tamamlanmamışlar önce
2. Bitiş tarihi + saati (artan; tarihsizler sona)
3. Öncelik (yüksekten düşüğe)
4. Oluşturulma zamanı (artan)

### Hızlı ekleme varsayılanları
| Ekran | Varsayılan |
|-------|-----------|
| Bugün | `dueDate` = bugün |
| Yaklaşan | `dueDate` = ilgili gün grubu |
| Kategori | `categoryId` = o kategori |
| Etiket | o etiket eklenir |
| Diğer | Gelen Kutusu |

### Arama
- Başlık ve notlarda arar; büyük/küçük harf ve Türkçe karakter farkı yok sayılır (`sut` → "Süt", `ISIK` → "ışık").
- Sorgudaki her kelime geçmelidir; sıra önemsizdir.
- Filtreler: kategori tek seçim (tekrar basınca kalkar), etiketler **VE**, öncelikler **VEYA**.
- Sorgu ya da filtre yokken sonuç gösterilmez; tamamlanan sonuçlar katlanabilir bölümdedir.
- Silinen bir kategori/etiket filtrede seçiliyse filtre kendiliğinden düşer.

### Tamamlama ve silme
- Tamamlanınca `completedAt` yazılır; işaret kaldırılınca `null` olur.
- Silme her zaman soft delete (`deletedAt`). "Tamamlananları sil" butonu tamamlananlar bölümünün içindedir.
- (v2) Tekrarlayan görev tamamlanınca bir sonraki tekrar yeni görev olarak oluşur.

## Veri modeli

Tüm kayıtlarda: `id` (UUID v4, `expo-crypto` `getRandomBytes` ile), `createdAt`, `updatedAt`, `deletedAt` (ISO zaman damgası veya `null`).

> `crypto.randomUUID` web'de yalnızca güvenli bağlamda (https/localhost) çalıştığı için kullanılmaz.
> Gelen Kutusu sabit `id: "inbox"` kullanır; senkronizasyonda her cihazda aynı kayıt olur.

```ts
Task {
  title: string
  notes: string
  categoryId: string          // zorunlu, varsayılan Gelen Kutusu
  dueDate: string | null      // "YYYY-MM-DD", yerel
  dueTime: string | null      // "HH:mm"; yalnızca dueDate varsa
  priority: 0 | 1 | 2 | 3
  completedAt: string | null
}

Category {
  name: string
  color: string
  icon: string                // Feather ikon adı
  isSystem: boolean           // Gelen Kutusu için true
  sortOrder: number
}

Tag {
  name: string
  nameKey: string             // tagKey(name), benzersizlik için
  color: string | null
}

TaskTag {
  taskId: string
  tagId: string
}
```

> `tagKey` Türkçe kuralını elle uygular (`I → ı`, `İ → i`, sonra `toLowerCase()`). Düz `toLowerCase()` Türkçe "İ/I" harflerinde hatalı sonuç verir; `toLocaleLowerCase('tr-TR')` ise her JS motorunda desteklenmez.

### AsyncStorage anahtarları
```
@todo/schemaVersion   → 2
@todo/tasks           → Task[]
@todo/categories      → Category[]
@todo/tags            → Tag[]
@todo/taskTags        → TaskTag[]
```

### Migration (v1 → v2)
- Eski `@todos` anahtarındaki `{ id, text, done }` kayıtları `Task` formatına çevrilir:
  `title = text`, `completedAt = done ? şimdi : null`, `categoryId = Gelen Kutusu`, yeni UUID.
- Gelen Kutusu kategorisi oluşturulur.
- Eski anahtar yalnızca yeni veriler başarıyla yazıldıktan sonra silinir.

## Klasör yapısı

```
app/
  _layout.jsx
  (tabs)/
    _layout.jsx
    today.jsx
    upcoming.jsx
    lists/
      index.jsx              → Kategoriler + Etiketler + Gecikmiş
      category/[id].jsx
      tag/[id].jsx
      overdue.jsx            → Gecikmiş akıllı listesi
    search.jsx
  task/[id].jsx              → detay/düzenleme (modal)
  task/new.jsx               → yeni görev (modal)
  category-form.jsx          → yeni/düzenle kategori (modal, ?id=...)
  manage-tags.jsx
  tag-form.jsx               → yeni/düzenle etiket (modal, ?id=...)
src/
  data/
    storage.js               → AsyncStorage okuma/yazma
    migrations.js
    repositories.js          → tasks/categories/tags/taskTags: list() + upsertMany()
  store/                     → Zustand store + hooks (useTagsByTask)
  domain/
    ids.js                   → newId, INBOX_ID
    models.js                → kayıt oluşturma/güncelleme + doğrulama
    tags.js                  → tagKey
    text.js                  → turkishLower, foldForSearch
    dates.js                 → gecikmiş/bugün/yaklaşan hesapları
    sorting.js
    filters.js               → kategori filtreleri; akıllı listeler 6. ve 7. adımda
  components/
    TaskItem.jsx
    TaskForm.jsx
    QuickAdd.jsx
    CompletedSection.jsx
    TaskRows.jsx             → görev satırları (detay + tamamla bağlı)
    SectionTitle.jsx
    EmptyState.jsx
    TagPicker.jsx
    CategoryPicker.jsx
    PriorityPicker.jsx
    Chip.jsx                 → seçim çipi (radio) / eylem çipi (button)
    DateInput.jsx            → mobil: @react-native-community/datetimepicker
    DateInput.web.jsx        → web: <input type="date|time">
    ColorPicker.jsx          → allowNone ile "renksiz" seçeneği
    ListRow.jsx              → Listeler / etiket yönetimi satırları
    IconPicker.jsx
    confirm.js               → web'de window.confirm, mobilde Alert
    navigation.js            → goBack: geçmiş yoksa yedek adrese git
```

Ekranlar depolamaya doğrudan erişmez; yalnızca store ve repository üzerinden erişir.

## v1 uygulama adımları

Her adım ayrı, çalışır durumda bir commit/PR olmalı.

1. ✅ **Altyapı:** `expo-router` kurulumu, giriş noktasının `expo-router/entry` olması, sekme iskeleti, `App.js`'in kaldırılması. `devDependencies` içindeki çakışan `babel-preset-expo ~12.0.0` düzeltmesi.
   (Geçici eski liste 6. adımda kaldırıldı.)
2. ✅ **Veri katmanı:** storage, repository'ler, Zustand store, migration. Saf mantık için birim testleri (`jest-expo`): tarih kuralları, sıralama, migration.
   Testler `America/New_York` saat diliminde koşar (UTC gerisinde + yaz saati), böylece tarihlerin UTC olarak yorumlanması yakalanır. Çalıştırmak için: `npm test`.
3. ✅ **Kategoriler:** Gelen Kutusu, oluşturma/düzenleme/silme, Listeler ekranı, kategori ekranı.
   `TaskItem` (öncelik renkli checkbox, tarih etiketi) ve `QuickAdd` bu adımda eklendi; 4. adımda görev detayına bağlanacak.
4. ✅ **Görevler:** `TaskForm`, detay ve yeni görev modalları, `QuickAdd`, öncelik ve tarih seçimi.
   `QuickAdd` ayrıntı butonu, yazılan başlık ve ekranın varsayılanlarıyla tam formu açar. Bugün sekmesindeki geçici listede satır içi düzenleme kaldırıldı (K10).
5. ✅ **Etiketler:** `TagPicker` (yazarak oluşturma), etiket yönetimi ekranı, etiket ekranı.
   Görev satırlarında etiketler `#ad` olarak görünür. `updateTask` `tagIds` ile görev ve bağları tek işlemde kaydeder. `/task/new` `tagIds` parametresini (virgülle ayrılmış) kabul eder.
6. ✅ **Akıllı listeler:** Bugün, Yaklaşan, Gecikmiş; varsayılan sıralama; `CompletedSection`.
   Kategori ve etiket ekranları da açık görevler + katlanabilir Tamamlananlar bölümü gösterir. Listeler yığınında `initialRouteName: 'index'`: doğrudan URL ile açılan sayfanın altında Listeler ekranı olur.
7. ✅ **Arama:** başlık/not araması + kategori, etiket (VE) ve öncelik filtreleri.

**v1 tamamlandı.**

## v2 — Hatırlatıcılar, tekrarlayan görevler, kontrol listesi

### Kararlar

| # | Konu | Karar |
|---|------|-------|
| V1 | Hatırlatıcı modeli | Görev başına en fazla 3 hatırlatıcı, bitiş anına göre: Zamanında · 10 dk · 30 dk · 1 saat · 1 gün önce |
| V2 | Platformlar | Mobil: `expo-notifications` yerel bildirim. Web: tarayıcı Notification API + uygulama içi şerit; sekme kapalıyken bildirim yok |
| V3 | Tekrar | Hazır seçenekler + "her N gün/hafta/ay/yıl", haftalıkta gün seçimi, bitiş ya da tamamlanma tarihinden sayma |
| V4 | Alt görevler | Basit kontrol listesi (metin + işaret). Tam alt görevler tüm sürümlerden sonra değerlendirilecek |
| V5 | Dil | Şimdilik yalnızca Türkçe; v2'den sonra tüm metinler tek bir dil dosyasına taşınacak (çok dile hazırlık) |

### Kurallar

**Hatırlatıcılar**
- Bitiş tarihi olmayan görevde hatırlatıcı olmaz; tarih kaldırılınca hatırlatıcılar da kalkar.
- Referans an: saatli görevde bitiş saati, saatsiz görevde varsayılan hatırlatma saati (09:00, Ayarlar'dan değiştirilebilir).
- Görev tamamlanır, silinir ya da hatırlatma anı geçmişteyse bildirim kurulmaz / iptal edilir.
- Bildirim izni ilk hatırlatıcı eklenirken istenir; reddedilirse görev yine kaydedilir, formda "Bildirim izni kapalı" uyarısı görünür.
- Uygulama kapalıyken kaçırılan hatırlatıcılar açılışta tekrar gösterilmez.
- Bildirim: başlık = görev adı, gövde = zaman etiketi ("Bugün 15:00"); dokununca görev detayı açılır.

**Tekrarlayan görevler**
- Tekrar için bitiş tarihi gerekir; tarih kaldırılınca tekrar da kalkar.
- Tamamlanınca görev tamamlanmış kalır, sonraki tekrar yeni görev olarak oluşur (başlık, not, kategori, etiketler, öncelik, saat, hatırlatıcılar, tekrar kuralı ve işaretsiz kontrol listesi kopyalanır).
- `from: 'due'` (varsayılan): bitiş tarihinden ileri sayılır, bugünü geçene kadar atlanır (gecikmiş görevde geçmiş kopyalar birikmez). `from: 'completion'`: tamamlandığı günden sayılır.
- Ay sonu: 31 Ocak'ta başlayan aylık görev Şubat'ta 28'ine, Mart'ta 31'ine düşer (serinin ilk günü korunur).
- Tamamlanan tekrarlayan görevin işareti kaldırılırsa ondan oluşan sonraki görev (henüz tamamlanmadıysa) silinir.
- Görev satırında tekrar simgesi görünür.

**Kontrol listesi**
- Görev satırında ilerleme ("2/5"); detayda ekle (Enter), işaretle, düzenle, sil. Sıralama eklenme sırası (sürükle-bırak v3).
- Otomatik tamamlama yok: tüm maddeler işaretlenince görev tamamlanmaz, görev tamamlanınca maddeler işaretlenmez.
- Arama madde metinlerinde de arar.

### Veri modeli eklemeleri (şema sürümü 3)

```ts
Task {
  // ...v1 alanları
  reminders: number[]              // bitiş anından kaç dakika önce: [0, 60]; en fazla 3
  recurrence: null | {
    unit: 'day' | 'week' | 'month' | 'year'
    interval: number               // >= 1
    weekdays: number[] | null      // yalnızca 'week': 0 = Pazar … 6 = Cumartesi
    from: 'due' | 'completion'
    monthDay: number | null        // 'month'/'year': serinin ilk günü (ay sonu için)
  }
  nextTaskId: string | null        // tekrarla oluşturulan sonraki görev (geri alma için)
  checklist: { id: string, title: string, done: boolean }[]
}
```
- Migration v2 → v3: mevcut görevlere `reminders: []`, `recurrence: null`, `nextTaskId: null`, `checklist: []` eklenir.
- Ayarlar `@todo/settings` anahtarında: `{ defaultReminderTime: '09:00' }`.
- Kurulu bildirimler cihaza özeldir ve senkronize edilmez. Mobilde işletim sisteminin listesi kullanılır (her bildirimin `data.key` alanı plandaki anahtardır); web'de sekmedeki zamanlayıcılar tutulur. Ayrı bir depolama anahtarı gerekmez.

### v2 uygulama adımları

1. ✅ **Kontrol listesi:** şema v3 + migration, `ChecklistEditor`, satırda ilerleme, aramada madde metni. Yeni metinler `src/strings.js` içinde.
   Kontrol listesi formun geri kalanı gibi "Kaydet" ile kaydedilir; kaydetmeden çıkılırsa değişiklikler kaybolur (otomatik kaydetme v3'te değerlendirilebilir).
2. ✅ **Tekrarlayan görevler:** `nextDueDate` / `stepDate` (`src/domain/recurrence.js`, kapsamlı testler), tamamlama/geri alma kuralları, `RecurrencePicker`, satırda simge.
   Haftalık gün seçiminde hafta Pazartesi başlar; "N haftada bir" kuralında seçili günler bitince N hafta sonrasının ilk seçili gününe geçilir. Kullanıcı bitiş tarihini değiştirirse aylık/yıllık serinin günü yeni tarihten alınır.
3. ✅ **Hatırlatıcılar:** `ReminderPicker`, Ayarlar ekranı (varsayılan saat), bildirim zamanlayıcı (mobil `expo-notifications`, web Notification API + şerit), izin akışı, bildirime dokununca detay.
   - `src/domain/reminders.js`: `plannedNotifications` o an kurulu olması gereken bildirimleri hesaplar; anahtar görev, süre, an, başlık ve gövdeden oluşur, biri değişince bildirim yeniden kurulur.
   - `src/notifications/scheduler.js`: planı kurulu bildirimlerle eşitler (platformdan bağımsız, sahte adaptörle test edilir). Platform kodu `adapter.native.js` / `adapter.web.js` içinde; web paketi `expo-notifications` içermez.
   - Eşitleme: görev/ayar değişince (300 ms gecikmeyle), uygulama öne gelince ve saatte bir.
   - Web'de görünür sekmede uygulama içi şerit, arka plandaki sekmede (izin varsa) tarayıcı bildirimi. Şerit kendiliğinden kapanmaz. `setTimeout` sınırı nedeniyle ~24 günden uzak hatırlatıcılar sonraki saatlik eşitlemelerde kurulur.
   - Mobil bildirimler gerçek cihazda henüz denenmedi (yalnızca paketleme doğrulandı).
4. ✅ **Metinleri dil dosyasına taşıma** (V5): davranış değişikliği olmadan, yalnızca metin taşıyan commit.
   - Tüm arayüz metinleri, tarih/gün/ay adları, tekrar açıklamaları, hata mesajları ve varsayılan "Gelen Kutusu" adı `src/strings.js` içinde.
   - Kodda kalanlar: yorumlar, geliştirici günlükleri (`console.warn`) ve Türkçe'ye özgü arama kuralları (`src/domain/text.js`: I/İ dönüşümü, ç→c gibi katlama). Yeni bir dil eklenirken bu dosya da o dilin kurallarına göre ele alınmalı.
   - Yeni dil eklemek için: `strings` nesnesinin aynı yapıda bir kopyası hazırlanır ve cihaz diline göre seçilir.

**v2 tamamlandı.**

## v3 — Kullanım kolaylığı

### Kararlar

| # | Konu | Karar |
|---|------|-------|
| W1 | Kapsam ve sıra | A Geri alma → C Otomatik kaydetme → E Akıllı hızlı ekleme → F Dışa/içe aktarma → D Karanlık mod → B Kaydırma; ayrıca G (etiket filtresinde VEYA) ve H ("Önemli" listesi). İstatistikler, web kenar çubuğu ve kontrol listesi sürükle-bırak v4 sonrasına |
| W2 | Geri alma | Tek seviyeli, 5 sn'lik alt şerit; yalnızca son işlem |
| W3 | Otomatik kaydetme | Görev detayında tam otomatik; "Kaydet" butonu kalkar |
| W4 | Akıllı hızlı ekleme | İşaretler (`#`, `@`, `!`) + Türkçe tarih/saat ifadeleri |
| W5 | Dışa/içe aktarma | JSON; içe aktarma kayıt kimliğine göre birleştirir, en son güncellenen kazanır |
| W6 | Tema | Ayarlar'da Sistem (varsayılan) · Açık · Koyu |
| W7 | Kaydırma | Yalnızca mobilde (sağa: tamamla, sola: sil); web'de üzerine gelince sil butonu |

### Kurallar

**A — Geri alma**
- Kapsam: görev silme, tamamlananları toplu silme, tamamlama (tekrarın oluşturduğu sonraki görev dahil), kategori silme (görevler eski kategorisine döner), etiket silme (bağlar geri gelir), içe aktarma.
- Store her işlemde değiştirdiği kayıtların önceki hâlini saklar; "Geri al" bunları tek seferde geri yazar (yeni `updatedAt` ile).
- Yeni işlem önceki şeridi kapatır. Görev silme ve toplu silmede onay sorulmaz; kategori/etiket silmede onay kalır.
- Form alanı düzenlemeleri geri alınmaz.

**C — Otomatik kaydetme**
- Çip, tarih, saat, kontrol listesi işareti hemen; başlık/not/madde metni yazmayı bıraktıktan 0,5 sn sonra; ekrandan çıkarken bekleyen değişiklik hemen kaydedilir.
- Boş başlık kaydedilmez: alan altında uyarı, son geçerli başlık korunur.
- Başlıkta "Kaydedildi" göstergesi. Yeni görev formu "Oluştur" ile kalır.

**E — Akıllı hızlı ekleme**
- `#etiket` (yoksa oluşturulur), `@kategori` (yalnızca var olanla eşleşir; harf/aksan duyarsız), `!1`–`!3` / `!düşük` `!orta` `!yüksek`.
- Tarih: bugün, yarın, öbür gün, haftaya (+7), gün adları (bugünden sonraki ilk), "5 ekim" (geçmişse gelecek yıl). Saat: "15:00", "15.30", "saat 15"; tarihsiz saat → bugün.
- Tanınan ifadeler başlıktan çıkarılır; başlık boş kalırsa görev oluşturulmaz.
- Yazarken altta önizleme çipleri. Yazılan değerler ekran varsayılanlarının üzerine yazar. Yalnızca hızlı ekleme satırlarında.

**F — Dışa / içe aktarma**
- Dosya: `{ app, schemaVersion, exportedAt, data: { tasks, categories, tags, taskTags, settings } }`, silinmiş kayıtlar dahil.
- İçe aktarma: kimliğe göre birleştirme, `updatedAt` daha yeni olan kazanır. Önce özet + onay. Bozuk ya da daha yeni sürümden dosya → hiçbir şey değişmez. Eski sürüm dosyaları güncel biçime çevrilir. Geri alınabilir.
- Ayarlar → "Yedekleme". Web: indir / dosya seç. Mobil: `expo-file-system`, `expo-sharing`, `expo-document-picker`.

**D — Karanlık mod**
- `settings.theme`: `'system' | 'light' | 'dark'`. İki renk seti; ekranlar `useTheme()` ile renk alır.
- Kategori/etiket/öncelik renkleri iki temada aynı. Başlıklar, sekme çubuğu, durum çubuğu, tarih seçici ve şerit temaya uyar. Kontrast WCAG AA ile ölçülür.

**B — Kaydırma**
- `react-native-gesture-handler` + `react-native-reanimated` (SDK 54 sürümleri), yalnızca mobil dosyada; web paketine girmez.
- Satırın ~1/3'ü kadar kaydırınca işlem; arkada renkli alan ve simge. Tamamlanmış görev sağa kaydırılınca geri açılır.
- Ekran okuyucu için satırda "Tamamla" ve "Sil" eylemleri.

**G / H**
- G: aramada etiket filtresi için "Hepsi / Herhangi biri" seçimi (varsayılan Hepsi).
- H: "Önemli" akıllı listesi (yüksek öncelikli, tamamlanmamış), Listeler'de Gecikmiş'in altında.

### v3 uygulama adımları

1. ✅ **A:** geri alma — `commit(changes, undoLabel)` değişen kayıtların önceki hâlini `lastUndo` içinde saklar; `undo()` bunları yeni `updatedAt` ile geri yazar, o işlemde oluşan kayıtları siler. Sonraki bir düzenleme aynı kayda dokunursa geri alma iptal edilir. `UndoBar` sekme çubuğunun üstünde.
2. ✅ **C:** otomatik kaydetme — `TaskForm` `autoSave` modu: seçimler hemen, metinler 0,5 sn sonra, ekrandan çıkarken hemen; boş başlıkta son geçerli başlık. Tamamla/Sil butonları önce bekleyen kaydı yapar. Bilinen sınır: web'de sekme 0,5 sn içinde kapatılırsa son yazılan metin kaydedilmeyebilir.
3. ✅ **E:** akıllı hızlı ekleme — `src/domain/quickParse.js` (30 test); tanınan kelimeler `strings.quickParse` ve `strings.dates` içinde. Her türün yalnızca ilki kullanılır, sonrakiler başlıkta kalır. Ayrıntı butonu ayrıştırılan değerleri (saat ve öncelik dahil) forma taşır. Bilinen belirsizlik: başlıkta geçen gün adları ("Cuma namazı", "pazar alışverişi") tarih olarak anlaşılır; önizleme bunu yazarken gösterir.
4. ✅ **F:** dışa / içe aktarma — `src/data/backup.js` (oluştur / doğrula / birleştir, 13 test), platform dosya işlemleri `backupFile.web.js` / `backupFile.native.js`. Aynı adda farklı kimlikli etiketler mevcut etikete bağlanır, çift etiket bağı eklenmez. Onay özeti yalnızca görünen değişiklikleri sayar (silinmiş gelen yeni kayıtlar "eklenecek" sayılmaz; canlı kaydı silen güncelleme "silinecek" olarak gösterilir). Ayarlar dışa aktarılır ama içe aktarılmaz (cihaza özel tercih).
5. ✅ **G + H:** etiket filtresinde VEYA, "Önemli" listesi — `searchTasks` `tagMode: 'all' | 'any'` alır; seçim en az 2 etiket varken görünür, filtre sayısına katılmaz, "Filtreleri temizle" Hepsi'ne döndürür. Önemli (`/lists/important`): yüksek öncelikli açık görevler; simge rengi Gecikmiş'ten ayrışan koyu amber (`colors.important`).
6. ✅ **D:** karanlık mod — `src/theme.js`: `lightColors` / `darkColors`, `ThemeProvider` (kök düzende `settings.theme` ile), `useTheme()` ve `useThemedStyles(makeStyles)`; stil fabrikaları modül düzeyinde, renkler bileşen içinde hook'tan alınır. `system` cihaz/tarayıcı tercihini canlı izler; web'de sayfa zemini ve `color-scheme` de ayarlanır (tarih alanları, kaydırma çubukları). Kontrast `src/__tests__/theme.test.js` ile kilitli: metinler ≥ 4,5:1, simgeler ve öncelik halkaları ≥ 3:1. Bu yüzden açık temada birkaç renk koyulaştırıldı (ikincil metin, yer tutucu, tehlike kırmızısı, etiket grisi, birincil mor; öncelik halkalarında "yok" grisi ve orta turuncu). Kullanıcı renkli zeminlerde (kategori simgesi, seçili çip, tamamlanmış halka) simge rengi `onColor(zemin)` ile beyaz/koyu seçilir. Bilinen sınır: kategori/etiket renkleri metin olarak kullanıldığında (ör. etiket adı) açık temada sarı gibi açık renkler düşük kontrastlı kalır; palet kullanıcı seçimi olduğu için değiştirilmedi. Mobil cihazda denenmedi (yalnızca derleme).
7. ✅ **B:** kaydırma hareketleri — `TaskRows` her satırı `SwipeableRow` ile sarar. Mobil (`SwipeableRow.jsx`): `react-native-gesture-handler` Pan + `react-native-reanimated`; 15 px yatay hareketten sonra satır kayar (dikey kaydırma listeye kalır), eşik `swipe.js` içinde genişliğin 1/3'ü; arkada birincil renkte "Tamamla"/"Geri aç", kırmızıda "Sil". Silme onay sormaz, geri alma şeridi çıkar. Ekran okuyucu için satırda `complete` / `delete` eylemleri. Uygulama kökü mobilde `GestureHandlerRootView` ile sarılır (`GestureRoot.jsx`). Web (`SwipeableRow.web.jsx`, `GestureRoot.web.jsx`): kütüphaneler pakete girmez; satırın sağında sil butonu yalnızca fare üzerindeyken ya da klavye odağındayken görünür, görünmezken dokunmaya kapalıdır (dokunmatik ekranda yanlışlıkla silinmesin), yerini koruduğu için satır zıplamaz. Mobil cihazda denenmedi: hareket mantığı Jest'te gesture-handler test araçlarıyla, derleme Android/iOS dışa aktarımıyla doğrulandı.

v3 tamamlandı.

## v4 — Hesap ve Supabase senkronizasyonu

### Kararlar

| # | Konu | Karar |
|---|------|-------|
| X1 | Hesap | İsteğe bağlı. Girişsiz uygulama bugünkü gibi yerel çalışır; Ayarlar → Hesap'tan giriş yapınca senkron başlar |
| X2 | İlk giriş | Yerel veri hesaptakiyle her zaman birleşir: kimliğe göre, `updatedAt` daha yeni olan kazanır (v3-F kuralı). Soru sorulmaz |
| X3 | Çıkış | Yerel veri silinir, cihaz yeni kurulum hâline döner; gönderilmemiş değişiklik varsa önce uyarı. Ayarlar kalır |
| X4 | Giriş yöntemi | E-posta + 6 haneli kod (`signInWithOtp` + `verifyOtp`). Şifre ve derin bağlantı yok |
| X5 | Zamanlama | Gönderme: yerel kuyruk, son değişiklikten 1 sn sonra. Çekme: açılışta, öne gelince, her gönderimden sonra, açıkken dakikada bir ve Realtime "değişti" sinyalinde |
| X6 | Çakışma | Kayıt düzeyinde son güncellenen (`updatedAt`) kazanır. "Neler değişti" sorgusu cihaz saatiyle değil, sunucu sırasıyla (`server_seq`) |
| X7 | Sunucu şeması | Koleksiyon başına tipli tablo, iç içe alanlar `jsonb`, birincil anahtar `(user_id, id)`, RLS `user_id = auth.uid()`, yazma RPC ile. SQL `supabase/migrations/` içinde |
| X8 | Sürüm uyumu | Şema sürümü `sync_meta.min_schema_version`'dan eski uygulama senkronu durdurur ve "uygulamayı güncelleyin" der; yerel kullanım sürer |
| X9 | Ayarlar | Cihaza özel; senkronize edilmez, çıkışta silinmez |
| X10 | Silinmiş kayıtlar | 30 gün sonra kalıcı silinir (sunucuda ve yerelde). Temizliği kaçıran cihaz tam eşitleme yapar |
| X11 | Hesabı sil | Bu sürümde; çift onay, önce yedek almaya bağlantı |
| X12 | Test | Katmanlı: motor (Jest + sahte sunucu), SQL (gerçek Postgres), E2E (Node test sunucusu, iki cihaz), gerçek Supabase elle |
| X13 | Tekrar kopyası | Tekrarın oluşturduğu sonraki görevin kimliği öncekinden türetilir (UUID v5); iki cihazda tamamlama tek kayıtta birleşir |
| X14 | Etiket kopyası | Her çekmeden sonra aynı `nameKey`'li canlı etiketler belirleyici olarak birleştirilir |
| X15 | Sıra | İçten dışa: SQL → istemci hazırlığı → motor → Supabase + Hesap ekranı → E2E |

### Kurallar

**Yapılandırma**
- `.env` (depoya girmez): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` (publishable anahtar). Depoda `.env.example` bulunur.
- Yapılandırma yoksa Hesap bölümü "Yapılandırılmadı" yazar; uygulama v3'teki gibi çalışır, mevcut e2e testleri değişmez.
- Supabase e-posta şablonu kodu içermelidir (`{{ .Token }}`); varsayılan şablon bağlantı gönderir. Yerleşik e-posta servisi yalnızca proje ekibindeki adreslere, saatte birkaç e-posta gönderir; başka kullanıcılar için özel SMTP gerekir.

**Giriş ve ilk birleştirme**
- Ayarlar → Hesap → e-posta → kod ekranı. Hatalı / süresi geçmiş kod mesajı, "Kodu yeniden gönder" (bekleme süresiyle).
- Oturum supabase-js tarafından saklanır ve yenilenir (mobilde AsyncStorage, web'de localStorage).
- İlk girişte (imleç yokken): sunucudaki her şey çekilir, yerel kayıtlarla kimliğe göre birleştirilir (`updatedAt` yeni olan kazanır, eşitlikte sunucu), yerelde daha yeni ya da sunucuda olmayan kayıtların tümü (silinmişler dahil) gönderilir.
- Gelen Kutusu her cihazda `"inbox"` olduğu için tek kayda iner. Aynı adlı etiketler X14 kuralıyla birleşir.

**Gönderme ve çekme**
- Girişliyken her `commit` değişen kayıtların `{ collection, id }` çiftlerini `@todo/syncQueue`'ya ekler. Kuyruk kaydın kendisini değil kimliğini tutar; gönderilen her zaman kaydın en son hâlidir. Girişsizken kuyruk tutulmaz (ilk girişte zaten her şey gönderilir).
- Gönderme son değişiklikten 1 sn sonra toplu yapılır. Sunucunun yazdığı ya da "sende daha eskisi var" diye reddettiği kayıtlar kuyruktan çıkar (reddedilenin yenisi sonraki çekmede gelir). Ağ hatasında artan bekleme (5 sn → 5 dk); öne gelince ve "Şimdi eşitle"de hemen yeniden denenir.
- Çekme `server_seq > imleç` olan kayıtları sayfa sayfa (500) alır. Gelen kayıt yerel kayıttan daha yeniyse (ya da yerelde yoksa) yazılır; yerel kayıt daha yeniyse yerel kalır (kuyrukta olduğu için gönderilir). İmleç `@todo/syncState` içinde.
- Realtime yalnızca tetikleyicidir: kullanıcının tablolarındaki değişiklik olayında (250 ms birleştirerek) çekme yapılır, olayın içeriği kullanılmaz. Bağlantı koparsa dakikalık çekme boşluğu kapatır.
- Uzaktan gelen değişiklikler store'a kuyruğa girmeden ve geri alma kaydı oluşturmadan yazılır. Geri alma kaydının dokunduğu bir kayda uzaktan değişiklik gelirse geri alma iptal olur (v3-A kuralı).
- Hatırlatıcılar store'dan hesaplandığı için uzaktan gelen görevlerin bildirimleri her cihazda kendiliğinden kurulur / iptal edilir; kurulu bildirimler senkronize edilmez (v2 kuralı).
- Zaman damgaları sunucudan her zaman istemcinin biçiminde (`toISOString()`, milisaniyeli `Z`) döner; karşılaştırma bu biçim üzerinden yapılır.

**Sürüm uyumu**
- Gönderme ve çekme RPC'leri uygulamanın `schemaVersion`'ını alır; `sync_meta.min_schema_version`'dan küçükse belirli bir hata döner.
- Bu hatada senkron durur; Ayarlar → Hesap'ta ve bir şeritte "Senkronizasyon için uygulamayı güncelleyin" görünür. Yerel kullanım sürer, kuyruk bekler.
- Kayıtlara alan ekleyen her SQL migration'ı `min_schema_version`'ı da yükseltir. v4'te istemci şeması 3'te kalır (kayıt alanı değişmiyor); başlangıç değeri 3.

**Çıkış ve hesap silme**
- Çıkış: önce bir gönderim denenir. Kuyruk hâlâ doluysa "n değişiklik henüz gönderilmedi. Çıkarsanız kaybolacak." onayı. Sonra oturum kapanır; `@todo/tasks`, `categories`, `tags`, `taskTags`, `syncQueue`, `syncState` silinir, Gelen Kutusu yeniden oluşturulur; bildirim eşitlemesi kurulu hatırlatıcıları iptal eder. `@todo/settings` kalır.
- Hesabı sil: iki onay (ilkinde "Önce yedek al" bağlantısı → Ayarlar → Yedekleme). `delete_account()` RPC `auth.users` satırını siler, tablolar `on delete cascade` ile temizlenir. Ardından çıkış akışı uyarısız çalışır.

**Silinmiş kayıtların temizliği**
- Sunucu: her satırın `server_updated_at`'ını tetikleyici yazar (cihaz saati değil). `pg_cron` günde bir `purge_deleted()` çalıştırır: `deleted_at` dolu ve `server_updated_at`'ı 30 günden eski satırlar kalıcı silinir; silinenlerin en büyük `server_seq`'i kullanıcının `purged_seq`'i olur.
- Çekme `purged_seq`'i de döndürür. İmleç 0'dan büyük ve `purged_seq`'ten küçükse cihaz bazı silmeleri kaçırmış olabilir → tam eşitleme: her şey baştan çekilir; yerelde olup sunucuda olmayan ve kuyrukta olmayan kayıtlar kalıcı silinir; kuyruktakiler normal gönderilir (silmeden daha yeni düzenlemedir, "son güncellenen kazanır"a göre geri gelmeleri doğrudur).
- Yerel: açılışta `deletedAt`'ı 30 günden eski ve kuyrukta olmayan kayıtlar kalıcı silinir (girişsiz kullanımda da).
- `nextTaskId` temizlenmiş bir görevi gösteriyorsa "sonraki görev yok" sayılır.
- Bilinen sınır: 30 günden eski bir yedek içe aktarılırsa, arada silinip temizlenmiş kayıtlar geri gelir.

**Kopyaları önleme**
- X13: sonraki görevin kimliği `uuidV5(task.id + ':next')`. İşaret kaldırılınca bu kayıt soft delete edilir; yeniden tamamlanınca aynı kimlikli kayıt yeni alanlarla ve `deletedAt: null` ile yazılır.
- Görev-etiket bağının kimliği de görev ve etiketten türetilir (`uuidV5('task-tag:' + taskId + ':' + tagId)`): iki cihaz aynı görevi aynı etiketle çevrimdışı etiketlerse tek bağ olur; kaldırılıp yeniden eklenen bağ aynı kaydı canlandırır. (2. adımda eklendi; X13'ün sonraki görevinin bağları da böylece tek kayıtta birleşir.)
- X14: çekmeden sonra aynı `nameKey`'li canlı etiketlerden `createdAt`'ı en eski olan kalır (eşitlikte küçük `id`), adı ve rengi onunkidir. Kopyaların bağları silinir ve kalan etikete türetilmiş kimlikle yeniden kurulur (iki cihaz aynı kayıtları yazar); görev kalan etikete zaten bağlıysa yalnızca silinir. Kopya etiket soft delete edilir. Geri alma şeridi çıkmaz. İçe aktarma kendi ad eşlemesini korur; yedeğin kendisi aynı adlı birden fazla etiket getirirse aynı birleştirme içe aktarma işleminin içinde çalışır (birlikte geri alınır).
- Kategorilerde ad benzersizliği yok (K4); aynı adlı kategoriler birleştirilmez.

**Durum**
- Ayarlar → Hesap: e-posta, son eşitleme zamanı, bekleyen değişiklik sayısı, varsa hata / "güncelleyin" uyarısı, "Şimdi eşitle", "Çıkış yap", "Hesabı sil".

### Sunucu şeması (özet)

```sql
-- tasks, categories, tags, task_tags için ortak sütunlar:
user_id uuid not null references auth.users on delete cascade,
id text not null,                    -- "inbox" UUID değil, bu yüzden text
created_at, updated_at timestamptz not null,
deleted_at timestamptz,
server_seq bigint not null,          -- tetikleyici: nextval('sync_seq')
server_updated_at timestamptz not null, -- tetikleyici: now()
primary key (user_id, id)

-- tasks: title, notes, category_id, due_date date, due_time text ("HH:mm"),
--        priority smallint check (priority between 0 and 3), completed_at,
--        reminders jsonb, recurrence jsonb, next_task_id, checklist jsonb
-- categories: name, color, icon, is_system, sort_order
-- tags: name, name_key, color
-- task_tags: task_id, tag_id

sync_meta (min_schema_version int)                -- tek satır, herkes okur
sync_users (user_id, purged_seq bigint)           -- temizlik sınırı

push(client_schema int, changes jsonb)   -- insert … on conflict do update … where excluded.updated_at > t.updated_at
pull(client_schema int, since bigint, lim int) → { records, next, purged_seq }
purge_deleted()                          -- pg_cron, günlük
delete_account()
```

- RPC'ler `security invoker`; RLS her tabloda `user_id = auth.uid()` (`purge_deleted` ve `delete_account` `security definer`).
- `push` kullanıcı başına `pg_advisory_xact_lock` alır: aynı kullanıcının yazmaları sırayla işlenir, böylece `server_seq`'ler işlem sırasıyla görünür olur ve çekme imleci arada kalan bir kaydı atlamaz.

### Klasör yapısı eklemeleri

```
supabase/
  migrations/                → tablolar, RLS, tetikleyiciler, RPC'ler
  tests/                     → npm run test:db (gerçek Postgres + auth taklidi)
src/sync/
  engine.js                  → kuyruk, gönderme/çekme, ilk birleştirme, tam eşitleme, çıkış (platformdan bağımsız)
  queue.js
  records.js                 → istemci alanları ↔ sütunlar, zaman damgası biçimi
  remote.supabase.js         → supabase-js adaptörü (auth, push/pull, Realtime)
  remote.fake.js             → bellek içi sunucu (Jest ve e2e)
src/domain/
  tagMerge.js                → X14, içe aktarmayla ortak
app/
  account.jsx                → Hesap: giriş (e-posta → kod) ve durum
e2e/
  syncServer.js              → iki cihaz senaryoları için Node test sunucusu
```

### v4 uygulama adımları

1. ✅ **Sunucu şeması:** `supabase/migrations/20260926120000_sync_schema.sql` (tablolar, RLS, tetikleyici, `push` / `pull`, `purge_deleted`, `delete_account`, Realtime yayını) ve `20260926120100_purge_schedule.sql` (pg_cron ile günlük temizlik; pg_cron yoksa uyarıyla atlanır).
   - `push(client_schema, changes)` → `{ written: { tasks: [id, …], categories, tags, task_tags } }`. Gönderilip `written`'da olmayanlar sunucuda daha yeni ya da aynı sürümü olanlardır. Aynı kayıt bir gönderimde iki kez gelirse en yenisi alınır.
   - `pull(client_schema, since, lim)` → `{ records: [{ collection, record }], next, has_more, purged_seq }`; sayfa 1–1000 (varsayılan 500). `record` snake_case ve `user_id`'siz; zaman damgaları Postgres biçiminde (`…+00:00`) döner, istemci `toISOString()` ile çevirir.
   - Hatalar: eski şema → `client_outdated` (`detail`: en küçük sürüm); oturum yok → `not_authenticated`.
   - Kullanıcı başına kilit tetikleyicide: tablolara doğrudan yazmalar da sıraya girer ve `server_seq` alır.
   - Yetkiler: `anon` hiçbir şeye erişemez; `authenticated` kendi satırlarında select / insert / update yapar (delete yok), sırayı ilerletemez, `purge_deleted`'ı çağıramaz.
   - Kısıtlar istemcinin zaten uyduğu kurallardır: öncelik 0–3, saat `HH:mm` ve yalnızca tarihle, `reminders` / `checklist` dizi, `recurrence` nesne ya da null. Kısıta uymayan bir kayıt tüm gönderimi reddeder; motor (3. adım) böyle bir kaydın kuyruğu kilitlememesini sağlamalı.
   - `npm run test:db` (33 test, `node --test` + `pg`): geçici bir Postgres kümesi başlatır (root olarak çalışırken `postgres` kullanıcısıyla), `supabase/tests/supabase-mock.sql` ile roller, `auth.users`, `auth.uid()`, varsayılan yetkiler ve Realtime yayınını taklit eder, migration'ları uygular. Kapsam: alanların gidiş-dönüşü, son güncellenen kazanır, kısıtlar, sayfalama, sürüm kilidi, RLS ve yetkiler, temizlik ve `purged_seq`, hesap silme, eşzamanlı yazmaların sırası. Testlerin gerçekten yakaladığı, şema bilerek bozularak denendi (`>` yerine `>=`, kilit kaldırma, yetki daraltmayı kaldırma, `user_id` sızdırma).
   - Postgres programları `pg_config`, `/usr/lib/postgresql/*/bin` ya da `PG_BIN` ile bulunur; var olan bir sunucu için `TEST_DATABASE_URL` (süper kullanıcı) verilebilir.
2. ✅ **İstemci hazırlığı (Supabase olmadan):** görünür değişiklik yok.
   - Türetilmiş kimlikler (`src/domain/ids.js`): `uuidV5` (RFC 4122; SHA-1 `src/domain/sha1.js` içinde senkron yazıldı, çünkü `expo-crypto`'nun özeti asenkron), `nextOccurrenceId(taskId)`, `taskTagId(taskId, tagId)`. Ad alanı sabit bir UUID; değiştirilirse cihazlar farklı kimlik üretir.
   - Tekrar (X13): sonraki görev `nextOccurrenceId` ile oluşur. Silinmiş bir kopyası varsa yeniden canlanır; canlı bir kopyası varsa (ör. tamamlandığı için işaret kaldırmada silinmemiş) yeni görev oluşmaz, ona bağlanılır — önceden bu durumda ikinci bir kopya oluşuyordu.
   - Etiket birleştirme (X14): `src/domain/tagMerge.js` → `mergeDuplicateTags(state)`; store'da aynı adlı eylem (3. adımda her çekmeden sonra çağrılacak) ve `importBackup` içinde.
   - Yerel temizlik (X10): `src/data/purge.js` → `expiredIds`; `init` açılışta `deletedAt`'ı 30 günden eski ve kuyrukta olmayan kayıtları bellekten ve depodan (`removeMany`) siler. e2e yedek testindeki silinmiş kaydın tarihi bu yüzden son 30 güne alındı.
   - Gönderme kuyruğu: `src/sync/queue.js` (`@todo/syncQueue`: `{ active, seq, entries }`). `commit` depoya yazmadan önce kuyruğa ekler (kuyrukta olup depoda eski kalan kayıt yalnızca eski hâlin gönderilmesi demek; tersi değişikliğin hiç gitmemesi olurdu). Kuyruk `activate()` edilene (girişe) kadar hiçbir şey tutmaz. Her eklemede artan sıra numarası: `ack` gönderim sırasında yeniden değişen kaydı kuyruktan çıkarmaz. `reset()` çıkış içindir.
3. ✅ **Senkron motoru:** `src/sync/engine.js` → `createSyncEngine({ remote })`: `load()`, `start(userId)`, `sync()`, `signOut({ force })`, `deleteAccount()`, `getStatus()` / `subscribe()`. Zamanlama (gecikme, yeniden deneme, Realtime) motorun dışında; 4. adımda.
   - `remote` arayüzü: `push(clientSchema, changes)`, `pull(clientSchema, since, lim)`, `deleteAccount()`, isteğe bağlı `signOut()`. Hatalar `RemoteError` (`src/sync/errors.js`): `outdated`, `unauthenticated`, `rejected` (Postgres 22xxx/23xxx), `network`.
   - `src/sync/records.js`: alan listeleri ve camelCase ↔ snake_case eşlemesi (`taskTags` ↔ `task_tags`); zaman damgaları `toISOString()` biçimine çevrilir.
   - `src/sync/remote.fake.js`: SQL fonksiyonlarını taklit eden bellek içi sunucu (kısıtlar, son güncellenen kazanır, `server_seq`, sayfalama, `purged_seq`, sürüm kilidi, hesap silme); zaman damgalarını Postgres biçiminde döndürür.
   - `sync()`: gönder → çek → aynı adlı etiketleri birleştir → (birleştirme bir şey değiştirdiyse) yeniden gönder. Aynı anda tek eşitleme; sürerken gelen istekler bitince tek bir tur daha çalıştırır. Hata fırlatmaz, durum döndürür (`phase`: `signedOut` · `idle` · `syncing` · `error` · `outdated`; `pending`, `blocked`, `lastSyncedAt`).
   - Gönderme 200'lük gruplarla. Sunucu yazsa da "sende daha yenisi var" diye yazmasa da kayıt kuyruktan çıkar. Kısıt hatasında grup ikiye bölünerek reddedilen kayıt bulunur; o kayıt kuyrukta **engelli** kalır (gönderilmez, bekleyen sayılır, tam eşitlemede silinmez), yeniden düzenlenince tekrar denenir. Böylece 1. adımdaki "tek kötü kayıt kuyruğu kilitler" riski kapandı.
   - Çekme 500'lük sayfalarla; imleç her sayfadan sonra kaydedilir. Store'un `applyRemote` eylemi yalnızca yerelde olmayan ya da daha yeni kayıtları yazar (kuyruğa girmez). İmleç `purged_seq`'in gerisindeyse tam eşitleme; kalıcı silme `removeRecords` ile.
   - İlk giriş: önce kuyruk etkinleşip tüm yerel kayıtlar eklenir, sonra durum yazılır (arada kesilirse tekrar çalışması zararsız). Başka bir hesap girişliyken `start` hata verir.
   - Çıkış: `force`'suz önce eşitleme; bekleyen varsa `{ signedOut: false, pending }`. `force` ile sürmekte olan eşitleme bir sonraki adımında durdurulur (çıkıştan sonra gönderim yapılmaz), `remote.signOut`, kuyruk sıfırlanır, store `resetLocalData` (yalnızca Gelen Kutusu), `@todo/syncState` silinir.
   - Gelen Kutusu'nun zaman damgaları artık en eski ana (`1970-01-01`) sabit: yeni kurulan ya da çıkışta sıfırlanan cihazın Gelen Kutusu, başka cihazda yeniden adlandırılmış olanın üzerine yazmaz. (Eski kurulumlardaki hiç düzenlenmemiş Gelen Kutusu kurulum zamanını taşır; bu durumda yalnızca varsayılan ad yarışır.)
   - Testler (`src/sync/__tests__/engine.test.js`, 25 senaryo): her cihaz `jest.isolateModules` + bellek içi AsyncStorage ile kendi store / kuyruk / motor kopyasını alır, sunucu ortaktır. İlk giriş birleştirmesi, yayılma, çakışma, gönderim sırasında düzenleme, çevrimdışı, reddedilen kayıt, sürüm kilidi, tam eşitleme, tekrar ve etiket kopyaları, çıkış / hesap silme ve çıkışın sürmekte olan eşitlemeyi durdurması. Motor ve store bilerek bozularak testlerin yakaladığı doğrulandı (7 bozulma).
4. ⬜ **Supabase + Hesap ekranı:** `@supabase/supabase-js`, oturum saklama, Ayarlar → Hesap (giriş, durum, Şimdi eşitle, Çıkış, Hesabı sil), Realtime tetikleyici, zamanlama.
5. ⬜ **E2E ve belgeler:** Node test sunucusu, iki tarayıcı bağlamıyla iki cihaz senaryoları (giriş, bir cihazda ekle → öbüründe gör, çevrimdışı düzenle → bağlan, çıkış → veri silinir), gerçek Supabase için elle kontrol listesi.

## Sonraki sürümler

- **v4:** hesap + Supabase senkronizasyonu — planlandı, bkz. yukarıdaki bölüm.
- **v4 sonrası:** istatistikler, geniş web ekranında kenar çubuğu, kontrol listesinde sürükle-bırak.
- **Sonraya bırakılanlar (tüm sürümlerden sonra):** tam alt görevler (kendi tarihi/etiketi olan, listelerde görünebilen alt görevler).

## Testler

- **Birim testleri (Jest):** `npm test` — saf mantık, store, veri taşıma, ayrıştırıcı. `America/New_York` saat diliminde koşar.
  - Bileşen testi olarak yalnızca mobil kaydırma satırı var (`react-test-renderer` + gesture-handler `jest-utils`; reanimated ve simgeler `jest.setup.js` / test dosyasında taklit edilir).
- **SQL testleri:** `npm run test:db` — `supabase/migrations/` dosyalarını geçici bir Postgres'e uygular ve `supabase/tests/*.test.js` senaryolarını çalıştırır (bkz. v4 1. adım). Postgres sunucu programları gerekir; Docker gerekmez.
- **Uçtan uca testler (Playwright):** `npm run e2e` — web derlemesini `dist/` klasörüne alır, küçük bir sunucuyla açar ve `e2e/*.spec.js` senaryolarını Chromium'da çalıştırır.
  - İlk kez çalıştırmadan önce: `npx playwright install chromium`.
  - Saat `Cuma 25 Eylül 2026 10:00` (İstanbul) olarak sabitlenir; hatırlatıcı ve gecikme testleri saati ileri alarak çalışır.
  - Her test sonunda konsol hatası olmadığı doğrulanır; onay/uyarı pencereleri otomatik kabul edilir ve `dialogs` ile kontrol edilebilir.
  - Headless Chromium bildirim iznini her zaman "reddedildi" bildirdiği için hatırlatıcı testleri sahte bir `Notification` sınıfı kullanır.
  - Bilinen küçük sorun: aktif sekmeye tekrar basınca adres çubuğunda eski bir parametre (`/lists?id=...`) kalabiliyor (expo-router); gösterilen ekran doğru.

## Notlar

- **Erişilebilirlik:** seçim durumu için `accessibilityState` yerine `aria-checked` gibi tekil `aria-*` prop'ları kullanılır. react-native-web 0.21 `accessibilityState` nesnesini yok sayar; React Native 0.81 ikisini de destekler.

## Açık konular

- ~~**Tarih/saat seçici**~~ → Çözüldü (4. adım): mobilde `@react-native-community/datetimepicker`, web'de `<input type="date|time">` (`DateInput.web.jsx`), üstte Bugün / Yarın / Gelecek hafta / Yok çipleri. Web alanları tarayıcının diline göre görünür (Türkçe tarayıcıda `26.09.2026`, `15:30`).
- ~~**Arayüz dili**~~ → Çözüldü (V5): şimdilik yalnızca Türkçe, v2 sonunda metinler tek dosyaya taşınacak.
