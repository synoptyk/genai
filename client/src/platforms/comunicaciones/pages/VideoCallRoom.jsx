import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, Users,
    ShieldCheck, Clock, Cast, MessageSquare, LayoutGrid, Hand,
    Copy, Check
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

let jitsiScriptPromise = null;

const loadJitsiScript = () => {
    if (window.JitsiMeetExternalAPI) return Promise.resolve();
    if (jitsiScriptPromise) return jitsiScriptPromise;

    jitsiScriptPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://meet.jit.si/external_api.js';
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error('No se pudo cargar Jitsi External API'));
        document.body.appendChild(script);
    });

    return jitsiScriptPromise;
};

const VideoCallRoom = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const conferenceRef = useRef(null);
    const apiRef = useRef(null);

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [connecting, setConnecting] = useState(true);
    const [elapsedTime, setElapsedTime] = useState(0);
    const [isSharingScreen, setIsSharingScreen] = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);
    const [participantsCount, setParticipantsCount] = useState(1);
    const [copiedInvite, setCopiedInvite] = useState(false);

    const inviteLink = useMemo(() => `${window.location.origin}/video-call/${roomId}`, [roomId]);

    useEffect(() => {
        let mounted = true;

        const initConference = async () => {
            try {
                await loadJitsiScript();
                if (!mounted || !conferenceRef.current) return;

                const safeRoom = String(roomId || 'sala-general').replace(/[^a-zA-Z0-9_-]/g, '-');

                const api = new window.JitsiMeetExternalAPI('meet.jit.si', {
                    roomName: `GenAI-${safeRoom}`,
                    parentNode: conferenceRef.current,
                    width: '100%',
                    height: '100%',
                    userInfo: {
                        displayName: user?.name || 'Invitado',
                        email: user?.email || ''
                    },
                    configOverwrite: {
                        prejoinPageEnabled: false,
                        startWithAudioMuted: false,
                        startWithVideoMuted: false,
                        disableModeratorIndicator: false,
                        enableNoisyMicDetection: true,
                        disableDeepLinking: true,
                        p2p: {
                            enabled: true,
                            preferH264: true
                        }
                    },
                    interfaceConfigOverwrite: {
                        MOBILE_APP_PROMO: false,
                        SHOW_JITSI_WATERMARK: false,
                        SHOW_WATERMARK_FOR_GUESTS: false,
                        DEFAULT_REMOTE_DISPLAY_NAME: 'Participante',
                        TOOLBAR_BUTTONS: [
                            'microphone', 'camera', 'desktop', 'fullscreen', 'fodeviceselection',
                            'hangup', 'chat', 'participants-pane', 'tileview', 'raisehand',
                            'settings', 'videoquality', 'filmstrip'
                        ]
                    }
                });

                apiRef.current = api;

                api.addListener('videoConferenceJoined', () => {
                    setConnecting(false);
                    setParticipantsCount(1);
                });

                api.addListener('participantJoined', () => {
                    setParticipantsCount((c) => c + 1);
                });

                api.addListener('participantLeft', () => {
                    setParticipantsCount((c) => Math.max(1, c - 1));
                });

                api.addListener('audioMuteStatusChanged', ({ muted }) => {
                    setIsMuted(Boolean(muted));
                });

                api.addListener('videoMuteStatusChanged', ({ muted }) => {
                    setIsVideoOff(Boolean(muted));
                });

                api.addListener('screenSharingStatusChanged', ({ on }) => {
                    setIsSharingScreen(Boolean(on));
                });

                api.addListener('readyToClose', () => {
                    navigate('/chat');
                });
            } catch (err) {
                console.error('Error iniciando videollamada:', err);
                setConnecting(false);
            }
        };

        initConference();

        return () => {
            mounted = false;
            if (apiRef.current) {
                apiRef.current.dispose();
                apiRef.current = null;
            }
        };
    }, [roomId, user, navigate]);

    // Timer de la llamada
    useEffect(() => {
        if (connecting) return;
        const interval = setInterval(() => {
            setElapsedTime(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [connecting]);

    const formatTime = (seconds) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const toggleMute = () => {
        apiRef.current?.executeCommand('toggleAudio');
    };

    const toggleVideo = () => {
        apiRef.current?.executeCommand('toggleVideo');
    };

    const toggleScreenShare = () => {
        apiRef.current?.executeCommand('toggleShareScreen');
    };

    const toggleChat = () => {
        apiRef.current?.executeCommand('toggleChat');
    };

    const toggleParticipantsPane = () => {
        apiRef.current?.executeCommand('toggleParticipantsPane');
        setShowParticipants((v) => !v);
    };

    const toggleTileView = () => {
        apiRef.current?.executeCommand('toggleTileView');
    };

    const raiseHand = () => {
        apiRef.current?.executeCommand('toggleRaiseHand');
    };

    const copyInvite = async () => {
        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopiedInvite(true);
            setTimeout(() => setCopiedInvite(false), 1800);
        } catch (e) {
            console.error('No se pudo copiar enlace de invitacion:', e);
        }
    };

    const handleHangUp = () => {
        apiRef.current?.executeCommand('hangup');
        setTimeout(() => navigate('/chat'), 250);
    };

    return (
        <div className="h-screen w-full bg-slate-950 flex flex-col font-sans overflow-hidden">
            {/* ── HEADER ── */}
            <div className="flex items-center justify-between p-6 absolute top-0 w-full z-10 bg-gradient-to-b from-black/80 to-transparent">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg">
                        <MonitorUp size={20} />
                    </div>
                    <div>
                        <h1 className="text-white font-black text-lg tracking-wide flex items-center gap-2">
                            Sala GenAI <span className="text-indigo-400">Pro</span>
                        </h1>
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2 mt-1">
                            <ShieldCheck size={12} className="text-emerald-500" />
                            Cifrado Extremo a Extremo
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    {!connecting && (
                        <div className="flex items-center gap-2 bg-indigo-950/40 backdrop-blur border border-indigo-500/30 px-4 py-2 rounded-xl text-indigo-200">
                            <Clock size={14} className="animate-pulse" />
                            <span className="font-mono font-bold text-sm tracking-widest">{formatTime(elapsedTime)}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2.5 rounded-[1.5rem] border border-white/10 cursor-pointer hover:bg-black/60 transition" onClick={() => setShowParticipants(!showParticipants)}>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-white text-[11px] font-black tracking-widest uppercase">
                            {connecting ? 'Conectando...' : 'En Linea'}
                        </span>
                        <span className="text-slate-500 mx-2">|</span>
                        <Users size={14} className="text-slate-400" />
                        <span className="text-white text-[11px] font-bold">{participantsCount}</span>
                    </div>
                </div>
            </div>

            {/* ── VIDEO GRID ── */}
            <div className="flex-1 p-6 relative pt-24 pb-32">
                <div className="w-full h-full bg-slate-900 rounded-[2.5rem] border border-slate-800 shadow-2xl overflow-hidden relative">
                    {connecting && (
                        <div className="absolute inset-0 z-20 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center">
                            <div className="w-24 h-24 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6" />
                            <h2 className="text-white text-xl font-black tracking-tight">Conectando a la videollamada</h2>
                            <p className="text-slate-400 mt-2 font-semibold">Unificando audio, video y red segura...</p>
                        </div>
                    )}
                    <div ref={conferenceRef} className="w-full h-full" />
                </div>
            </div>

            {/* SIDE PANEL DE PARTICIPANTES */}
            {showParticipants && (
                <div className="absolute top-24 right-6 w-80 bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 shadow-2xl z-30 animate-in slide-in-from-right duration-300">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2"><Users size={16} className="text-indigo-400"/> Asistencia en Sala</h3>
                        <button onClick={() => setShowParticipants(false)} className="text-slate-400 hover:text-white transition"><X size={20} /></button>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="flex items-center justify-between bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black shadow-lg">
                                    {user?.name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-white text-xs font-bold uppercase tracking-tight leading-none">{user?.name} (Tú)</p>
                                    <p className="text-emerald-400 text-[9px] uppercase font-black tracking-widest mt-1.5">Anfitrión</p>
                                </div>
                            </div>
                            <div className="flex gap-2 text-slate-400">
                                {isMuted ? <MicOff size={14} className="text-red-400" /> : <Mic size={14} className="text-emerald-400" />}
                                {isVideoOff ? <VideoOff size={14} className="text-red-400" /> : <Video size={14} className="text-emerald-400" />}
                            </div>
                        </div>
                        
                        <p className="text-center text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-6">
                            {participantsCount > 1 ? 'Sesion activa en multipunto' : 'Esperando a que otros se unan...'}
                        </p>

                        <div className="mt-4 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
                            <p className="text-slate-300 text-[10px] font-black uppercase tracking-widest mb-2">Enlace de invitacion</p>
                            <div className="flex items-center gap-2">
                                <input
                                    value={inviteLink}
                                    readOnly
                                    className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-[10px] text-slate-300 outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={copyInvite}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1"
                                >
                                    {copiedInvite ? <Check size={12} /> : <Copy size={12} />}
                                    {copiedInvite ? 'Copiado' : 'Copiar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── CONTROLS BAR ── */}
            <div className="absolute bottom-0 w-full h-24 bg-gradient-to-t from-black to-transparent flex items-end justify-center pb-6 gap-4 z-20">
                <button
                    onClick={toggleMute}
                    className={`p-4 rounded-[1.5rem] transition-all duration-300 ${isMuted ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500'}`}
                >
                    {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>

                <button
                    onClick={toggleVideo}
                    className={`p-4 rounded-[1.5rem] transition-all duration-300 ${isVideoOff ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500'}`}
                >
                    {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
                </button>

                <button
                    onClick={toggleScreenShare}
                    className={`p-4 rounded-[1.5rem] transition-all duration-300 ${isSharingScreen ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-900/50' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500'}`}
                    title="Compartir Pantalla"
                >
                    <Cast size={24} />
                </button>

                <button
                    className="p-4 rounded-[1.5rem] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500 transition-all duration-300"
                    onClick={toggleParticipantsPane}
                    title="Asistencia"
                >
                    <Users size={24} />
                </button>

                <button
                    className="p-4 rounded-[1.5rem] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500 transition-all duration-300"
                    onClick={toggleChat}
                    title="Chat"
                >
                    <MessageSquare size={24} />
                </button>

                <button
                    className="p-4 rounded-[1.5rem] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500 transition-all duration-300"
                    onClick={toggleTileView}
                    title="Vista en Cuadricula"
                >
                    <LayoutGrid size={24} />
                </button>

                <button
                    className="p-4 rounded-[1.5rem] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500 transition-all duration-300"
                    onClick={raiseHand}
                    title="Levantar Mano"
                >
                    <Hand size={24} />
                </button>

                <button
                    className="p-4 rounded-[1.5rem] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500 transition-all duration-300"
                    onClick={copyInvite}
                    title="Copiar enlace de reunion"
                >
                    {copiedInvite ? <Check size={24} /> : <Copy size={24} />}
                </button>

                <button
                    onClick={handleHangUp}
                    className="p-4 px-8 rounded-[1.5rem] bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-900/50 hover:shadow-rose-900 transition-all duration-300 flex items-center gap-3"
                >
                    <PhoneOff size={24} />
                    <span className="font-black tracking-widest uppercase text-xs">Finalizar</span>
                </button>
            </div>
        </div>
    );
};

export default VideoCallRoom;
