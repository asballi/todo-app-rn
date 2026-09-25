// Tüm arayüz metinleri (plan V5). Yeni bir dil eklemek için bu nesnenin aynı
// yapıda bir kopyası hazırlanır. Yorumlar ve geliştirici günlükleri
// (console.warn) burada değildir.
export const strings = {
  // Sıralama/karşılaştırma için dil kodu.
  locale: 'tr',

  common: {
    save: 'Kaydet',
    create: 'Oluştur',
    delete: 'Sil',
    ok: 'Tamam',
    cancel: 'Vazgeç',
    error: 'Hata',
    none: 'Görev yok',
    loadFailed: error => `Veriler yüklenemedi: ${error}`,
  },

  tabs: {
    today: 'Bugün',
    upcoming: 'Yaklaşan',
    lists: 'Listeler',
    search: 'Ara',
  },

  dates: {
    today: 'Bugün',
    tomorrow: 'Yarın',
    yesterday: 'Dün',
    nextWeek: 'Gelecek hafta',
    monthsShort: ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'],
    monthsLong: [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
    ],
    // Date#getDay sırası: 0 = Pazar
    weekdays: ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'],
    weekdaysShort: ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'],
    dateInput: 'Tarih',
    timeInput: 'Saat',
  },

  today: {
    quickAdd: 'Bugün için görev ekle...',
    overdue: 'Gecikmiş',
    today: 'Bugün',
    empty: 'Bugün için görev yok',
  },

  upcoming: {
    addFor: day => `${day} için görev ekle`,
  },

  lists: {
    title: 'Listeler',
    smartLists: 'Akıllı listeler',
    overdue: 'Gecikmiş',
    overdueEmpty: 'Gecikmiş görev yok',
    categories: 'Kategoriler',
    newCategory: 'Yeni kategori',
    tags: 'Etiketler',
    manageTags: 'Etiketleri yönet',
    noTags: 'Henüz etiket yok. Görev düzenlerken etiket ekleyebilirsin.',
  },

  category: {
    quickAdd: name => `${name} listesine ekle...`,
    empty: 'Bu kategoride açık görev yok',
    edit: 'Kategoriyi düzenle',
    new: 'Yeni kategori',
    namePlaceholder: 'Kategori adı',
    color: 'Renk',
    icon: 'Simge',
    delete: 'Kategoriyi sil',
    deleteConfirm: name => `"${name}" silinsin mi?`,
    deleteMovesTasks: n => `İçindeki ${n} görev Gelen Kutusu'na taşınacak.`,
    chipLabel: name => `Kategori ${name}`,
  },

  tag: {
    quickAdd: name => `#${name} etiketiyle ekle...`,
    empty: 'Bu etiketle açık görev yok',
    edit: 'Etiketi düzenle',
    new: 'Yeni etiket',
    manageTitle: 'Etiketler',
    count: n => `${n} etiket`,
    none: 'Henüz etiket yok.',
    namePlaceholder: 'Etiket adı',
    color: 'Renk',
    delete: 'Etiketi sil',
    deleteConfirm: name => `#${name} silinsin mi?`,
    deleteUnlinks: n => `Etiket ${n} görevden kaldırılacak; görevler silinmez.`,
    chipLabel: name => `Etiket ${name}`,
    pickerPlaceholder: 'Etiket ara veya oluştur',
    createChip: name => `"${name}" oluştur`,
  },

  task: {
    newTitle: 'Yeni görev',
    detailTitle: 'Görev',
    markDone: 'Tamamlandı olarak işaretle',
    markUndone: 'Tamamlanmadı olarak işaretle',
    delete: 'Görevi sil',
    deleteConfirm: title => `"${title}" silinsin mi?`,
  },

  taskForm: {
    titlePlaceholder: 'Görev başlığı',
    notesPlaceholder: 'Not ekle',
    notesLabel: 'Not',
    date: 'Tarih',
    noDate: 'Yok',
    noDateLabel: 'Tarih yok',
    noTime: 'Saat yok',
    addTime: 'Saat ekle',
    category: 'Kategori',
    tags: 'Etiketler',
    priority: 'Öncelik',
  },

  quickAdd: {
    placeholder: 'Görev ekle...',
    add: 'Görev ekle',
    details: 'Ayrıntılı görev ekle',
  },

  completed: {
    title: n => `Tamamlananlar (${n})`,
    clear: 'Tamamlananları sil',
    clearConfirm: n => `${n} tamamlanmış görev silinsin mi?`,
  },

  priority: {
    labels: ['Yok', 'Düşük', 'Orta', 'Yüksek'],
    chipLabel: label => `Öncelik ${label}`,
  },

  pickers: {
    colorLabel: color => `Renk ${color}`,
    noColor: 'Renksiz',
    iconLabel: icon => `Simge ${icon}`,
  },

  search: {
    placeholder: 'Görevlerde ara',
    clear: 'Aramayı temizle',
    filters: n => (n > 0 ? `Filtreler (${n})` : 'Filtreler'),
    clearFilters: 'Filtreleri temizle',
    category: 'Kategori',
    tagsAll: 'Etiketler (hepsi)',
    noTags: 'Etiket yok',
    priority: 'Öncelik',
    hint: 'Aramak için yaz veya filtre seç',
    noResults: 'Sonuç bulunamadı',
    resultCount: n => `${n} sonuç`,
  },

  checklist: {
    title: 'Kontrol listesi',
    addPlaceholder: 'Madde ekle',
    itemLabel: title => `Madde: ${title}`,
    deleteItem: title => `"${title}" maddesini sil`,
    progress: (done, total) => `${done}/${total}`,
    progressLabel: (done, total) => `Kontrol listesi: ${done}/${total} tamamlandı`,
  },

  recurrence: {
    title: 'Tekrar',
    none: 'Tekrar yok',
    custom: 'Özel',
    every: 'Her',
    units: { day: 'gün', week: 'hafta', month: 'ay', year: 'yıl' },
    presets: {
      daily: 'Her gün',
      weekdays: 'Hafta içi',
      weekly: 'Her hafta',
      monthly: 'Her ay',
      yearly: 'Her yıl',
    },
    everyUnit: { day: 'Her gün', week: 'Her hafta', month: 'Her ay', year: 'Her yıl' },
    // "Her 3 günde bir", "Her 2 haftada bir" (Türkçe ek ünlü uyumuna göre)
    everyN: (unit, n, unitName) => `Her ${n} ${unitName}${unit === 'day' ? 'de' : 'da'} bir`,
    afterCompletion: label => `${label} (tamamlandıktan sonra)`,
    decrease: 'Aralığı azalt',
    increase: 'Aralığı artır',
    intervalLabel: n => `Aralık: ${n}`,
    fromDue: 'Bitiş tarihinden say',
    fromCompletion: 'Tamamlanınca say',
    repeats: label => `Tekrarlıyor: ${label}`,
  },

  reminders: {
    title: 'Hatırlatıcılar',
    channelName: 'Hatırlatıcılar',
    options: { 0: 'Zamanında', 10: '10 dk önce', 30: '30 dk önce', 60: '1 saat önce', 1440: '1 gün önce' },
    max: n => `En fazla ${n} hatırlatıcı`,
    untimed: time => `Saat seçilmedi: hatırlatıcılar varsayılan saate (${time}) göre ayarlanır.`,
    permissionDenied: 'Bildirim izni kapalı. Hatırlatıcılar kaydedilir ama bildirim gelmez; izni cihaz ayarlarından açabilirsin.',
    unsupported: 'Bu tarayıcı bildirimleri desteklemiyor; hatırlatıcılar yalnızca uygulama açıkken şerit olarak görünür.',
    webNote: 'Web\'de hatırlatıcılar yalnızca sekme açıkken çalışır.',
    hasReminders: n => `${n} hatırlatıcı`,
    bannerOpen: title => `${title} görevini aç`,
    bannerDismiss: 'Hatırlatıcıyı kapat',
  },

  settings: {
    title: 'Ayarlar',
    open: 'Ayarlar',
    defaultReminderTime: 'Varsayılan hatırlatma saati',
    defaultReminderHelp: 'Saati olmayan görevlerin hatırlatıcıları bu saate göre kurulur.',
    notifications: 'Bildirimler',
    permission: {
      granted: 'Bildirim izni verildi.',
      denied: 'Bildirim izni reddedildi. Cihaz ya da tarayıcı ayarlarından açabilirsin.',
      undetermined: 'Bildirim izni henüz istenmedi.',
      unsupported: 'Bu tarayıcı bildirimleri desteklemiyor.',
    },
    requestPermission: 'Bildirimlere izin ver',
  },

  // Kayıtlara yazılan varsayılan değerler.
  defaults: {
    inboxName: 'Gelen Kutusu',
  },

  // Kullanıcıya gösterilen hata mesajları (showError ile).
  errors: {
    required: label => `${label} boş olamaz`,
    fields: {
      taskTitle: 'Görev başlığı',
      categoryName: 'Kategori adı',
      tagName: 'Etiket adı',
      checklistItem: 'Madde',
    },
    invalidDate: 'Geçersiz tarih',
    invalidTime: 'Geçersiz saat',
    invalidPriority: 'Geçersiz öncelik',
    invalidChecklist: 'Geçersiz kontrol listesi',
    invalidRecurrenceUnit: 'Geçersiz tekrar birimi',
    invalidRecurrenceInterval: 'Geçersiz tekrar aralığı',
    invalidWeekday: 'Geçersiz gün',
    invalidReminder: 'Geçersiz hatırlatıcı',
    tooManyReminders: n => `En fazla ${n} hatırlatıcı eklenebilir`,
    notFound: (collection, id) => `Kayıt bulunamadı: ${collection}/${id}`,
    duplicateTag: 'Bu adla bir etiket zaten var',
    inboxUndeletable: 'Gelen Kutusu silinemez',
    legacyUnreadable: message => `Eski görevler okunamadı: ${message}`,
  },
};
