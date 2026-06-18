const fs = require('fs');
const file = 'client/src/platforms/comunicaciones/pages/Webmail.jsx';
let content = fs.readFileSync(file, 'utf8');

const helper = `
// Helper para permisos granulares de IA
const checkAIAccess = () => {
    const u = JSON.parse(localStorage.getItem('platform_user') || sessionStorage.getItem('platform_user') || '{}');
    const r = String(u.role || '').toLowerCase();
    return ['system_admin', 'ceo', 'ceo_genai', 'admin', 'gerencia'].includes(r);
};
`;

if (!content.includes('const checkAIAccess')) {
    content = content.replace(
        "const API_URL = require('../../config/config').API_URL;",
        "const API_URL = require('../../config/config').API_URL;\n" + helper
    );
}

// 1. SignatureManager: Hide AI button
// The button has "✨ Generar con IA". We can conditionally render the parent div of that button.
const sigButtonArea = `className="w-full flex-1 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition shadow shadow-indigo-200"`;
const newSigButtonArea = `className={\`w-full flex-1 py-3 \${!checkAIAccess() ? 'hidden' : ''} bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition shadow shadow-indigo-200\`}`;
content = content.replace(sigButtonArea, newSigButtonArea);

// Also hide the prompt box
const promptBox = `<textarea\n                                        value={aiPrompt}`;
const newPromptBox = `{checkAIAccess() && <textarea\n                                        value={aiPrompt}`;
content = content.replace(promptBox, newPromptBox);
// close the conditional rendering for the textarea block (which includes the button)
// Actually, it's easier to just hide the whole "Generar con IA" tab in SignatureManager
const aiTabBtn = `<button onClick={() => setSigTab('ai')} className={\`flex-1 py-3 text-sm font-semibold border-b-2 transition \${sigTab === 'ai' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}\`}>✨ Asistente IA</button>`;
const newAiTabBtn = `{checkAIAccess() && <button onClick={() => setSigTab('ai')} className={\`flex-1 py-3 text-sm font-semibold border-b-2 transition \${sigTab === 'ai' ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}\`}>✨ Asistente IA</button>}`;
content = content.replace(aiTabBtn, newAiTabBtn);

// 2. ComposeModal: Hide GenAI Assistant
const genAIButton = `<button type="button" onClick={() => setShowAiBox(!showAiBox)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition">`;
const newGenAIButton = `{checkAIAccess() && <button type="button" onClick={() => setShowAiBox(!showAiBox)} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition">`;
content = content.replace(genAIButton, newGenAIButton);

// Close tag for GenAI Button
content = content.replace(
    `<Sparkles size={14} /> GENAI ASSISTANT\n                                    </button>`,
    `<Sparkles size={14} /> GENAI ASSISTANT\n                                    </button>}`
);

// 3. EmailDetail: Hide Agenda IA and Resumir con IA buttons
const aiToolsContainer = `<div className="flex items-center gap-1">\n                    <button onClick={handleExtractMeeting}`;
const newAiToolsContainer = `{checkAIAccess() && <div className="flex items-center gap-1">\n                    <button onClick={handleExtractMeeting}`;
// the container closes after handleSummarize
const afterSummarize = `</button>\n                </div>\n            </div>`;
const newAfterSummarize = `</button>\n                </div>}\n            </div>`;
content = content.replace(aiToolsContainer, newAiToolsContainer);
content = content.replace(afterSummarize, newAfterSummarize);

// 4. EmailDetail: Hide Smart Replies
const smartRepliesArea = `{smartReplies.length > 0 && (\n                            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">`;
const newSmartRepliesArea = `{checkAIAccess() && smartReplies.length > 0 && (\n                            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100">`;
content = content.replace(smartRepliesArea, newSmartRepliesArea);

// Also don't fetch smart replies if not accessible
const fetchSmartReplies = `const res = await fetch(\`\${API_URL}/api/webmail/ai/smart-replies\``;
const newFetchSmartReplies = `if (!checkAIAccess()) return;\n            const res = await fetch(\`\${API_URL}/api/webmail/ai/smart-replies\``;
content = content.replace(fetchSmartReplies, newFetchSmartReplies);

fs.writeFileSync(file, content, 'utf8');
console.log('Frontend restrictions applied');
