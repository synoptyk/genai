const fs = require('fs');
const file = 'client/src/platforms/comunicaciones/pages/Webmail.jsx';
let content = fs.readFileSync(file, 'utf8');

const helper = `
// Helper para permisos granulares de IA
const getCurrentUser = () => JSON.parse(localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user') || '{}');
const hasGenAiMailAccess = () => {
    const user = getCurrentUser();
    return user?.permisosModulos?.ai_genai_mail?.ver === true;
};
`;

if (!content.includes('const hasGenAiMailAccess')) {
    content = content.replace(
        "const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5003';",
        "const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5003';\n" + helper
    );
}

// Mobile AI Sidebar Toggle (in EmailCompose or ComposeModal)
// Find something like: <div className="md:hidden px-4 py-3 bg-indigo-50/50 border-t border-indigo-100/50
content = content.replace(
    /<div className="md:hidden px-4 py-3 bg-indigo-50\/50 border-t border-indigo-100\/50[\s\S]*?Ocultar.*?Abrir[\s\S]*?<\/div>/,
    (match) => {
        if (match.includes('hasGenAiMailAccess()')) return match;
        return `{hasGenAiMailAccess() && (\n${match}\n)}`;
    }
);

// AI Sidebar desktop block
// It typically starts with something like: <div className={`${showAISidebar ? 'flex absolute inset-x-0
content = content.replace(
    /<div className=\{\`\$\{showAISidebar \? 'flex absolute inset-x-0[\s\S]*?Redactando\.\.\.' : 'Generar Borrador'\}[\s\S]*?<\/button>[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<\/div>/,
    (match) => {
        if (match.includes('hasGenAiMailAccess()')) return match;
        return `{hasGenAiMailAccess() && (\n${match}\n)}`;
    }
);

// EmailDetail Resumir con IA
// <button onClick={handleSummarize} ... > Resumir con IA </button>
content = content.replace(
    /<button[^>]*onClick=\{handleSummarize\}[^>]*>[\s\S]*?Resumir con IA[\s\S]*?<\/button>/,
    (match) => {
        if (match.includes('hasGenAiMailAccess()')) return match;
        return `{hasGenAiMailAccess() && (\n${match}\n)}`;
    }
);

// EmailDetail Smart Replies
// {smartReplies.length > 0 && (
content = content.replace(
    /\{smartReplies\.length > 0 && \([\s\S]*?Respuestas Sugeridas[\s\S]*?\}\)/,
    (match) => {
        if (match.includes('hasGenAiMailAccess()')) return match;
        return `{hasGenAiMailAccess() && (\n${match}\n)}`;
    }
);

fs.writeFileSync(file, content, 'utf8');
console.log('Frontend granular permissions applied to Webmail.jsx');
