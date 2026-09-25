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
};
