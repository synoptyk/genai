import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, PhoneOff, MonitorUp, Users, Settings, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';

const VideoCallRoom = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [stream, setStream] = useState(null);
    const [connecting, setConnecting] = useState(true);

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

    // Toggle de Audio y Video locales
    const toggleMute = () => {
        if (stream) {
            stream.getAudioTracks()[0].enabled = !stream.getAudioTracks()[0].enabled;
            setIsMuted(!stream.getAudioTracks()[0].enabled);
        } else {
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (stream) {
            stream.getVideoTracks()[0].enabled = !stream.getVideoTracks()[0].enabled;
            setIsVideoOff(!stream.getVideoTracks()[0].enabled);
        } else {
            setIsVideoOff(!isVideoOff);
        }
    };

    const handleHangUp = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        window.close(); // Si fue abierto como popup
        navigate(-1); // Respaldo si fue abierto en misma pestaña
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

                <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-4 py-2.5 rounded-[1.5rem] border border-white/10">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-white text-[11px] font-black tracking-widest uppercase">
                        {connecting ? 'Conectando...' : 'En Linea'}
                    </span>
                    <span className="text-slate-500 mx-2">|</span>
                    <Users size={14} className="text-slate-400" />
                    <span className="text-white text-[11px] font-bold">1/4</span>
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
                <div className="absolute bottom-32 right-12 w-64 aspect-video bg-black rounded-3xl border-2 border-slate-700 shadow-2xl overflow-hidden group">
                    <video
                        ref={myVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : 'block'} scale-x-[-1]`}
                    />

                    {isVideoOff && (
                        <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center">
                            <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white font-black text-xl mb-2">
                                {user?.name?.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Cámara Apagada</span>
                        </div>
                    )}

                    <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-[10px] font-black font-sans shadow-sm">Tú ({user?.name})</span>
                    </div>

                    {isMuted && (
                        <div className="absolute top-3 right-3 bg-red-500/80 p-1.5 rounded-full text-white backdrop-blur-md">
                            <MicOff size={14} />
                        </div>
                    )}
                </div>
            </div>

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
