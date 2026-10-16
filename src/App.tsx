import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.js';
import { DashboardLayout } from './components/DashboardLayout.js';
import { DashboardPage } from './pages/Dashboard.js';
import { RamassagePage } from './pages/Ramassage.js';
import { StocksPage } from './pages/Stocks.js';
import { MortalitePage } from './pages/Mortalite.js';
import { VentesPage } from './pages/Ventes.js';
import { FacturesPage } from './pages/Factures.js';
import { ClientsPage } from './pages/Clients.js';
import { RapportsPage } from './pages/Rapports.js';
import { UtilisateursPage } from './pages/Utilisateurs.js';
import { ParametresPage } from './pages/Parametres.js';
import { SuiviVeterinairePage } from './pages/SuiviVeterinaire.js';
import { LoginPage } from './components/LoginPage.js';

function AppContent() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-bold text-slate-300">Chargement de la session POULAILLER CAMPEMENT...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardPage onNavigate={setCurrentTab} />;
      case 'ramassage':
        return <RamassagePage />;
      case 'stocks':
        return <StocksPage />;
      case 'mortalite':
        return <MortalitePage />;
      case 'veterinaire':
        return <SuiviVeterinairePage />;
      case 'ventes':
        return <VentesPage />;
      case 'factures':
        return <FacturesPage />;
      case 'clients':
        return <ClientsPage />;
      case 'rapports':
        return <RapportsPage />;
      case 'utilisateurs':
        return <UtilisateursPage />;
      case 'parametres':
        return <ParametresPage />;
      default:
        return <DashboardPage onNavigate={setCurrentTab} />;
    }
  };

  return (
    <DashboardLayout currentTab={currentTab} onTabChange={setCurrentTab}>
      {renderContent()}
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
