const fs = require('fs');
const file = 'server/platforms/comunicaciones/webmailRoutes.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/router\.post\('\/ai\/signature', protect, authorize\('social_webmail'\)/g, "router.post('/ai/signature', protect, authorize('solo_altos_mandos')");
content = content.replace(/router\.post\('\/ai\/summarize', protect, authorize\('social_webmail'\)/g, "router.post('/ai/summarize', protect, authorize('solo_altos_mandos')");
content = content.replace(/router\.post\('\/ai\/draft', protect, authorize\('social_webmail'\)/g, "router.post('/ai/draft', protect, authorize('solo_altos_mandos')");
content = content.replace(/router\.post\('\/ai\/smart-replies', protect, authorize\('social_webmail'\)/g, "router.post('/ai/smart-replies', protect, authorize('solo_altos_mandos')");
content = content.replace(/router\.post\('\/ai\/extract-meeting', protect, authorize\('social_webmail'\)/g, "router.post('/ai/extract-meeting', protect, authorize('solo_altos_mandos')");

fs.writeFileSync(file, content, 'utf8');
console.log('Backend restrictions applied');
