import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Header from './Header';
import { Upload, ImageIcon, Sparkles, LogOut, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function MainLayout() {
  const { school, refreshSchool } = useApp();
  const { isAdmin, isDirector, signOut } = useAuth();

  // Check if school setup is incomplete
  const isBrandingIncomplete = school && (!school.logo_url || !school.facade_url || !school.students_uniform_url);
  const showSetupWizard = isBrandingIncomplete && (isAdmin || isDirector);

  // Wizard state values
  const [logoUrl, setLogoUrl] = useState(school?.logo_url || '');
  const [facadeUrl, setFacadeUrl] = useState(school?.facade_url || '');
  const [uniformUrl, setUniformUrl] = useState(school?.students_uniform_url || '');

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFacade, setUploadingFacade] = useState(false);
  const [uploadingUniform, setUploadingUniform] = useState(false);

  useEffect(() => {
    if (school) {
      setLogoUrl(school.logo_url || '');
      setFacadeUrl(school.facade_url || '');
      setUniformUrl(school.students_uniform_url || '');
    }
  }, [school]);

  async function handleFileUpload(type: 'logo' | 'facade' | 'uniform', file: File) {
    if (!school) return;

    if (type === 'logo') setUploadingLogo(true);
    if (type === 'facade') setUploadingFacade(true);
    if (type === 'uniform') setUploadingUniform(true);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${school.id}/branding/${type}-${Date.now()}.${extension}`;
      
      const { error: uploadError } = await supabase.storage.from('school-assets').upload(path, file, {
        upsert: true,
        cacheControl: '3600',
      });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('school-assets').getPublicUrl(path);
      const publicUrl = data.publicUrl;

      if (type === 'logo') {
        setLogoUrl(publicUrl);
        await supabase.from('schools').update({ logo_url: publicUrl }).eq('id', school.id);
      } else if (type === 'facade') {
        setFacadeUrl(publicUrl);
        await supabase.from('schools').update({ facade_url: publicUrl }).eq('id', school.id);
      } else if (type === 'uniform') {
        setUniformUrl(publicUrl);
        await supabase.from('schools').update({ students_uniform_url: publicUrl }).eq('id', school.id);
      }
    } catch (error) {
      alert("Erreur lors de l'envoi de l'image. Assurez-vous que le bucket 'school-assets' est configuré sur votre base Supabase.");
    } finally {
      if (type === 'logo') setUploadingLogo(false);
      if (type === 'facade') setUploadingFacade(false);
      if (type === 'uniform') setUploadingUniform(false);
    }
  }

  async function handleFinish() {
    if (!logoUrl || !facadeUrl || !uniformUrl) return;
    await refreshSchool();
  }

  if (showSetupWizard) {
    const progress = [logoUrl, facadeUrl, uniformUrl].filter(Boolean).length;

    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-6 md:p-12 relative overflow-hidden">
        {/* Abstract design blobs in the background */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-pink-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

        {/* Wizard header */}
        <header className="flex justify-between items-center max-w-5xl mx-auto w-full border-b border-white/5 pb-5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-gradient-to-tr from-pink-500 to-amber-500 p-2 text-white shadow-lg">
              <Sparkles size={20} />
            </div>
            <div>
              <h1 className="font-extrabold text-lg leading-none tracking-tight">{school?.name || 'SchoolManager Pro'}</h1>
              <p className="text-slate-400 text-xs mt-1">Configuration Initiale Obligatoire</p>
            </div>
          </div>
          <button 
            onClick={() => void signOut()} 
            className="flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white transition"
          >
            <LogOut size={14} /> Déconnexion
          </button>
        </header>

        {/* Main Wizard Area */}
        <main className="flex-1 max-w-5xl mx-auto w-full flex flex-col justify-center my-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-3xl font-black tracking-tight leading-tight">Personnalisez votre établissement</h2>
            <p className="text-slate-400 text-sm mt-3">
              Pour sa première connexion, chaque école doit configurer ses éléments d'identité visuelle de base. 
              Ces photos seront visibles sur la page de connexion et le portail parents.
            </p>
            
            {/* Progress bar */}
            <div className="mt-6 flex items-center justify-center gap-2">
              <div className="w-48 h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-emerald-500 transition-all duration-500" 
                  style={{ width: `${(progress / 3) * 100}%` }}
                />
              </div>
              <span className="text-xs font-extrabold text-slate-300 uppercase tracking-wide">
                {progress} / 3 complétés
              </span>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* 1. Logo upload */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col justify-between items-center text-center backdrop-blur-md relative">
              {logoUrl && <CheckCircle2 className="absolute top-4 right-4 text-emerald-400" size={20} />}
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-pink-400 uppercase bg-pink-500/10 px-2.5 py-1 rounded-full">Étape 1</span>
                <h3 className="text-sm font-extrabold text-white mt-4">Logo de l'école</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Format carré transparent recommandé (PNG). Présent sur tous les documents imprimés.
                </p>
              </div>
              <div className="my-6">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="h-24 w-24 rounded-3xl border border-white/20 object-cover shadow-lg bg-white" />
                ) : (
                  <div className="h-24 w-24 rounded-3xl border border-dashed border-white/20 bg-white/5 flex items-center justify-center text-slate-500 shadow-inner">
                    <ImageIcon size={32} />
                  </div>
                )}
              </div>
              <label className="w-full cursor-pointer flex items-center justify-center gap-2 bg-white text-slate-900 hover:bg-slate-100 font-bold py-3 rounded-2xl text-xs transition duration-300">
                <Upload size={14} />
                {uploadingLogo ? 'Envoi...' : 'Uploader le logo'}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={e => e.target.files?.[0] && void handleFileUpload('logo', e.target.files[0])} 
                  className="hidden" 
                />
              </label>
            </div>

            {/* 2. Facade upload */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col justify-between items-center text-center backdrop-blur-md relative">
              {facadeUrl && <CheckCircle2 className="absolute top-4 right-4 text-emerald-400" size={20} />}
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-purple-400 uppercase bg-purple-500/10 px-2.5 py-1 rounded-full">Étape 2</span>
                <h3 className="text-sm font-extrabold text-white mt-4">Façade de l'école</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Image au format paysage. Sert de fond d'écran officiel à votre page de connexion.
                </p>
              </div>
              <div className="my-6">
                {facadeUrl ? (
                  <img src={facadeUrl} alt="Façade" className="h-24 w-24 rounded-3xl border border-white/20 object-cover shadow-lg" />
                ) : (
                  <div className="h-24 w-24 rounded-3xl border border-dashed border-white/20 bg-white/5 flex items-center justify-center text-slate-500 shadow-inner">
                    <ImageIcon size={32} />
                  </div>
                )}
              </div>
              <label className="w-full cursor-pointer flex items-center justify-center gap-2 bg-white text-slate-900 hover:bg-slate-100 font-bold py-3 rounded-2xl text-xs transition duration-300">
                <Upload size={14} />
                {uploadingFacade ? 'Envoi...' : 'Uploader la façade'}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={e => e.target.files?.[0] && void handleFileUpload('facade', e.target.files[0])} 
                  className="hidden" 
                />
              </label>
            </div>

            {/* 3. Uniform image upload */}
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col justify-between items-center text-center backdrop-blur-md relative">
              {uniformUrl && <CheckCircle2 className="absolute top-4 right-4 text-emerald-400" size={20} />}
              <div>
                <span className="text-[10px] font-extrabold tracking-widest text-emerald-400 uppercase bg-emerald-500/10 px-2.5 py-1 rounded-full">Étape 3</span>
                <h3 className="text-sm font-extrabold text-white mt-4">Élèves en tenue scolaire</h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Photo d'élèves portant la tenue de l'école. Visible sur l'espace d'accueil des parents.
                </p>
              </div>
              <div className="my-6">
                {uniformUrl ? (
                  <img src={uniformUrl} alt="Tenue scolaire" className="h-24 w-24 rounded-3xl border border-white/20 object-cover shadow-lg" />
                ) : (
                  <div className="h-24 w-24 rounded-3xl border border-dashed border-white/20 bg-white/5 flex items-center justify-center text-slate-500 shadow-inner">
                    <ImageIcon size={32} />
                  </div>
                )}
              </div>
              <label className="w-full cursor-pointer flex items-center justify-center gap-2 bg-white text-slate-900 hover:bg-slate-100 font-bold py-3 rounded-2xl text-xs transition duration-300">
                <Upload size={14} />
                {uploadingUniform ? 'Envoi...' : 'Uploader la tenue'}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={e => e.target.files?.[0] && void handleFileUpload('uniform', e.target.files[0])} 
                  className="hidden" 
                />
              </label>
            </div>
          </div>
        </main>

        {/* Wizard Footer */}
        <footer className="max-w-5xl mx-auto w-full border-t border-white/5 pt-5 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldAlert size={14} className="text-pink-500" />
            <span>Tous les champs sont requis pour valider la configuration et activer le système.</span>
          </div>
          <button
            onClick={() => void handleFinish()}
            disabled={!logoUrl || !facadeUrl || !uniformUrl}
            className="rounded-2xl bg-emerald-500 text-slate-950 font-bold px-8 py-4 text-sm transition hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-emerald-500 shadow-lg shadow-emerald-500/25"
          >
            Accéder à l'application
          </button>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="px-4 pb-8 pt-5 lg:px-6">
        <div className="mx-auto max-w-[1480px]">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
