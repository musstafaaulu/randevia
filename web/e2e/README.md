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
otomatik başlatır. İki ayrı tarayıcı bağlamı (hasta ve doktor) açar, hasta
gerçek arayüz üzerinden bir randevu alır ve doktorun ekranında sayfa
yenilenmeden bildirim zili ile toast mesajının anlık olarak göründüğünü
doğrular.
