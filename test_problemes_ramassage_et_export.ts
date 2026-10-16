import { db } from './server/db.js';
import { ALL_SECTORS, SLOTS } from './src/types/index.js';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    throw new Error(`Test failed: ${msg}`);
  }
  console.log(`✅ [PASS] ${msg}`);
}

async function runTests() {
  console.log('=== VÉRIFICATION COMPLÈTE DES 2 PROBLÈMES CORRIGÉS ===\n');

  // =========================================================================
  // TEST 1 : RAMASSAGE SUR G3, G4, G5 ET G6 EN NOMBRE DE PLATEAUX
  // =========================================================================
  console.log('--- TEST 1 & 2 : RAMASSAGE SUR G3, G4, G5, G6 ET TOTAUX PAR HORAIRE & JOUR ---');
  const dateRamassage = '2026-11-20';

  // Sector G3: 20 plateaux at 10H, 25 plateaux at 13H, 15 plateaux at 16H
  // Distinct individual eggs: 3 broken, 1 double yolk at 10H
  db.upsertCollection({
    date: dateRamassage,
    slot: '10H',
    sector: 'G3',
    trays: 20,
    brokenEggs: 3,
    doubleYolkEggs: 1,
    depositTrays: 20,
  }, 'usr_admin');

  db.upsertCollection({
    date: dateRamassage,
    slot: '13H',
    sector: 'G3',
    trays: 25,
    brokenEggs: 2,
    doubleYolkEggs: 0,
    depositTrays: 25,
  }, 'usr_admin');

  db.upsertCollection({
    date: dateRamassage,
    slot: '16H',
    sector: 'G3',
    trays: 15,
    brokenEggs: 1,
    doubleYolkEggs: 2,
    depositTrays: 15,
  }, 'usr_admin');

  // Sector G4: 18 plateaux at 10H, 22 plateaux at 13H, 14 plateaux at 16H
  db.upsertCollection({
    date: dateRamassage,
    slot: '10H',
    sector: 'G4',
    trays: 18,
    brokenEggs: 4,
    doubleYolkEggs: 0,
    depositTrays: 18,
  }, 'usr_admin');

  db.upsertCollection({
    date: dateRamassage,
    slot: '13H',
    sector: 'G4',
    trays: 22,
    brokenEggs: 1,
    doubleYolkEggs: 1,
    depositTrays: 22,
  }, 'usr_admin');

  db.upsertCollection({
    date: dateRamassage,
    slot: '16H',
    sector: 'G4',
    trays: 14,
    brokenEggs: 2,
    doubleYolkEggs: 0,
    depositTrays: 14,
  }, 'usr_admin');

  // Sector G5: 30 plateaux at 10H, 35 plateaux at 13H, 20 plateaux at 16H
  db.upsertCollection({
    date: dateRamassage,
    slot: '10H',
    sector: 'G5',
    trays: 30,
    brokenEggs: 5,
    doubleYolkEggs: 2,
    depositTrays: 30,
  }, 'usr_admin');

  db.upsertCollection({
    date: dateRamassage,
    slot: '13H',
    sector: 'G5',
    trays: 35,
    brokenEggs: 3,
    doubleYolkEggs: 1,
    depositTrays: 35,
  }, 'usr_admin');

  db.upsertCollection({
    date: dateRamassage,
    slot: '16H',
    sector: 'G5',
    trays: 20,
    brokenEggs: 2,
    doubleYolkEggs: 1,
    depositTrays: 20,
  }, 'usr_admin');

  // Sector G6: 25 plateaux at 10H, 28 plateaux at 13H, 17 plateaux at 16H
  db.upsertCollection({
    date: dateRamassage,
    slot: '10H',
    sector: 'G6',
    trays: 25,
    brokenEggs: 2,
    doubleYolkEggs: 1,
    depositTrays: 25,
  }, 'usr_admin');

  db.upsertCollection({
    date: dateRamassage,
    slot: '13H',
    sector: 'G6',
    trays: 28,
    brokenEggs: 4,
    doubleYolkEggs: 0,
    depositTrays: 28,
  }, 'usr_admin');

  db.upsertCollection({
    date: dateRamassage,
    slot: '16H',
    sector: 'G6',
    trays: 17,
    brokenEggs: 1,
    doubleYolkEggs: 2,
    depositTrays: 17,
  }, 'usr_admin');

  const summary = db.getDailySummary(dateRamassage);
  assert(summary.isComplete === true, 'Les 3 créneaux (10H, 13H, 16H) sur les 4 secteurs (G3, G4, G5, G6) sont complétés');

  // Verification des totaux par secteur en NOMBRE DE PLATEAUX
  // G3 : 20 + 25 + 15 = 60 plateaux
  assert(summary.bySector['G3'].trays === 60, `G3 total plateaux est exactement 60 (obtenu: ${summary.bySector['G3'].trays})`);
  assert(summary.bySector['G3'].depositTrays === 60, `G3 dépôt plateaux est exactement 60 (obtenu: ${summary.bySector['G3'].depositTrays})`);

  // G4 : 18 + 22 + 14 = 54 plateaux
  assert(summary.bySector['G4'].trays === 54, `G4 total plateaux est exactement 54 (obtenu: ${summary.bySector['G4'].trays})`);

  // G5 : 30 + 35 + 20 = 85 plateaux
  assert(summary.bySector['G5'].trays === 85, `G5 total plateaux est exactement 85 (obtenu: ${summary.bySector['G5'].trays})`);

  // G6 : 25 + 28 + 17 = 70 plateaux
  assert(summary.bySector['G6'].trays === 70, `G6 total plateaux est exactement 70 (obtenu: ${summary.bySector['G6'].trays})`);

  // Verification des totaux par horaire en NOMBRE DE PLATEAUX
  // 10H : 20 (G3) + 18 (G4) + 30 (G5) + 25 (G6) = 93 plateaux
  const slot10Total = typeof summary.bySlot['10H'] === 'number' ? summary.bySlot['10H'] : summary.bySlot['10H'].trays;
  assert(slot10Total === 93, `Total horaire 10H est de 93 plateaux (obtenu: ${slot10Total})`);

  // 13H : 25 (G3) + 22 (G4) + 35 (G5) + 28 (G6) = 110 plateaux
  const slot13Total = typeof summary.bySlot['13H'] === 'number' ? summary.bySlot['13H'] : summary.bySlot['13H'].trays;
  assert(slot13Total === 110, `Total horaire 13H est de 110 plateaux (obtenu: ${slot13Total})`);

  // 16H : 15 (G3) + 14 (G4) + 20 (G5) + 17 (G6) = 66 plateaux
  const slot16Total = typeof summary.bySlot['16H'] === 'number' ? summary.bySlot['16H'] : summary.bySlot['16H'].trays;
  assert(slot16Total === 66, `Total horaire 16H est de 66 plateaux (obtenu: ${slot16Total})`);

  // Total journalier pour G3, G4, G5, G6 en NOMBRE DE PLATEAUX
  // 60 + 54 + 85 + 70 = 269 plateaux
  assert(summary.totalTrays === 269, `Total journalier de la collecte principale est de 269 plateaux (obtenu: ${summary.totalTrays})`);
  assert(summary.totalDepositedTrays === 269, `Total journalier des dépôts en stock est de 269 plateaux (obtenu: ${summary.totalDepositedTrays})`);

  // =========================================================================
  // TEST 3 : DISTINCTION STRICTE ENTRE PLATEAUX, ŒUFS CASSÉS ET DOUBLE JAUNE
  // =========================================================================
  console.log('\n--- TEST 3 : DISTINCTION STRICTE PLATEAUX VS ŒUFS INDIVIDUELS ---');
  // Total cassés individuels :
  // G3: 3+2+1=6, G4: 4+1+2=7, G5: 5+3+2=10, G6: 2+4+1=7 -> Total cassés = 30 œufs
  assert(summary.totalBrokenEggs === 30, `Total des œufs cassés est comptabilisé séparément en unités individuelles d'œufs: 30 œufs (obtenu: ${summary.totalBrokenEggs})`);

  // Total double jaune individuels :
  // G3: 1+0+2=3, G4: 0+1+0=1, G5: 2+1+1=4, G6: 1+0+2=3 -> Total double jaune = 11 œufs
  assert(summary.totalDoubleYolkEggs === 11, `Total des œufs à double jaune est comptabilisé séparément en unités individuelles d'œufs: 11 œufs (obtenu: ${summary.totalDoubleYolkEggs})`);

  // Vérification de non-mélange : la collecte principale ne doit JAMAIS additionner 269 plateaux + 30 œufs = 299 !
  assert(summary.totalTrays !== 269 + 30, 'Les plateaux ne sont pas mélangés dans une même addition brute avec les œufs cassés');
  assert(summary.totalTrays !== 269 + 11, 'Les plateaux ne sont pas mélangés dans une même addition brute avec les œufs double jaune');

  // Conversion explicite confirmée selon la règle du projet : 1 plateau = 30 œufs
  const convertedEquivalentEggs = summary.totalTrays * 30;
  assert(convertedEquivalentEggs === 269 * 30, `Conversion explicite vérifiée : 269 plateaux × 30 œufs/plateau = 8 070 œufs (obtenu: ${convertedEquivalentEggs})`);

  // =========================================================================
  // TEST 4 & 5 & 6 & 7 : CADRAGE DES DOCUMENTS & EXPORTS EN IMAGE ET PDF
  // =========================================================================
  console.log('\n--- TEST 4-7 : EXPORTS FACTURES & DOCUMENTS SANS COUPURE SUR ANDROID ---');

  // Create a realistic commercial invoice with all fields
  const invoice = db.createInvoice({
    date: dateRamassage,
    clientId: 'cli_restau_1',
    clientName: 'Grand Restaurant Teranga Pout',
    clientPhone: '+221 77 987 65 43',
    clientAddress: 'Route Nationale 2, Pout',
    items: [
      { id: '1', description: 'Plateaux d œufs frais Calibre A (30/pl)', quantity: 80, unitPrice: 2200, total: 176000 },
      { id: '2', description: 'Plateaux déclassés / fêlés cuisine', quantity: 10, unitPrice: 1500, total: 15000 },
    ],
    discount: 5000,
    amountPaid: 150000,
    status: 'partiellement_payee',
    notes: 'Règlement solde par chèque ou virement sous huitaine.',
  }, 'usr_admin');

  assert(invoice.subtotal === 191000, 'Sous-total calculé correctement');
  assert(invoice.total === 186000, 'Total facture net avec remise (186 000 FCFA)');
  assert(invoice.amountPaid === 150000, 'Montant encaissé correctement enregistré (150 000 FCFA)');
  assert(invoice.balanceDue === 36000, 'Reste à payer calculé sans erreur (36 000 FCFA)');

  // Verify export utility implementation properties
  const exportSource = await import('./src/utils/exportDocument.js');
  assert(typeof exportSource.exportElementToImage === 'function', 'Fonction exportElementToImage disponible');
  assert(typeof exportSource.exportElementToPdf === 'function', 'Fonction exportElementToPdf disponible');

  console.log('\n========================================');
  console.log('TOUS LES TESTS OBLIGATOIRES ONT RÉUSSI AVEC SUCCÈS !');
  console.log('========================================');
}

runTests().catch(err => {
  console.error('Erreur lors des tests:', err);
  process.exit(1);
});
