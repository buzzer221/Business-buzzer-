import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  DollarSign, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';
import { Client } from '../types/index.js';

export const ClientsPage: React.FC = () => {
  const { user, isAdmin, isManager } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    balanceDue: '0',
  });

  const loadClients = async () => {
    setIsLoading(true);
    try {
      const data = await api.getClients();
      setClients(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur chargement clients' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      setFeedback({ type: 'error', message: 'Nom et téléphone obligatoires.' });
      return;
    }

    try {
      await api.addClient({
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        balanceDue: parseFloat(formData.balanceDue) || 0,
      });

      setFeedback({ type: 'success', message: 'Nouveau client ajouté avec succès.' });
      setShowAddModal(false);
      setFormData({ name: '', phone: '', email: '', address: '', balanceDue: '0' });
      loadClients();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err?.message || 'Erreur lors de la création du client' });
    }
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm)
  );

  const totalOutstanding = clients.reduce((sum, c) => sum + (c.balanceDue || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Répertoire Clients & Créances
            </h1>
            <span className="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              Carnet d'adresses
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Gestion des acheteurs récurrents, coordonnées et suivi des soldes dus.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadClients()}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold shadow-md transition"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Client</span>
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

      {/* KPI Outstanding */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">Nombre de Clients Actifs</div>
          <div className="text-3xl font-black text-slate-900 mt-2">{clients.length}</div>
          <div className="text-xs text-slate-400 mt-1">Supermarchés, grossistes, boulangeries</div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="text-xs font-bold uppercase text-slate-500">Total des Créances Clients (Soldes Dûs)</div>
          <div className="text-3xl font-black text-rose-600 mt-2">
            {totalOutstanding.toLocaleString('fr-FR')} <span className="text-sm font-semibold text-slate-500">FCFA</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">Règlements en attente de versement</div>
        </div>
      </div>

      {/* Search & List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <div className="relative w-full max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Rechercher par nom ou téléphone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {filteredClients.map(c => (
            <div key={c.id} className="p-4 rounded-xl border border-slate-200 hover:border-emerald-300 transition bg-slate-50/40 text-xs space-y-2">
              <div className="flex items-start justify-between">
                <div className="font-extrabold text-sm text-slate-900">{c.name}</div>
                {c.balanceDue > 0 ? (
                  <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-rose-100 text-rose-800">
                    Dû : {c.balanceDue.toLocaleString('fr-FR')} FCFA
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800">
                    À jour
                  </span>
                )}
              </div>

              <div className="text-slate-600 space-y-1 pt-1">
                <div className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{c.phone}</span>
                </div>
                {c.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
                {c.address && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{c.address}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Client Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-lg text-slate-900">Nouveau Client</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Raison sociale ou Nom :</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pâtisserie Le Palais Royal"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Téléphone :</label>
                <input
                  type="text"
                  required
                  placeholder="+221 77 000 00 00"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">E-mail (facultatif) :</label>
                <input
                  type="email"
                  placeholder="contact@client.sn"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Adresse de livraison :</label>
                <input
                  type="text"
                  placeholder="Quartier, Ville"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl shadow transition"
                >
                  Créer le client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
