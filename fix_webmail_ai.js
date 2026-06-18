const fs = require('fs');
const file = 'client/src/platforms/comunicaciones/pages/Webmail.jsx';
let content = fs.readFileSync(file, 'utf8');

// Fix CC
const oldCcState = "cc: replyTo && !replyTo.isForward ? replyTo.cc || '' : '',";
const newCcState = "cc: replyTo && !replyTo.isForward ? (Array.isArray(replyTo.cc) ? replyTo.cc.map(c => c.address).join(', ') : (replyTo.cc || '')) : '',";
content = content.replace(oldCcState, newCcState);

// Fix AI payload
const oldAiCall = `                    instruction: promptToUse, 
                    originalText: replyTo ? (replyTo.textBody || replyTo.htmlBody) : null 
                }) `;
const newAiCall = `                    instruction: promptToUse, 
                    originalText: replyTo ? (replyTo.textBody || replyTo.htmlBody) : null,
                    responderName: currentAccount?.displayName,
                    responderEmail: currentAccount?.email
                }) `;
content = content.replace(oldAiCall, newAiCall);

fs.writeFileSync(file, content, 'utf8');
console.log('Webmail.jsx AI call and CC fixed.');
