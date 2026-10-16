import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Edit3, 
  Check, 
  UserX, 
  LogIn,
  Key,
  Trash2,
  Archive,
  RotateCcw,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { ALL_SECTORS, SectorId, User, UserRole } from '../types/index.js';
import { DeleteConfirmModal } from '../components/DeleteConfirmModal.js';

export const UtilisateursPage: React.FC = () => {
  const { user, isAdmin, isManager, switchUser, refreshAuth } = useAuth();

  const [activeTab, setActiveTab] = useState<'users' | 'trash'>('users');
  const [usersList, setUsersList] = useState<User[]>([]);
  const [deletedRecords, setDeletedRecords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTrash, setIsLoadingTrash] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [passwordTargetUser, setPasswordTargetUser] = useState<User | null>(null);
  const [deleteTargetUser, setDeleteTargetUser] = useState<User | null>(null);

  // Password modal states
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [operatorPassword, setOperatorPassword] = useState('');
  const [showPlainPassword, setShowPlainPassword] = useState(false);
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    role: 'employee' as UserRole,
    phone: '',
    sectors: ['G3'] as SectorId[],
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: 'employee' as UserRole,
    phone: '',
    active: true,
    sectors: [] as SectorId[],
  });

  const loadUsers = async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const data = await api.getUsers();
      setUsersList(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors du chargement des utilisateurs' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadTrash = async () => {
    if (!isAdmin) return;
    setIsLoadingTrash(true);
    try {
      const records = await api.getDeletedRecords();
      setDeletedRecords(records);
    } catch (err: any) {
      console.warn('Erreur chargement corbeille:', err);
    } finally {
      setIsLoadingTrash(false);
    }
  };

  useEffect(() => {
    if (isAdmin || isManager) {
      loadUsers();
      if (isAdmin) loadTrash();
    }
  }, [isAdmin, isManager]);

  // If user is neither admin nor manager, show permission denied notice
  if (!isAdmin && !isManager) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-8 text-center max-w-xl mx-auto my-12">
        <ShieldAlert className="w-12 h-12 text-rose-600 mx-auto mb-3" />
        <h2 className="text-lg font-extrabold text-rose-950">Accès Réservé à l'Administration</h2>
        <p className="text-sm text-rose-800 mt-2 leading-relaxed">
          Le module de gestion des comptes, mots de passe et d'attribution des secteurs est réservé à l'Administrateur principal (Boubacar Sene) et à la Gérante (Awa Gassama).
        </p>
      </div>
    );
  }

  const handleToggleSectorInCreate = (sec: SectorId) => {
    setCreateForm(prev => {
      const exists = prev.sectors.includes(sec);
      return {
        ...prev,
        sectors: exists ? prev.sectors.filter(s => s !== sec) : [...prev.sectors, sec],
      };
    });
  };

  const handleToggleSectorInEdit = (sec: SectorId) => {
    setEditForm(prev => {
      const exists = prev.sectors.includes(sec);
      return {
        ...prev,
        sectors: exists ? prev.sectors.filter(s => s !== sec) : [...prev.sectors, sec],
      };
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.name || !createForm.email) {
      setFeedback({ type: 'error', message: 'Nom et e-mail sont obligatoires.' });
      return;
    }

    try {
      await api.createUser({
        name: createForm.name,
        email: createForm.email,
        role: createForm.role,
        phone: createForm.phone,
        sectors: createForm.role === 'employee' ? createForm.sectors : ALL_SECTORS,
      });

      setFeedback({ type: 'success', message: `Compte ${createForm.name} créé avec succès.` });
      setShowCreateModal(false);
      setCreateForm({
        name: '',
        email: '',
        role: 'employee',
        phone: '',
        sectors: ['G3'],
      });
      await loadUsers();
      await refreshAuth();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de la création' });
    }
  };

  const handleStartEdit = (u: User) => {
    setEditingUser(u);
    setEditForm({
      name: u.name,
      email: u.email,
      role: u.role,
      phone: u.phone || '',
      active: u.active,
      sectors: [...(u.assignedSectors || [])],
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      await api.updateUser(editingUser.id, {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role,
        phone: editForm.phone,
        active: editForm.active,
        sectors: editForm.role === 'employee' ? editForm.sectors : ALL_SECTORS,
      });

      setFeedback({ type: 'success', message: `Compte ${editForm.name} mis à jour avec succès.` });
      setEditingUser(null);
      await loadUsers();
      await refreshAuth();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de la mise à jour' });
    }
  };

  const handleToggleUserActive = async (u: User) => {
    try {
      await api.updateUser(u.id, { active: !u.active });
      setFeedback({ 
        type: 'success', 
        message: `Compte ${u.name} ${!u.active ? 'réactivé' : 'désactivé'} avec succès.` 
      });
      await loadUsers();
      await refreshAuth();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur' });
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordTargetUser) return;

    if (newPassword.length < 4) {
      setFeedback({ type: 'error', message: 'Le mot de passe doit comporter au moins 4 caractères.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', message: 'La confirmation ne correspond pas au mot de passe.' });
      return;
    }

    setIsSettingPassword(true);
    setFeedback(null);
    try {
      const res = await api.setUserPassword(
        passwordTargetUser.id,
        newPassword,
        operatorPassword.trim() || undefined
      );
      setFeedback({
        type: 'success',
        message: `Mot de passe du compte ${passwordTargetUser.name} (${passwordTargetUser.role}) mis à jour avec succès. Le changement prend effet immédiatement.`,
      });
      setPasswordTargetUser(null);
      setNewPassword('');
      setConfirmPassword('');
      setOperatorPassword('');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de la modification du mot de passe.' });
    } finally {
      setIsSettingPassword(false);
    }
  };

  const handleConfirmDeleteUser = async (reason: string, opPass?: string) => {
    if (!deleteTargetUser) return;
    try {
      await api.deleteUser(deleteTargetUser.id, reason, opPass);
      setFeedback({
        type: 'success',
        message: `Le compte ${deleteTargetUser.name} a été supprimé avec archivage et journalisation d'audit.`,
      });
      setDeleteTargetUser(null);
      await loadUsers();
      if (isAdmin) await loadTrash();
      await refreshAuth();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de la suppression' });
    }
  };

  const handleRestoreRecord = async (archiveId: string) => {
    try {
      await api.restoreDeletedRecord(archiveId);
      setFeedback({
        type: 'success',
        message: 'Enregistrement restauré avec succès dans sa table active.',
      });
      await loadTrash();
      await loadUsers();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de la restauration' });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Gestion des Utilisateurs, Mots de Passe & Autorisations
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {isAdmin ? 'Boubacar Sene (Admin)' : 'Awa Gassama (Gérante)'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Définition des mots de passe avec hachage sécurisé (PBKDF2/sel), gestion des comptes et protection stricte des suppressions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              loadUsers();
              if (isAdmin) loadTrash();
            }}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Créer un compte</span>
          </button>
        </div>
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

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition ${
            activeTab === 'users'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Comptes Utilisateurs & Mots de Passe ({usersList.length})</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => {
              setActiveTab('trash');
              loadTrash();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition ${
              activeTab === 'trash'
                ? 'bg-rose-700 text-white shadow-sm'
                : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>Corbeille & Éléments Supprimés ({deletedRecords.length})</span>
          </button>
        )}
      </div>

      {/* Security Rule Card */}
      <div className="bg-emerald-50/80 border border-emerald-200 rounded-2xl p-4 text-xs text-emerald-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="space-y-1">
          <strong className="block text-emerald-900 font-extrabold text-sm">
            Règles de sécurité et gestion des mots de passe :
          </strong>
          <p className="text-emerald-800 leading-relaxed">
            • <strong>Boubacar Sene</strong> (Admin) & <strong>Awa Gassama</strong> (Gérante) sont les <strong>seuls autorisés</strong> à définir ou réinitialiser les mots de passe.<br />
            • Les employés et le vétérinaire <strong>ne peuvent pas modifier eux-mêmes</strong> leur mot de passe ni celui d'un tiers.<br />
            • Tous les mots de passe sont <strong>hachés avec sel individuel (PBKDF2)</strong>. Jamais stockés en clair, jamais affichés, jamais inscrits dans les journaux d'audit.<br />
            • <strong>Droit de suppression :</strong> Strictement exclusif à Boubacar Sene. La gérante ne dispose d'aucun droit de suppression (contrôle serveur HTTP 403).
          </p>
        </div>
        <div className="font-mono text-[11px] bg-emerald-200 px-3 py-1.5 rounded-xl text-emerald-950 font-black self-start md:self-center whitespace-nowrap">
          Sécurité Serveur Strict
        </div>
      </div>

      {/* SUBTAB 1: USERS LIST */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 font-bold text-slate-900 text-sm sm:text-base flex items-center justify-between">
            <span>Comptes enregistrés ({usersList.length})</span>
            <span className="text-xs text-slate-500 font-normal">
              Boubacar Sene, Awa Gassama, Saliou, Moustapha, Faty, Cherif, Boubacar Keita, M. Ndour
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[750px]">
              <thead>
                <tr className="bg-slate-100/70 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <th className="py-3 px-4">Utilisateur</th>
                  <th className="py-3 px-3">E-mail</th>
                  <th className="py-3 px-3">Rôle</th>
                  <th className="py-3 px-4">Secteurs Attribués</th>
                  <th className="py-3 px-3">Statut</th>
                  <th className="py-3 px-4 text-right">Mots de passe & Droits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {usersList.map(u => {
                  const isSelf = u.id === user?.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-800 text-white flex items-center justify-center font-bold text-xs uppercase">
                            {u.name[0]}
                          </div>
                          <div>
                            <div>{u.name}</div>
                            {u.phone && <div className="text-[10px] text-slate-400 font-normal">{u.phone}</div>}
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-3 font-mono text-slate-600">{u.email}</td>

                      <td className="py-3.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                          u.role === 'manager' ? 'bg-blue-100 text-blue-800' :
                          u.role === 'veterinaire' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {u.role === 'veterinaire' ? 'Vétérinaire & Gérant' : u.role}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        {u.role === 'veterinaire' ? (
                          <span className="text-[11px] font-bold text-amber-900 bg-amber-50 px-2 py-0.5 rounded inline-block">
                            Tous les secteurs (G3, G4, G5, G6)
                          </span>
                        ) : u.role === 'admin' ? (
                          <span className="text-[11px] font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded inline-block">
                            Tous (G3, G4, G5, G6) — Supervision globale
                          </span>
                        ) : u.role === 'manager' ? (
                          <span className="text-[11px] font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded inline-block">
                            Tous (G3, G4, G5, G6) — Gérance & Opérations
                          </span>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {u.assignedSectors && u.assignedSectors.length > 0 ? (
                              u.assignedSectors.map(s => (
                                <span key={s} className="px-2.5 py-0.5 rounded-lg font-black text-xs bg-emerald-800 text-white shadow-xs">
                                  Secteur {s}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">Aucun secteur affecté</span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          u.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                        }`}>
                          {u.active ? 'Actif' : 'Désactivé'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {/* Définir / Réinitialiser Mot de passe */}
                          <button
                            onClick={() => {
                              setPasswordTargetUser(u);
                              setNewPassword('');
                              setConfirmPassword('');
                              setOperatorPassword('');
                              setShowPlainPassword(false);
                            }}
                            className="px-2.5 py-1.5 rounded-lg font-bold text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 transition"
                            title="Définir ou réinitialiser le mot de passe"
                          >
                            <Key className="w-3.5 h-3.5 text-amber-700" />
                            <span>Mot de passe</span>
                          </button>

                          {/* Tester Connexion */}
                          <button
                            onClick={() => switchUser(u.id)}
                            className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] flex items-center gap-1 transition ${
                              isSelf
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm'
                            }`}
                            title="Se connecter avec ce compte"
                          >
                            <LogIn className="w-3 h-3" />
                            <span>{isSelf ? 'Connecté' : 'Tester'}</span>
                          </button>

                          {/* Modifier */}
                          <button
                            onClick={() => handleStartEdit(u)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                            title="Modifier"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Activer/Désactiver */}
                          {!isSelf && (
                            <button
                              onClick={() => handleToggleUserActive(u)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-rose-600 transition"
                              title={u.active ? 'Désactiver' : 'Réactiver'}
                            >
                              <UserX className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Supprimer (STRICTEMENT BOUBACAR SENE ADMIN) */}
                          {isAdmin && !isSelf && (
                            <button
                              onClick={() => setDeleteTargetUser(u)}
                              className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition"
                              title="Supprimer définitivement ce compte"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: TRASH & RECOVERY (ADMIN ONLY) */}
      {activeTab === 'trash' && isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <Archive className="w-4 h-4 text-rose-600" />
                <span>Corbeille Sécurisée & Traçabilité des Suppressions</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Chaque élément supprimé par Boubacar Sene est conservé ici avec son motif pour audit et restauration éventuelle.
              </p>
            </div>

            <button
              onClick={loadTrash}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTrash ? 'animate-spin' : ''}`} />
              <span>Actualiser</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-slate-100/70 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                  <th className="py-3 px-4">Date de suppression</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-4">Détails de l'élément</th>
                  <th className="py-3 px-4">Auteur & Motif</th>
                  <th className="py-3 px-4 text-right">Restauration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {deletedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Aucun enregistrement dans la corbeille.
                    </td>
                  </tr>
                ) : (
                  deletedRecords.map(rec => (
                    <tr key={rec.id} className="hover:bg-slate-50 transition">
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {new Date(rec.deletedAt).toLocaleDateString('fr-FR')} {new Date(rec.deletedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-200 text-slate-800">
                          {rec.entityType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-800 max-w-xs truncate">
                        {rec.entityType === 'collection' && `Ramassage ${rec.data?.sector} - ${rec.data?.slot} (${rec.data?.trays || 0} plat.)`}
                        {rec.entityType === 'stock' && `Stock ${rec.data?.movementType} (${rec.data?.quantity} ${rec.data?.itemType}, ${rec.data?.sector})`}
                        {rec.entityType === 'sale' && `Vente ${rec.data?.clientName} (${rec.data?.totalAmount} FCFA)`}
                        {rec.entityType === 'invoice' && `Facture ${rec.data?.number} (${rec.data?.clientName})`}
                        {rec.entityType === 'mortality' && `Mortalité ${rec.data?.count} sujets (${rec.data?.sector})`}
                        {rec.entityType === 'user' && `Utilisateur ${rec.data?.name} (${rec.data?.email})`}
                        {rec.entityType === 'treatment' && `Traitement ${rec.data?.productName} (${rec.data?.sector})`}
                        {rec.entityType === 'vaccination' && `Vaccin ${rec.data?.vaccineName} (${rec.data?.sector})`}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{rec.deletedByName}</div>
                        <div className="text-[11px] text-slate-500 italic mt-0.5">{rec.reason}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleRestoreRecord(rec.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs inline-flex items-center gap-1 transition"
                          title="Restaurer cet élément"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Restaurer</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: SET / RESET PASSWORD */}
      {passwordTargetUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900">Définir le mot de passe</h3>
                  <p className="text-xs text-slate-500">{passwordTargetUser.name} ({passwordTargetUser.role.toUpperCase()})</p>
                </div>
              </div>
              <button
                onClick={() => setPasswordTargetUser(null)}
                className="text-slate-400 hover:text-slate-700 font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePassword} className="space-y-4 mt-4 text-xs">
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900 leading-relaxed">
                <strong>Sécurité & Confidentialité :</strong> L'ancien mot de passe n'est pas requis. Le nouveau mot de passe sera haché avec un sel individuel (PBKDF2) et prendra effet immédiatement. Il ne sera jamais stocké ni affiché en clair.
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Nouveau mot de passe ou code PIN <span className="text-rose-600">*</span> :
                </label>
                <div className="relative">
                  <input
                    type={showPlainPassword ? 'text' : 'password'}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Au moins 4 caractères"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 pr-10 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPlainPassword(!showPlainPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPlainPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-800 block mb-1">
                  Confirmer le nouveau mot de passe <span className="text-rose-600">*</span> :
                </label>
                <input
                  type={showPlainPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Répétez le mot de passe"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-sm font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Mot de passe de confirmation de l'opérateur ({user?.name}) :
                </label>
                <input
                  type="password"
                  value={operatorPassword}
                  onChange={(e) => setOperatorPassword(e.target.value)}
                  placeholder="Votre mot de passe personnel actuel"
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 font-mono focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Requis pour valider cette opération sensible.
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPasswordTargetUser(null)}
                  disabled={isSettingPassword}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSettingPassword || !newPassword}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  <span>{isSettingPassword ? 'Enregistrement...' : 'Enregistrer le mot de passe'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRM DELETE USER (BOUBACAR SENE ONLY) */}
      {deleteTargetUser && (
        <DeleteConfirmModal
          isOpen={!!deleteTargetUser}
          onClose={() => setDeleteTargetUser(null)}
          onConfirm={handleConfirmDeleteUser}
          title={`Supprimer le compte de ${deleteTargetUser.name}`}
          itemDetails={[
            { label: 'Nom complet', value: deleteTargetUser.name },
            { label: 'Rôle', value: deleteTargetUser.role.toUpperCase() },
            { label: 'E-mail', value: deleteTargetUser.email },
            { label: 'Secteurs', value: deleteTargetUser.assignedSectors?.join(', ') || 'Tous' },
          ]}
          warningMessage="Attention : La suppression d'un compte révoquera tous ses jetons de session actifs. Une copie est archivée dans la corbeille pour traçabilité."
        />
      )}

      {/* MODAL 3: CREATE USER */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-lg text-slate-900">Créer un nouveau compte</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nom complet :</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Babacar Diouf"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Adresse E-mail :</label>
                <input
                  type="email"
                  required
                  placeholder="ex: awa@poulaillercampement.sn"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Rôle :</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as UserRole })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800"
                  >
                    <option value="employee">Employé (Restreint aux secteurs)</option>
                    <option value="manager">Gérante / Manager</option>
                    <option value="veterinaire">Vétérinaire & Responsable Sanitaire (Gérant)</option>
                    <option value="admin">Administrateur Principal</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Téléphone :</label>
                  <input
                    type="tel"
                    placeholder="+221 77 000 00 00"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800"
                  />
                </div>
              </div>

              {/* Multi-Sector Selector in Create */}
              {createForm.role === 'employee' && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <label className="font-bold text-emerald-950 block mb-2">
                    Attribution des secteurs (G3, G4, G5, G6) :
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {ALL_SECTORS.map(sec => {
                      const isSelected = createForm.sectors.includes(sec);
                      return (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => handleToggleSectorInCreate(sec)}
                          className={`py-2 px-2 rounded-xl font-black text-xs flex items-center justify-center gap-1 transition ${
                            isSelected
                              ? 'bg-emerald-800 text-white shadow'
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          <span>{sec}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow transition"
                >
                  Créer l'utilisateur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: EDIT USER */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-lg text-slate-900">Modifier : {editingUser.name}</h3>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Nom complet :</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">E-mail :</label>
                <input
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-mono text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Rôle :</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800"
                  >
                    <option value="employee">Employé (Restreint aux secteurs)</option>
                    <option value="manager">Gérante / Manager</option>
                    <option value="veterinaire">Vétérinaire & Responsable Sanitaire (Gérant)</option>
                    <option value="admin">Administrateur Principal</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Statut :</label>
                  <select
                    value={editForm.active ? 'true' : 'false'}
                    onChange={(e) => setEditForm({ ...editForm, active: e.target.value === 'true' })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-semibold text-slate-800"
                  >
                    <option value="true">Actif</option>
                    <option value="false">Désactivé</option>
                  </select>
                </div>
              </div>

              {/* Multi-Sector Selector in Edit */}
              {editForm.role === 'employee' && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <label className="font-bold text-emerald-950 block mb-2">
                    Attribution des secteurs (G3, G4, G5, G6) :
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {ALL_SECTORS.map(sec => {
                      const isSelected = editForm.sectors.includes(sec);
                      return (
                        <button
                          key={sec}
                          type="button"
                          onClick={() => handleToggleSectorInEdit(sec)}
                          className={`py-2 px-2 rounded-xl font-black text-xs flex items-center justify-center gap-1 transition ${
                            isSelected
                              ? 'bg-emerald-800 text-white shadow'
                              : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                          <span>{sec}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow transition"
                >
                  Sauvegarder les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
