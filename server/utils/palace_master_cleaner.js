const fs = require('fs');
const path = require('path');

const questionsDir = path.join(__dirname, '../questions');
let files = fs.readdirSync(questionsDir).filter(f => f.endsWith('.csv') &&!f.includes('.clean') &&!f.includes('.errors'));

console.log(`Found ${files.length} files: ${files.join(', ')}`);

const monthMap = { Jan:'1', Feb:'2', Mar:'3', Apr:'4', May:'5', Jun:'6', Jul:'7', Aug:'8', Sep:'9', Oct:'10', Nov:'11', Dec:'12' };

function fixExcelDateToFraction(text) {
  let count = 0;
  let newText = text
   .replace(/(\d{1,2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:-\d{2,4})?/gi, (m, d, mon) => {
      count++;
      let key = mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase();
      return `${d}/${monthMap[key]}`;
    })
   .replace(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{1,2})/gi, (m, mon, d) => {
      count++;
      let key = mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase();
      return `${monthMap[key]}/${d}`;
    });
  return { text: newText, count };
}

function isBadSymbols(q) {
  let open = (q.match(/\(/g) || []).length;
  let close = (q.match(/\)/g) || []).length;
  return open!== close;
}

function isNonsense(q) {
  if (!q || q.length < 8) return 'TOO_SHORT';
  if (/^(undefined|null|NaN|error)$/i.test(q.trim())) return 'UNDEFINED';
  if (/[+\-*/^=]\s*$/.test(q.trim())) return 'ENDS_WITH_OPERATOR';
  if (q.includes('∫') &&!/dx|dθ|dy/i.test(q)) return 'INTEGRAL_NO_DX';
  return null;
}

let grandTotal = { scanned:0, kept:0, fixed:0, removed:0 };

for (let fileName of files) {
  let input = path.join(questionsDir, fileName);
  let cleanOut = path.join(questionsDir, fileName.replace('.csv','.clean.csv'));
  let errorOut = path.join(questionsDir, fileName.replace('.csv','.errors.csv'));

  let raw = fs.readFileSync(input, 'utf8');
  let lines = raw.split('\n').filter(l => l.trim());
  let header = lines[0];
  let clean = [header];
  let errors = ['line_number,error_type,content'];
  let seen = new Set();
  let stats = { total:0, kept:0, fixedFrac:0, incomplete:0, badAns:0, dup:0, symbol:0, nonsense:0 };

  for (let i=1; i<lines.length; i++) {
    let line = lines[i];
    stats.total++;
    let fix = fixExcelDateToFraction(line);
    line = fix.text;
    stats.fixedFrac += fix.count;

    let cols = []; let cur='', inQ=false;
    for (let ch of line) {
      if (ch === '"') { inQ =!inQ; cur += ch; }
      else if (ch === ',' &&!inQ) { cols.push(cur); cur=''; }
      else cur += ch;
    }
    cols.push(cur);

    if (cols.length < 6) {
      stats.incomplete++;
      errors.push(`${i},INCOMPLETE,"${line.replace(/"/g,'""')}"`);
      continue;
    }

    let q = cols[0].replace(/^"|"$/g,'').trim();
    let a = cols[1].replace(/^"|"$/g,'').trim();
    let b = cols[2].replace(/^"|"$/g,'').trim();
    let c = cols[3].replace(/^"|"$/g,'').trim();
    let d = cols[4].replace(/^"|"$/g,'').trim();
    let ans = cols[5].replace(/"/g,'').trim().toUpperCase().charAt(0);

    if (!q ||!a ||!b ||!c ||!d) {
      stats.incomplete++;
      errors.push(`${i},EMPTY_FIELD,"${line.replace(/"/g,'""')}"`);
      continue;
    }
    if (!['A','B','C','D'].includes(ans)) {
      stats.badAns++;
      errors.push(`${i},BAD_ANS_${ans},"${line.replace(/"/g,'""')}"`);
      continue;
    }

    let key = q.toLowerCase().replace(/\s+/g,' ').trim();
    if (seen.has(key)) {
      stats.dup++;
      errors.push(`${i},DUPLICATE,"${line.replace(/"/g,'""')}"`);
      continue;
    }
    if (isBadSymbols(q)) {
      stats.symbol++;
      errors.push(`${i},SYMBOL_CLASH,"${line.replace(/"/g,'""')}"`);
      continue;
    }

    let nonsense = isNonsense(q);
    if (nonsense) {
      stats.nonsense++;
      errors.push(`${i},${nonsense},"${line.replace(/"/g,'""')}"`);
      continue;
    }

    seen.add(key);
    clean.push(line);
    stats.kept++;
  }

  fs.writeFileSync(cleanOut, clean.join('\n'));
  fs.writeFileSync(errorOut, errors.join('\n'));

  grandTotal.scanned += stats.total;
  grandTotal.kept += stats.kept;
  grandTotal.fixed += stats.fixedFrac;
  grandTotal.removed += (stats.total - stats.kept);

  console.log(`\n[${fileName}] Scanned:${stats.total} Fixed:${stats.fixedFrac} Kept:${stats.kept} Removed:${stats.total-stats.kept}`);
}

console.log(`\n========== ALL SUBJECTS DONE ==========`);
console.log(`Total scanned: ${grandTotal.scanned}, Fixed: ${grandTotal.fixed}, Kept: ${grandTotal.kept}, Removed: ${grandTotal.removed}`);
console.log(`\nTo apply all clean files, run: node utils/apply_clean.js`);

// Create apply script separately
const applyCode = `const fs=require('fs');const path=require('path');
let dir=path.join(__dirname,'../questions');
let cleans=fs.readdirSync(dir).filter(f=>f.endsWith('.clean.csv'));
cleans.forEach(f=>{
  let original=f.replace('.clean.csv','.csv');
  fs.copyFileSync(path.join(dir,f), path.join(dir,original));
  console.log('Applied '+original);
});
`;
fs.writeFileSync(path.join(__dirname,'apply_clean.js'), applyCode);