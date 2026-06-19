import React, { useEffect, useRef } from 'react';
import { Phone, Video, PhoneOff, User } from 'lucide-react';

const IncomingCallOverlay = ({ callData, onAccept, onReject }) => {
  const { caller, callType, roomId } = callData;
  const audioRef = useRef(null);

  useEffect(() => {
    // Reproducir tono de llamada en bucle
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3');
    audio.loop = true;
    audio.play().catch(e => console.log('Error reproduciendo tono de llamada:', e));
    audioRef.current = audio;

    // Vibración si está disponible
    if (navigator.vibrate) {
      navigator.vibrate([500, 500, 500, 500, 500]);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if (navigator.vibrate) {
        navigator.vibrate(0);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/90 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-300">
      
      {/* Efecto de radar / ondas */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[300px] h-[300px] bg-indigo-500/20 rounded-full animate-ping absolute" style={{ animationDuration: '2s' }} />
        <div className="w-[400px] h-[400px] bg-indigo-500/10 rounded-full animate-ping absolute" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-indigo-500 shadow-[0_0_50px_rgba(99,102,241,0.5)] flex items-center justify-center bg-slate-800">
          {caller?.avatar ? (
            <img src={caller.avatar} alt="Caller Avatar" className="w-full h-full object-cover" />
          ) : (
            <User size={64} className="text-slate-400" />
          )}
        </div>

        <div className="text-center flex flex-col items-center">
          <h2 className="text-3xl font-black text-white tracking-tight">{caller?.name || 'Usuario'}</h2>
          <p className="text-indigo-300 font-medium text-lg mt-1">{caller?.cargo || 'Te está llamando...'}</p>
          <div className="flex items-center gap-2 mt-2 px-4 py-1.5 bg-white/10 rounded-full backdrop-blur-md">
            {callType === 'video' ? <Video size={16} className="text-white" /> : <Phone size={16} className="text-white" />}
            <span className="text-white/90 text-sm font-bold uppercase tracking-wider">
              Llamada de {callType === 'video' ? 'Video' : 'Audio'} entrante
            </span>
          </div>
        </div>

        <div className="flex items-center gap-12 mt-12">
          {/* Botón Rechazar */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={onReject}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-all duration-300"
            >
              <PhoneOff size={28} />
            </button>
            <span className="text-white/70 font-medium text-sm">Rechazar</span>
          </div>

          {/* Botón Contestar */}
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => onAccept(roomId, callType)}
              className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.5)] hover:scale-110 transition-all duration-300 animate-bounce"
            >
              {callType === 'video' ? <Video size={28} /> : <Phone size={28} />}
            </button>
            <span className="text-emerald-400 font-bold text-sm">Contestar</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallOverlay;
