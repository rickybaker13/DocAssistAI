/**
 * Quick test script for Open Sandbox
 * Tests direct HTTP calls to Oracle Health Open Sandbox (no auth required)
 */

const baseUrl = 'https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d';
const patientId = '12742400'; // Example patient ID from Open Sandbox

async function testOpenSandbox() {
  try {
    console.log('🧪 Testing Oracle Health Open Sandbox...\n');
    console.log(`Base URL: ${baseUrl}`);
    console.log(`Test Patient ID: ${patientId}\n`);
    
    // Test 1: Get Patient
    console.log('1️⃣ Fetching Patient...');
    const patientResponse = await fetch(`${baseUrl}/Patient/${patientId}`, {
      headers: { 'Accept': 'application/fhir+json' }
    });
    
    if (!patientResponse.ok) {
      throw new Error(`Patient request failed: ${patientResponse.status} ${patientResponse.statusText}`);
    }
    
    const patient = await patientResponse.json();
    const patientName = patient.name?.[0] 
      ? `${patient.name[0].given?.join(' ') || ''} ${patient.name[0].family || ''}`.trim()
      : patient.id;
    console.log(`✅ Patient: ${patientName} (ID: ${patient.id})`);
    console.log(`   Gender: ${patient.gender || 'N/A'}, Birth Date: ${patient.birthDate || 'N/A'}\n`);
    
    // Test 2: Get Conditions
    console.log('2️⃣ Fetching Conditions...');
    const conditionsResponse = await fetch(`${baseUrl}/Condition?patient=${patientId}`, {
      headers: { 'Accept': 'application/fhir+json' }
    });
    
    if (!conditionsResponse.ok) {
      throw new Error(`Conditions request failed: ${conditionsResponse.status}`);
    }
    
    const conditions = await conditionsResponse.json();
    const conditionCount = conditions.entry?.length || 0;
    console.log(`✅ Conditions: ${conditionCount} found`);
    if (conditionCount > 0) {
      conditions.entry.slice(0, 3).forEach((entry, idx) => {
        const cond = entry.resource;
        const code = cond.code?.coding?.[0]?.display || cond.code?.text || 'Unknown';
        console.log(`   ${idx + 1}. ${code}`);
      });
    }
    console.log('');
    
    // Test 3: Get Observations
    console.log('3️⃣ Fetching Observations...');
    const obsResponse = await fetch(`${baseUrl}/Observation?patient=${patientId}&_count=5`, {
      headers: { 'Accept': 'application/fhir+json' }
    });
    
    if (!obsResponse.ok) {
      throw new Error(`Observations request failed: ${obsResponse.status}`);
    }
    
    const observations = await obsResponse.json();
    const obsCount = observations.entry?.length || 0;
    console.log(`✅ Observations: ${obsCount} found`);
    if (obsCount > 0) {
      observations.entry.slice(0, 3).forEach((entry, idx) => {
        const obs = entry.resource;
        const code = obs.code?.coding?.[0]?.display || obs.code?.text || 'Unknown';
        const value = obs.valueQuantity?.value || obs.valueString || 'N/A';
        console.log(`   ${idx + 1}. ${code}: ${value}`);
      });
    }
    console.log('');
    
    // Test 4: Get Encounters
    console.log('4️⃣ Fetching Encounters...');
    const encountersResponse = await fetch(`${baseUrl}/Encounter?patient=${patientId}&_count=3`, {
      headers: { 'Accept': 'application/fhir+json' }
    });
    
    if (!encountersResponse.ok) {
      throw new Error(`Encounters request failed: ${encountersResponse.status}`);
    }
    
    const encounters = await encountersResponse.json();
    const encounterCount = encounters.entry?.length || 0;
    console.log(`✅ Encounters: ${encounterCount} found`);
    if (encounterCount > 0) {
      encounters.entry.slice(0, 2).forEach((entry, idx) => {
        const enc = entry.resource;
        const type = enc.type?.[0]?.coding?.[0]?.display || 'Unknown';
        const period = enc.period?.start || 'N/A';
        console.log(`   ${idx + 1}. ${type} (${period})`);
      });
    }
    console.log('');
    
    console.log('✅✅✅ Open Sandbox is working perfectly!');
    console.log('\n📝 Next steps:');
    console.log('   1. Set VITE_USE_OPEN_SANDBOX=true in .env.local');
    console.log('   2. Set VITE_FHIR_BASE_URL=https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d');
    console.log('   3. Restart your dev server');
    console.log('   4. Open http://localhost:8080 - app will load with real FHIR data!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('   - Check your internet connection');
    console.error('   - Verify the base URL is correct');
    console.error('   - Try a different patient ID if this one doesn\'t exist');
    process.exit(1);
  }
}

testOpenSandbox();

