# Demo videosu üretim pipeline'ı

`docs/demo-video/final/` altına iki dilde (TR/EN altyazılı) bir tanıtım
videosu üretir: `randevia-demo-tr.mp4` ve `randevia-demo-en.mp4` (1920x1080,
60fps, ~2:30, özgün bir arka plan müziğiyle). Uygulamanın arayüzü her zaman
Türkçe kalır — yalnızca alt yazı metni dile göre değişir (gerçek bir filmin
altyazısı gibi).

Yerelde `k6`/`ffmpeg`/ses aracı kurulu olması gerekmez: ffmpeg, Docker imajı
(`mwader/static-ffmpeg`) üzerinden `lib/ffmpeg.mjs` ile çağrılır; müzik saf
Node.js ile sentezlenir (bkz. `08-generate-music.mjs`). Tarayıcı olarak
`web/`'in zaten indirdiği Playwright Chromium'u kullanılır (`lib/browser.mjs`,
`web/node_modules/playwright`'a göreli import yapar).

## Altyazılar nasıl senkronize ediliyor

Her kayıt script'i, eylemi anlatan Türkçe/İngilizce metni **gerçek zamanlı**
olarak `timeline.log(tr, en)` ile loglar (bkz. `lib/timeline.mjs`) — zaman
damgası, o sahnenin kaydı başladığı andan (Playwright context'i oluşturulduğu
an, video dosyasının 0. saniyesiyle aynı an) itibaren geçen gerçek süredir.
`07-assemble.mjs` her olayı, bir sonraki olayın zaman damgasına kadar (veya
sahne bitimine kadar) ekranda tutan bir altyazı penceresine çevirir — bu
yüzden altyazılar asla üst üste binmez ve ekrandaki hareketle gerçekten
senkronizedir (tahmini zamanlama değil). Kayıt script'lerinde bir eylemi
anlatan `timeline.log(...)` çağrısı her zaman o eylemden **önce** gelir
(örn. tıklamadan önce), sonra değil — aksi hâlde altyazı, eylem zaten
bittikten sonra görünür.

## Akıcılık (60fps)

Bu ortamda gerçek daha yüksek kare hızıyla kayıt denendi (CDP
`Page.startScreencast` ve sıkı bir `page.screenshot()` döngüsü) ama ikisi de
~25-28fps'te tavan yaptı — Playwright'ın kendi `recordVideo`'sundan farksız.
Bunun yerine her sahne `ffmpeg`'in `minterpolate=fps=60:mi_mode=blend` filtresiyle
60fps'e yeniden örnekleniyor (bkz. `07-assemble.mjs`), fare hareketleri ve
kaydırmalar `lib/browser.mjs`'te çok sayıda küçük adımla ve easing ile
yapılıyor. `mi_mode=blend` (çapraz çözünürlük), tam hareket telafili
`mi_mode=mci`'den kasıtlı olarak tercih edildi: çok daha hızlı ve ekrandaki
en sık hareket eden şey (imleç, metin) etrafında çarpıtma riski yok.

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
node scripts/demo-video/05-build-cards.mjs        # açılış/kapanış kartları (TR+EN), 60fps
node scripts/demo-video/06-build-captions.mjs     # her loglanmış olay için alt yazı PNG'leri (TR+EN)
node scripts/demo-video/07-assemble.mjs           # 60fps + altyazı pencereleri + 0.7s crossfade + müzik -> final mp4'ler
node scripts/demo-video/08-generate-music.mjs     # (yalnızca müziği yeniden üretmek isterseniz; 07 zaten raw/music.wav'ı kullanır)
```

İlk dört script `docs/demo-video/raw/` altına ham `.webm`/`.mp4` kayıtları,
her biri için de `<id>-events.json` (zaman damgalı alt yazı olayları) yazar.
`04-record-technical.mjs`, Jaeger'daki **güncel** bir multi-servis trace'i
Jaeger'ın kendi API'sinden sorgulayarak bulur (sabit bir trace ID kullanmaz),
bu yüzden diğer sahnelerden sonra çalıştırılmalı.

`08-generate-music.mjs` çalıştırılmadıysa veya `raw/music.wav` yoksa önce onu
çalıştırın — kurumsal/sakin bir I-V-vi-IV (C majör, ~96 BPM) ilerlemesi
üstüne pad + piyano benzeri arpej + bas + çok hafif bir ritim katmanı,
basit bir Schroeder yankısıyla, saf Node.js matematiğiyle (örnek/numune
tabanlı sentez, dış bağımlılık yok) üretir. `07-assemble.mjs` bunu gerçek
video süresine kırpıp başta/sonda yumuşak geçişle (fade) ve düşük seviyede
(`volume=0.32`) videonun tek ses parçası olarak ekler.

Sahne sırası ve dosya adları tek bir yerde, [`scenes.mjs`](scenes.mjs)'te
tutuluyor — yeni bir sahne eklemek için orayı, ilgili kayıt script'ini ve
`07-assemble.mjs`'teki `RAW_FILES` eşlemesini güncellemek yeterli.

`docs/demo-video/` tamamen `.gitignore`'da (büyük ikili dosyalar); bu
klasördeki hiçbir şey commit edilmez, yalnızca bu script'ler edilir.
