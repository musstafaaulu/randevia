# Demo videosu üretim pipeline'ı

`docs/demo-video/` altına iki dilde (TR/EN altyazılı) bir tanıtım videosu
üretir: `randevia-demo-tr.mp4` ve `randevia-demo-en.mp4`. Uygulamanın
arayüzü her zaman Türkçe kalır — yalnızca alt altyazı metni dile göre
değişir (gerçek bir filmin altyazısı gibi).

Yerelde `k6`/`ffmpeg` kurulu olması gerekmez: ffmpeg, Docker imajı
(`mwader/static-ffmpeg`) üzerinden `lib/ffmpeg.mjs` ile çağrılır. Tarayıcı
olarak `web/`'in zaten indirdiği Playwright Chromium'u kullanılır
(`lib/browser.mjs`, `web/node_modules/playwright`'a göreli import yapar).

## Önkoşullar

1. `docker compose up -d --build` ile tüm sistem ayakta olmalı.
2. `node scripts/seed-demo.mjs` ile demo hesapları/doktorlar hazır olmalı.
3. Kayıt sırasında çok sayıda giriş/istek yapılır; gateway'in ve servislerin
   rate limitlerini geçici olarak yükseltmek gerekir (bkz. README'nin
   "k6 Yük Testi" bölümündeki aynı teknik):

   ```bash
   RATE_LIMIT_MAX=100000 AUTH_RATE_LIMIT_MAX=100000 SERVICE_RATE_LIMIT_MAX=100000 \
     docker compose up -d --no-deps api-gateway auth-service appointment-service notification-service
   ```

   Kayıt bitince üretim varsayılanlarına geri almayı unutmayın:

   ```bash
   docker compose up -d --no-deps api-gateway auth-service appointment-service notification-service
   ```

## Çalıştırma sırası

```bash
node scripts/demo-video/01-record-main.mjs       # tanıtım+giriş+arama, randevularım+.ics, tema, admin paneli
node scripts/demo-video/02-record-split.mjs       # hasta/doktor yan yana - canlı bildirim sahnesi
node scripts/demo-video/03-record-mobile.mjs      # mobil görünüm
node scripts/demo-video/04-record-technical.mjs   # RabbitMQ, Grafana, Jaeger, Swagger
node scripts/demo-video/05-build-cards.mjs        # açılış/kapanış kartları (TR+EN)
node scripts/demo-video/06-build-captions.mjs     # her sahne için alt yazı PNG'leri (TR+EN)
node scripts/demo-video/07-assemble.mjs           # normalize + altyazı overlay + birleştirme -> final mp4'ler
```

İlk dört script `docs/demo-video/raw/` altına ham `.webm`/`.mp4` kayıtları
yazar; `04-record-technical.mjs`'teki Jaeger trace URL'si, önceden bulunmuş
gerçek bir trace ID'sine sabit — yeniden çalıştırırken güncel bir trace ID
bulmak isterseniz `http://localhost:16686/api/traces?service=api-gateway&operation=POST`
uç noktasını sorgulayıp `scripts/demo-video/04-record-technical.mjs`'teki
`JAEGER_TRACE_URL`'i güncelleyin.

Sahne sırası, dosya adları ve iki dildeki alt yazı metinleri tek bir yerde,
[`scenes.mjs`](scenes.mjs)'te tutuluyor — yeni bir sahne eklemek için orayı
ve ilgili kayıt script'ini güncellemek yeterli.

`docs/demo-video/` tamamen `.gitignore`'da (büyük ikili dosyalar); bu
klasördeki hiçbir şey commit edilmez, yalnızca bu script'ler edilir.
