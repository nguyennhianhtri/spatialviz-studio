const fs=require('node:fs');
fs.cpSync('.next/static','.next/standalone/.next/static',{recursive:true});
fs.cpSync('public','.next/standalone/public',{recursive:true});
console.log('Standalone assets prepared.');
