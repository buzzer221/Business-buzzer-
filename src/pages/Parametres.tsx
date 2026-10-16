import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Mail, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Save, 
  Eye, 
  Database, 
  Sliders, 
  ShieldCheck, 
  Server
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { EmailLog, FarmSettings } from '../types/index.js';

export const ParametresPage: React.FC = () => {
  const { user, isAdmin } = useAuth();

  const [settings, setSettings] = useState<FarmSettings | null>(null);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [previewLog, setPreviewLog] = useState<EmailLog | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sett, logs] = await Promise.all([
        api.getSettings(),
        api.getEmailLogs().catch(() => []),
      ]);
      setSettings(sett);
      setEmailLogs(logs);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors du chargement des paramètres' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setIsSaving(true);
    setFeedback(null);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      setFeedback({ type: 'success', message: 'Paramètres enregistrés avec succès.' });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur enregistrement paramètres' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setIsTestingEmail(true);
    setFeedback(null);
    try {
      const res = await api.testEmail(settings?.managerEmail || 'boubacarsene8@gmail.com');
      if (res.success) {
        setFeedback({ 
          type: 'success', 
          message: `E-mail de test envoyé avec succès à ${settings?.managerEmail || 'boubacarsene8@gmail.com'}. ${res.simulated ? '(Mode simulation non-bloquant actif)' : ''}` 
        });
      } else {
        setFeedback({ type: 'error', message: res.error || 'Erreur envoi e-mail' });
      }
      await loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Échec du test e-mail' });
    } finally {
      setIsTestingEmail(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Paramètres & Configuration E-mail
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              SMTP & Exploitation
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Configuration du destinataire boubacarsene8@gmail.com, notifications de ramassage 10H-13H-16H et journal sans secrets.
          </p>
        </div>

        <button
          onClick={() => loadData()}
          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          title="Actualiser"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl text-sm flex items-start gap-3 border ${
          feedback.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'
        }`}>
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          )}
          <div className="flex-1 font-medium">{feedback.message}</div>
          <button onClick={() => setFeedback(null)} className="text-xs font-bold underline opacity-70 hover:opacity-100">
            Fermer
          </button>
        </div>
      )}

      {/* Main Settings Form */}
      {settings && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Box 1: Farm General Details */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2 border-b border-slate-100 pb-3">
                <Sliders className="w-4 h-4 text-emerald-700" />
                <span>Identité de l'Exploitation</span>
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Nom de l'exploitation :</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={settings.farmName}
                    onChange={(e) => setSettings({ ...settings, farmName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 font-bold disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Localisation / Adresse :</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={settings.address}
                    onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 disabled:opacity-60"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Téléphone de contact :</label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={settings.phone}
                      onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Devise :</label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      value={settings.currency}
                      onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 font-bold disabled:opacity-60"
                    />
                  </div>
                </div>
              </div>

              {/* Flock counts per sector */}
              <div className="pt-3 border-t border-slate-100">
                <label className="font-bold text-slate-800 text-xs block mb-2">
                  Effectifs de poules pondeuses par bâtiment :
                </label>
                <div className="grid grid-cols-4 gap-2 text-xs">
                  {(['G3', 'G4', 'G5', 'G6'] as const).map(sec => (
                    <div key={sec} className="bg-slate-50 p-2 rounded-xl border border-slate-200 text-center">
                      <span className="font-extrabold text-[11px] text-emerald-800 block">{sec}</span>
                      <input
                        type="number"
                        disabled={!isAdmin}
                        value={settings.sectorFlocks[sec] || 0}
                        onChange={(e) => setSettings({
                          ...settings,
                          sectorFlocks: {
                            ...settings.sectorFlocks,
                            [sec]: parseInt(e.target.value, 10) || 0,
                          },
                        })}
                        className="w-full text-center font-bold text-xs bg-white border border-slate-300 rounded p-1 mt-1 disabled:opacity-60"
                      />
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Box 2: Automated Email Configuration */}
            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-700" />
                  <span>Destinataire & Paramètres SMTP</span>
                </h3>

                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={isTestingEmail || !isAdmin}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition shadow disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${isTestingEmail ? 'animate-spin' : ''}`} />
                  <span>{isTestingEmail ? 'Test en cours...' : 'Tester l\'envoi'}</span>
                </button>
              </div>

              <div className="space-y-3 text-xs">
                {/* Official Target Recipient */}
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <label className="font-bold text-emerald-950 block mb-1">
                    Destinataire du rapport quotidien (10H + 13H + 16H) :
                  </label>
                  <input
                    type="email"
                    required
                    disabled={!isAdmin}
                    value={settings.managerEmail}
                    onChange={(e) => setSettings({ ...settings, managerEmail: e.target.value })}
                    className="w-full bg-white border border-emerald-300 rounded-xl p-2.5 font-mono font-bold text-emerald-900 text-sm focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                  />
                  <div className="text-[11px] text-emerald-700 mt-1">
                    Adresse cible configurée par défaut : <strong>boubacarsene8@gmail.com</strong>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Serveur SMTP :</label>
                    <input
                      type="text"
                      disabled={!isAdmin}
                      placeholder="smtp.gmail.com"
                      value={settings.smtpHost}
                      onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Port SMTP :</label>
                    <input
                      type="number"
                      disabled={!isAdmin}
                      value={settings.smtpPort}
                      onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value, 10) || 587 })}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 disabled:opacity-60"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Utilisateur SMTP (Compte Gmail) :</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    placeholder="votre-adresse@gmail.com"
                    value={settings.smtpUser}
                    onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Mot de passe d'application SMTP :</label>
                  <input
                    type="password"
                    disabled={!isAdmin}
                    placeholder="Mot de passe d'application Google (16 caractères)"
                    value={settings.smtpPass}
                    onChange={(e) => setSettings({ ...settings, smtpPass: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 disabled:opacity-60"
                  />
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Sécurité : Le mot de passe n'est jamais affiché ni journalisé en clair.
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Expéditeur affiché (From) :</label>
                  <input
                    type="text"
                    disabled={!isAdmin}
                    value={settings.smtpFrom}
                    onChange={(e) => setSettings({ ...settings, smtpFrom: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 disabled:opacity-60"
                  />
                </div>
              </div>

            </div>

          </div>

          {/* Box 3: Politique de Connexion & Sécurité d'Accès (Boubacar Sene Admin Principal) */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                <span>Politique de Connexion & Sécurité des Accès</span>
              </h3>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                isAdmin ? 'bg-purple-100 text-purple-900 border border-purple-200' : 'bg-slate-100 text-slate-600'
              }`}>
                {isAdmin ? 'Configuration active (Boubacar Sene)' : 'Consultation seule (Gérante)'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              
              {/* Session Duration */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <label className="font-extrabold text-slate-900 block">
                  Durée de validité de session :
                </label>
                <select
                  disabled={!isAdmin}
                  value={settings.sessionDurationHours || 24}
                  onChange={(e) => setSettings({
                    ...settings,
                    sessionDurationHours: parseInt(e.target.value, 10) || 24,
                  })}
                  className="w-full bg-white border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                >
                  <option value={1}>1 heure (Sécurité renforcée)</option>
                  <option value={4}>4 heures</option>
                  <option value={8}>8 heures (Journée de travail)</option>
                  <option value={12}>12 heures</option>
                  <option value={24}>24 heures (1 jour — Par défaut)</option>
                  <option value={48}>48 heures (2 jours)</option>
                  <option value={168}>7 jours</option>
                </select>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Après cette durée d'inactivité, le jeton de session est automatiquement invalidé côté serveur et l'utilisateur doit obligatoirement se reconnecter.
                </p>
              </div>

              {/* Re-auth for sensitive operations */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 flex flex-col justify-between">
                <div>
                  <label className="font-extrabold text-slate-900 block mb-1">
                    Ré-authentification pour opérations sensibles :
                  </label>
                  <p className="text-[11px] text-slate-500 leading-normal mb-3">
                    Exige le mot de passe personnel avant de supprimer une donnée, modifier des permissions ou réinitialiser un mot de passe.
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 pt-2 border-t border-slate-200">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={settings.requireReauthForSensitiveOps ?? true}
                    onChange={(e) => setSettings({
                      ...settings,
                      requireReauthForSensitiveOps: e.target.checked,
                    })}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 disabled:opacity-60"
                  />
                  <span>Activer la confirmation par mot de passe</span>
                </label>
              </div>

              {/* Require password on each open */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 flex flex-col justify-between">
                <div>
                  <label className="font-extrabold text-slate-900 block mb-1">
                    Authentification à chaque ouverture :
                  </label>
                  <p className="text-[11px] text-slate-500 leading-normal mb-3">
                    Exige l'identifiant et le mot de passe à chaque nouvelle ouverture ou fermeture de session. Aucun accès direct aux données privées sans connexion.
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 pt-2 border-t border-slate-200">
                  <input
                    type="checkbox"
                    disabled={!isAdmin}
                    checked={settings.requirePasswordOnAppOpen ?? true}
                    onChange={(e) => setSettings({
                      ...settings,
                      requirePasswordOnAppOpen: e.target.checked,
                    })}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 disabled:opacity-60"
                  />
                  <span>Connexion obligatoire à chaque session</span>
                </label>
              </div>

            </div>

            <div className="text-[11px] text-slate-500 p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 flex items-center justify-between">
              <span>
                Note de gouvernance : La gérante Awa Gassama a accès en consultation à ces paramètres mais ne peut ni les désactiver ni les modifier.
              </span>
              <span className="font-mono text-emerald-900 font-bold">Vérification RBAC Serveur</span>
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-6 py-2.5 rounded-xl shadow-lg transition text-xs sm:text-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Enregistrement...' : 'Enregistrer les paramètres'}</span>
              </button>
            </div>
          )}

        </form>
      )}

      {/* Email Logs Table (Audited without secrets) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-700" />
              <span>Journal des E-mails & Traçabilité des Notifications</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Historique des récapitulatifs quotidiens et factures expédiés sans exposition de secrets.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-slate-100/70 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <th className="py-3 px-4">Date & Heure</th>
                <th className="py-3 px-3">Destinataire</th>
                <th className="py-3 px-4">Objet</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3">Statut</th>
                <th className="py-3 px-3 text-right">Aperçu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {emailLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Aucun e-mail consigné pour l'instant.
                  </td>
                </tr>
              ) : (
                emailLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleDateString('fr-FR')} {new Date(log.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-800">{log.recipient}</td>
                    <td className="py-3 px-4 text-slate-900 font-semibold max-w-[240px] truncate" title={log.subject}>
                      {log.subject}
                    </td>
                    <td className="py-3 px-3 text-slate-500 capitalize">{log.type.replace('_', ' ')}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        log.status === 'sent' ? 'bg-emerald-100 text-emerald-800' :
                        log.status === 'non_configure' ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {log.status === 'sent' ? 'Envoyé (SMTP)' :
                         log.status === 'non_configure' ? 'Non configuré (Ignoré)' : 'Erreur'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {log.previewHtml && (
                        <button
                          onClick={() => setPreviewLog(log)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                          title="Voir le contenu HTML envoyé"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* HTML Email Log Preview Modal */}
      {previewLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-emerald-950 text-white flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm">Contenu Réel de l'E-mail</h4>
                <div className="text-xs text-emerald-300 font-mono mt-0.5">{previewLog.subject}</div>
              </div>
              <button onClick={() => setPreviewLog(null)} className="text-slate-400 hover:text-white font-bold">
                ✕
              </button>
            </div>

            <div className="p-4 bg-slate-100 border-b border-slate-200 text-xs text-slate-600 flex justify-between">
              <div>À : <strong>{previewLog.recipient}</strong></div>
              <div>Date : {new Date(previewLog.timestamp).toLocaleString('fr-FR')}</div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 bg-slate-50">
              <div
                className="bg-white p-4 rounded-xl border border-slate-200"
                dangerouslySetInnerHTML={{ __html: previewLog.previewHtml || '' }}
              />
            </div>

            <div className="p-3 bg-white border-t border-slate-200 text-right">
              <button
                onClick={() => setPreviewLog(null)}
                className="px-4 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
