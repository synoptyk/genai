const fs = require('fs');
const file = fs.readFileSync('client/src/platforms/prevencion/pages/PrevDashboard.jsx', 'utf8');

const icons = ['ShieldAlert', 'CheckCircle2', 'Users', 'Activity', 'Bell', 'Calendar', 'MapPin', 'ArrowUpRight', 'ArrowDownRight', 'Trophy', 'Zap', 'LayoutDashboard'];

let unused = [];
icons.forEach(icon => {
  const regex = new RegExp(`\\b${icon}\\b`, 'g');
  const matches = file.match(regex);
  if (matches && matches.length === 1) {
    unused.push(icon);
  }
});

console.log("Unused icons in PrevDashboard:", unused);

const file2 = fs.readFileSync('client/src/components/InternationalInput.jsx', 'utf8');
const icons2 = ['Smartphone', 'Globe'];
unused = [];
icons2.forEach(icon => {
  const regex = new RegExp(`\\b${icon}\\b`, 'g');
  const matches = file2.match(regex);
  if (matches && matches.length === 1) {
    unused.push(icon);
  }
});
console.log("Unused icons in InternationalInput:", unused);

