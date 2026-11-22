import { recordScene } from './lib/record.mjs';
import { humanClick, humanMove } from './lib/browser.mjs';

const JAEGER_TRACE_URL = 'http://localhost:16686/trace/279af4cbdce910bda68b72bbd469335c';

async function main() {
  await recordScene(
    '06-teknik',
    async (page) => {
      // RabbitMQ management - queues with real traffic.
      await page.goto('http://localhost:15672/#/queues');
      await page.waitForSelector('input[name="username"]', { timeout: 10_000 });
      await page.locator('input[name="username"]').fill('guest');
      await page.locator('input[name="password"]').fill('guest');
      await humanClick(page, page.locator('input[type="submit"]'));
      await page.waitForTimeout(1500);
      await page.waitForSelector('table.list', { timeout: 10_000 }).catch(() => {});
      await humanMove(page, 960, 400);
      await page.waitForTimeout(2800);

      // Grafana dashboard with live data.
      await page.goto('http://localhost:3001/login');
      await page.locator('input[name="user"]').fill('admin');
      await page.locator('input[name="password"]').fill('admin');
      await humanClick(page, page.getByRole('button', { name: 'Log in' }));
      await page.waitForTimeout(1000);
      const skip = page.getByRole('button', { name: /skip/i });
      if (await skip.isVisible().catch(() => false)) await skip.click();
      await page.goto('http://localhost:3001/d/randevia-overview/randevia?orgId=1&from=now-1h&to=now&kiosk');
      await page.waitForTimeout(3000);
      await humanMove(page, 900, 500);
      await page.waitForTimeout(2800);

      // Jaeger - a real multi-service trace from this demo session.
      await page.goto(JAEGER_TRACE_URL);
      await page.waitForTimeout(2000);
      await humanMove(page, 700, 400);
      await page.waitForTimeout(3000);

      // Swagger / OpenAPI docs.
      await page.goto('http://localhost:3000/api/docs');
      await page.waitForTimeout(1800);
      await page.mouse.wheel(0, 500);
      await page.waitForTimeout(2500);
    },
    { baseURL: 'http://localhost:8080' },
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
