import { chromium } from 'playwright';
import fs from 'fs';
import { convertToCSV } from './csvConverter.js';
import { detectCountry } from './countryDetector.js';
import { formatFBrefUrl } from './urlFormatter.js';
import { scrapeCompetitionData, scrapeCompetitionPage } from './scraper.js';

// Export all the functions we want to use elsewhere
export { analyze_page_structure, read_all_leagues, read_mens_leagues, read_womens_leagues };


// Helper function to fetch champion and top scorer data from competition page
async function fetchCompetitionDetails(page, url) {
    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForLoadState('networkidle');

        const details = await page.evaluate(() => {
            const championText = document.querySelector('h2:contains("Champion")');
            const topScorerText = document.querySelector('h2:contains("Top Scorer")');

            let champion = null;
            let topScorer = null;

            if (championText) {
                const championElement = championText.nextElementSibling;
                if (championElement) {
                    champion = championElement.textContent.trim();
                }
            }

            if (topScorerText) {
                const topScorerElement = topScorerText.nextElementSibling;
                if (topScorerElement) {
                    topScorer = topScorerElement.textContent.trim();
                }
            }

            return { champion, topScorer };
        });

        return details;
    } catch (error) {
        console.warn(`Failed to fetch details for ${url}:`, error.message);
        return { champion: null, topScorer: null };
    }
}

// Helper function to read and analyze page structure
async function analyze_page_structure(page) {
    console.log('Analyzing page structure...');
    const structure = await page.evaluate(() => {
        const filters = Array.from(document.querySelectorAll('.sr_preset')).map(filter => ({
            text: filter.textContent,
            hideSelector: filter.getAttribute('data-hide'),
            showSelector: filter.getAttribute('data-show')
        }));

        const tables = Array.from(document.querySelectorAll('.table_wrapper')).map(wrapper => {
            const heading = wrapper.querySelector('.section_heading h2');
            const rows = Array.from(wrapper.querySelectorAll('tbody tr'));
            const genderRows = {
                total: rows.length,
                men: rows.filter(row => row.classList.contains('gender-m')).length,
                women: rows.filter(row => row.classList.contains('gender-f')).length,
            };

            return {
                title: heading ? heading.textContent : 'Unknown',
                totalRows: rows.length,
                genderBreakdown: genderRows
            };
        });

        return {
            filters,
            tables
        };
    });

    console.log('\nPage Structure Analysis:');
    console.log('\nFilters found:');
    structure.filters.forEach(filter => {
        console.log(`- ${filter.text}`);
        console.log(`  Hide: ${filter.hideSelector}`);
        console.log(`  Show: ${filter.showSelector}`);
    });

    console.log('\nTables found:');
    structure.tables.forEach(table => {
        console.log(`\n${table.title}:`);
        console.log(`Total rows: ${table.totalRows}`);
        console.log(`Men's competitions: ${table.genderBreakdown.men}`);
        console.log(`Women's competitions: ${table.genderBreakdown.women}`);
    });

    return structure;
}

// Function to read all leagues or a specific league's seasons history
async function read_all_leagues(season = null, leagueName = null) {
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
    let jsonData = null;

    try {
        const url = formatFBrefUrl(season);
        console.log(`Navigating to fbref.com competitions page${season ? ` for season ${season}` : ''}...`);

        // Add retry logic for page navigation
        let retries = 3;
        while (retries > 0) {
            try {
                await page.goto(url, {
                    waitUntil: 'domcontentloaded', // Changed from networkidle to domcontentloaded
                    timeout: 180000 // Increased timeout to 3 minutes
                });
                break; // If successful, break the retry loop
            } catch (error) {
                retries--;
                if (retries === 0) {
                    throw error; // If all retries failed, throw the error
                }
                console.log(`Navigation failed, retrying... (${retries} attempts remaining)`);
                await page.waitForTimeout(5000); // Wait 5 seconds before retrying
            }
        }

        console.log('Waiting for page to load...');
        try {
            // Try to wait for either network idle or DOM content loaded
            await Promise.race([
                page.waitForLoadState('networkidle', { timeout: 30000 }),
                page.waitForLoadState('domcontentloaded', { timeout: 30000 })
            ]);
            console.log('Page loaded successfully');
        } catch (error) {
            console.warn('Timeout while waiting for page load, continuing anyway:', error.message);
        }

        // Add a shorter fixed wait instead of waiting for network idle
        await page.waitForTimeout(10000);

        // If a specific league is requested, find its URL and navigate to its history
        if (leagueName) {
            console.log(`Searching for league: ${leagueName}...`);
            const leagueUrl = await page.evaluate((name) => {
                const links = Array.from(document.querySelectorAll('table a'));
                const link = links.find(a => a.textContent.trim().toLowerCase().includes(name.toLowerCase()));
                return link ? link.href : null;
            }, leagueName);

            if (!leagueUrl) {
                throw new Error(`League "${leagueName}" not found`);
            }

            console.log(`Found league URL: ${leagueUrl}`);
            console.log('Navigating to league page...');

            // Add retry logic for league page navigation
            let retries = 3;
            while (retries > 0) {
                try {
                    await page.goto(leagueUrl, {
                        waitUntil: 'domcontentloaded',
                        timeout: 180000 // 3 minutes
                    });
                    break; // If successful, break the retry loop
                } catch (error) {
                    retries--;
                    if (retries === 0) {
                        throw error; // If all retries failed, throw the error
                    }
                    console.log(`League page navigation failed, retrying... (${retries} attempts remaining)`);
                    await page.waitForTimeout(5000); // Wait 5 seconds before retrying
                }
            }

            try {
                // Try to wait for either network idle or DOM content loaded
                await Promise.race([
                    page.waitForLoadState('networkidle', { timeout: 30000 }),
                    page.waitForLoadState('domcontentloaded', { timeout: 30000 })
                ]);
                console.log('League page loaded successfully');
            } catch (error) {
                console.warn('Timeout while waiting for league page load, continuing anyway:', error.message);
            }

            await page.waitForTimeout(10000);

            // Wait for table to be available
            try {
                await page.waitForSelector('table#seasons', { timeout: 30000 });
            } catch (error) {
                console.warn('Table selector timeout, will try alternative selectors');
            }

            // Get seasons data
            // First, log all available tables and their IDs
            console.log('Analyzing page structure before evaluation...');
            const tableInfo = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('table')).map(table => ({
                    id: table.id,
                    className: table.className,
                    headers: Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim())
                }));
            });
            console.log('Available tables:', JSON.stringify(tableInfo, null, 2));

            const seasonsData = await page.evaluate(() => {
                const data = [];

                // Debug: Log page title and URL
                console.log('Current page:', document.title);
                console.log('URL:', window.location.href);

                // Try different table selectors as some leagues use different IDs/classes
                const seasonsTable = document.querySelector('table#seasons');

                if (!seasonsTable) {
                    console.warn('No seasons table found');
                    return data;
                }

                // Get the headers first
                const headers = Array.from(seasonsTable.querySelectorAll('thead th')).map(th => ({
                    text: th.textContent.trim(),
                    dataStat: th.getAttribute('data-stat')
                }));

                // Debug: Log headers
                console.log('Headers found:', headers);

                const rows = seasonsTable.querySelectorAll('tbody tr:not(.thead)');

                rows.forEach((row, index) => {
                    // Skip header rows
                    if (row.classList.contains('thead')) return;

                    const rowData = {};

                    // Process each cell in the row
                    const cells = row.querySelectorAll('th, td');
                    console.log(`Row ${index} cells:`, Array.from(cells).map(cell => cell.textContent.trim()));
                    cells.forEach((cell, cellIndex) => {
                        if (cellIndex >= headers.length) return;

                        const header = headers[cellIndex];
                        const headerText = header.text.trim();
                        const cellText = cell.textContent.trim();

                        // Don't process empty cells
                        if (!cellText) return;

                        // Map column headers to field names
                        let fieldName;
                        switch (headerText) {
                            case 'Season':
                                fieldName = 'season';
                                break;
                            case 'Competition Name':
                                fieldName = 'competition';
                                break;
                            case '# Squads':
                                fieldName = 'squads';
                                // Convert squad count to number
                                const squadCount = parseInt(cellText);
                                if (!isNaN(squadCount)) {
                                    rowData[fieldName] = squadCount;
                                    return;
                                }
                                break;
                            case 'Champion':
                                // Handle cases where the champion is listed with points
                                const championMatch = cellText.match(/(.+?)\s*(?:-\s*(\d+))?$/);
                                if (championMatch) {
                                    rowData.champion = championMatch[1].trim();
                                    if (championMatch[2]) {
                                        rowData.champion_points = parseInt(championMatch[2]);
                                    }
                                } else {
                                    rowData.champion = cellText;
                                }
                                return;
                            case 'Top Scorer':
                                fieldName = 'top_scorer';
                                break;
                            default:
                                fieldName = headerText.toLowerCase().replace(/[\s#]+/g, '_');
                        }

                        // Only set non-empty values
                        if (cellText) {
                            rowData[fieldName] = cellText;
                        }

                        // Check for links
                        const link = cell.querySelector('a');
                        if (link) {
                            rowData[`${fieldName}_url`] = link.href;
                        }

                        // Extract points from champion text if available
                        if (fieldName === 'champion' && cellText) {
                            const pointsMatch = cellText.match(/ - (\d+)$/);
                            if (pointsMatch) {
                                rowData.champion_points = parseInt(pointsMatch[1]);
                                rowData.champion = cellText.split(' - ')[0].trim();
                            }
                        }
                    });

                    // Only add rows that have season data and aren't header rows
                    if (rowData.season && rowData.season !== 'Season') {
                        data.push(rowData);
                    }
                });

                return data;
            });

            // Create league-specific data structure
            jsonData = {
                timestamp: new Date().toISOString(),
                source: 'fbref.com',
                league_name: leagueName,
                league_url: leagueUrl,
                seasons_count: seasonsData.length,
                seasons: seasonsData
            };

            // Create filenames for league history
            const leagueFilename = leagueName
                .toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_]/g, '');
            const seasonStr = season ? `_${season}` : '';
            const jsonFilename = `data/${leagueFilename}${seasonStr}_history.json`;
            const csvFilename = `data/${leagueFilename}${seasonStr}_history.csv`;

            // Save files
            fs.writeFileSync(jsonFilename, JSON.stringify(jsonData, null, 2));
            console.log(`\nData has been saved to ${jsonFilename}`);

            const csvContent = convertToCSV(jsonData);
            fs.writeFileSync(csvFilename, csvContent);
            console.log(`Data has been saved to ${csvFilename}`);

            return jsonData;
        }

        // Click "All Genders" filter
        await page.click('a.sr_preset[data-show=".gender-m,.gender-f"]');
        await page.waitForTimeout(1000);

        const tableData = await page.evaluate(() => {
            const tables = {};

            document.querySelectorAll('.table_wrapper').forEach(wrapper => {
                const heading = wrapper.querySelector('.section_heading h2');
                const table = wrapper.querySelector('table');

                if (!heading || !table) return;

                const captionText = heading.textContent.trim();

                const headers = Array.from(table.querySelectorAll('thead th')).map(th =>
                    th.textContent.trim()
                        .toLowerCase()
                        .replace(/\s+/g, '_')
                        .replace(/[^a-z0-9_]/g, '')
                );

                const rows = [];
                const links = [];

                Array.from(table.querySelectorAll('tbody tr:not(.hidden)')).forEach(row => {
                    const cells = Array.from(row.querySelectorAll('th, td'));
                    const rowData = {};
                    const rowLinks = {};

                    cells.forEach((cell, index) => {
                        const links = cell.querySelectorAll('a');
                        const cellData = cell.textContent.trim();

                        if (index === 0) {
                            rowData.competition_name = cellData;
                            if (links.length > 0) {
                                rowData.url = links[0].href;
                                rowLinks.competition_link = {
                                    name: cellData,
                                    url: links[0].href
                                };
                            }
                        }
                        else if (headers[index]) {
                            const fieldName = headers[index];
                            rowData[fieldName] = cellData;

                            if (links.length > 0) {
                                rowLinks[`${fieldName}_link`] = {
                                    name: cellData,
                                    url: links[0].href
                                };
                            }
                        }
                    });

                    rowData.gender = row.classList.contains('gender-f') ? 'F' : 'M';

                    if (Object.keys(rowLinks).length > 0) {
                        rowData.links = rowLinks;
                    }

                    rows.push(rowData);

                    if (rowLinks.competition_link) {
                        links.push(rowLinks.competition_link);
                    }
                });

                const tableKey = captionText
                    .toLowerCase()
                    .replace(/table/i, '')
                    .trim()
                    .replace(/\s+/g, '_')
                    .replace(/[^a-z0-9_]/g, '');

                tables[tableKey] = {
                    title: captionText,
                    headers: headers,
                    rows: rows,
                    [`${tableKey}_links`]: links
                };
            });

            return tables;
        });

        jsonData = {
            timestamp: new Date().toISOString(),
            source: 'fbref.com',
            dataType: 'all football competitions',
            summary: {
                total_tables: Object.keys(tableData).length,
                tables: Object.keys(tableData).map(key => ({
                    name: tableData[key].title,
                    rows: tableData[key].rows.length,
                    total_links: tableData[key][`${key}_links`].length
                }))
            },
            tables: tableData
        };

        // Create filenames based on season
        const seasonStr = season ? `_${season}` : '';
        const jsonFilename = `data/all_football_competitions${seasonStr}.json`;
        const csvFilename = `data/all_football_competitions${seasonStr}.csv`;

        // Save to JSON file
        fs.writeFileSync(jsonFilename, JSON.stringify(jsonData, null, 2));
        console.log(`\nData has been saved to ${jsonFilename}`);

        // Convert to CSV and save
        const csvContent = convertToCSV(jsonData);
        fs.writeFileSync(csvFilename, csvContent);
        console.log(`Data has been saved to ${csvFilename}`);

    } catch (error) {
        console.error('An error occurred:', error);
        throw error;
    } finally {
        await browser.close();
    }

    return jsonData;
}

// Function to read only men's leagues
async function read_mens_leagues(season = null) {
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
    let jsonData = null;

    try {
        const url = formatFBrefUrl(season);
        console.log(`Navigating to fbref.com competitions page for men's leagues${season ? ` (season ${season})` : ''}...`);
        await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 90000
        });

        console.log('Waiting for page to load...');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);

        // Click "Men" filter
        await page.click('a.sr_preset[data-hide=".gender-f"][data-show=".gender-m"]');
        await page.waitForTimeout(1000);

        const tableData = await page.evaluate(() => {
            const tables = {};

            document.querySelectorAll('.table_wrapper').forEach(wrapper => {
                const heading = wrapper.querySelector('.section_heading h2');
                const table = wrapper.querySelector('table');

                if (!heading || !table) return;

                const captionText = heading.textContent.trim();

                const headers = Array.from(table.querySelectorAll('thead th')).map(th =>
                    th.textContent.trim()
                        .toLowerCase()
                        .replace(/\s+/g, '_')
                        .replace(/[^a-z0-9_]/g, '')
                );

                const rows = [];
                const links = [];

                Array.from(table.querySelectorAll('tbody tr:not(.hidden)')).forEach(row => {
                    const cells = Array.from(row.querySelectorAll('th, td'));
                    const rowData = {};
                    const rowLinks = {};

                    cells.forEach((cell, index) => {
                        const links = cell.querySelectorAll('a');
                        const cellData = cell.textContent.trim();

                        if (index === 0) {
                            rowData.competition_name = cellData;
                            if (links.length > 0) {
                                rowData.url = links[0].href;
                                rowLinks.competition_link = {
                                    name: cellData,
                                    url: links[0].href
                                };
                            }
                        }
                        else if (headers[index]) {
                            const fieldName = headers[index];
                            rowData[fieldName] = cellData;

                            if (links.length > 0) {
                                rowLinks[`${fieldName}_link`] = {
                                    name: cellData,
                                    url: links[0].href
                                };
                            }
                        }
                    });

                    // All competitions in this data should be men's
                    rowData.gender = 'M';

                    if (Object.keys(rowLinks).length > 0) {
                        rowData.links = rowLinks;
                    }

                    rows.push(rowData);

                    if (rowLinks.competition_link) {
                        links.push(rowLinks.competition_link);
                    }
                });

                const tableKey = captionText
                    .toLowerCase()
                    .replace(/table/i, '')
                    .trim()
                    .replace(/\s+/g, '_')
                    .replace(/[^a-z0-9_]/g, '');

                tables[tableKey] = {
                    title: captionText,
                    headers: headers,
                    rows: rows,
                    [`${tableKey}_links`]: links
                };
            });

            return tables;
        });

        jsonData = {
            timestamp: new Date().toISOString(),
            source: 'fbref.com',
            dataType: 'men\'s football competitions',
            summary: {
                total_tables: Object.keys(tableData).length,
                tables: Object.keys(tableData).map(key => ({
                    name: tableData[key].title,
                    rows: tableData[key].rows.length,
                    total_links: tableData[key][`${key}_links`].length
                }))
            },
            tables: tableData
        };

        // Create filenames based on season
        const seasonStr = season ? `_${season}` : '';
        const jsonFilename = `data/mens_football_competitions${seasonStr}.json`;
        const csvFilename = `data/mens_football_competitions${seasonStr}.csv`;

        // Save to JSON file
        fs.writeFileSync(jsonFilename, JSON.stringify(jsonData, null, 2));
        console.log(`\nData has been saved to ${jsonFilename}`);

        // Convert to CSV and save
        const csvContent = convertToCSV(jsonData);
        fs.writeFileSync(csvFilename, csvContent);
        console.log(`Data has been saved to ${csvFilename}`);

    } catch (error) {
        console.error('An error occurred:', error);
        throw error;
    } finally {
        await browser.close();
    }

    return jsonData;
}

// Function to read only women's leagues
async function read_womens_leagues(season = null) {
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
    let jsonData = null;

    try {
        const url = formatFBrefUrl(season);
        console.log(`Navigating to fbref.com competitions page for women's leagues${season ? ` (season ${season})` : ''}...`);
        await page.goto(url, {
            waitUntil: 'networkidle',
            timeout: 90000
        });

        console.log('Waiting for page to load...');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);

        // Click "Women" filter
        await page.click('a.sr_preset[data-hide=".gender-m"][data-show=".gender-f"]');
        await page.waitForTimeout(1000);

        const tableData = await page.evaluate(() => {
            const tables = {};

            document.querySelectorAll('.table_wrapper').forEach(wrapper => {
                const heading = wrapper.querySelector('.section_heading h2');
                const table = wrapper.querySelector('table');

                if (!heading || !table) return;

                const captionText = heading.textContent.trim();

                const headers = Array.from(table.querySelectorAll('thead th')).map(th =>
                    th.textContent.trim()
                        .toLowerCase()
                        .replace(/\s+/g, '_')
                        .replace(/[^a-z0-9_]/g, '')
                );

                const rows = [];
                const links = [];

                Array.from(table.querySelectorAll('tbody tr:not(.hidden)')).forEach(row => {
                    const cells = Array.from(row.querySelectorAll('th, td'));
                    const rowData = {};
                    const rowLinks = {};

                    cells.forEach((cell, index) => {
                        const links = cell.querySelectorAll('a');
                        const cellData = cell.textContent.trim();

                        if (index === 0) {
                            rowData.competition_name = cellData;
                            if (links.length > 0) {
                                rowData.url = links[0].href;
                                rowLinks.competition_link = {
                                    name: cellData,
                                    url: links[0].href
                                };
                            }
                        }
                        else if (headers[index]) {
                            const fieldName = headers[index];
                            rowData[fieldName] = cellData;

                            if (links.length > 0) {
                                rowLinks[`${fieldName}_link`] = {
                                    name: cellData,
                                    url: links[0].href
                                };
                            }
                        }
                    });

                    // All competitions in this data should be women's
                    rowData.gender = 'F';

                    if (Object.keys(rowLinks).length > 0) {
                        rowData.links = rowLinks;
                    }

                    rows.push(rowData);

                    if (rowLinks.competition_link) {
                        links.push(rowLinks.competition_link);
                    }
                });

                const tableKey = captionText
                    .toLowerCase()
                    .replace(/table/i, '')
                    .trim()
                    .replace(/\s+/g, '_')
                    .replace(/[^a-z0-9_]/g, '');

                tables[tableKey] = {
                    title: captionText,
                    headers: headers,
                    rows: rows,
                    [`${tableKey}_links`]: links
                };
            });

            return tables;
        });

        jsonData = {
            timestamp: new Date().toISOString(),
            source: 'fbref.com',
            dataType: 'women\'s football competitions',
            summary: {
                total_tables: Object.keys(tableData).length,
                tables: Object.keys(tableData).map(key => ({
                    name: tableData[key].title,
                    rows: tableData[key].rows.length,
                    total_links: tableData[key][`${key}_links`].length
                }))
            },
            tables: tableData
        };

        // Create filenames based on season
        const seasonStr = season ? `_${season}` : '';
        const jsonFilename = `data/womens_football_competitions${seasonStr}.json`;
        const csvFilename = `data/womens_football_competitions${seasonStr}.csv`;

        // Save to JSON file
        fs.writeFileSync(jsonFilename, JSON.stringify(jsonData, null, 2));
        console.log(`\nData has been saved to ${jsonFilename}`);

        // Convert to CSV and save
        const csvContent = convertToCSV(jsonData);
        fs.writeFileSync(csvFilename, csvContent);
        console.log(`Data has been saved to ${csvFilename}`);

    } catch (error) {
        console.error('An error occurred:', error);
        throw error;
    } finally {
        await browser.close();
    }

    return jsonData;
}

// Example usage
async function main() {
    try {
        const browser = await chromium.launch({
            headless: false,
            channel: 'msedge'
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0'
        });

        const page = await context.newPage();

        // First analyze the page structure
        console.log('Analyzing page structure...');
        await page.goto('https://fbref.com/en/comps/', {
            waitUntil: 'networkidle',
            timeout: 90000
        });

        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);

        await analyze_page_structure(page);
        await browser.close();

        // Now fetch all types of competitions
        console.log('\nFetching all competitions data...');
        const allLeagues = await read_all_leagues();
        console.log('\nFetching men\'s competitions data...');
        const mensLeagues = await read_mens_leagues();
        console.log('\nFetching women\'s competitions data...');
        const womensLeagues = await read_womens_leagues();

        // Display summary for all competitions
        console.log('\nAll Competitions Summary:');
        Object.entries(allLeagues.tables).forEach(([key, data]) => {
            const menCount = data.rows.filter(row => row.gender === 'M').length;
            const womenCount = data.rows.filter(row => row.gender === 'F').length;

            console.log(`\n${data.title}:`);
            console.log(`Total: ${data.rows.length} competitions`);
            console.log(`Men's: ${menCount} competitions`);
            console.log(`Women's: ${womenCount} competitions`);
        });

        // Display summary for men's competitions
        console.log('\nMen\'s Competitions Summary:');
        Object.entries(mensLeagues.tables).forEach(([key, data]) => {
            if (data.rows.length > 0) {
                console.log(`\n${data.title}:`);
                console.log(`Total: ${data.rows.length} competitions`);
            }
        });

        // Display summary for women's competitions
        console.log('\nWomen\'s Competitions Summary:');
        Object.entries(womensLeagues.tables).forEach(([key, data]) => {
            if (data.rows.length > 0) {
                console.log(`\n${data.title}:`);
                console.log(`Total: ${data.rows.length} competitions`);
            }
        });

    } catch (error) {
        console.error('Error in main:', error);
    }
}


// Run the main function
// main().catch(console.error);

// Example usage:
// Current season (no parameter)
// read_all_leagues().catch(console.error);

// Single year season
// read_mens_leagues("1986").catch(console.error);

// Season range
// read_all_leagues("2003-2004").catch(console.error);

read_all_leagues(null, "Premier League").catch(console.error);

// Export the main function instead of running it automatically
export { main };
