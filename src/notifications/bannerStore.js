import { create } from 'zustand';

// Uygulama içi hatırlatıcı şeridi (web'de sekme açıkken ya da bildirim izni yokken).
export const useReminderBanner = create(set => ({
  items: [],
  push: item => set(s => ({ items: [...s.items.filter(i => i.key !== item.key), item] })),
  dismiss: key => set(s => ({ items: s.items.filter(i => i.key !== key) })),
}));
