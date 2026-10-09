import sharp from 'sharp';
const items = [['jacket','#8b5a2b'],['blazer','#7a1f2b'],['tee','#2f5d8a']];
for (const [n,c] of items) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800"><rect width="600" height="800" fill="#f3f1ee"/>
  <path d="M200 120 120 170 70 330 150 350 170 300V700H430V300L450 350 530 330 480 170 400 120Q300 200 200 120Z" fill="${c}" stroke="#0003" stroke-width="4"/></svg>`;
  await sharp(Buffer.from(svg)).jpeg().toFile(`public/demo/${n}.jpg`);
}
