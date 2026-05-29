const fetch = require('node-fetch');
const fs = require('fs');

async function getCoordinates(city) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'solar-app-js' } });
  const data = await res.json();
  if (data.length === 0) {
    throw new Error('Lieu introuvable');
  }
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
}

async function getSolarData(lat, lon) {
  const url = `https://re.jrc.ec.europa.eu/api/v5_2/OGC/PVGIS/JRC/gettmadata?lat=${lat}&lon=${lon}&outputformat=json`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.outputs || !data.outputs.tmy) {
    throw new Error('Données solaires indisponibles pour ce lieu');
  }
  return data.outputs.tmy;
}

function calculateSizing(tmyData, desiredEnergyKwhPerDay, panelEfficiency = 0.2, availableAreaM2 = null) {
  const ghi = tmyData.data.map(p => parseFloat(p.G_h));
  const dni = tmyData.data.map(p => parseFloat(p.B_h));
  const dhi = tmyData.data.map(p => parseFloat(p.D_h));

  const avgGhi = ghi.reduce((a, b) => a + b, 0) / ghi.length;
  const avgDni = dni.reduce((a, b) => a + b, 0) / dni.length;
  const avgDhi = dhi.reduce((a, b) => a + b, 0) / dhi.length;

  const dailySum = [];
  for (let day = 0; day < 365; day++) {
    const start = day * 24;
    let sum = 0;
    for (let h = 0; h < 24; h++) {
      const ghiVal = ghi[start + h] || 0;
      const dniVal = dni[start + h] || 0;
      const dhiVal = dhi[start + h] || 0;
      const poa = (ghiVal + dniVal + dhiVal) * 0.9;
      sum += poa;
    }
    dailySum.push(sum / 1000);
  }

  const avgDailyEnergy = dailySum.reduce((a, b) => a + b, 0) / dailySum.length;
  const energyPerPanelPerDay = avgDailyEnergy * panelEfficiency;
  let numPanels = desiredEnergyKwhPerDay / energyPerPanelPerDay;
  const panelArea = 1.6;
  let totalArea = numPanels * panelArea;

  let note = '';
  if (availableAreaM2 && totalArea > availableAreaM2) {
    numPanels = availableAreaM2 / panelArea;
    totalArea = availableAreaM2;
    const actualEnergy = numPanels * energyPerPanelPerDay;
    note = 'Limité par la surface disponible';
    return { numPanels: Math.floor(numPanels), totalArea, estimatedDailyEnergyKwh: actualEnergy, averageIrradianceKwhM2Day: avgDailyEnergy, avgGhi, avgDni, avgDhi, note };
  }

  return { numPanels: Math.ceil(numPanels), totalArea, estimatedDailyEnergyKwh: desiredEnergyKwhPerDay, averageIrradianceKwhM2Day: avgDailyEnergy, avgGhi, avgDni, avgDhi, note };
}

function saveHtmlReport(city, lat, lon, desiredEnergy, availableArea, result, filename = 'solar_report.html') {
  const availableText = availableArea ? `${availableArea} m²` : 'Illimité';
  const noteLine = result.note ? `<p><strong>Note</strong>: ${result.note}</p>` : '';
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Rapport solaire</title></head><body>` +
    `<h1>Dimensionnement panneaux solaires</h1>` +
    `<p>Ville: ${city} (${lat.toFixed(4)}, ${lon.toFixed(4)})</p>` +
    `<p>Energie demandée: ${desiredEnergy.toFixed(2)} kWh/jour</p>` +
    `<p>Surface disponible: ${availableText}</p>` +
    `<div class="card"><h2>Données météo solaires (PVGIS)</h2>` +
    `<ul>` +
    `<li>GHI moyen: ${result.avgGhi.toFixed(2)} W/m²</li>` +
    `<li>DNI moyen: ${result.avgDni.toFixed(2)} W/m²</li>` +
    `<li>DHI moyen: ${result.avgDhi.toFixed(2)} W/m²</li>` +
    `</ul></div>` +
    `<div class="card"><h2>Résultats</h2>` +
    `<ul>` +
    `<li>Panneaux nécessaires: ${result.numPanels}</li>` +
    `<li>Surface requise: ${result.totalArea.toFixed(2)} m²</li>` +
    `<li>Energie estimée: ${result.estimatedDailyEnergyKwh.toFixed(2)} kWh/jour</li>` +
    `<li>Irradiance moyenne POA: ${result.averageIrradianceKwhM2Day.toFixed(2)} kWh/m²/jour</li>` +
    `</ul></div>` + noteLine +
    `</body></html>`;

  fs.writeFileSync(filename, html, 'utf8');
  return filename;
}

async function main() {
  const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
  const question = (prompt) => new Promise((resolve) => readline.question(prompt, resolve));

  try {
    const city = await question('Ville (ou adresse) : ');
    const desiredEnergy = parseFloat(await question('Energie journalière souhaitée (kWh) : '));
    const availableAreaInput = await question('Surface disponible (m²), ou Entrée pour illimité : ');
    const availableArea = availableAreaInput.trim() ? parseFloat(availableAreaInput) : null;

    const { lat, lon } = await getCoordinates(city);
    console.log(`Coordonnées : ${lat.toFixed(4)}, ${lon.toFixed(4)}`);

    const tmy = await getSolarData(lat, lon);
    const result = calculateSizing(tmy, desiredEnergy, 0.20, availableArea);

    console.log('--- Résultats ---');
    console.log(`Panneaux requis : ${result.numPanels}`);
    console.log(`Surface totale : ${result.totalArea.toFixed(2)} m²`);
    console.log(`Energie estimée : ${result.estimatedDailyEnergyKwh.toFixed(2)} kWh/jour`);
    console.log(`Irradiance moyenne : ${result.averageIrradianceKwhM2Day.toFixed(2)} kWh/m²/jour`);
    if (result.note) console.log(`Note : ${result.note}`);

    const exportHtml = (await question('Générer un rapport HTML ? (oui/non) : ')).trim().toLowerCase();
    if (['oui', 'o', 'yes', 'y'].includes(exportHtml)) {
      const filename = saveHtmlReport(city, lat, lon, desiredEnergy, availableArea, result);
      console.log(`Rapport créé : ${filename}`);
    }

    readline.close();
  } catch (err) {
    console.error('Erreur :', err.message);
    process.exit(1);
  }
}

if (require.main === module) main();