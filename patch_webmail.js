const fs = require('fs');

const fileClient = 'client/src/platforms/comunicaciones/pages/Webmail.jsx';
let content = fs.readFileSync(fileClient, 'utf8');

const helperCode = `
const getCurrentUser = () => JSON.parse(localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user') || '{}');
const hasGenAiMailAccess = () => {
    const user = getCurrentUser();
    return user?.permisosModulos?.ai_genai_mail?.ver === true;
};
`;

if (!content.includes('hasGenAiMailAccess')) {
    content = content.replace("const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5003';", "const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5003';\n" + helperCode);
}

// 1. In ComposeModal, hide GenAI Assistant Sidebar Toggle
content = content.replace(/\{.*?GenAI Assistant[\s\S]*?Ocultar.*?Abrir.*?\}/g, (match) => {
    if (match.includes('hasGenAiMailAccess()')) return match;
    return `{hasGenAiMailAccess() && (\n${match}\n)}`;
});

// 2. In ComposeModal, hide AI Sidebar entirely
content = content.replace(/\{.*?showAISidebar \?.*?GenAI[\s\S]*?Redacción Inteligente[\s\S]*?<\/div>[\s\S]*?<\/div>/g, (match) => {
    if (match.includes('hasGenAiMailAccess()')) return match;
    return `{hasGenAiMailAccess() && (\n${match}\n)}`;
});

// 3. In EmailDetail View, hide "Resumir con IA" and Smart Replies
// The component is const EmailDetail = ({...
// "Resumir con IA"
content = content.replace(/<button[^>]*onClick=\{generateSummary\}[^>]*>[\s\S]*?Resumir con IA[\s\S]*?<\/button>/g, (match) => {
    return `{hasGenAiMailAccess() && (\n${match}\n)}`;
});

// "Smart Replies"
content = content.replace(/\{smartReplies\.length > 0 && \([\s\S]*?Respuestas Sugeridas[\s\S]*?\}\)/g, (match) => {
    return `{hasGenAiMailAccess() && (\n${match}\n)}`;
});

fs.writeFileSync(fileClient, content);
console.log("Webmail patched.");
