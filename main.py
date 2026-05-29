import requests
import pandas as pd
from geopy.geocoders import Nominatim
import numpy as np

def get_location_coordinates(city_name):
    geolocator = Nominatim(user_agent="solar_app")
    location = geolocator.geocode(city_name)
    if location:
        return location.latitude, location.longitude
    else:
        raise ValueError("Location not found")

def get_solar_data(lat, lon):
    # Récupère les données d'irradiance NASA POWER (LARC) pour le site.
    url = f"https://power.larc.nasa.gov/api/temporal/climatology/point?parameters=ALLSKY_SFC_SW_DWN&community=RE&longitude={lon}&latitude={lat}&format=JSON"
    response = requests.get(url, timeout=20)
    response.raise_for_status()
    data = response.json()
    if 'properties' not in data or 'parameter' not in data['properties'] or 'ALLSKY_SFC_SW_DWN' not in data['properties']['parameter']:
        raise ValueError('Aucune donnée NASA POWER disponible pour cette localisation')
    monthly = data['properties']['parameter']['ALLSKY_SFC_SW_DWN']
    return monthly

def calculate_panel_sizing(lat, lon, desired_energy_kwh_per_day, panel_efficiency=0.2, available_area_m2=None):
    # Get NASA POWER solar data (monthly averages GHI en kWh/m²/jour)
    monthly_data = get_solar_data(lat, lon)
    values = np.array(list(monthly_data.values()), dtype=float)
    average_daily_ghi = np.nanmean(values)
    # Approximation du fractionnement: DNI/DHI
    avg_dni = average_daily_ghi * 0.6
    avg_dhi = average_daily_ghi * 0.4

    # Estimation POA (angle optimisé, facteur de conversion)
    average_daily_poa = average_daily_ghi * 0.9
    energy_per_panel = average_daily_poa * panel_efficiency

    if energy_per_panel <= 0:
        raise ValueError('Données solaires invalides pour calcul.')

    num_panels = desired_energy_kwh_per_day / energy_per_panel
    panel_area = 1.6
    total_area = num_panels * panel_area
    
    if available_area_m2 and total_area > available_area_m2:
        num_panels = available_area_m2 / panel_area
        actual_energy = num_panels * energy_per_panel
        return {
            'num_panels': int(num_panels),
            'total_area_m2': available_area_m2,
            'estimated_daily_energy_kwh': actual_energy,
            'average_irradiance_kwh_m2_day': average_daily_poa,
            'avg_ghi': average_daily_ghi,
            'avg_dni': avg_dni,
            'avg_dhi': avg_dhi,
            'note': 'Limited by available area'
        }
    
    return {
        'num_panels': int(np.ceil(num_panels)),
        'total_area_m2': total_area,
        'estimated_daily_energy_kwh': desired_energy_kwh_per_day,
        'average_irradiance_kwh_m2_day': average_daily_poa,
        'avg_ghi': average_daily_ghi,
        'avg_dni': avg_dni,
        'avg_dhi': avg_dhi
    }


def save_html_report(city, lat, lon, desired_energy, available_area, result, filename='solar_report.html'):
    note_line = f"<p><strong>Note:</strong> {result['note']}</p>" if 'note' in result else ''
    available_area_text = f"{available_area} m²" if available_area is not None else 'Illimité'
    content = f"""
<html>
<head>
    <meta charset='utf-8'>
    <title>Solar Panel Sizing Report</title>
</head>
<body>
    <h1>Rapport de calcul des panneaux solaires</h1>
    <p>Localisation: {city} ({lat:.4f}, {lon:.4f})</p>
    <p>Energie désirée: {desired_energy:.2f} kWh/jour</p>
    <p>Surface disponible: {available_area_text}</p>
    <h2>Résultats</h2>
    <ul>
        <li>Nombre de panneaux requis: {result['num_panels']}</li>
        <li>Surface totale: {result['total_area_m2']:.2f} m²</li>
        <li>Energie estimée: {result['estimated_daily_energy_kwh']:.2f} kWh/jour</li>
    </ul>
    """

    if 'average_irradiance_kwh_m2_day' in result:
        content += f"<p>Irradiance moyenne (POA): {result['average_irradiance_kwh_m2_day']:.2f} kWh/m²/jour</p>\n"
    if 'avg_ghi' in result:
        content += f"<p>GHI moyen: {result['avg_ghi']:.2f} W/m²</p>\n"
    if 'avg_dni' in result:
        content += f"<p>DNI moyen: {result['avg_dni']:.2f} W/m²</p>\n"
    if 'avg_dhi' in result:
        content += f"<p>DHI moyen: {result['avg_dhi']:.2f} W/m²</p>\n"
    content += note_line
    content += "</body>\n</html>"

    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

    return filename


def main():
    print("Solar Panel Sizing Application")
    city = input("Enter city name: ")
    desired_energy = float(input("Enter desired daily energy production (kWh): "))
    available_area = input("Enter available area for panels (m²), or press enter if unlimited: ")
    available_area = float(available_area) if available_area else None
    
    try:
        lat, lon = get_location_coordinates(city)
        print(f"Location: {city} ({lat:.2f}, {lon:.2f})")
        
        result = calculate_panel_sizing(lat, lon, desired_energy, available_area_m2=available_area)
        
        print("\nSizing Results:")
        print(f"Number of panels needed: {result['num_panels']}")
        print(f"Total area required: {result['total_area_m2']:.2f} m²")
        print(f"Estimated daily energy: {result['estimated_daily_energy_kwh']:.2f} kWh")
        if 'average_irradiance_kwh_m2_day' in result:
            print(f"Average solar irradiance (POA): {result['average_irradiance_kwh_m2_day']:.2f} kWh/m²/day")
        if 'avg_ghi' in result:
            print(f"GHI moyen: {result['avg_ghi']:.2f} W/m²")
        if 'avg_dni' in result:
            print(f"DNI moyen: {result['avg_dni']:.2f} W/m²")
        if 'avg_dhi' in result:
            print(f"DHI moyen: {result['avg_dhi']:.2f} W/m²")
        if 'note' in result:
            print(f"Note: {result['note']}")

        export_html = input("Voulez-vous générer un rapport HTML? (oui/non): ").strip().lower()
        if export_html in ['oui', 'o', 'yes', 'y']:
            html_filename = save_html_report(city, lat, lon, desired_energy, available_area, result)
            print(f"Rapport HTML généré : {html_filename}")
    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()