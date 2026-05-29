# Solar Panel Sizing Application

This Python application helps you size solar panels for maximum energy production based on your location.

## Features

- Input a city name to get location coordinates
- Fetches typical meteorological year (TMY) solar data
- Calculates optimal number of solar panels needed for desired daily energy production
- Considers available area constraints
- Assumes standard panel efficiency and size

## Requirements

- Python 3.7+
- Dependencies listed in requirements.txt

## Installation

1. Install Python dependencies:
   ```
   pip install -r requirements.txt
   ```

## Usage

Solar Panel Sizing
Utilisez le script `main.py` pour calculer le dimensionnement et générer un rapport HTML.

1. Installer les dépendances :
   ```
   pip install -r requirements.txt
   ```
2. Lancer le script :
   ```
   python main.py
   ```
3. Saisir la localisation, l'énergie souhaitée et la surface
4. Accepter la génération de rapport HTML

Le rapport sera enregistré dans `solar_report.html`.

## Notes

- Uses PVGIS TMY data for solar irradiance
- Assumes optimal tilt equal to latitude and south-facing orientation
- Standard panel size: 1.6 m² (1m x 1.6m)
- Panel efficiency: 20%

## JavaScript Version

Fichier : `main.js`

1. Initialisez le projet Node.js :
   ```bash
   npm init -y
   npm install node-fetch@2
   ```
2. Exécutez :
   ```bash
   node main.js
   ```
3. Suivez les invites : ville, électricité désirée, surface.
4. Répondez `oui` pour générer `solar_report.html`.

### package.json (script start)

Ajoutez ceci pour démarrer plus simple :

```json
{
  "name": "solar-panel-sizing",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "start": "node main.js"
  },
  "dependencies": {
    "node-fetch": "2.6.12"
  }
}
```

Ensuite lancez `npm start`.