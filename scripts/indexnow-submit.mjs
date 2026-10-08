// Posts the URLs in indexnow-urls.json to the IndexNow API after deploy.
import { readFileSync } from 'node:fs';

const key = process.env.INDEXNOW_KEY;
const urlList = JSON.parse(readFileSync('indexnow-urls.json', 'utf8'));
if (!urlList.length) {
  console.log('indexnow: nothing changed, no ping');
  process.exit(0);
}
for (let i = 0; i < urlList.length; i += 10000) {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      host: 'pickyourrow.com',
      key,
      keyLocation: `https://pickyourrow.com/${key}.txt`,
      urlList: urlList.slice(i, i + 10000),
    }),
  });
  console.log(`indexnow: submitted ${urlList.slice(i, i + 10000).length}, HTTP ${res.status}`);
}
