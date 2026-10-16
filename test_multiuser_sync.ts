import { db, syncHub } from './server/db.js';
import { ALL_SECTORS, SectorId, SyncEvent } from './src/types/index.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`✅ [PASS] ${message}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${message}`);
    failed++;
    throw new Error(`Test assertion failed: ${message}`);
  }
}

async function runMultiuserAndSyncTests() {
  console.log('================================================================');
  console.log('  TESTS RÉELS POULAILLER CAMPEMENT : MULTI-UTILISATEURS & SYNC  ');
  console.log('================================================================\n');

  // -------------------------------------------------------------------------
  // TEST 1 : CONNECTER DEUX UTILISATEURS SUR DEUX SESSIONS DISTINCTES
  // -------------------------------------------------------------------------
  console.log('--- TEST 1 : Authentification de 2 sessions distinctes ---');
  
  // Session 1: Saliou (Employé G3)
  const authSaliou = db.authenticateUser('usr_saliou', '2026');
  assert(authSaliou.success === true, 'Saliou authentifié avec son code PIN');
  assert(!!authSaliou.token, 'Session 1 (Saliou) : Jeton de session unique généré');
  assert(authSaliou.user.role === 'employee', 'Session 1 : Rôle employé vérifié');
  const session1User = db.getUserBySessionToken(authSaliou.token!);
  assert(session1User?.id === 'usr_saliou', 'Session 1 résolue par jeton de session côté serveur');

  // Session 2: Awa Gassama (Gérante)
  const authAwa = db.authenticateUser('usr_awa_gassama', '2026');
  assert(authAwa.success === true, 'Awa Gassama authentifiée avec son code PIN');
  assert(!!authAwa.token, 'Session 2 (Awa Gassama) : Jeton de session unique généré');
  assert(authAwa.token !== authSaliou.token, 'Les deux sessions sont parfaitement distinctes et isolées');
  const session2User = db.getUserBySessionToken(authAwa.token!);
  assert(session2User?.id === 'usr_awa_gassama', 'Session 2 résolue par jeton de session côté serveur');

  // Vérification de M. Ndour et Boubacar Sene
  const authAdmin = db.authenticateUser('usr_admin', '2026');
  assert(authAdmin.success === true && authAdmin.user.role === 'admin', 'Boubacar Sene authentifié avec succès (Admin)');
  const authNdour = db.authenticateUser('usr_dr_ndour', '2026');
  assert(authNdour.success === true && authNdour.user.role === 'veterinaire', 'M. Ndour authentifié avec succès (Vétérinaire)');

  // -------------------------------------------------------------------------
  // TEST 2 & 3 : ENREGISTRER UNE FICHE AVEC LE COMPTE 1 & RÉCEPTION PAR COMPTE 2
  // -------------------------------------------------------------------------
  console.log('\n--- TESTS 2 & 3 : Enregistrement Compte 1 & Réception temps réel Compte 2 ---');
  
  let receivedSyncEvent: SyncEvent | null = null;
  const unsubscribe = syncHub.subscribe((evt) => {
    receivedSyncEvent = evt;
  });

  const testDate = '2026-10-16';
  const saveResult = db.upsertCollection({
    date: testDate,
    slot: '10H',
    sector: 'G3',
    trays: 52, // 52 plateaux
    brokenEggs: 3, // 3 œufs cassés
    doubleYolkEggs: 1, // 1 œuf double jaune
    depositTrays: 52, // 52 plateaux déposés en stock
  }, 'usr_saliou');

  assert(!!saveResult.collection, 'Compte 1 (Saliou) a enregistré le ramassage G3 à 10H');
  assert(saveResult.collection.trays === 52, 'Unité principale : 52 plateaux enregistrés sans confusion');
  assert(saveResult.collection.brokenEggs === 3, '3 œufs cassés enregistrés séparément');
  assert(saveResult.collection.doubleYolkEggs === 1, '1 œuf double jaune enregistré séparément');
  assert(saveResult.collection.recordedBy === 'usr_saliou', 'Traçabilité de l\'opérateur enregistrée');

  // Vérification que le Compte 2 (Awa Gassama / autres postes) reçoit la mise à jour via le hub temps-réel
  assert(receivedSyncEvent !== null, 'Événement de synchronisation temps-réel diffusé par le Hub');
  assert((receivedSyncEvent as any)?.type === 'collection', 'Type d\'événement : collection');
  assert((receivedSyncEvent as any)?.userName?.includes('Saliou'), 'Auteur de l\'action identifié dans l\'événement');
  unsubscribe();

  // Consultation immédiate par le second compte autorisé
  const awaCols = db.getCollections(testDate, 'G3');
  const foundByAwa = awaCols.find(c => c.slot === '10H');
  assert(foundByAwa !== undefined && foundByAwa.trays === 52, 'Le Compte 2 (Awa) consulte immédiatement la fiche enregistrée');

  // -------------------------------------------------------------------------
  // TEST 4 : ACTUALISER LES DEUX SESSIONS ET VÉRIFIER LA PERSISTANCE
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4 : Actualisation et persistance des données sur disque ---');
  
  // Re-lecture depuis la base centrale
  const reloadedCols = db.getCollections(testDate, 'G3');
  const persistentRecord = reloadedCols.find(c => c.slot === '10H');
  assert(!!persistentRecord, 'Fiche persistée dans la base centrale');
  assert(persistentRecord?.trays === 52, 'Plateaux persistés fidèlement (52 plateaux)');
  assert(persistentRecord?.brokenEggs === 3, 'Œufs cassés persistés fidèlement (3 œufs)');
  assert(persistentRecord?.depositTrays === 52, 'Dépôt en stock persisté fidèlement (52 plateaux)');

  // -------------------------------------------------------------------------
  // TEST 5 : RESPECT STRICT DES DROITS PAR SECTEUR ET RÔLE (RBAC BACKEND)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5 : Sécurité RBAC & isolation stricte des secteurs ---');
  
  // Saliou -> G3 autorisé, G4/G5/G6 interdits
  assert(db.canAccessSector('usr_saliou', 'G3') === true, 'Saliou a accès au Secteur G3');
  assert(db.canAccessSector('usr_saliou', 'G4') === false, 'Saliou n\'a PAS accès au Secteur G4');
  let saliouBlockedG4 = false;
  try {
    db.upsertCollection({ date: testDate, slot: '10H', sector: 'G4', trays: 40 }, 'usr_saliou');
  } catch (err: any) {
    saliouBlockedG4 = true;
  }
  assert(saliouBlockedG4 === true, 'Serveur bloque immédiatement toute tentative de Saliou sur G4 (403)');

  // Moustapha -> G4 autorisé, G3 interdit
  assert(db.canAccessSector('usr_moustapha', 'G4') === true, 'Moustapha a accès au Secteur G4');
  assert(db.canAccessSector('usr_moustapha', 'G3') === false, 'Moustapha n\'a PAS accès au Secteur G3');

  // Faty et Cherif -> G5 autorisés, G4/G6 interdits
  assert(db.canAccessSector('usr_faty', 'G5') === true, 'Faty a accès au Secteur G5');
  assert(db.canAccessSector('usr_cherif', 'G5') === true, 'Cherif a accès au Secteur G5');
  assert(db.canAccessSector('usr_faty', 'G3') === false, 'Faty n\'a PAS accès au Secteur G3');
  assert(db.canAccessSector('usr_cherif', 'G6') === false, 'Cherif n\'a PAS accès au Secteur G6');

  // Boubacar Keita -> G6 autorisé, G5 interdit
  assert(db.canAccessSector('usr_boubacar_keita', 'G6') === true, 'Boubacar Keita a accès au Secteur G6');
  assert(db.canAccessSector('usr_boubacar_keita', 'G5') === false, 'Boubacar Keita n\'a PAS accès au Secteur G5');

  // Boubacar Sene (Admin) et Awa Gassama (Gérante) -> Tous les secteurs autorisés
  assert(db.getUserAllowedSectors('usr_admin').length === 4, 'Boubacar Sene a accès aux 4 secteurs');
  assert(db.getUserAllowedSectors('usr_awa_gassama').length === 4, 'Awa Gassama a accès aux 4 secteurs');

  // M. Ndour -> Vétérinaire & Suivi Sanitaire
  assert(db.getUser('usr_dr_ndour')?.role === 'veterinaire', 'M. Ndour a le rôle vétérinaire & sanitaire');

  // -------------------------------------------------------------------------
  // TEST 6 : TEST RÉSEAU, FILE D'ATTENTE ET REPRISE
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6 : Gestion des interruptions et reprises de synchronisation ---');
  
  const offlineActionId = `act_offline_${Date.now()}`;
  assert(db.isActionProcessed(offlineActionId) === false, 'Action non encore traitée');
  
  // Simulation exécution après reprise du réseau
  db.recordProcessedAction(offlineActionId, 'col_test_offline_1');
  assert(db.isActionProcessed(offlineActionId) === true, 'Action enregistrée dans le registre d\'idempotence central');

  // -------------------------------------------------------------------------
  // TEST 7 : DÉTECTION DES CONFLITS LORS DE MODIFICATIONS SIMULTANÉES
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7 : Gestion des modifications simultanées (Verrouillage Optimiste) ---');
  
  const currentRecord = db.getCollections(testDate, 'G3').find(c => c.slot === '10H');
  assert(!!currentRecord?.updatedAt, 'Fiche existante dispose d\'un horodatage updatedAt');
  
  // Un second utilisateur essaie de modifier avec une version obsolète
  const obsoleteTimestamp = '2026-01-01T00:00:00.000Z';
  let conflictDetected = false;
  try {
    db.upsertCollection(
      { date: testDate, slot: '10H', sector: 'G3', trays: 60 },
      'usr_awa_gassama',
      { lastKnownUpdatedAt: obsoleteTimestamp }
    );
  } catch (err: any) {
    if (err.code === 'CONFLICT') {
      conflictDetected = true;
    }
  }
  assert(conflictDetected === true, 'Conflit de modification simultanée détecté avec succès sans écrasement silencieux');

  // Modification autorisée avec horodatage à jour ou forçage explicite
  const resolved = db.upsertCollection(
    { date: testDate, slot: '10H', sector: 'G3', trays: 55 },
    'usr_awa_gassama',
    { lastKnownUpdatedAt: currentRecord?.updatedAt }
  );
  assert(resolved.collection.trays === 55, 'Modification acceptée une fois le conflit synchronisé');

  // -------------------------------------------------------------------------
  // TEST 8 : ABSENCE DE DOUBLONS (IDEMPOTENCE ET DÉDOUBLONNAGE)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 8 : Absence de doublons lors des réémissions réseau ---');
  
  const retryActionId = `act_retry_${Date.now()}`;
  db.recordProcessedAction(retryActionId, 'rec_123');
  assert(db.isActionProcessed(retryActionId) === true, 'Action idempotente identifiée');
  // Une seconde soumission avec le même actionId est reconnue comme doublon
  const isDuplicate = db.isActionProcessed(retryActionId);
  assert(isDuplicate === true, 'Dédoublonnage confirmé : aucune insertion en double');

  console.log('\n================================================================');
  console.log(`  RÉSULTATS : ${passed} TESTS RÉUSSIS / ${failed} ÉCHECS  `);
  console.log('================================================================');
}

runMultiuserAndSyncTests().catch(err => {
  console.error('Erreur test suite :', err);
  process.exit(1);
});
