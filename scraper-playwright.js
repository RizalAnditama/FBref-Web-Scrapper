import { chromium } from 'playwright';
import fs from 'fs';

async function scrapeFbref() {
    const browser = await chromium.launch({
        headless: false,
        channel: 'msedge'
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
    });

    const page = await context.newPage();

    try {
        console.log('Navigating to fbref.com competitions page...');
        await page.goto('https://fbref.com/en/comps/', {
            waitUntil: 'load',
            timeout: 60000
        });

        // Wait for the National Team Competitions filter link to be available
        console.log('Looking for National Team Competitions filter...');
        await page.waitForSelector('a.sr_preset[data-hide=".type-club"][data-show=".type-fa"]', {
            timeout: 30000
        });

        // Click the National Team Competitions filter
        console.log('Clicking National Team Competitions filter...');
        await page.click('a.sr_preset[data-hide=".type-club"][data-show=".type-fa"]');

        // Wait for the filtering to take effect
        await page.waitForTimeout(2000);

        // Ensure that national team rows are visible
        console.log('Waiting for national team rows to be visible...');
        try {
            await page.waitForSelector('tr.type-fa:not([style*="display: none"])', {
                state: 'visible',
                timeout: 10000
            });
        } catch (e) {
            console.log('Warning: No visible national team rows found');
        }

        // Debug: Check page content after clicking filter
        console.log('Analyzing page structure...');
        const pageInfo = await page.evaluate(() => {
            const tables = document.querySelectorAll('table');
            const info = {
                totalTables: tables.length,
                tableDetails: Array.from(tables).map(t => {
                    const caption = t.querySelector('caption');
                    const headerCells = t.querySelectorAll('thead th');
                    const visibleRows = t.querySelectorAll('tbody tr:not([style*="display: none"])');

                    return {
                        caption: caption ? caption.textContent.trim() : 'No caption',
                        headers: Array.from(headerCells).map(h => h.textContent.trim()),
                        visibleRowCount: visibleRows.length,
                        firstRowSample: visibleRows.length > 0 ? {
                            cells: Array.from(visibleRows[0].querySelectorAll('th, td')).map(c => c.textContent.trim())
                        } : null
                    };
                })
            };
            return info;
        });
        console.log('Page structure:', JSON.stringify(pageInfo, null, 2));

        // Wait for the filtered table content
        console.log('Waiting for filtered table content...');
        const hasTable = await page.waitForSelector('table', {
            timeout: 30000,
            state: 'attached'
        });

        // Get National Team Competitions information
        const nationalTeamData = await page.evaluate(() => {
            const data = {
                competitions: [],
                qualifications: []
            };

            // Function to extract table data
            const extractTableData = (table) => {
                const rows = table.querySelectorAll('tbody tr:not([style*="display: none"])');
                console.log(`Found ${rows.length} visible rows in table`);

                return Array.from(rows).map(row => {
                    const nameCell = row.querySelector('th');
                    const cells = row.querySelectorAll('td');

                    const linkElement = nameCell ? nameCell.querySelector('a') : null;
                    const data = {
                        competition_name: linkElement ? linkElement.textContent.trim() : nameCell ? nameCell.textContent.trim() : '',
                        url: linkElement ? linkElement.href : '',
                        gender: cells[0] ? cells[0].textContent.trim() : '',
                        governing_body: cells[1] ? cells[1].textContent.trim() : '',
                        first_season: cells[2] ? cells[2].textContent.trim() : '',
                        last_season: cells[3] ? cells[3].textContent.trim() : '',
                        tier: cells[4] ? cells[4].textContent.trim() : '',
                        awards: cells[5] ? cells[5].textContent.trim() : ''
                    };
                    console.log('Extracted row:', data);
                    return data;
                }).filter(comp => comp.competition_name && comp.competition_name !== '');
            };

            // Find the main competitions table
            const tables = document.querySelectorAll('table');
            let competitionsTable = null;
            let qualificationsTable = null;

            // Look for tables with specific captions
            tables.forEach(table => {
                const caption = table.querySelector('caption');
                if (caption) {
                    const captionText = caption.textContent.trim();
                    if (captionText === 'National Team Competitions Table') {
                        competitionsTable = table;
                    } else if (captionText === 'National Team Qualification Table') {
                        qualificationsTable = table;
                    }
                }
            });

            // Extract data from both tables if found
            if (competitionsTable) {
                data.competitions = extractTableData(competitionsTable);
            }

            if (qualificationsTable) {
                data.qualifications = extractTableData(qualificationsTable);
            }

            return data;
        });

        // Create a data object with metadata
        const jsonData = {
            timestamp: new Date().toISOString(),
            source: 'fbref.com',
            dataType: 'national team competitions',
            summary: {
                total_competitions: nationalTeamData.competitions.length,
                total_qualifications: nationalTeamData.qualifications.length
            },
            national_team_competitions: {
                description: 'Major international tournaments and competitions',
                count: nationalTeamData.competitions.length,
                competitions: nationalTeamData.competitions.map(comp => ({
                    ...comp,
                    competition_type: 'Major Tournament'
                }))
            },
            national_team_qualifications: {
                description: 'Qualification tournaments for major competitions',
                count: nationalTeamData.qualifications.length,
                competitions: nationalTeamData.qualifications.map(comp => ({
                    ...comp,
                    competition_type: 'Qualification Tournament'
                }))
            }
        };

        // Write to file
        fs.writeFileSync('national_team_competitions.json', JSON.stringify(jsonData, null, 2));

        console.log('\nData has been saved to national_team_competitions.json');
        console.log(`\nTotal national team competitions found: ${nationalTeamData.competitions.length}`);
        console.log(`Total national team qualifications found: ${nationalTeamData.qualifications.length}`);

        // Display sample of competitions
        console.log('\nSample of Major National Team Competitions:');
        console.log('-------------------');
        nationalTeamData.competitions.slice(0, 2).forEach(comp => {
            console.log(`Competition: ${comp.competition_name}
Gender: ${comp.gender}
Governing Body: ${comp.governing_body}
Seasons: ${comp.first_season} - ${comp.last_season}
Tier: ${comp.tier}
Awards: ${comp.awards}
URL: ${comp.url}
-------------------`);
        });

        console.log('\nSample of National Team Qualifications:');
        console.log('-------------------');
        nationalTeamData.qualifications.slice(0, 2).forEach(comp => {
            console.log(`Competition: ${comp.competition_name}
Gender: ${comp.gender}
Governing Body: ${comp.governing_body}
Seasons: ${comp.first_season} - ${comp.last_season}
Tier: ${comp.tier}
Awards: ${comp.awards}
URL: ${comp.url}
-------------------`);
        });

    } catch (error) {
        console.log('An error occurred:', error);
    } finally {
        await browser.close();
    }
}

// Run the scraper
scrapeFbref().catch(console.error);