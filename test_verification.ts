import { db } from './server/db.js';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    throw new Error(`Test failed: ${msg}`);
  }
  console.log(`✅ [PASS] ${msg}`);
}

async function runVerification() {
  console.log('=====================================================');
  console.log('   VÉRIFICATION POULAILLER CAMPEMENT — PROJET AVIPO  ');
  console.log('=====================================================\n');

  // 1. VÉRIFICATION DU NOM DE L'ENTREPRISE
  console.log('--- 1. IDENTITÉ ET NOM DE L\'ENTREPRISE ---');
  const settings = db.getSettings();
  assert(settings.farmName.includes('POULAILLER CAMPEMENT'), `Nom de l'exploitation conforme : "${settings.farmName}"`);
  assert(settings.smtpFrom.includes('POULAILLER CAMPEMENT'), `Expéditeur SMTP conforme : "${settings.smtpFrom}"`);

  // 2. VÉRIFICATION DES UTILISATEURS ET AFFECTATIONS
  console.log('\n--- 2. CONTRÔLE DES UTILISATEURS & SECTEURS ---');
  
  // Boubacar Sene
  const bsene = db.getUser('usr_admin');
  assert(!!bsene && bsene.role === 'admin', 'Boubacar Sene configuré en Administrateur principal');
  assert(db.getUserAllowedSectors('usr_admin').length === 4, 'Boubacar Sene a accès à tous les secteurs (G3, G4, G5, G6)');
  assert(db.canAccessSector('usr_admin', 'G6'), 'Boubacar Sene est associé au secteur G6');

  // Awa Gassama
  const awa = db.getUser('usr_awa_gassama');
  assert(!!awa && awa.role === 'manager', 'Awa Gassama configurée avec le rôle Gérante');
  assert(db.getUserAllowedSectors('usr_awa_gassama').length === 4, 'Awa Gassama a accès aux 4 secteurs en tant que gérante');

  // Saliou -> G3
  const saliou = db.getUser('usr_saliou');
  assert(!!saliou && saliou.role === 'employee', 'Saliou configuré avec rôle employé');
  assert(db.canAccessSector('usr_saliou', 'G3') === true, 'Saliou a accès au secteur G3');
  assert(db.canAccessSector('usr_saliou', 'G4') === false, 'Saliou n\'a PAS accès au secteur G4 (sécurité serveur)');
  assert(db.canAccessSector('usr_saliou', 'G5') === false, 'Saliou n\'a PAS accès au secteur G5 (sécurité serveur)');
  assert(db.canAccessSector('usr_saliou', 'G6') === false, 'Saliou n\'a PAS accès au secteur G6 (sécurité serveur)');

  // Moustapha -> G4
  const moustapha = db.getUser('usr_moustapha');
  assert(!!moustapha && moustapha.role === 'employee', 'Moustapha configuré avec rôle employé');
  assert(db.canAccessSector('usr_moustapha', 'G4') === true, 'Moustapha a accès au secteur G4');
  assert(db.canAccessSector('usr_moustapha', 'G3') === false, 'Moustapha n\'a PAS accès au secteur G3');
  assert(db.canAccessSector('usr_moustapha', 'G5') === false, 'Moustapha n\'a PAS accès au secteur G5');
  assert(db.canAccessSector('usr_moustapha', 'G6') === false, 'Moustapha n\'a PAS accès au secteur G6');

  // Faty & Cherif -> G5
  const faty = db.getUser('usr_faty');
  const cherif = db.getUser('usr_cherif');
  assert(!!faty && faty.role === 'employee', 'Faty configurée avec rôle employé');
  assert(!!cherif && cherif.role === 'employee', 'Cherif configuré avec rôle employé');
  assert(db.canAccessSector('usr_faty', 'G5') === true, 'Faty a accès au secteur G5');
  assert(db.canAccessSector('usr_cherif', 'G5') === true, 'Cherif a accès au secteur G5');
  assert(db.canAccessSector('usr_faty', 'G3') === false, 'Faty n\'a PAS accès au secteur G3');
  assert(db.canAccessSector('usr_cherif', 'G4') === false, 'Cherif n\'a PAS accès au secteur G4');

  // Boubacar Keita -> G6
  const bkeita = db.getUser('usr_boubacar_keita');
  assert(!!bkeita && bkeita.role === 'employee', 'Boubacar Keita configuré avec rôle employé');
  assert(db.canAccessSector('usr_boubacar_keita', 'G6') === true, 'Boubacar Keita a accès au secteur G6');
  assert(db.canAccessSector('usr_boubacar_keita', 'G5') === false, 'Boubacar Keita n\'a PAS accès au secteur G5');

  // M. Ndour -> Vétérinaire et Gérant
  const ndour = db.getUser('usr_dr_ndour');
  assert(!!ndour && ndour.role === 'veterinaire', 'M. Ndour configuré avec le rôle veterinaire');
  assert(db.getUserAllowedSectors('usr_dr_ndour').length === 4, 'M. Ndour a accès au suivi sanitaire de TOUS les secteurs (G3, G4, G5, G6)');

  // 3. VÉRIFICATION DU SUIVI PHARMACIE & MÉDICAMENTS (M. NDOUR)
  console.log('\n--- 3. SUIVI PHARMACIE & MÉDICAMENTS ---');
  const testMed = db.upsertMedication({
    name: 'Oxytétracycline 20% L.A.',
    category: 'antibiotique',
    unit: 'Flacons 100ml',
    currentStock: 20,
    minimumStockAlert: 5,
    expiryDate: '2026-12-31',
    batchNumber: 'LOT-OXY-2026-A',
  }, 'usr_dr_ndour');
  assert(!!testMed && !!testMed.id, 'Enregistrement médicament avec ID unique généré');
  assert(testMed.currentStock === 20, 'Stock initial enregistré : 20 flacons');

  // Sortie médicament avec traçabilité et validation vétérinaire
  const sortie = db.addMedicationMovement({
    medicationId: testMed.id,
    type: 'SORTIE_TRAITEMENT',
    quantity: 4,
    sector: 'G3',
    reason: 'Traitement antibactérien secteur G3',
    dosagePrescrit: '0.5ml / kg pendant 3 jours'
  }, 'usr_dr_ndour');
  assert(sortie.newStock === 16, 'Décompte de stock automatique et exact (20 - 4 = 16)');
  assert(sortie.performedBy === 'usr_dr_ndour', 'Traçabilité de l\'opérateur enregistrée (M. Ndour)');
  assert(sortie.validatedByVet === true, 'Sortie certifiée par validation vétérinaire');

  // 4. VÉRIFICATION DES VACCINS & CAMPAGNES
  console.log('\n--- 4. GESTION DES VACCINS & CAMPAGNES DE VACCINATION ---');
  const testVaccine = db.upsertVaccine({
    name: 'Vaccin Newcastle LaSota',
    targetDisease: 'Maladie de Newcastle',
    unit: 'Doses',
    quantityReceived: 15000,
    currentStock: 15000,
    minimumStockAlert: 3000,
    expiryDate: '2026-11-30',
    receptionDate: '2026-03-01',
    batchNumber: 'LOT-NC-998',
  }, 'usr_dr_ndour');
  assert(!!testVaccine && testVaccine.currentStock === 15000, 'Vaccin enregistré avec 15 000 doses en stock');

  // Planification campagne sur secteur G4
  const campaign = db.upsertVaccination({
    vaccineId: testVaccine.id,
    vaccineName: testVaccine.name,
    sector: 'G4',
    scheduledDate: '2026-03-25',
    targetBirdCount: 3500,
    status: 'PROGRAMMEE',
    administrationRoute: 'EAU_BOISSON',
    observations: 'Administration oculo-nasale stricte'
  }, 'usr_dr_ndour');
  assert(campaign.status === 'PROGRAMMEE', 'Campagne de vaccination planifiée pour secteur G4');

  // Réalisation de la vaccination par M. Ndour
  const realized = db.markVaccinationRealized(campaign.id, {
    realizedDate: '2026-03-25',
    dosesAdministered: 3500,
    observations: 'Vaccination complétée avec succès'
  }, 'usr_dr_ndour');
  assert(realized.status === 'REALISEE', 'Statut passé à REALISEE');
  assert(realized.validatedByVet === true, 'Vaccination certifiée conforme par le vétérinaire');
  const updatedVaccine = db.getVaccine(testVaccine.id);
  assert(updatedVaccine?.currentStock === 11500, 'Décompte automatique des doses en stock (15 000 - 3 500 = 11 500)');

  // 5. HISTORIQUE SANITAIRE & TRAITEMENTS POUR G3, G4, G5, G6
  console.log('\n--- 5. HISTORIQUE DES TRAITEMENTS SANITAIRES ---');
  const treatmentG5 = db.addSanitaryTreatment({
    date: '2026-03-20',
    sector: 'G5',
    diagnosis: 'Prophylaxie vitaminique après stress thermique',
    treatmentType: 'PREVENTIF',
    productName: 'Complexe polyvitaminique hydrosoluble',
    dosage: '1g par litre d eau de boisson',
    durationDays: 3,
    startDate: '2026-03-20',
    withdrawalPeriodDays: 0,
    observations: 'Surveillance de la consommation d eau'
  }, 'usr_dr_ndour');
  assert(!!treatmentG5.id, 'Traitement sanitaire enregistré avec succès sur secteur G5');
  assert(treatmentG5.validatedByVet === true, 'Traitement validé sous la responsabilité du vétérinaire');
  assert(treatmentG5.dosage === '1g par litre d eau de boisson', 'Dosage prescrit strictement préservé sans altération');

  // 6. CALCUL DES ALERTES SANITAIRES
  console.log('\n--- 6. MOTEUR D\'ALERTES SANITAIRES (STOCKS, PÉREMPTION, RAPPELS) ---');
  const alerts = db.getVeterinaryAlerts();
  assert(typeof alerts.totalAlertsCount === 'number', 'Calcul du total d\'alertes opérationnel');
  assert(Array.isArray(alerts.lowStockMedications), 'Liste des stocks médicaments faibles disponible');
  assert(Array.isArray(alerts.expiringMedications), 'Liste des médicaments proches de péremption disponible');
  assert(Array.isArray(alerts.upcomingVaccinations), 'Liste des vaccinations à venir / en retard disponible');

  // 7. VÉRIFICATION DE LA RÈGLE FINANCIÈRE DE M. NDOUR
  console.log('\n--- 7. RÈGLE FINANCIÈRE : AUCUNE COMMISSION POUR M. NDOUR ---');
  const dummySale = db.addSale({
    date: '2026-03-20',
    sector: 'G6',
    clientId: 'cli_1',
    clientName: 'Client Restauration',
    itemType: 'Alvéoles 30 œufs',
    quantity: 50,
    unitPrice: 2000,
    totalAmount: 100000,
    status: 'validee',
    recordedBy: 'usr_admin',
    recordedByName: 'Boubacar Sene'
  }, 'usr_admin');
  assert(dummySale.totalAmount === 100000, 'Montant de vente standard');
  // Vérification qu'aucun champ de commission ou de pourcentage n'existe pour M. Ndour
  const ndourData = db.getUser('usr_dr_ndour') as any;
  assert(ndourData.profitSharePercentage === undefined, 'Aucun pourcentage de bénéfice assigné à M. Ndour');
  assert(ndourData.automaticRemuneration === undefined, 'Aucune rémunération automatique assignée');

  // 8. CONSERVATION DE TOUTES LES DONNÉES HISTORIQUES
  console.log('\n--- 8. INTÉGRITÉ ET CONSERVATION DES DONNÉES HISTORIQUES ---');
  const invoices = db.getInvoices();
  assert(invoices.length >= 1, 'Factures préexistantes conservées');
  const collections = db.getCollections();
  assert(collections.length >= 10, 'Historique des ramassages préexistants conservé');
  const stocks = db.getStockMovements();
  assert(stocks.length >= 5, 'Historique des stocks d\'œufs conservé');

  console.log('\n=====================================================');
  console.log('   TOUTES LES VÉRIFICATIONS ONT RÉUSSI AVEC SUCCÈS !  ');
  console.log('=====================================================');
}

runVerification().catch(err => {
  console.error('Erreur lors de la vérification :', err);
  process.exit(1);
});
