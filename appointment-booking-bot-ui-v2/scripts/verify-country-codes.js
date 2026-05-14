/**
 * Country code verification script
 * Checks if the country codes in our system match the expected values
 */

const fs = require('fs');
const path = require('path');

// Import our current country data
const { MOST_USED_COUNTRIES, ALL_COUNTRIES } = require('../src/data/countries.ts');

// Combine all countries
const allCountries = [...MOST_USED_COUNTRIES, ...ALL_COUNTRIES];

console.log('=== COUNTRY CODE VERIFICATION ===\n');

// Check for duplicates in our data
console.log('1. Checking for duplicate country codes...');
const seenCodes = new Set();
const seenApiValues = new Set();
const duplicates = [];

allCountries.forEach(country => {
  if (seenCodes.has(country.code)) {
    duplicates.push(`Duplicate ISO code: ${country.code} (${country.name})`);
  }
  if (seenApiValues.has(country.apiValue)) {
    duplicates.push(`Duplicate API value: ${country.apiValue} (${country.name})`);
  }
  seenCodes.add(country.code);
  seenApiValues.add(country.apiValue);
});

if (duplicates.length > 0) {
  console.log('❌ Found duplicates:');
  duplicates.forEach(dup => console.log('  ' + dup));
} else {
  console.log('✅ No duplicates found');
}

console.log('\n2. Most used countries (should match Fasah common selections):');
MOST_USED_COUNTRIES.forEach(country => {
  console.log(`  ${country.code} (${country.apiValue}) -> ${country.name}`);
});

console.log('\n3. Sample of other countries:');
ALL_COUNTRIES.slice(0, 10).forEach(country => {
  console.log(`  ${country.code} (${country.apiValue}) -> ${country.name}`);
});

console.log(`\n4. Total countries: ${allCountries.length}`);

// Common countries that should be present
const expectedCommon = [
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'EG', name: 'Egypt' },
  { code: 'JO', name: 'Jordan' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'OM', name: 'Oman' },
  { code: 'TR', name: 'Turkey' },
  { code: 'SY', name: 'Syria' }
];

console.log('\n5. Verifying key countries:');
expectedCommon.forEach(expected => {
  const found = allCountries.find(c => c.code === expected.code);
  if (found) {
    console.log(`  ✅ ${expected.code}: Found with API value ${found.apiValue} (${found.name})`);
  } else {
    console.log(`  ❌ ${expected.code}: Missing!`);
  }
});

console.log('\n=== TO VERIFY WITH YOUR EXCEL FILE ===');
console.log('Please check that these API values match your Excel file:');
MOST_USED_COUNTRIES.forEach(country => {
  console.log(`${country.code} should map to API value: ${country.apiValue}`);
});

console.log('\n=== EXPORT FOR COMPARISON ===');
console.log('Current data in CSV format:');
console.log('ISO_Code,Country_Name,API_Value');
allCountries.forEach(country => {
  console.log(`${country.code},"${country.name}",${country.apiValue}`);
});