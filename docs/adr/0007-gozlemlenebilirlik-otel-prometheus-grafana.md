# ADR-0007: Gözlemlenebilirlik — OpenTelemetry + Prometheus + Grafana

**Durum:** Kabul edildi

## Bağlam

Dört servisli (gateway + 3) ve olay güdümlü bir sistemde, bir isteğin
gateway'den hangi servislere uğradığını ve ne kadar sürdüğünü görmek,
loglara bakarak (`X-Request-Id` ile bile) zaman alıcı. Ayrıca servislerin
anlık sağlığı/yükü (istek hızı, hata oranı, RabbitMQ kuyruk derinliği) için
log taraması değil, metrik ve panel gerekiyor.

## Karar

Her dört backend servisine OpenTelemetry auto-instrumentation eklendi,
`node -r ./dist/tracing.js` ile (bir `import` değil — auto-instrumentation
modülleri, require edildikleri anda diğer modülleri yamalıyor; bir `import`
olarak eklenseydi bazı modüller zaten yüklenmiş olabilirdi). Testler ve
`npm run dev` bilerek bu girişten geçmiyor. Trace'ler Jaeger'a, metrikler
(`prom-client`, route şablonuyla etiketli) Prometheus'a gidiyor;
notification-service ayrıca RabbitMQ kuyruk derinliğini ayrı bir bağlantıyla
ölçüyor (ana consumer'ın kanalını riske atmamak için). Grafana, bu iki
kaynağa önceden yapılandırılmış bir panelle geliyor — kurulumdan sonra elle
bir şey ayarlamaya gerek yok.

## Sonuçlar

**Artı:**
- Gateway'den auth-service'e uzanan gerçek bir isteğin trace'i Jaeger'da
  uçtan uca görülebiliyor; hangi servisin/adımın gecikmeye sebep olduğu
  anında anlaşılıyor.
- `/metrics` her serviste var, rate limitten önce (bir Prometheus taramasının
  429 almaması için) — bkz. ADR-0008.
- Grafana paneli `docker compose up`'tan hemen sonra veriyle çalışıyor,
  ekstra kurulum adımı yok.

**Eksi:**
- `-r` ile yükleme, auto-instrumentation'ın neden bir `import` olmadığını
  bilmeyen birine şaşırtıcı gelebilir (koddaki yorumla belgelendi).
- Testler ve `npm run dev` tracing'den geçmiyor; bu, prod'daki gerçek
  davranışla yerel geliştirme/test davranışı arasında kasıtlı bir fark —
  tracing'in test çıktısını kirletmesini/yavaşlatmasını istemedik.
