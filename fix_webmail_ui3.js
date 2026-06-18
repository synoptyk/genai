const fs = require('fs');
const file = 'client/src/platforms/comunicaciones/pages/Webmail.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    'const MessageRow = ({ msg, isSelected, isChecked, onToggleCheck, onClick }) => {',
    'const MessageRow = ({ msg, isSelected, isChecked, onToggleCheck, onClick, onMouseEnter }) => {'
);

content = content.replace(
    '        <div onClick={onClick}',
    '        <div onClick={onClick} onMouseEnter={onMouseEnter}'
);

const originalMap = `                                        {filteredMessages.map(msg => (
                                            <MessageRow key={msg.uid} msg={msg}
                                                isSelected={selectedMsg === msg.uid}
                                                isChecked={!!selectedMsgMap[msg.uid]}
                                                onToggleCheck={handleToggleCheck}
                                                onClick={() => openMessage(msg)} />
                                        ))}`;

const newMap = `                                        {filteredMessages.map(msg => (
                                            <MessageRow key={msg.uid} msg={msg}
                                                isSelected={selectedMsg === msg.uid}
                                                isChecked={!!selectedMsgMap[msg.uid]}
                                                onToggleCheck={handleToggleCheck}
                                                onClick={() => openMessage(msg)}
                                                onMouseEnter={() => {
                                                    // Prefetch en background
                                                    if (!msg._prefetchTriggered) {
                                                        msg._prefetchTriggered = true;
                                                        const user = JSON.parse(localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user') || '{}');
                                                        fetch(\`\${API_URL}/api/webmail/message/\${selectedAccount._id}/\${msg.uid}?folder=\${encodeURIComponent(selectedFolder)}\`, {
                                                            headers: { Authorization: \`Bearer \${user.token}\` }
                                                        }).catch(() => {});
                                                    }
                                                }}
                                            />
                                        ))}`;

content = content.replace(originalMap, newMap);

fs.writeFileSync(file, content, 'utf8');
console.log('Prefetch logic added.');
