'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  getPlaybackState, 
  togglePlayPause, 
  skipToNext, 
  skipToPrevious, 
  setPlaybackVolume, 
  initiateSpotifyLogin, 
  clearStoredTokens, 
  getValidAccessToken, 
  getStoredClientId, 
  saveStoredClientId,
  SpotifyTrack
} from '../lib/spotify';
import { 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  Music, 
  LogOut, 
  Settings, 
  ExternalLink, 
  Check, 
  RefreshCw,
  Tv
} from 'lucide-react';
import { Language } from '../lib/i18n';

interface SpotifyPanelProps {
  lang: Language;
  onToast: (msg: string) => void;
  onTrackUpdate?: (track: SpotifyTrack | null) => void;
}

export default function SpotifyPanel({ lang, onToast, onTrackUpdate }: SpotifyPanelProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [clientId, setClientId] = useState('');
  const [isEditingClientId, setIsEditingClientId] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load configuration and verify auth on mount
  useEffect(() => {
    setClientId(getStoredClientId());
    checkAuth();

    // Listen for authentication completion messages from popup
    const handleOAuthMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setIsAuthenticated(true);
        onToast(lang === 'pt' ? 'Spotify conectado com sucesso!' : 'Spotify successfully connected!');
        checkAuth();
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => {
      window.removeEventListener('message', handleOAuthMessage);
      stopPolling();
    };
  }, [lang]);

  // Handle progress counter incrementing locally for responsive UI
  useEffect(() => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    
    if (currentTrack?.isPlaying) {
      setProgress(currentTrack.progressMs);
      progressIntervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev + 1000 >= currentTrack.durationMs) {
            // Refetch when track ends
            fetchState();
            return currentTrack.durationMs;
          }
          return prev + 1000;
        });
      }, 1000);
    } else if (currentTrack) {
      setProgress(currentTrack.progressMs);
    }

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [currentTrack]);

  const checkAuth = async () => {
    setIsLoading(true);
    const token = await getValidAccessToken();
    if (token) {
      setIsAuthenticated(true);
      await fetchState();
      startPolling();
    } else {
      setIsAuthenticated(false);
      setCurrentTrack(null);
      if (onTrackUpdate) onTrackUpdate(null);
    }
    setIsLoading(false);
  };

  const startPolling = () => {
    stopPolling();
    pollIntervalRef.current = setInterval(fetchState, 5000); // poll Spotify every 5s
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const fetchState = async () => {
    const track = await getPlaybackState();
    setCurrentTrack(track);
    if (onTrackUpdate) onTrackUpdate(track);
  };

  const handleConnect = async () => {
    try {
      const redirectUri = `${window.location.origin}/auth/callback`;
      const authUrl = await initiateSpotifyLogin(clientId, redirectUri);
      
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        authUrl,
        'spotify_oauth',
        `width=${width},height=${height},top=${top},left=${left},resizable=yes,scrollbars=yes,status=yes`
      );

      if (!popup) {
        onToast(lang === 'pt' ? 'Permita popups para conectar com o Spotify.' : 'Please allow popups to connect with Spotify.');
      }
    } catch (e: any) {
      console.error(e);
      onToast('Error: ' + e.message);
    }
  };

  const handleDisconnect = () => {
    clearStoredTokens();
    setIsAuthenticated(false);
    setCurrentTrack(null);
    if (onTrackUpdate) onTrackUpdate(null);
    stopPolling();
    onToast(lang === 'pt' ? 'Sessão encerrada.' : 'Disconnected from Spotify.');
  };

  const handleSaveClientId = () => {
    if (!clientId.trim()) {
      onToast(lang === 'pt' ? 'O Client ID não pode ser vazio.' : 'Client ID cannot be empty.');
      return;
    }
    saveStoredClientId(clientId.trim());
    setIsEditingClientId(false);
    onToast(lang === 'pt' ? 'Client ID salvo!' : 'Client ID saved!');
  };

  // Web API Handlers
  const handlePlayPause = async () => {
    if (!currentTrack || isActionLoading) return;
    setIsActionLoading(true);
    const newPlayingState = !currentTrack.isPlaying;
    
    // Optimistic UI update
    setCurrentTrack({ ...currentTrack, isPlaying: newPlayingState });
    
    try {
      await togglePlayPause(currentTrack.isPlaying);
      setTimeout(fetchState, 400); // slight delay before refreshing to let Spotify update its state
    } catch (e) {
      onToast('Spotify Control Error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSkipNext = async () => {
    if (isActionLoading) return;
    setIsActionLoading(true);
    onToast(lang === 'pt' ? 'Pulando música...' : 'Skipping track...');
    try {
      await skipToNext();
      setTimeout(fetchState, 600);
    } catch (e) {
      onToast('Spotify Control Error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSkipPrev = async () => {
    if (isActionLoading) return;
    setIsActionLoading(true);
    onToast(lang === 'pt' ? 'Voltando música...' : 'Previous track...');
    try {
      await skipToPrevious();
      setTimeout(fetchState, 600);
    } catch (e) {
      onToast('Spotify Control Error');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleVolumeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseInt(e.target.value);
    if (currentTrack) {
      setCurrentTrack({ ...currentTrack, volumePercent: newVol });
    }
    try {
      await setPlaybackVolume(newVol);
    } catch (err) {
      console.warn('Could not set volume:', err);
    }
  };

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const progressPercentage = currentTrack && currentTrack.durationMs > 0 
    ? Math.min(100, (progress / currentTrack.durationMs) * 100) 
    : 0;

  const currentRedirectUri = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '';

  return (
    <div className="w-full max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 p-6 animate-in fade-in duration-300" id="spotify-panel">
      {/* Configuration / Status Column */}
      <div className="bg-[#202224] p-5 rounded-2xl shadow-xl flex flex-col justify-between space-y-4" id="spotify-config">
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-[#1db954] flex items-center justify-center shadow-md">
              <span className="text-white text-xl font-bold">S</span>
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Spotify Web API</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                {isAuthenticated ? (lang === 'pt' ? 'Status: Conectado' : 'Status: Connected') : (lang === 'pt' ? 'Status: Desconectado' : 'Status: Disconnected')}
              </p>
            </div>
          </div>

          <p className="text-xs text-gray-400 leading-relaxed">
            {lang === 'pt' 
              ? 'Conecte sua conta do Spotify para visualizar o que está tocando e controlar as faixas usando os botões físicos e seletores do Danjos Deck.'
              : 'Connect your Spotify account to see what is currently playing and control tracks using the physical buttons and rotary encoders of your Danjos Deck.'}
          </p>

          <div className="border-t border-[#2b2d31] pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Spotify Client ID</span>
              <button 
                onClick={() => setIsEditingClientId(!isEditingClientId)}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
              >
                {isEditingClientId ? (lang === 'pt' ? 'Cancelar' : 'Cancel') : (lang === 'pt' ? 'Alterar' : 'Change')}
              </button>
            </div>

            {isEditingClientId ? (
              <div className="flex space-x-2">
                <input 
                  type="text" 
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Insert Client ID"
                  className="flex-1 bg-[#171717] px-3 py-1.5 rounded text-xs focus:outline-none"
                />
                <button 
                  onClick={handleSaveClientId}
                  className="bg-[#1db954] hover:bg-[#1ed760] text-black px-3 rounded text-xs font-bold"
                >
                  <Check size={14} />
                </button>
              </div>
            ) : (
              <div className="bg-[#171717] px-3 py-2 rounded text-[11px] font-mono text-gray-500 truncate">
                {clientId}
              </div>
            )}
          </div>
        </div>

        <div>
          {isAuthenticated ? (
            <button 
              onClick={handleDisconnect}
              className="w-full flex items-center justify-center space-x-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest transition-all"
            >
              <LogOut size={14} />
              <span>{lang === 'pt' ? 'Sair do Spotify' : 'Log Out Spotify'}</span>
            </button>
          ) : (
            <button 
              onClick={handleConnect}
              className="w-full flex items-center justify-center space-x-2 bg-[#1db954] hover:bg-[#1ed760] text-black font-bold py-2.5 rounded-xl text-xs uppercase tracking-widest transition-all shadow-md active:scale-[0.98]"
            >
              <Music size={14} />
              <span>{lang === 'pt' ? 'Conectar Spotify' : 'Connect Spotify'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Music Player Card */}
      <div className="bg-[#202224] p-6 rounded-2xl shadow-xl flex flex-col justify-between col-span-1 md:col-span-2 min-h-[300px]" id="spotify-player">
        {isLoading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10 space-y-3">
            <RefreshCw size={24} className="animate-spin text-[#1db954]" />
            <p className="text-xs text-gray-500">{lang === 'pt' ? 'Carregando Player...' : 'Loading Player...'}</p>
          </div>
        ) : !isAuthenticated ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10 space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#2b2d31] flex items-center justify-center text-gray-600">
              <Music size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-400">{lang === 'pt' ? 'Spotify não conectado' : 'Spotify not connected'}</p>
              <p className="text-xs text-gray-600 mt-1">
                {lang === 'pt' ? 'Conecte sua conta para habilitar o painel' : 'Connect your account to enable this dashboard'}
              </p>
            </div>
          </div>
        ) : currentTrack ? (
          // Active Track Display
          <div className="flex flex-col h-full justify-between space-y-6" id="player-active-track">
            <div className="flex space-x-5">
              <div className="w-24 h-24 relative rounded-xl overflow-hidden shadow-2xl flex-shrink-0 bg-[#2b2d31]">
                <img 
                  src={currentTrack.albumCoverUrl} 
                  alt={currentTrack.albumName} 
                  className="object-cover w-full h-full"
                />
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h2 className="text-base font-bold text-white truncate">{currentTrack.name}</h2>
                <p className="text-xs text-gray-400 truncate mt-1">{currentTrack.artists.join(', ')}</p>
                <p className="text-[10px] text-gray-500 italic truncate mt-0.5">{currentTrack.albumName}</p>
                
                {/* Active playback device */}
                <div className="flex items-center space-x-1.5 mt-3 bg-[#2b2d31] w-fit px-2 py-0.5 rounded text-[10px] text-gray-400">
                  <Tv size={10} className="text-[#1db954]" />
                  <span className="truncate max-w-[120px]">{currentTrack.deviceName}</span>
                </div>
              </div>
            </div>

            {/* Progress Slider */}
            <div className="space-y-1">
              <div className="relative w-full h-1.5 bg-[#2b2d31] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#1db954] rounded-full transition-all duration-300" 
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span>{formatTime(progress)}</span>
                <span>{formatTime(currentTrack.durationMs)}</span>
              </div>
            </div>

            {/* Media Controls */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center space-x-4">
                <button 
                  onClick={handleSkipPrev}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <SkipBack size={18} />
                </button>
                <button 
                  onClick={handlePlayPause}
                  className="w-10 h-10 rounded-full bg-[#1db954] hover:bg-[#1ed760] text-black flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-md"
                >
                  {currentTrack.isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                </button>
                <button 
                  onClick={handleSkipNext}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <SkipForward size={18} />
                </button>
              </div>

              {/* Volume Slider */}
              <div className="flex items-center space-x-2 w-32 md:w-44">
                <Volume2 size={14} className="text-gray-500" />
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={currentTrack.volumePercent}
                  onChange={handleVolumeChange}
                  className="w-full accent-[#1db954] cursor-pointer h-1"
                />
                <span className="text-[10px] text-gray-500 font-mono w-6">{currentTrack.volumePercent}%</span>
              </div>
            </div>
          </div>
        ) : (
          // Authenticated but not playing
          <div className="flex-1 flex flex-col items-center justify-center text-center py-10 space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#2b2d31] flex items-center justify-center text-[#1db954]">
              <Music size={24} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-300">{lang === 'pt' ? 'Nenhuma música tocando' : 'No track active'}</p>
              <p className="text-xs text-gray-500 mt-1">
                {lang === 'pt' ? 'Inicie uma música no Spotify de qualquer aparelho para controlá-la aqui.' : 'Start playing Spotify on any device to see and control it here.'}
              </p>
            </div>
            <button 
              onClick={fetchState}
              className="px-4 py-1.5 bg-[#2b2d31] hover:bg-[#36393e] text-xs font-semibold rounded-lg text-gray-300 transition-colors"
            >
              {lang === 'pt' ? 'Atualizar Player' : 'Refresh Player'}
            </button>
          </div>
        )}
      </div>

      {/* Connection Guide Accordion / Text Card */}
      <div className="bg-[#202224] p-5 rounded-2xl shadow-xl col-span-1 md:col-span-3 space-y-3" id="spotify-guide">
        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center space-x-1.5">
          <Settings size={12} />
          <span>{lang === 'pt' ? 'Guia de Configuração do Spotify' : 'Spotify Integration Setup Guide'}</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-400 leading-relaxed">
          <div className="space-y-1.5">
            <p className="font-semibold text-white">1. {lang === 'pt' ? 'Registrar Aplicativo' : 'Register Developer Application'}</p>
            <p>
              {lang === 'pt' 
                ? 'Acesse o painel do Spotify e crie um App para obter suas próprias credenciais:'
                : 'Access the Spotify Developer dashboard and create an App to get your free credentials:'}{' '}
              <a 
                href="https://developer.spotify.com/dashboard" 
                target="_blank" 
                rel="noreferrer" 
                className="text-blue-400 hover:underline flex items-center inline-flex space-x-0.5"
              >
                <span>dashboard</span>
                <ExternalLink size={10} />
              </a>
            </p>
            <p className="font-semibold text-white pt-1">2. {lang === 'pt' ? 'Adicionar URI de Redirecionamento' : 'Configure Redirect URI'}</p>
            <p>
              {lang === 'pt' 
                ? 'Nas configurações do seu App do Spotify, configure a seguinte Redirect URI:'
                : 'In your Spotify App settings, make sure to add the following Redirect URI:'}
            </p>
            <div className="bg-[#171717] px-2.5 py-1 rounded font-mono text-[10px] text-blue-400 overflow-x-auto select-all">
              {currentRedirectUri}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-white">3. {lang === 'pt' ? 'Configurar Client ID' : 'Provide your Client ID'}</p>
            <p>
              {lang === 'pt' 
                ? 'Copie o Client ID do seu painel e salve no campo acima para que a autenticação ocorra diretamente pelo seu próprio aplicativo de desenvolvedor.'
                : 'Copy the Client ID from your Spotify panel and save it above to authenticate directly under your custom Spotify application.'}
            </p>
            <p className="font-semibold text-white pt-1">4. {lang === 'pt' ? 'Conexão via Deck' : 'Connect via Deck'}</p>
            <p>
              {lang === 'pt' 
                ? 'Ao conectar o Danjos Deck via USB Serial, os botões e encoders configurados com ações do Spotify enviarão comandos de reprodução em tempo real.'
                : 'When connecting your Danjos Deck via USB Serial, buttons and encoders mapped with Spotify actions will issue playback requests instantly.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
