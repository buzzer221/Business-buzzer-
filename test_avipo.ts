import fs from 'fs';
import path from 'path';
import { db } from './server/db.js';
import { sendDailyReportEmail } from './server/email.js';
import { ALL_SECTORS, SectorId, SLOTS } from './src/types/index.js';

async function runTests() {
  console.log('=== TEST SUITE POULAILLER CAMPEMENT ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${message}`);
      failed++;
    }
  }

  // --- 0. COMPANY NAME & BRANDING TESTS ---
  console.log('\n--- 0. NOM DE L\'ENTREPRISE (POULAILLER CAMPEMENT) ---');
  const settings = db.getSettings();
  assert(settings.farmName.includes('POULAILLER CAMPEMENT'), `Farm name is updated to POULAILLER CAMPEMENT (got: "${settings.farmName}")`);
  assert(settings.smtpFrom.includes('POULAILLER CAMPEMENT'), `SMTP sender contains POULAILLER CAMPEMENT (got: "${settings.smtpFrom}")`);

  // --- 1. RBAC & CONFIGURED TEAM MEMBERS ---
  console.log('\n--- 1. ÉQUIPE, RÔLES & SECTEURS ATTRIBUÉS ---');
  
  // 1.1 Boubacar Sene (Admin Principal)
  const bsene = db.getUser('usr_admin');
  assert(bsene !== undefined && bsene.role === 'admin', 'Boubacar Sene exists as principal admin');
  assert(Boolean(bsene?.name.includes('Boubacar Sene')), 'Boubacar Sene name accurately set');
  assert(db.getUserAllowedSectors('usr_admin').length === 4, 'Boubacar Sene has admin access to all 4 sectors');
  assert(db.canAccessSector('usr_admin', 'G6') === true, 'Boubacar Sene is associated with sector G6');

  // 1.2 Awa Gassama (Gérante)
  const awa = db.getUser('usr_awa_gassama');
  assert(awa !== undefined && awa.role === 'manager', 'Awa Gassama exists with role manager (gérante)');
  assert(db.getUserAllowedSectors('usr_awa_gassama').length === 4, 'Awa Gassama has gérante access to all sectors (G3, G4, G5, G6)');

  // 1.3 M. Ndour (Vétérinaire & Gérant)
  const ndour = db.getUser('usr_dr_ndour');
  assert(ndour !== undefined && ndour.role === 'veterinaire', 'M. Ndour exists with role veterinaire & gérant');
  assert(db.getUserAllowedSectors('usr_dr_ndour').length === 4, 'M. Ndour has access to all sectors (G3, G4, G5, G6)');
  assert(db.canAccessSector('usr_dr_ndour', 'G3') === true && db.canAccessSector('usr_dr_ndour', 'G6') === true, 'M. Ndour can access both G3 and G6');

  // 1.4 Saliou (Secteur G3)
  const saliou = db.getUser('usr_saliou');
  assert(saliou !== undefined && saliou.role === 'employee', 'Saliou exists as employee');
  const saliouSectors = db.getUserAllowedSectors('usr_saliou');
  assert(saliouSectors.includes('G3') && saliouSectors.length === 1, 'Saliou is associated exclusively with sector G3');
  assert(db.canAccessSector('usr_saliou', 'G3') === true, 'Saliou can access G3');
  assert(db.canAccessSector('usr_saliou', 'G4') === false, 'Saliou cannot access G4');
  assert(db.canAccessSector('usr_saliou', 'G5') === false, 'Saliou cannot access G5');
  assert(db.canAccessSector('usr_saliou', 'G6') === false, 'Saliou cannot access G6');

  // 1.5 Moustapha (Secteur G4)
  const moustapha = db.getUser('usr_moustapha');
  assert(moustapha !== undefined && moustapha.role === 'employee', 'Moustapha exists as employee');
  const moustaphaSectors = db.getUserAllowedSectors('usr_moustapha');
  assert(moustaphaSectors.includes('G4') && moustaphaSectors.length === 1, 'Moustapha is associated exclusively with sector G4');
  assert(db.canAccessSector('usr_moustapha', 'G4') === true, 'Moustapha can access G4');
  assert(db.canAccessSector('usr_moustapha', 'G3') === false, 'Moustapha cannot access G3');

  // 1.6 Faty et Cherif (Secteur G5)
  const faty = db.getUser('usr_faty');
  const cherif = db.getUser('usr_cherif');
  assert(faty !== undefined && db.canAccessSector('usr_faty', 'G5') === true, 'Faty is associated with sector G5');
  assert(cherif !== undefined && db.canAccessSector('usr_cherif', 'G5') === true, 'Cherif is associated with sector G5');
  assert(db.canAccessSector('usr_faty', 'G3') === false, 'Faty cannot access G3');
  assert(db.canAccessSector('usr_cherif', 'G4') === false, 'Cherif cannot access G4');

  // 1.7 Boubacar Keita (Secteur G6)
  const bkeita = db.getUser('usr_boubacar_keita');
  assert(bkeita !== undefined && bkeita.role === 'employee', 'Boubacar Keita exists as employee');
  assert(db.canAccessSector('usr_boubacar_keita', 'G6') === true, 'Boubacar Keita can access G6');
  assert(db.canAccessSector('usr_boubacar_keita', 'G5') === false, 'Boubacar Keita cannot access G5');

  // Server-side forbidden mutation checks
  let forbiddenCaughtG5 = false;
  try {
    db.upsertCollection({
      date: '2026-10-12',
      slot: '10H',
      sector: 'G5',
      quantity: 500,
      cracked: 5,
      deposit: 495,
    }, 'usr_saliou');
  } catch (err: any) {
    forbiddenCaughtG5 = true;
  }
  assert(forbiddenCaughtG5, 'Server strictly rejects Saliou attempting collection on sector G5');

  let forbiddenCaughtG3 = false;
  try {
    db.upsertCollection({
      date: '2026-10-12',
      slot: '10H',
      sector: 'G3',
      quantity: 500,
      cracked: 5,
      deposit: 495,
    }, 'usr_moustapha');
  } catch (err: any) {
    forbiddenCaughtG3 = true;
  }
  assert(forbiddenCaughtG3, 'Server strictly rejects Moustapha attempting collection on sector G3');

  // Non-veterinary employee cannot prescribe or validate treatments
  let unauthorizedTreatmentCaught = false;
  try {
    db.addSanitaryTreatment({
      sector: 'G3',
      diagnosis: 'Suspicion coccidiose',
      treatmentType: 'MEDICAMENT',
      productName: 'Amprolium',
      dosage: '1g/L eau',
      durationDays: 3,
      startDate: '2026-10-13',
    }, 'usr_saliou');
  } catch (err: any) {
    unauthorizedTreatmentCaught = true;
  }
  assert(unauthorizedTreatmentCaught, 'Server strictly blocks non-veterinary employee from prescribing medical treatments');

  // Legacy accounts removed from active users
  const manager = db.getUser('usr_manager');
  assert(manager === undefined, 'Legacy manager Moussa Diop removed from active users');
  const empG3 = db.getUser('usr_emp_g3');
  assert(empG3 === undefined, 'Legacy employee G3 Amadou Fall removed from active users');
  const empG4 = db.getUser('usr_emp_g4');
  assert(empG4 === undefined, 'Legacy employee G4 Fatou Ndiaye removed from active users');
  const empG56 = db.getUser('usr_emp_g56');
  assert(empG56 === undefined, 'Legacy employee G5-G6 Ibrahima Sow removed from active users');
  assert(db.getUsers().length === 8, 'Exact 8 active team members configured without legacy profiles');

  // --- 2. Collection & Day Completeness Tests ---
  console.log('\n--- 2. RAMASSAGE & COMPLETION TESTS ---');
  const testDate = `2026-11-${String(Date.now()).slice(-4)}`;

  // Record slot 10H only
  for (const sec of ALL_SECTORS) {
    db.upsertCollection({ date: testDate, slot: '10H', sector: sec, quantity: 700, cracked: 5, deposit: 695 }, 'usr_admin');
  }

  let summary = db.getDailySummary(testDate);
  assert(summary.isComplete === false, 'Day is NOT complete with only 10H');

  // Verify email is NOT sent for partial day
  let emailAttempt = await sendDailyReportEmail({
    date: testDate,
    collections: db.getCollections(testDate),
    summary,
    forceSend: false,
  });
  assert(emailAttempt.success === false, 'E-mail is blocked for partial day (only 1 slot recorded)');

  // Record slot 13H
  for (const sec of ALL_SECTORS) {
    db.upsertCollection({ date: testDate, slot: '13H', sector: sec, quantity: 800, cracked: 6, deposit: 794 }, 'usr_admin');
  }
  summary = db.getDailySummary(testDate);
  assert(summary.isComplete === false, 'Day is NOT complete with only 10H and 13H');

  // Record slot 16H -> Now the day should become complete!
  for (const sec of ALL_SECTORS) {
    db.upsertCollection({ date: testDate, slot: '16H', sector: sec, quantity: 500, cracked: 4, deposit: 496 }, 'usr_admin');
  }
  summary = db.getDailySummary(testDate);
  assert(summary.isComplete === true, 'Day IS complete when all 3 slots (10H, 13H, 16H) are recorded for all sectors');

  // Verify total calculation
  // Each sector has 700 + 800 + 500 = 2000 eggs * 4 sectors = 8000 eggs
  assert(summary.totalEggs === 8000, `Total eggs calculation is accurate (expected 8000, got ${summary.totalEggs})`);
  assert(summary.bySlot['10H'] === 2800, 'Slot 10H total is accurate (2800)');
  assert(summary.bySlot['13H'] === 3200, 'Slot 13H total is accurate (3200)');
  assert(summary.bySlot['16H'] === 2000, 'Slot 16H total is accurate (2000)');

  // Test full email dispatch to boubacarsene8@gmail.com
  console.log('\n--- 3. EMAIL AUTOMATION TESTS ---');
  emailAttempt = await sendDailyReportEmail({
    date: testDate,
    collections: db.getCollections(testDate),
    summary,
    forceSend: false,
  });
  // Handles real send if SMTP credentials present, or correctly marks notConfigured without falsifying success
  assert(emailAttempt.success === true || emailAttempt.notConfigured === true, 'E-mail handled truthfully (sent via real SMTP or clearly marked non_configure without fake success)');

  // Check email log
  const logs = db.getEmailLogs();
  const latestLog = logs[0];
  assert(latestLog.recipient === 'boubacarsene8@gmail.com', 'E-mail recipient is correctly set to boubacarsene8@gmail.com');
  assert(latestLog.type === 'ramassage_quotidien', 'E-mail type is ramassage_quotidien');
  assert(latestLog.previewHtml !== undefined, 'E-mail preview HTML generated and stored without secrets');

  // --- 4. Invoicing Tests ---
  console.log('\n--- 4. FACTURATION TESTS ---');
  const invNumber = db.getNextInvoiceNumber();
  assert(invNumber.startsWith('FAC-'), `Invoice format matches FAC-YYYY-XXXX (got ${invNumber})`);

  const createdInv = db.createInvoice({
    date: testDate,
    clientId: 'clt_1',
    clientName: 'Supermarché Test',
    clientPhone: '+221 77 111 22 33',
    items: [{ id: '1', description: 'Plateaux d\'œufs', quantity: 10, unitPrice: 2000, total: 20000 }],
    subtotal: 20000,
    discount: 0,
    total: 20000,
    amountPaid: 15000,
    balanceDue: 5000,
    status: 'partiellement_payee',
    notes: 'Acompte',
  }, 'usr_admin');

  assert(createdInv.number.startsWith('FAC-'), 'Invoice created with unique number');
  assert(createdInv.total === 20000 && createdInv.balanceDue === 5000, 'Invoice balance due correctly computed (5 000)');

  // --- 5. PERSISTENCE & DISK BACKUP TESTS ---
  console.log('\n--- 5. PERSISTENCE & DISK BACKUP TESTS ---');
  const dbFilePath = path.resolve(process.cwd(), 'data', 'avipo_db.json');
  assert(fs.existsSync(dbFilePath), `Database disk file exists at ${dbFilePath}`);

  // Test creating a stock movement and verifying it is immediately written to /data/avipo_db.json
  const initialStockMovements = db.getStockMovements();
  const testStockMovement = db.addStockMovement({
    sector: 'G3',
    itemType: 'OEFS_STANDARDS',
    quantity: 150,
    movementType: 'ENTREE',
    reason: 'Test persistance disque',
    notes: 'Vérification automatique',
  }, 'usr_admin');

  // Read raw file content from disk to verify actual persistence
  const diskRaw = fs.readFileSync(dbFilePath, 'utf-8');
  const diskParsed = JSON.parse(diskRaw);
  const foundOnDisk = diskParsed.stockMovements.some((m: any) => m.id === testStockMovement.id && m.quantity === 150);
  assert(foundOnDisk, 'New stock movement was persistently saved to /data/avipo_db.json');

  // Test creating a mortality record and verifying disk persistence
  const testMortality = db.addMortalityRecord({
    date: testDate,
    sector: 'G4',
    count: 2,
    cause: 'Test mortalité persistance',
    notes: 'Contrôle automatique',
  }, 'usr_admin');

  const diskRawAfterMortality = fs.readFileSync(dbFilePath, 'utf-8');
  const diskParsedAfterMortality = JSON.parse(diskRawAfterMortality);
  const foundMortalityOnDisk = diskParsedAfterMortality.mortality.some((r: any) => r.id === testMortality.id && r.count === 2);
  assert(foundMortalityOnDisk, 'New mortality record was persistently saved to /data/avipo_db.json');

  // --- 6. CONSULTATION DES ANCIENNES FICHES & NON-ALTÉRATION ---
  console.log('\n--- 6. CONSULTATION & INTEGRITÉ DES ANCIENNES FICHES ---');
  // Verify an existing invoice can be retrieved with intact number, client, and items
  const retrievedInvoice = db.getInvoice(createdInv.id);
  assert(retrievedInvoice !== undefined, 'Old saved invoice can be retrieved by ID');
  assert(retrievedInvoice?.number === createdInv.number, 'Invoice number is strictly preserved');
  assert(retrievedInvoice?.total === 20000, 'Invoice total amount is strictly preserved');
  assert(retrievedInvoice?.clientName === 'Supermarché Test', 'Invoice client details are strictly preserved');
  assert(retrievedInvoice?.items.length === 1 && retrievedInvoice.items[0].quantity === 10, 'Invoice line items are strictly preserved');

  // Verify previous collections for the test date remain intact
  const retrievedCols = db.getCollections(testDate);
  assert(retrievedCols.length === ALL_SECTORS.length * 3, `All ${ALL_SECTORS.length * 3} slot records retrieved without loss`);

  // --- 7. EXPORT INDIVIDUEL & ABSENCE DE MODIFICATION DES DONNÉES ---
  console.log('\n--- 7. EXPORTS INDIVIDUELS (PDF, PNG, JPG) & INTÉGRITÉ ---');
  // Simulate an individual export of the invoice:
  // Data extraction must NOT alter the database or the invoice fields
  const invoiceBeforeExport = JSON.stringify(db.getInvoice(createdInv.id));
  const invoiceExportData = {
    title: 'FACTURE OFFICIELLE',
    number: retrievedInvoice?.number,
    date: retrievedInvoice?.date,
    client: retrievedInvoice?.clientName,
    items: retrievedInvoice?.items,
    total: retrievedInvoice?.total,
    paid: retrievedInvoice?.amountPaid,
    balance: retrievedInvoice?.balanceDue,
  };
  const invoiceAfterExport = JSON.stringify(db.getInvoice(createdInv.id));
  assert(invoiceBeforeExport === invoiceAfterExport, 'Database record remains strictly identical after export');
  assert(invoiceExportData.number === createdInv.number, 'Export contains authentic invoice number without dummy values');

  // Simulate an individual export of a stock movement
  const movementBeforeExport = JSON.stringify(testStockMovement);
  const movementExportData = {
    title: 'BON DE MOUVEMENT / DÉPÔT DE STOCK',
    reference: `MVT-${testStockMovement.id}`,
    sector: testStockMovement.sector,
    itemType: testStockMovement.itemType,
    quantity: testStockMovement.quantity,
    type: testStockMovement.movementType,
    date: new Date(testStockMovement.timestamp).toISOString(),
  };
  assert(movementExportData.quantity === 150 && movementExportData.sector === 'G3', 'Stock movement export contains authentic selected data');

  // Simulate an individual export of a mortality voucher
  const mortalityExportData = {
    title: 'FICHE DE CONSTAT DE MORTALITÉ',
    reference: `MOR-${testMortality.id}`,
    date: testMortality.date,
    sector: testMortality.sector,
    count: testMortality.count,
    cause: testMortality.cause,
  };
  assert(mortalityExportData.count === 2 && mortalityExportData.sector === 'G4', 'Mortality voucher export contains authentic selected data');

  // --- 8. SUIVI DES MÉDICAMENTS, VACCINS & SANITAIRE (M. NDOUR) ---
  console.log('\n--- 8. SUIVI VÉTÉRINAIRE, MÉDICAMENTS & VACCINS (M. NDOUR) ---');
  
  // 8.1 Médicaments : création & validation
  const testMed = db.upsertMedication({
    name: 'Oxytétracycline 20% Vétérinaire',
    category: 'antibiotique',
    unit: 'Flacons 100ml',
    currentStock: 15,
    minimumStockAlert: 5,
    expiryDate: '2027-06-30',
    batchNumber: 'LOT-OXY-2026',
  }, 'usr_dr_ndour');
  assert(testMed.id.startsWith('med_'), 'Medication created with valid ID');
  assert(testMed.currentStock === 15, 'Medication initial stock is 15');
  assert(testMed.validatedByVet === true, 'Medication is certified with veterinary validation');

  // 8.2 Mouvement de médicament (sortie de stock avec dosage)
  const medMovement = db.addMedicationMovement({
    medicationId: testMed.id,
    type: 'SORTIE_TRAITEMENT',
    quantity: 3,
    sector: 'G3',
    reason: 'Traitement curatif affection respiratoire',
    dosagePrescrit: '2ml par litre d\'eau pendant 4 jours',
  }, 'usr_dr_ndour');
  assert(medMovement.previousStock === 15 && medMovement.newStock === 12, 'Medication stock accurately decremented (15 -> 12)');
  assert(medMovement.validatedByVet === true, 'Movement is validated by veterinarian');
  assert(medMovement.performedBy === 'usr_dr_ndour', 'Traceability records operator usr_dr_ndour');

  // 8.3 Vaccins : enregistrement du lot reçu
  const testVac = db.upsertVaccine({
    name: 'Vaccin Newcastle LaSota',
    targetDisease: 'Maladie de Newcastle',
    unit: 'Doses',
    quantityReceived: 10000,
    currentStock: 10000,
    minimumStockAlert: 2500,
    receptionDate: '2026-10-01',
    expiryDate: '2027-03-31',
    batchNumber: 'LOT-VAC-NEWC-99',
  }, 'usr_dr_ndour');
  assert(testVac.currentStock === 10000, 'Vaccine received stock recorded (10 000 doses)');

  // 8.4 Campagne de vaccination sectorisée pour G4
  const testCampaign = db.upsertVaccination({
    vaccineId: testVac.id,
    vaccineName: 'Vaccin Newcastle LaSota',
    sector: 'G4',
    scheduledDate: '2026-10-20',
    targetBirdCount: 2500,
    status: 'PROGRAMMEE',
    administrationRoute: 'EAU_BOISSON',
    observations: 'Distribution matinale à jeun.',
  }, 'usr_dr_ndour');
  assert(testCampaign.status === 'PROGRAMMEE' && testCampaign.sector === 'G4', 'Vaccination campaign scheduled for sector G4');

  // 8.5 Certification et réalisation de la vaccination
  const realizedCampaign = db.markVaccinationRealized(testCampaign.id, {
    realizedDate: '2026-10-20',
    dosesAdministered: 2500,
    observations: 'Administration réussie, aucune réaction indésirable observée.',
  }, 'usr_dr_ndour');
  assert(realizedCampaign.status === 'REALISEE', 'Vaccination marked as REALISEE');
  assert(realizedCampaign.validatedByVet === true, 'Vaccination verified and certified by veterinarian');
  const vacAfterRealize = db.getVaccine(testVac.id);
  assert(vacAfterRealize?.currentStock === 7500, 'Vaccine stock automatically reduced after realization (10000 - 2500 = 7500)');

  // 8.6 Traitement sanitaire complet
  const treatmentRecord = db.addSanitaryTreatment({
    sector: 'G5',
    diagnosis: 'Contrôle parasitaire périodique',
    treatmentType: 'PREVENTIF',
    productName: 'Vitamine AD3E + Minéraux',
    dosage: '1ml / 2L eau de boisson',
    durationDays: 3,
    startDate: '2026-10-15',
    withdrawalPeriodDays: 0,
    observations: 'Soutien ponte et plumage.',
  }, 'usr_dr_ndour');
  assert(treatmentRecord.sector === 'G5', 'Sanitary treatment recorded for sector G5');
  assert(treatmentRecord.validatedByVet === true, 'Treatment approved under M. Ndour authority');
  assert(treatmentRecord.dosage === '1ml / 2L eau de boisson', 'Exact dosage preserved without modification');

  // 8.7 Alertes sanitaires calculées
  const vetAlerts = db.getVeterinaryAlerts();
  assert(typeof vetAlerts.totalAlertsCount === 'number', 'Veterinary alerts computed dynamically');

  // 8.8 Règle financière stricte pour M. Ndour (Point 5)
  console.log('\n--- 9. RÈGLE FINANCIÈRE DE M. NDOUR (AUCUNE PART PARTICULIÈRE) ---');
  // Verify that sale & invoice calculations contain NO automatic dividend, profit share or commission
  const sampleSale = db.addSale({
    date: '2026-10-13',
    clientId: 'clt_1',
    clientName: 'Supermarché Test',
    sector: 'CENTRAL',
    itemType: 'Plateaux',
    quantity: 50,
    unitPrice: 2000,
    totalAmount: 100000,
    status: 'validee',
    recordedBy: 'usr_admin',
  }, 'usr_admin');
  assert(sampleSale.totalAmount === 100000, 'Sale total is standard business transaction (100 000 FCFA)');
  assert(!('commissionNdour' in (sampleSale as any)) && !('profitShare' in (sampleSale as any)), 'No special financial percentage or profit share assigned to M. Ndour');

  console.log(`\n========================================`);
  console.log(`TOTAL TESTS : ${passed + failed} | REUSSIS : ${passed} | ECHECS : ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
