import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, Users, Settings, ShieldCheck, Clock, MonitorPlay, Cast, X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

const VideoCallRoom = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [stream, setStream] = useState(null);
    const [connecting, setConnecting] = useState(true);

    const [elapsedTime, setElapsedTime] = useState(0);
    const [isSharingScreen, setIsSharingScreen] = useState(false);
    const [screenStream, setScreenStream] = useState(null);
    const [showParticipants, setShowParticipants] = useState(false);

    // Referencia al elemento <video>
    const myVideoRef = useRef(null);

    // Inicializar Cámara al entrar
    useEffect(() => {
        const initCamera = async () => {
            try {
                const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                setStream(mediaStream);
                if (myVideoRef.current) {
                    myVideoRef.current.srcObject = mediaStream;
                }

                // Simular delay de "conectar a sala segura"
                setTimeout(() => setConnecting(false), 2000);
            } catch (err) {
                console.error("No se pudo acceder a la cámara", err);
                setConnecting(false);
            }
        };
        initCamera();

        return () => {
            // Apagar cámara al salir de la sala
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    // Toggle de Audio y Video locales
    const toggleMute = () => {
        if (stream && stream.getAudioTracks().length > 0) {
            stream.getAudioTracks()[0].enabled = !stream.getAudioTracks()[0].enabled;
            setIsMuted(!stream.getAudioTracks()[0].enabled);
        } else {
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (stream && stream.getVideoTracks().length > 0) {
            stream.getVideoTracks()[0].enabled = !stream.getVideoTracks()[0].enabled;
            setIsVideoOff(!stream.getVideoTracks()[0].enabled);
        } else {
            setIsVideoOff(!isVideoOff);
        }
    };

    const toggleScreenShare = async () => {
        if (!isSharingScreen) {
            try {
                const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
                setScreenStream(displayStream);
                if (myVideoRef.current) myVideoRef.current.srcObject = displayStream;
                setIsSharingScreen(true);

                displayStream.getVideoTracks()[0].onended = () => {
                    stopScreenShare();
                };
            } catch (err) {
                console.error("Error al compartir pantalla:", err);
            }
        } else {
            stopScreenShare();
        }
    };

    const stopScreenShare = () => {
        if (screenStream) {
            screenStream.getTracks().forEach(track => track.stop());
            setScreenStream(null);
        }
        if (myVideoRef.current && stream) {
            myVideoRef.current.srcObject = stream;
        }
        setIsSharingScreen(false);
    };

    const handleHangUp = () => {
        if (stream) stream.getTracks().forEach(track => track.stop());
        if (screenStream) screenStream.getTracks().forEach(track => track.stop());
        window.close(); // Cierra si fue abierto como popup
        setTimeout(() => navigate('/chat'), 300); // Redirige por si window.close falla u originó en la misma pestaña
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
                        <span className="text-white text-[11px] font-bold">1</span>
                    </div>
                </div>
            </div>

            {/* ── VIDEO GRID ── */}
            <div className="flex-1 p-6 flex flex-col md:flex-row gap-6 justify-center items-center relative pt-24 pb-32">

                {/* Placeholder de Participantes Remotos */}
                <div className="w-full md:w-3/4 h-full bg-slate-900 rounded-[2.5rem] border border-slate-800 flex flex-col items-center justify-center relative shadow-2xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 via-indigo-950/20 to-slate-900 z-0" />

                    {connecting ? (
                        <div className="z-10 flex flex-col items-center">
                            <div className="w-24 h-24 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-6" />
                            <h2 className="text-white text-xl font-black tracking-tight">Estableciendo Conexión Segura</h2>
                            <p className="text-slate-400 mt-2 font-semibold">Esperando a otros participantes de la sala...</p>
                        </div>
                    ) : (
                        <div className="z-10 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                            <div className="w-24 h-24 bg-slate-800 border-2 border-slate-700 rounded-[2rem] flex items-center justify-center mb-6 shadow-xl">
                                <Users size={40} className="text-slate-500" />
                            </div>
                            <h2 className="text-white text-2xl font-black tracking-tight">Sala de Reunión Lista</h2>
                            <p className="text-indigo-300 mt-2 font-bold uppercase tracking-widest text-[11px]">ID: {roomId}</p>
                            <p className="text-slate-400 mt-4 text-sm font-semibold text-center max-w-sm">
                                Eres el primer participante. Los demás interlocutores se unirán pronto a la transmisión.
                            </p>
                        </div>
                    )}
                </div>

                {/* Video Local (PIP) */}
                <div className={`absolute bottom-32 right-12 w-64 aspect-video bg-black rounded-3xl border-2 shadow-2xl overflow-hidden group transition-all ${isSharingScreen ? 'border-indigo-500 shadow-indigo-500/50' : 'border-slate-700'}`}>
                    <video
                        ref={myVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${isVideoOff && !isSharingScreen ? 'hidden' : 'block'} ${!isSharingScreen && 'scale-x-[-1]'}`}
                    />

                    {isVideoOff && !isSharingScreen && (
                        <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center">
                            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white font-black text-xl mb-2">
                                {user?.name?.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Cámara Apagada</span>
                        </div>
                    )}

                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-[10px] font-black font-sans shadow-sm flex items-center gap-2">
                            {isSharingScreen ? <MonitorPlay size={10} className="text-indigo-400" /> : null} Tú ({user?.name})
                        </span>
                    </div>

                    {isMuted && (
                        <div className="absolute top-3 right-3 bg-red-500/80 p-1.5 rounded-full text-white backdrop-blur-md">
                            <MicOff size={14} />
                        </div>
                    )}
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
                        
                        {!connecting && (
                             <p className="text-center text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-6">Esperando a que otros se unan...</p>
                        )}
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
                    onClick={() => setShowParticipants(!showParticipants)}
                    title="Asistencia"
                >
                    <Users size={24} />
                </button>

                <button
                    className="p-4 rounded-[1.5rem] bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-slate-500 transition-all duration-300"
                >
                    <Settings size={24} />
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
