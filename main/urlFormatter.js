/**
 * Helper function to format the URL based on the season parameter
 * @param {string|number|null} season Optional season parameter (e.g., "1986", "2003-2004", or null)
 * @returns {string} The formatted FBref URL
 */
export function formatFBrefUrl(season = null) {
    const baseUrl = 'https://fbref.com/en/comps';

    if (!season) {
        return baseUrl;
    }

    // Convert to string in case a number is passed
    const seasonStr = season.toString();

    // Check if it's a valid season format (YYYY or YYYY-YYYY)
    const singleYearPattern = /^\d{4}$/;
    const yearRangePattern = /^\d{4}-\d{4}$/;

    if (!singleYearPattern.test(seasonStr) && !yearRangePattern.test(seasonStr)) {
        console.warn(`Invalid season format: ${seasonStr}. Using default URL.`);
        return baseUrl;
    }

    return `${baseUrl}/season/${seasonStr}`;
}