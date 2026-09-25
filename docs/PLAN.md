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
7. **Arama:** başlık/not araması + kategori, etiket (VE) ve öncelik filtreleri.

## Sonraki sürümler

- **v2:** alarmlar/hatırlatıcılar (`expo-notifications` mobilde; web'de yalnızca uygulama açıkken uygulama içi uyarı), saatsiz görevler için ayarlanabilir varsayılan hatırlatma saati, tekrarlayan görevler, alt görevler.
- **v3:** kaydırma hareketleri, geri alma (Undo), karanlık mod, `#etiket` / doğal dil ile hızlı ekleme, etiket filtresinde VEYA, dışa/içe aktarma, istatistikler, geniş web ekranında kenar çubuğu, "Önemli" akıllı listesi.
- **v4:** hesap + Supabase senkronizasyonu.

## Notlar

- **Erişilebilirlik:** seçim durumu için `accessibilityState` yerine `aria-checked` gibi tekil `aria-*` prop'ları kullanılır. react-native-web 0.21 `accessibilityState` nesnesini yok sayar; React Native 0.81 ikisini de destekler.

## Açık konular

- ~~**Tarih/saat seçici**~~ → Çözüldü (4. adım): mobilde `@react-native-community/datetimepicker`, web'de `<input type="date|time">` (`DateInput.web.jsx`), üstte Bugün / Yarın / Gelecek hafta / Yok çipleri. Web alanları tarayıcının diline göre görünür (Türkçe tarayıcıda `26.09.2026`, `15:30`).
- **Arayüz dili:** yalnızca Türkçe mi, yoksa çoklu dil desteği mi olacak?
