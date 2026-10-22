const fs = require('fs');
const path = require('path');

// FIXED PATH - go up one level
const qFolder = path.join(__dirname, '../questions');
const files = fs.readdirSync(qFolder).filter(f => f.endsWith('.csv') &&!f.includes('.clean') &&!f.includes('.errors'));

let totalRemoved = 0;

files.forEach(fileName => {
  const filePath = path.join(qFolder, fileName);
  let content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n').filter(l => l.trim()!== '');
  if (lines.length < 2) return;

  let header = lines[0];
  let seen = new Set();
  let uniqueLines = [header];
  let dup = 0;

  for (let i = 1; i < lines.length; i++) {
    let line = lines[i];
    let cols = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    let key = (cols[0] || '').replace(/^"|"$/g, '').trim().toLowerCase();

    if (!key) {
      dup++; continue;
    }
    if (seen.has(key)) {
      dup++; continue;
    }
    seen.add(key);
    uniqueLines.push(line);
  }

  if (dup > 0) {
    fs.writeFileSync(filePath, uniqueLines.join('\n') + '\n');
    console.log(`✅ ${fileName}: ${lines.length-1} -> ${uniqueLines.length-1} | removed ${dup}`);
    totalRemoved += dup;
  } else {
    console.log(`✓ ${fileName}: ${lines.length-1} clean, no dup`);
  }
});

// Also auto-delete duplicate mathematics.csv if maths.csv exists
const mathsPath = path.join(qFolder, 'maths.csv');
const mathematicsPath = path.join(qFolder, 'mathematics.csv');
if (fs.existsSync(mathsPath) && fs.existsSync(mathematicsPath)) {
  console.log(`\n⚠️ Found both maths.csv and mathematics.csv - merging into maths.csv`);
  let mathsContent = fs.readFileSync(mathsPath, 'utf8');
  let mathContent = fs.readFileSync(mathematicsPath, 'utf8');
  let combined = mathsContent.trim() + '\n' + mathContent.split('\n').slice(1).join('\n');
  fs.writeFileSync(mathsPath, combined);
  fs.unlinkSync(mathematicsPath);
  console.log(`Deleted mathematics.csv, merged into maths.csv - run script again to dedupe merged file`);
}

console.log(`\n👑 DONE: Total duplicates removed: ${totalRemoved}`);
console.log(`Now restart server: node index.js`);