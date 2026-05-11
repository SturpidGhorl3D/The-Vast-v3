import fs from 'fs';

const p = './components/ui/species-editor/SpeciesEditor.tsx';
let txt = fs.readFileSync(p, 'utf-8');

txt = txt.replace('ctx.lineWidth = 2;\n              ctx.strokeStyle = \'rgba(59, 130, 246, 0.8)\';', 'ctx.lineWidth = 1;\n              ctx.strokeStyle = \'rgba(59, 130, 246, 0.8)\';');
txt = txt.replace('ctx.moveTo(nx + 4, ny);\n                  ctx.arc(nx, ny, 4, 0, Math.PI * 2);', 'ctx.moveTo(nx + 2, ny);\n                  ctx.arc(nx, ny, 2, 0, Math.PI * 2);');
txt = txt.replace('ctx.arc(part.anchorX, part.anchorY, 6, 0, Math.PI * 2);\n               ctx.fillStyle = \'#10b981\';', 'ctx.arc(part.anchorX, part.anchorY, 3, 0, Math.PI * 2);\n               ctx.fillStyle = \'#10b981\';');
txt = txt.replace('ctx.lineWidth = 2;\n               ctx.stroke();\n               \n               const prevFont = ctx.font;', 'ctx.lineWidth = 1;\n               ctx.stroke();\n               \n               const prevFont = ctx.font;');

fs.writeFileSync(p, txt);
console.log("Replaced");
