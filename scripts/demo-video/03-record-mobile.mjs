import { recordScene } from './lib/record.mjs';
import { humanClick, humanType } from './lib/browser.mjs';

const PATIENT = { email: 'hasta@randevia.local', password: 'Demo12345!' };
const MOBILE_VIEWPORT = { width: 390, height: 844 };

async function main() {
  await recordScene(
    '04b-mobil',
    async (page) => {
      await page.goto('/giris');
      await page.waitForTimeout(600);
      await humanType(page, page.getByLabel('E-posta'), PATIENT.email);
      await humanType(page, page.getByLabel('Şifre'), PATIENT.password);
      await humanClick(page, page.getByRole('button', { name: 'Giriş Yap' }));
      await page.waitForURL('**/doktorlar');
      await page.waitForTimeout(1200);

      await humanClick(page, page.getByRole('button', { name: 'Menüyü aç/kapat' }));
      await page.waitForTimeout(1800);
      await humanClick(page, page.getByRole('button', { name: 'Menüyü aç/kapat' }));
      await page.waitForTimeout(800);

      await page.mouse.wheel(0, 300);
      await page.waitForTimeout(1500);
    },
    { viewport: MOBILE_VIEWPORT },
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
