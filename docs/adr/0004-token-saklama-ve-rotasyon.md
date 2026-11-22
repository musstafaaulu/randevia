# ADR-0004: Access token bellekte, opak refresh token rotasyonu

**Durum:** Kabul edildi

## Bağlam

Web arayüzünün kimliğini kanıtlamak için bir yol gerekiyor. Yaygın seçenek
access token'ı `localStorage`'da saklamaktır (kolay ama XSS'e karşı
korumasız — sayfaya enjekte edilen herhangi bir script token'ı okuyabilir).
Refresh token tarafında da ya JWT (sunucu tarafında iptal edilemez, süresi
dolana kadar geçerli) ya da sunucuda saklanan bir kayıt (iptal edilebilir,
ama veritabanı sorgusu gerektirir) seçilebilir.

## Karar

Access token yalnızca tarayıcı belleğinde (React state), hiçbir yerde kalıcı
tutulmuyor; sayfa yenilendiğinde refresh akışıyla yeniden alınıyor. Refresh
token ise JWT değil, **opak** bir değer: sunucu yalnızca onun SHA-256
özetini (`RefreshToken` modeli) saklıyor, tarayıcıya httpOnly cookie olarak
gönderiliyor (JavaScript'ten okunamaz). Her `/refresh` çağrısı eskisini
iptal edip aynı `family`'de yeni bir token basıyor (**rotasyon**); iptal
edilmiş bir token yine de kullanılmaya çalışılırsa (çalıntı senaryosu), o
kullanıcının **tüm** token'ları iptal ediliyor. `POST /auth/logout` da token'ı
sunucu tarafında iptal ediyor.

Bu, `CORS_ORIGIN`'in `*` olamayacağı anlamına geliyor: tarayıcılar
credentialed (cookie'li) isteklerde yalnızca belirli bir origin'e izin verir.

## Sonuçlar

**Artı:**
- Access token XSS'e karşı `localStorage`'dan daha dayanıklı (sayfadaki bir
  script'in belleği okuması için ekstra bir araç/zafiyet gerekir).
- Refresh token çalınsa bile (örn. cookie sızdırılsa) rotasyon + çalıntı
  tespiti sayesinde bir kere kullanıldığında fark edilir ve tüm oturumlar
  kapatılır — JWT refresh token'da bu mümkün değildir (süresi dolana kadar
  geçerlidir, iptal edilemez).
- Logout gerçek bir iptal, sadece istemci tarafı bir "token'ı unut" değil.

**Eksi:**
- `CORS_ORIGIN`'in tam origin olması gerekiyor (`*` yasak) — çoklu origin
  gerektiren durumlarda (örn. birden fazla alan adı) virgülle liste
  yönetmek gerekiyor.
- Her `/refresh`'te bir veritabanı yazması var (JWT refresh token'da
  sunucu hiç dokunmadan doğrulanabilirdi) — ölçeklenme maliyeti biraz
  daha yüksek, ama iptal edilebilirlik bunun karşılığı.
- Sayfa her yenilendiğinde kısa bir an access token yok (refresh akışı
  tamamlanana kadar) — arayüzde bir yüklenme durumu gerektiriyor.
