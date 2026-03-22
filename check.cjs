const fs = require('fs');
const lines = fs.readFileSync('src/pages/SimulationPage.tsx', 'utf-8').split('\n');
let stack = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('<main')) stack.push('MAIN:' + i);
  if (line.includes('</main>')) stack.push('/MAIN:' + i);
  
  const opens = (line.match(/<div(\s|>)/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  for (let j=0; j<opens; j++) stack.push(i);
  for (let j=0; j<closes; j++) {
     if (typeof stack[stack.length-1] === 'number') stack.pop();
  }
}
console.log(stack);
