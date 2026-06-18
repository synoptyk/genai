import React, { useState, useEffect, useRef } from 'react';
import { Search, ArrowLeft, ArrowRight, RotateCw, Home, ExternalLink } from 'lucide-react';

const isElectron = navigator.userAgent.toLowerCase().indexOf(' electron/') > -1;

const InternalBrowser = () => {
  const [url, setUrl] = useState(() => localStorage.getItem('internal_browser_url') || 'https://www.google.com');
  const [inputUrl, setInputUrl] = useState(() => localStorage.getItem('internal_browser_url') || 'https://www.google.com');
  const [loading, setLoading] = useState(false);
  const webviewRef = useRef(null);

  useEffect(() => {
    const webview = webviewRef.current;
    if (webview) {
      const handleLoadCommit = (e) => {
        if (e.isMainFrame) {
          setUrl(e.url);
          setInputUrl(e.url);
          localStorage.setItem('internal_browser_url', e.url);
        }
      };
      const handleStartLoading = () => setLoading(true);
      const handleStopLoading = () => setLoading(false);

      webview.addEventListener('load-commit', handleLoadCommit);
      webview.addEventListener('did-start-loading', handleStartLoading);
      webview.addEventListener('did-stop-loading', handleStopLoading);

      return () => {
        webview.removeEventListener('load-commit', handleLoadCommit);
        webview.removeEventListener('did-start-loading', handleStartLoading);
        webview.removeEventListener('did-stop-loading', handleStopLoading);
      };
    }
  }, []);

  const handleNavigate = (e) => {
    e.preventDefault();
    let finalUrl = inputUrl;
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      if (finalUrl.includes('.') && !finalUrl.includes(' ')) {
        finalUrl = 'https://' + finalUrl;
      } else {
        // Buscar en Google
        finalUrl = 'https://www.google.com/search?q=' + encodeURIComponent(finalUrl);
      }
    }
    setUrl(finalUrl);
    setInputUrl(finalUrl);
    localStorage.setItem('internal_browser_url', finalUrl);
  };

  const handleLoadStart = () => setLoading(true);
  const handleLoadStop = () => setLoading(false);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-white rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
      {/* Barra de navegación estilo Chrome */}
      <div className="flex items-center space-x-3 bg-slate-800 p-3 border-b border-slate-700">
        <div className="flex space-x-2">
          <button onClick={() => {}} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button onClick={() => {}} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            <ArrowRight className="w-4 h-4" />
          </button>
          <button onClick={() => setUrl(url)} className={`p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors ${loading ? 'animate-spin' : ''}`}>
            <RotateCw className="w-4 h-4" />
          </button>
          <button onClick={() => { 
            const newUrl = 'https://www.google.com';
            setUrl(newUrl); 
            setInputUrl(newUrl); 
            localStorage.setItem('internal_browser_url', newUrl);
          }} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors">
            <Home className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleNavigate} className="flex-1 flex items-center bg-slate-900 rounded-full px-4 py-1.5 border border-slate-600 focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500 transition-all">
          <Search className="w-4 h-4 text-slate-400 mr-2" />
          <input
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-200 placeholder-slate-500"
            placeholder="Buscar en Google o escribir una URL..."
          />
        </form>
      </div>

      {/* Contenedor Web */}
      <div className="flex-1 bg-white relative">
        {!isElectron ? (
          <iframe 
            src={url}
            className="w-full h-full border-none"
            title="Internal Browser"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
          />
        ) : (
          <webview 
            ref={webviewRef}
            src={url} 
            className="w-full h-full border-none"
            allowpopups="true"
            webpreferences="allowRunningInsecureContent=no, contextIsolation=yes"
          />
        )}
      </div>
    </div>
  );
};

export default InternalBrowser;
