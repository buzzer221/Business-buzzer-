import fs from 'fs';
import { db } from './server/db.js';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    throw new Error(`Test failed: ${msg}`);
  }
  console.log(`✅ [PASS] ${msg}`);
}

async function runResetAndProfilesValidation() {
  console.log('=================================================================');
  console.log('   TESTS DE CONFORMITÉ : PROFILS UTILISATEURS & REMISE À ZÉRO   ');
  console.log('=================================================================\n');

  // 1. VÉRIFICATION QUE LES ANCIENS PROFILS NE SONT PLUS ACTIFS
  console.log('--- 1. ANCIENS PROFILS RETIRÉS DES UTILISATEURS ACTIFS ---');
  const activeUsers = db.getUsers();
  const legacyNames = ['Moussa Diop', 'Amadou Fall', 'Fatou Ndiaye', 'Ibrahima Sow'];
  const legacyIds = ['usr_manager', 'usr_emp_g3', 'usr_emp_g4', 'usr_emp_g56'];

  for (const legId of legacyIds) {
    const userFound = activeUsers.find(u => u.id === legId);
    assert(userFound === undefined, `Ancien identifiant ${legId} absent des utilisateurs actifs`);
  }

  for (const legName of legacyNames) {
    const nameFound = activeUsers.find(u => u.name.includes(legName));
    assert(nameFound === undefined, `Ancien profil "${legName}" absent du menu de changement de profil et des données sources`);
  }

  assert(activeUsers.length === 8, `Exactement 8 profils actifs configurés (obtenu: ${activeUsers.length})`);

  // 2. VÉRIFICATION DES NOUVEAUX NOMS ET RÔLES ATTENDUS
  console.log('\n--- 2. PROFILS ATTENDUS, RÔLES & SECTEURS ---');
  const expectedTeam = [
    { id: 'usr_admin', namePart: 'Boubacar Sene', role: 'admin', desc: 'Administrateur principal' },
    { id: 'usr_awa_gassama', namePart: 'Awa Gassama', role: 'manager', desc: 'Gérante' },
    { id: 'usr_saliou', namePart: 'Saliou', role: 'employee', sector: 'G3', desc: 'Employé G3' },
    { id: 'usr_moustapha', namePart: 'Moustapha', role: 'employee', sector: 'G4', desc: 'Employé G4' },
    { id: 'usr_faty', namePart: 'Faty', role: 'employee', sector: 'G5', desc: 'Employée G5' },
    { id: 'usr_cherif', namePart: 'Cherif', role: 'employee', sector: 'G5', desc: 'Employé G5' },
    { id: 'usr_boubacar_keita', namePart: 'Boubacar Keita', role: 'employee', sector: 'G6', desc: 'Employé G6' },
    { id: 'usr_dr_ndour', namePart: 'M. Ndour', role: 'veterinaire', desc: 'Vétérinaire et gérant' },
  ];

  for (const exp of expectedTeam) {
    const u = db.getUser(exp.id);
    assert(u !== undefined, `Utilisateur ${exp.desc} (${exp.namePart}) existe`);
    assert(u!.role === exp.role, `Rôle conforme pour ${exp.namePart}: ${exp.role}`);
    assert(u!.name.includes(exp.namePart), `Nom conforme: ${u!.name}`);
    if (exp.sector) {
      assert(db.canAccessSector(exp.id, exp.sector as any), `${exp.namePart} associé au secteur ${exp.sector}`);
    }
  }

  // Droits de Boubacar Sene
  assert(db.getUserAllowedSectors('usr_admin').length === 4, 'Boubacar Sene conserve ses droits d\'administrateur sur tous les secteurs');
  assert(db.canAccessSector('usr_admin', 'G6'), 'Boubacar Sene a accès au secteur G6');

  // M. Ndour vétérinaire & gérant
  assert(db.getUserAllowedSectors('usr_dr_ndour').length === 4, 'M. Ndour a accès sanitaire et gérant à tous les secteurs (G3, G4, G5, G6)');

  // 3. VÉRIFICATION QUE LES STOCKS SONT STRICTEMENT À ZÉRO
  console.log('\n--- 3. STOCKS DE PLATEAUX ET D\'ŒUFS STRICTEMENT À ZÉRO ---');
  const balances = db.getStockBalances();
  for (const sec of ['G3', 'G4', 'G5', 'G6', 'CENTRAL'] as const) {
    assert(balances[sec].oefsStandards === 0, `Secteur ${sec} - Œufs standards à 0`);
    assert(balances[sec].oefsFeles === 0, `Secteur ${sec} - Œufs fêlés à 0`);
    assert(balances[sec].plateauxVides === 0, `Secteur ${sec} - Plateaux vides à 0`);
    assert(balances[sec].alimentKg === 0, `Secteur ${sec} - Aliment à 0`);
  }

  // 4. VÉRIFICATION DES HISTORIQUES OPÉRATIONNELS VIDÉS
  console.log('\n--- 4. HISTORIQUES OPÉRATIONNELS PURGÉS ---');
  assert(db.getCollections().length === 0, 'Ramassages : liste vide (0)');
  assert(db.getStockMovements().length === 0, 'Mouvements de stock : liste vide (0)');
  assert(db.getMortalityRecords().length === 0, 'Mortalités / Pertes : liste vide (0)');
  assert(db.getSales().length === 0, 'Ventes : liste vide (0)');
  assert(db.getInvoices().length === 0, 'Factures : liste vide (0)');
  assert(db.getMedications().length === 0, 'Médicaments : liste vide (0)');
  assert(db.getMedicationMovements().length === 0, 'Mouvements médicaments : liste vide (0)');
  assert(db.getVaccines().length === 0, 'Vaccins : liste vide (0)');
  assert(db.getVaccinations().length === 0, 'Vaccinations programmées / réalisées : liste vide (0)');
  assert(db.getSanitaryTreatments().length === 0, 'Traitements sanitaires : liste vide (0)');

  // Chiffres et compteurs du tableau de bord
  const today = new Date().toISOString().split('T')[0];
  const summary = db.getDailySummary(today);
  assert(summary.totalEggs === 0, 'Tableau de bord : Total œufs aujourd\'hui à 0');
  assert(summary.totalCracked === 0, 'Tableau de bord : Total fêlés à 0');
  assert(summary.totalDeposited === 0, 'Tableau de bord : Total déposés à 0');
  assert(summary.isComplete === false, 'Tableau de bord : Journée non clôturée');

  // 5. VÉRIFICATION DE LA PERSISTANCE RÉELLE SUR LE FICHIER DISQUE
  console.log('\n--- 5. VÉRIFICATION DE LA PERSISTANCE SUR DISQUE (data/avipo_db.json) ---');
  const diskRaw = fs.readFileSync('data/avipo_db.json', 'utf-8');
  const diskJson = JSON.parse(diskRaw);

  assert(diskJson.collections.length === 0, 'Persistance disque : collections est []');
  assert(diskJson.stockMovements.length === 0, 'Persistance disque : stockMovements est []');
  assert(diskJson.mortality.length === 0, 'Persistance disque : mortality est []');
  assert(diskJson.sales.length === 0, 'Persistance disque : sales est []');
  assert(diskJson.invoices.length === 0, 'Persistance disque : invoices est []');
  assert(diskJson.medications.length === 0, 'Persistance disque : medications est []');
  assert(diskJson.vaccines.length === 0, 'Persistance disque : vaccines est []');
  assert(diskJson.users.length === 8, 'Persistance disque : 8 utilisateurs enregistrés');

  const diskLegacy = diskJson.users.some((u: any) => legacyIds.includes(u.id));
  assert(!diskLegacy, 'Persistance disque : aucun compte ancien dans le fichier JSON');

  console.log('\n=================================================================');
  console.log('   TOUS LES TESTS DE PROFIL ET DE REMISE À ZÉRO SONT VALIDÉS !   ');
  console.log('=================================================================');
}

runResetAndProfilesValidation().catch(err => {
  console.error('Erreur test reset:', err);
  process.exit(1);
});
