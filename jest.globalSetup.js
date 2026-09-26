// Testler UTC'nin gerisinde ve yaz saati uygulayan bir saat diliminde koşar;
// böylece tarihlerin yanlışlıkla UTC olarak yorumlanması testlerde yakalanır.
module.exports = () => {
  process.env.TZ = 'America/New_York';
};
