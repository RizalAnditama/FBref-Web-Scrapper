import fs from 'fs';
import { detectCountry } from './countryDetector.js';

export { convertToCSV };

// Helper function to convert table data to CSV format
function convertToCSV(data) {
    const csvRows = [];

    // Check if this is league history data
    if (data.league_name && data.seasons) {
        // Add CSV header for league history
        csvRows.push('season,competition,squad,champion,top_scorer,notes,season_url,squad_url,champion_url,top_scorer_url');

        // Process each season
        data.seasons.forEach(season => {
            const csvRow = [
                season.season || '',
                season.competition || '',
                season.squad || '',
                season.champion || '',
                season.top_scorer || '',
                season.notes || '',
                season.season_url || '',
                season.squad_url || '',
                season.champion_url || '',
                season.top_scorer_url || ''
            ].map(field => {
                if (String(field).includes(',') || String(field).includes('"')) {
                    return `"${String(field).replace(/"/g, '""')}"`;
                }
                return field;
            });

            csvRows.push(csvRow.join(','));
        });

        return csvRows.join('\n');
    }

    // Regular competition data format
    // Add CSV header for competitions
    csvRows.push('league,gender,governing_body,first_season,last_season,tier,awards,url,country,champion,top_scorer');

    // Process each table
    Object.values(tableData.tables).forEach(table => {
        table.rows.forEach(row => {
            // Skip rows that contain "Competition Name" as these are headers
            if (row.competition_name === "Competition Name") {
                return;
            }

            const competitionName = row.competition_name;
            const country = detectCountry(competitionName, row.governing_body);

            // Debug log
            console.log(`Processing: "${competitionName}"`);
            console.log(`Extracted country: "${country}"`);

            // Map the data to our CSV structure
            const csvRow = [
                // League name - remove country in parentheses if present
                row.competition_name.split('(')[0].trim(),
                row.gender || '',
                row.governing_body || '',
                row.first_season || '',
                row.last_season || '',
                row.tier || '',
                row.awards || '',
                row.url || '',
                country,
                row.champion || '',
                row.top_scorer || ''
            ].map(field => {
                // Escape quotes and wrap field in quotes if it contains comma
                if (field.includes(',') || field.includes('"')) {
                    return `"${field.replace(/"/g, '""')}"`;
                }
                return field;
            });

            csvRows.push(csvRow.join(','));
        });
    });

    return csvRows.join('\n');
}