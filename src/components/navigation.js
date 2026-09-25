// Web'de sayfa doğrudan URL ile açıldıysa geçmiş boştur; o zaman yedek adrese git.
export function goBack(router, fallback = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
