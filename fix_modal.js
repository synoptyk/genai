const fs = require('fs');
const file = 'client/src/platforms/comunicaciones/pages/Webmail.jsx';
let content = fs.readFileSync(file, 'utf8');

const startMarker = '{/* Render builder modal when open */}';
const endMarker = '                )}';
const afterEndMarker = '                <div className="w-px h-4 bg-slate-200 mx-1" />';

const startIndex = content.indexOf(startMarker);
const afterEndIndex = content.indexOf(afterEndMarker, startIndex);
// The block ends at afterEndIndex. We want to extract from startIndex to afterEndIndex (excluding it).

const blockToExtract = content.substring(startIndex, afterEndIndex);

// Remove the block from its current location
content = content.slice(0, startIndex) + content.slice(afterEndIndex);

// Find the end of the RichTextEditor component
const targetPointStr = `            />\n        </div>\n    );\n};`;
const targetIndex = content.indexOf(targetPointStr);

if (startIndex === -1 || targetIndex === -1) {
    console.error('Could not find markers');
    process.exit(1);
}

// Insert the block right before targetPointStr
content = content.slice(0, targetIndex) + blockToExtract + '\n' + content.slice(targetIndex);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully moved the modal out of the z-10 Toolbar.');
