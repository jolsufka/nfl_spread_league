#!/usr/bin/env python3
"""
NFL Weather Forecast Script
Fetches weather forecasts for outdoor NFL stadiums using OpenWeatherMap API
"""

import requests
import json
import yaml
import pandas as pd
from datetime import datetime
import argparse
import sys
import os
from dateutil import parser as date_parser
import pytz

class WeatherAPI:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "https://api.openweathermap.org/data/2.5/forecast"
    
    def get_forecast(self, city, state):
        """Get 5-day weather forecast for a city"""
        # Format: "City,State,US" for better accuracy
        location = f"{city},{state},US"
        
        params = {
            'q': location,
            'appid': self.api_key,
            'units': 'imperial',  # Fahrenheit
            'cnt': 40  # 5 days * 8 forecasts per day (3-hour intervals)
        }
        
        try:
            response = requests.get(self.base_url, params=params)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error fetching weather for {city}, {state}: {e}")
            return None

def load_stadium_data():
    """Load stadium information from YAML file"""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    yaml_path = os.path.join(script_dir, '..', 'nfl-pickem', 'public', 'nflStadiums.yaml')
    
    with open(yaml_path, 'r') as file:
        data = yaml.safe_load(file)
    
    return data['teams']

def get_outdoor_stadiums():
    """Get list of teams that play in outdoor stadiums"""
    stadiums = load_stadium_data()
    outdoor_teams = {}
    
    for team, info in stadiums.items():
        if info['type'] == 'outdoor':
            outdoor_teams[team] = info
    
    return outdoor_teams

def load_games_data(games_csv_path):
    """Load game data with kickoff times"""
    if not games_csv_path or not os.path.exists(games_csv_path):
        return {}
    
    try:
        games_df = pd.read_csv(games_csv_path)
        games_dict = {}
        
        for _, row in games_df.iterrows():
            # Parse kickoff time (assuming ET timezone)
            kickoff_str = row['kickoff_et']
            # Remove timezone suffix if present and parse
            if kickoff_str.endswith('-05:00'):
                kickoff_str = kickoff_str[:-6]
            
            kickoff_dt = date_parser.parse(kickoff_str)
            # Assume ET timezone if not specified
            et_tz = pytz.timezone('America/New_York')
            if kickoff_dt.tzinfo is None:
                kickoff_dt = et_tz.localize(kickoff_dt)
            
            # Store game time for both teams (since weather matters for the stadium location)
            home_team = row['home']
            away_team = row['away']
            games_dict[home_team] = kickoff_dt
            games_dict[away_team] = kickoff_dt
            
        return games_dict
    except Exception as e:
        print(f"Error loading games data: {e}")
        return {}

def generate_weather_summary(forecast_data, target_date=None):
    """Generate a concise weather summary for game conditions"""
    if not forecast_data or 'list' not in forecast_data:
        return "Weather data unavailable"
    
    # If target_date is provided, find the closest forecast
    # Otherwise, use the first forecast (next 3 hours)
    forecast = forecast_data['list'][0]
    
    if target_date:
        # Find forecast closest to target date
        target_timestamp = int(target_date.timestamp())
        closest_forecast = min(forecast_data['list'], 
                             key=lambda x: abs(x['dt'] - target_timestamp))
        forecast = closest_forecast
    
    # Extract weather data
    temp = round(forecast['main']['temp'])
    feels_like = round(forecast['main']['feels_like'])
    humidity = forecast['main']['humidity']
    wind_speed = round(forecast['wind']['speed'])
    wind_gust = round(forecast['wind'].get('gust', 0))
    
    # Weather conditions
    weather = forecast['weather'][0]
    condition = weather['main']
    description = weather['description']
    
    # Precipitation
    rain_chance = forecast.get('pop', 0) * 100  # Probability of precipitation
    rain_amount = forecast.get('rain', {}).get('3h', 0)
    snow_amount = forecast.get('snow', {}).get('3h', 0)
    
    # Generate summary
    summary_parts = []
    
    # Temperature
    if abs(temp - feels_like) > 5:
        summary_parts.append(f"{temp}°F (feels {feels_like}°F)")
    else:
        summary_parts.append(f"{temp}°F")
    
    # Precipitation
    if rain_chance > 20:
        if rain_amount > 0:
            summary_parts.append(f"{rain_chance:.0f}% chance rain ({rain_amount:.2f}\")")
        else:
            summary_parts.append(f"{rain_chance:.0f}% chance rain")
    
    if snow_amount > 0:
        summary_parts.append(f"Snow expected ({snow_amount:.2f}\")")
    
    # Wind
    if wind_speed > 10 or wind_gust > 15:
        if wind_gust > wind_speed + 5:
            summary_parts.append(f"Windy ({wind_speed}mph, gusts {wind_gust}mph)")
        else:
            summary_parts.append(f"Windy ({wind_speed}mph)")
    
    # Weather condition if notable
    if condition.lower() in ['thunderstorm', 'snow', 'fog', 'mist']:
        summary_parts.append(description.title())
    
    if not summary_parts:
        summary_parts.append("Clear conditions")
    
    return " | ".join(summary_parts)

def main():
    parser = argparse.ArgumentParser(description='Fetch NFL weather forecasts')
    parser.add_argument('--api-key', required=True, help='OpenWeatherMap API key')
    parser.add_argument('--output', default='data/weather/weather_forecast.csv', 
                       help='Output CSV file path')
    parser.add_argument('--games-csv', 
                       help='Path to games CSV file with kickoff times')
    parser.add_argument('--test', action='store_true', 
                       help='Test with a few stadiums only')
    
    args = parser.parse_args()
    
    # Initialize weather API
    weather_api = WeatherAPI(args.api_key)
    
    # Load game data with kickoff times
    games_data = {}
    if args.games_csv:
        games_data = load_games_data(args.games_csv)
        print(f"Loaded kickoff times for {len(games_data)} games")
    
    # Get outdoor stadiums
    outdoor_stadiums = get_outdoor_stadiums()
    
    if args.test:
        # Test with just a few stadiums
        test_teams = ['Green Bay Packers', 'Buffalo Bills', 'Chicago Bears']
        outdoor_stadiums = {k: v for k, v in outdoor_stadiums.items() if k in test_teams}
    
    print(f"Fetching weather for {len(outdoor_stadiums)} outdoor stadiums...")
    
    weather_data = []
    
    for team, stadium_info in outdoor_stadiums.items():
        print(f"Getting weather for {team} ({stadium_info['city']}, {stadium_info['state']})...")
        
        forecast_data = weather_api.get_forecast(stadium_info['city'], stadium_info['state'])
        
        if forecast_data:
            # Get game time if available
            game_time = games_data.get(team)
            
            # Generate summary for game time or current conditions
            summary = generate_weather_summary(forecast_data, game_time)
            
            time_info = f" at game time ({game_time.strftime('%m/%d %I:%M%p')})" if game_time else ""
            
            weather_data.append({
                'team': team,
                'stadium': stadium_info['stadium'],
                'city': stadium_info['city'],
                'state': stadium_info['state'],
                'weather_summary': summary,
                'forecast_time': datetime.now().isoformat(),
                'game_time': game_time.isoformat() if game_time else '',
                'raw_data': json.dumps(forecast_data)  # Store raw data for detailed analysis
            })
            
            print(f"  {summary}{time_info}")
        else:
            print(f"  Failed to get weather data")
    
    # Create output directory if it doesn't exist
    os.makedirs(os.path.dirname(args.output), exist_ok=True)
    
    # Save to CSV
    df = pd.DataFrame(weather_data)
    df.to_csv(args.output, index=False)
    
    print(f"\nWeather data saved to {args.output}")
    print(f"Retrieved weather for {len(weather_data)} stadiums")

if __name__ == "__main__":
    main()