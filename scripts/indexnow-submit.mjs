// Posts the URLs in indexnow-urls.json to the IndexNow API after deploy.
// GitHub Pages can answer 403 from IndexNow until the key file has propagated,
// so a non-success response is retried. 200 or 202 is success.
import { readFileSync } from 'node:fs';

const key = process.env.INDEXNOW_KEY;
const urlList = JSON.parse(readFileSync('indexnow-urls.json', 'utf8'));
if (!urlList.length) {
  console.log('indexnow: nothing changed, no ping');
  process.exit(0);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const keyLocation = `https://pickyourrow.com/${key}.txt`;
const attempts = 6;

let failed = false;
for (let i = 0; i < urlList.length; i += 10000) {
  const batch = urlList.slice(i, i + 10000);
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: 'pickyourrow.com',
        key,
        keyLocation,
        urlList: batch,
      }),
    });
    const detail = (await res.text()).trim();
    console.log(
      `indexnow: submitted ${batch.length}, HTTP ${res.status}${detail ? ` ${detail.slice(0, 200)}` : ''}`,
    );
    if (res.status === 200 || res.status === 202) break;
    if (attempt === attempts) {
      failed = true;
      break;
    }
    await sleep(20000);
  }
}
if (failed) process.exit(1);
