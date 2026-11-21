# Uçtan uca test (Playwright)

Bu test gerçek backend'e (`docker compose up`) ve bir Vite geliştirme
sunucusuna karşı çalışır; sahte/mock bir API kullanmaz.

## Önkoşullar

1. `docker compose up -d` ile tüm sistem ayakta olmalı.
2. Kök dizindeki `.env` dosyasında `CORS_ORIGIN` değişkeni `http://localhost:5173`
   adresini içermeli (varsayılan `.env.example` zaten içeriyor).
3. `ADMIN_PASSWORD` ortam değişkenini kök `.env` dosyasındaki değerle aynı
   şekilde ayarla (test, doktor rolü atamak için admin ile giriş yapar).

## Çalıştırma

```bash
cd web
npm install
npx playwright install chromium   # ilk çalıştırmada
ADMIN_PASSWORD=<.env'deki ADMIN_PASSWORD> npm run test:e2e
```

Test, Playwright'ın kendi geliştirme sunucusunu (`npm run dev -- --port 5173`)
otomatik başlatır.

## Kapsam

| Dosya | Doğruladığı akış |
|---|---|
| `realtime.spec.ts` | İki tarayıcı bağlamı (hasta/doktor); hasta randevu alır, doktorun ekranında **sayfa yenilenmeden** bildirim zili + toast anlık belirir. |
| `doctor-search.spec.ts` | Doktor listesinde isim/uzmanlık alanına göre arama ve filtre, eşleşme yoksa boş durum. |
| `profile.spec.ts` | Profil adı güncelleme (nav'a anında yansıması), yanlış mevcut şifreyle reddedilme, doğru şifreyle değiştirme ve yeni şifreyle giriş. |
| `cancel-appointment.spec.ts` | Randevu iptali onay penceresinden (ConfirmDialog) geçer; "Vazgeç" randevuyu değiştirmez. |
| `theme-toggle.spec.ts` | Koyu temaya geçiş ve sayfa yenilemesinden sonra da kalıcı olması. |

## Test verisi ve hız sınırı

Testler, hasta/doktor hesaplarını gerçek veritabanına kaydeder (`helpers.ts`);
bu yüzden koşu biter bitmez (başarılı ya da başarısız) `globalTeardown`
otomatik olarak `../scripts/clean-test-data.mjs`'i çalıştırıp bu kayıtları
temizler. Demo hesapları (`@randevia.local`) bu temizlikten etkilenmez.

Her sayfa yüklemesi (`page.goto`/`page.reload`) oturumu doğrulamak için
gateway'e bir istek daha gönderir (bkz. `web/src/api/client.ts`), bu da
gerçek giriş/kayıt istekleriyle birlikte gateway'in kimlik bilgisi hız
sınırına (`AUTH_RATE_LIMIT_MAX`, varsayılan 15 dakikada 20) hızla
yaklaşabilir. Bunu elle yönetmek yerine:

- `globalSetup` (`global-setup.ts`) koşu başlamadan önce hız sınırını uygulayan
  konteynerleri (`api-gateway`, `auth-service`, `appointment-service`,
  `notification-service`) yeniden başlatıp sağlıklı olmalarını bekler — veri
  kaybı olmaz, yalnızca bellekteki sayaç sıfırlanır.
- `helpers.ts`'teki REST yardımcıları (`postJson`/`patchJson`) ve
  `loginAs`/`submitLoginForm`, bir 429 yanıtı aldıklarında aynı sıfırlamayı
  yapıp isteği bir kez daha dener.

Bu sayede testler, art arda veya başka manuel testlerin hemen ardından
çalıştırıldığında da güvenilir biçimde geçer.
