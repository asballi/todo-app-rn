// Arayüz metinleri. v2 ile eklenen metinler buradan başlar; v2 sonunda tüm
// metinler bu dosyaya taşınacak (çok dile hazırlık, plan V5).
export const strings = {
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
    decrease: 'Aralığı azalt',
    increase: 'Aralığı artır',
    intervalLabel: n => `Aralık: ${n}`,
    fromDue: 'Bitiş tarihinden say',
    fromCompletion: 'Tamamlanınca say',
    repeats: label => `Tekrarlıyor: ${label}`,
  },
};
