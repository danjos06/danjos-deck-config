'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { exchangeCodeForTokens, getStoredClientId } from '../../../lib/spotify';

function CallbackHandler() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function handleCallback() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
          throw new Error(`Spotify authorization failed: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code found in the callback URL.');
        }

        const codeVerifier = localStorage.getItem('spotify_code_verifier');
        if (!codeVerifier) {
          throw new Error('No code verifier found in local storage. Please try logging in again.');
        }

        const clientId = getStoredClientId();
        const redirectUri = `${window.location.origin}/auth/callback`;

        await exchangeCodeForTokens(clientId, redirectUri, code, codeVerifier);

        setStatus('success');
        
        // Notify parent and close
        if (window.opener) {
          window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
          setTimeout(() => {
            window.close();
          }, 1500);
        } else {
          // Fallback if not opened in popup: redirect to home
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
        }
      } catch (err: any) {
        console.error('Spotify OAuth callback error:', err);
        setStatus('error');
        setErrorMsg(err.message || 'An unexpected error occurred during authorization.');
      }
    }

    handleCallback();
  }, []);

  return (
    <div className="min-h-screen bg-[#2b2d31] flex flex-col items-center justify-center text-[#e2e8f0] font-sans p-6">
      <div className="w-full max-w-md bg-[#202224] p-8 rounded-2xl shadow-2xl text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-[#1db954] rounded-full flex items-center justify-center shadow-lg animate-pulse">
            <span className="text-white text-3xl font-bold">S</span>
          </div>
        </div>

        {status === 'loading' && (
          <div className="space-y-3">
            <h1 className="text-xl font-bold tracking-tight text-white">Conectando ao Spotify...</h1>
            <p className="text-sm text-gray-400">Por favor, aguarde enquanto finalizamos a sua autenticação.</p>
            <div className="flex justify-center pt-2">
              <div className="w-8 h-8 border-4 border-t-[#1db954] border-gray-700 rounded-full animate-spin"></div>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <h1 className="text-xl font-bold tracking-tight text-[#4ade80]">Sucesso!</h1>
            <p className="text-sm text-gray-300">Sua conta do Spotify foi conectada com êxito.</p>
            <p className="text-xs text-gray-500">Esta janela fechará automaticamente em instantes.</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
            <h1 className="text-xl font-bold tracking-tight text-red-400">Falha na Conexão</h1>
            <p className="text-sm text-gray-300">{errorMsg}</p>
            <div className="pt-4">
              <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-md"
              >
                Voltar para o Editor
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#2b2d31] flex flex-col items-center justify-center text-[#e2e8f0]">
        <div className="w-8 h-8 border-4 border-t-[#1db954] border-gray-700 rounded-full animate-spin"></div>
      </div>
    }>
      <CallbackHandler />
    </Suspense>
  );
}
