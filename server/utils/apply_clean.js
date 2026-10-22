const fs=require('fs');const path=require('path');
let dir=path.join(__dirname,'../questions');
let cleans=fs.readdirSync(dir).filter(f=>f.endsWith('.clean.csv'));
cleans.forEach(f=>{
  let original=f.replace('.clean.csv','.csv');
  fs.copyFileSync(path.join(dir,f), path.join(dir,original));
  console.log('Applied '+original);
});
