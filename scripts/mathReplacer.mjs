import fs from 'fs';

const p = './components/ui/species-editor/SpeciesEditor.tsx';
let txt = fs.readFileSync(p, 'utf-8');

txt = txt.replace(/anchorX:\s*([\d.]+)/g, (match, val) => {
    return 'anchorX: ' + (parseFloat(val) > 2 ? (parseFloat(val)/100).toFixed(2) : val);
});
txt = txt.replace(/anchorY:\s*([\d.]+)/g, (match, val) => {
     return 'anchorY: ' + (parseFloat(val) > 2 ? (parseFloat(val)/100).toFixed(2) : val);
});
txt = txt.replace(/attachX:\s*([\d.]+)/g, (match, val) => {
     return 'attachX: ' + (parseFloat(val) > 2 ? (parseFloat(val)/100).toFixed(2) : val);
});
txt = txt.replace(/attachY:\s*([\d.]+)/g, (match, val) => {
     return 'attachY: ' + (parseFloat(val) > 2 ? (parseFloat(val)/100).toFixed(2) : val);
});

fs.writeFileSync(p, txt);
console.log("Replaced!");
