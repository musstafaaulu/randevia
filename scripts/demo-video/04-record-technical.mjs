import { recordScene } from './lib/record.mjs';
import { humanClick, humanMove } from './lib/browser.mjs';

// Picks a real, fresh multi-service trace instead of a hardcoded id that
// ages out of Jaeger's retention: finds the most recent api-gateway POST
// trace that also touched appointment-service (a real booking request).
async function findRecentTraceUrl() {
  const res = await fetch('http://localhost:16686/api/traces?service=api-gateway&operation=POST&limit=20');
  const { data } = await res.json();
  for (const trace of data) {
    const services = new Set(Object.values(trace.processes).map((p) => p.serviceName));
    if (services.has('appointment-service')) {
      return `http://localhost:16686/trace/${trace.traceID}`;
    }
  }
  return data[0] ? `http://localhost:16686/trace/${data[0].traceID}` : null;
}

async function main() {
  const jaegerTraceUrl = await findRecentTraceUrl();
  if (!jaegerTraceUrl) throw new Error('No recent api-gateway trace found in Jaeger - run the other scenes first.');

  await recordScene(
    '06-teknik',
    async (page, _context, timeline) => {
      // RabbitMQ management - queues with real traffic.
      await page.goto('http://localhost:15672/#/queues');
      await page.waitForSelector('input[name="username"]', { timeout: 10_000 });
      await page.locator('input[name="username"]').fill('guest');
      await page.locator('input[name="password"]').fill('guest');
      await humanClick(page, page.locator('input[type="submit"]'));
      await page.waitForTimeout(1200);
      await page.waitForSelector('table.list', { timeout: 10_000 }).catch(() => {});
      timeline.log(
        'Randevu olayı RabbitMQ üzerinden Notification Service’e iletiliyor',
        'The appointment event is relayed to the Notification Service through RabbitMQ',
      );
      await humanMove(page, 960, 400);
      await page.waitForTimeout(3200);

      // Grafana dashboard with live data.
      await page.goto('http://localhost:3001/login');
      await page.locator('input[name="user"]').fill('admin');
      await page.locator('input[name="password"]').fill('admin');
      await humanClick(page, page.getByRole('button', { name: 'Log in' }));
      await page.waitForTimeout(1000);
      const skip = page.getByRole('button', { name: /skip/i });
      if (await skip.isVisible().catch(() => false)) await skip.click();
      await page.goto('http://localhost:3001/d/randevia-overview/randevia?orgId=1&from=now-1h&to=now&kiosk');
      await page.waitForTimeout(2500);
      timeline.log(
        "Grafana'da servislerin gerçek zamanlı metrikleri",
        "Grafana shows the services' real-time metrics",
      );
      await humanMove(page, 900, 500);
      await page.waitForTimeout(3200);

      // Jaeger - a real multi-service trace from this demo session.
      await page.goto(jaegerTraceUrl);
      await page.waitForTimeout(1600);
      timeline.log(
        "Jaeger'da bir isteğin gateway'den appointment-service'e uzanan yolculuğu",
        "Jaeger traces a single request's journey from the gateway to appointment-service",
      );
      await humanMove(page, 700, 400);
      await page.waitForTimeout(3400);

      // Swagger / OpenAPI docs.
      await page.goto('http://localhost:3000/api/docs');
      await page.waitForTimeout(1200);
      timeline.log(
        "Swagger'da tüm API uç noktalarının canlı dokümantasyonu",
        'Swagger documents every API endpoint live',
      );
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(3200);
    },
    { baseURL: 'http://localhost:8080' },
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
