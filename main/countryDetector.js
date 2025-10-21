// League-country mapping for country detection
export const leagueCountryMap = {
    // England
    'Premier League': 'England',
    'FA Women\'s Super League': 'England',
    'EFL Championship': 'England',
    'EFL League One': 'England',
    'EFL League Two': 'England',
    'National League': 'England',
    'Premier League 2': 'England',
    'Premier League 2 — Division 2': 'England',
    'FA Cup': 'England',
    'FA Community Shield': 'England',
    'EFL Cup': 'England',

    // Spain
    'La Liga': 'Spain',
    'Liga F': 'Spain',
    'Spanish Segunda División': 'Spain',
    'Copa del Rey': 'Spain',
    'Supercopa de España': 'Spain',

    // France
    'Ligue 1': 'France',
    'Ligue 2': 'France',
    'Première Ligue': 'France',
    'Coupe de France': 'France',
    'Coupe de la Ligue': 'France',
    'Trophée des Champions': 'France',

    // Germany
    'Fußball-Bundesliga': 'Germany',
    'Frauen-Bundesliga': 'Germany',
    '2. Fußball-Bundesliga': 'Germany',
    '3. Fußball-Liga': 'Germany',
    'DFB-Pokal': 'Germany',
    'DFB-Pokal Frauen': 'Germany',
    'U17 DFB Youth League': 'Germany',
    'U19 DFB Youth League': 'Germany',
    'Franz Beckenbauer Supercup': 'Germany',

    // Italy
    'Serie A': 'Italy',
    'Serie B': 'Italy',
    'Coppa Italia': 'Italy',
    'Supercoppa Italiana': 'Italy',

    // Netherlands
    'Eredivisie': 'Netherlands',
    'Eredivisie Vrouwen': 'Netherlands',
    'Eerste Divisie': 'Netherlands',

    // Portugal
    'Primeira Liga': 'Portugal',

    // Scotland
    'Scottish Premiership': 'Scotland',
    'Scottish Championship': 'Scotland',

    // Turkey
    'Süper Lig': 'Turkey',

    // Belgium
    'Belgian Pro League': 'Belgium',
    'Belgian Women\'s Super League': 'Belgium',
    'Challenger Pro League': 'Belgium',

    // Poland
    'Ekstraklasa': 'Poland',

    // Sweden
    'Allsvenskan': 'Sweden',
    'Damallsvenskan': 'Sweden',
    'Superettan': 'Sweden',

    // Norway
    'Eliteserien': 'Norway',
    'Toppserien': 'Norway',

    // United States
    'Major League Soccer': 'United States',
    'National Women\'s Soccer League': 'United States',
    'Women\'s Professional Soccer': 'United States',
    'Women\'s United Soccer Association': 'United States',
    'North American Soccer League': 'United States',
    'USL Championship': 'United States',
    'USL First Division': 'United States',
    'USL League One': 'United States',
    'USSF Division 2 Professional League': 'United States',
    'Lamar Hunt U.S. Open Cup': 'United States',
    'NWSL Challenge Cup': 'United States',
    'NWSL Fall Series': 'United States',

    // Mexico
    'Liga MX': 'Mexico',

    // Japan
    'J1 League': 'Japan',
    'J2 League': 'Japan',
    'Women Empowerment League': 'Japan',

    // South Korea
    'K League 1': 'South Korea',

    // Australia
    'A-League Men': 'Australia',
    'A-League Women': 'Australia',

    // India
    'Indian Super League': 'India',
    'I-League': 'India',

    // China
    'Chinese Football Association Super League': 'China',

    // Saudi Arabia
    'Saudi Pro League': 'Saudi Arabia',

    // Austria
    'Austrian Football Bundesliga': 'Austria',
    'ÖFB Frauen-Bundesliga': 'Austria',

    // Brazil
    'Campeonato Brasileiro Série A': 'Brazil',
    'Campeonato Brasileiro Série B': 'Brazil',
    'Brasileirão Feminino Série A1': 'Brazil',

    // Argentina
    'Liga Profesional de Fútbol Argentina': 'Argentina',
    'Copa de la Liga Profesional': 'Argentina',

    // Other Countries
    'Croatian Football League': 'Croatia',
    'Czech First League': 'Czech Republic',
    'Danish Superliga': 'Denmark',
    'Liga Profesional Ecuador': 'Ecuador',
    'Veikkausliiga': 'Finland',
    'Super League Greece': 'Greece',
    'Nemzeti Bajnokság I': 'Hungary',
    'League of Ireland Premier Division': 'Ireland',
    'Persian Gulf Pro League': 'Iran',
    'Paraguayan Primera División': 'Paraguay',
    'Liga 1 de Fútbol Profesional': 'Peru',
    'Liga I': 'Romania',
    'Russian Premier League': 'Russia',
    'Serbian SuperLiga': 'Serbia',
    'Swiss Super League': 'Switzerland',
    'Swiss Women\'s Super League': 'Switzerland',
    'Ukrainian Premier League': 'Ukraine',
    'Uruguayan Primera División': 'Uruguay',
    'Venezuelan Primera División': 'Venezuela',
    'South African Premiership': 'South Africa',
    'División de Fútbol Profesional': 'Bolivia',
    'Canadian Premier League': 'Canada',
    'Chilean Primera División': 'Chile',
    'Categoría Primera A': 'Colombia',
    'A-Liga': 'Slovenia'
};

// List of international competition markers
export const internationalMarkers = [
    'FIFA', 'UEFA', 'AFC', 'CAF', 'CONCACAF', 'CONMEBOL', 'OFC',
    'World Cup', 'Champions League', 'Europa League', 'Nations League',
    'Copa Libertadores', 'Sudamericana', 'Leagues Cup', 'Olympics',
    'International', 'Confederations Cup', 'Gold Cup', 'Asian Cup',
    'Copa América', 'European Championship', 'African Cup of Nations',
    'Algarve Cup', 'SheBelieves Cup'
];

// Helper function to detect country
export function detectCountry(competitionName, governingBody) {
    let country = '';

    // First check if it's a known league
    if (leagueCountryMap[competitionName]) {
        country = leagueCountryMap[competitionName];
        return country;
    }

    // Check for international competitions
    if (internationalMarkers.some(marker => competitionName.includes(marker))) {
        return 'International';
    }

    // Try different patterns for country extraction
    if (competitionName.includes('(')) {
        const match = competitionName.match(/\((.*?)\)/)?.[1]?.trim() || '';
        if (match && !['M', 'W'].includes(match)) {
            country = match;
            return country;
        }
    }

    if (competitionName.includes(' - ')) {
        country = competitionName.split(' - ')[0].trim();
        return country;
    }

    // If still no country and governing body available, try that
    if (!country && governingBody) {
        const govBody = governingBody.trim();
        if (govBody.includes('(')) {
            const match = govBody.match(/\((.*?)\)/)?.[1]?.trim() || '';
            if (match && !['M', 'W'].includes(match)) {
                country = match;
                return country;
            }
        }
        if (govBody.includes(',')) {
            country = govBody.split(',')[0].trim();
            return country;
        }
    }

    return country;
}