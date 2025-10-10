import requests
from bs4 import BeautifulSoup
import time
import random

# URL to scrape
url = "https://fbref.com/en/comps/"

# Headers to mimic a browser visit more accurately
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.5",
    "Accept-Encoding": "gzip, deflate, br",
    "DNT": "1",
    "Connection": "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Cache-Control": "max-age=0"
}

# Add a random delay before making the request (between 2 and 5 seconds)
time.sleep(random.uniform(2, 5))

# Send a GET request to the website with a session
session = requests.Session()
response = session.get(url, headers=headers)

# Print the status code and response
print(f"Status Code: {response.status_code}")
if response.status_code == 403:
    print("Access forbidden. The website might be blocking web scraping attempts.")
    exit()

response.raise_for_status()  # Raise an error for bad status

# Parse the HTML content with BeautifulSoup
soup = BeautifulSoup(response.text, 'html.parser')

# Example: Extract all competitions listed in the main table
table = soup.find('table', {'id': 'comps_club'})
rows = table.tbody.find_all('tr') if table else []

competitions = []
for row in rows:
    comp_name = row.find('th').get_text(strip=True)
    country = row.find('td').get_text(strip=True) if row.find('td') else 'N/A'
    competitions.append({'name': comp_name, 'country': country})

# Print result
for comp in competitions:
    print(f"Competition: {comp['name']}, Country: {comp['country']}")
