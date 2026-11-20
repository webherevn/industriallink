/**
 * Go escape thua trong regex character class (no-useless-escape).
 *
 * Rule: ben trong `[...]`, chi can escape cac ky tu dac biet cua regex
 * (`]`, `\`, `^`, `-` o dau/cuoi). `\/` va `\-` o giua la thua.
 */
const fs = require('node:fs');
const path = require('node:path');

const FILES = [
  'src/modules/ai/providers/llm-job-parse-technical.util.ts',
  'src/modules/ai/providers/llm-job-parse.util.ts',
  'src/modules/ai/providers/llm-parse.util.ts',
  'src/modules/candidate/cv-draft-from-text.ts',
  'src/modules/recruitment/matching.util.ts',
];

let total = 0;

for (const rel of FILES) {
  const file = path.resolve(rel);
  if (!fs.existsSync(file)) {
    console.log(`SKIP (khong ton tai): ${rel}`);
    continue;
  }
  const src = fs.readFileSync(file, 'utf8');

  const out = src.replace(/\[[^\]\n]*\]/g, (cls) => {
    if (!/\\/.test(cls)) return cls;
    let next = cls;
    next = next.replace(/\\([/-])/g, (m, ch, offset, full) => {
      const isFirst = offset === 1;
      const isLast = offset + 2 === full.length;
      // `-` o dau/cuoi class van can escape (de khong bi hieu la range).
      if (ch === '-' && (isFirst || isLast)) return m;
      return ch;
    });
    return next;
  });

  if (out !== src) {
    fs.writeFileSync(file, out, 'utf8');
    console.log(`FIXED: ${rel}`);
    total += 1;
  } else {
    console.log(`OK (khong doi): ${rel}`);
  }
}

console.log(`\nDa xu ly ${total}/${FILES.length} file.`);
