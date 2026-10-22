const fs = require('fs');
const path = require('path');

function findCsvs(dir, files=[]) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const full = path.join(dir, item);
    if (fs.statSync(full).isDirectory() && !item.startsWith('node_modules') && !item.startsWith('.')) {
      findCsvs(full, files);
    } else if (item.endsWith('.csv')) {
      files.push(full);
    }
  }
  return files;
}

const root = path.join(__dirname, '..'); // search jamb-2go root + server
const allCsvs = [...findCsvs(__dirname), ...findCsvs(root)];

console.log(`Found ${allCsvs.length} CSV files:`);
allCsvs.forEach(f=>console.log(' -', f));

if(allCsvs.length===0){
  console.log('❌ No CSV found! Where you put your subject csvs? Check folder name.');
  process.exit(0);
}

let totalRemoved = 0;

allCsvs.forEach(fullPath => {
  let content = fs.readFileSync(fullPath, 'utf8');
  let lines = content.split(/\r?\n/);
  if(lines.length < 2) return;

  const header = lines[0];
  const originalCount = lines.length - 1;

  const cleaned = lines.filter((line, idx)=>{
    if(idx===0) return true;
    if(!line.trim()) return false;
    const lower = line.toLowerCase();
    const cols = line.split(',');
    const q = (cols[0]||'').trim().toLowerCase();
    const optA = (cols[1]||'').trim().toLowerCase();
    
    if(q==='question_text' || q==='"question_text"' || q==='') return false;
    if(optA==='option_a' || optA==='"option_a"') return false;
    if(line.includes('question_text,option_a,option_b')) return false;
    if(lower.startsWith('question_text,')) return false;
    if(q.length < 8) return false;
    return true;
  });

  const removed = originalCount - (cleaned.length - 1);
  totalRemoved+=removed;

  if(removed>0){
    fs.writeFileSync(fullPath, cleaned.join('\n'), 'utf8');
    console.log(`✅ ${path.basename(fullPath)}: removed ${removed} | ${originalCount} -> ${cleaned.length-1}`);
  } else {
    console.log(`✔️ ${path.basename(fullPath)} clean (${originalCount})`);
  }
});

console.log(`\n🔥 DONE: Total ugly rows removed: ${totalRemoved}`);