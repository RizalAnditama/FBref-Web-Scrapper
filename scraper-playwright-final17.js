import { chromium } from 'playwright';
import fs from 'fs';

// Export all the functions we want to use elsewhere
export { analyze_page_structure, read_all_leagues, read_mens_leagues, read_womens_leagues };

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

// Function to read all leagues
async function read_all_leagues() {
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
        console.log('Navigating to fbref.com competitions page...');
        await page.goto('https://fbref.com/en/comps/', {
            waitUntil: 'networkidle',
            timeout: 90000
        });

        console.log('Waiting for page to load...');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(5000);

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

        // Save to file
        fs.writeFileSync('all_football_competitions.json', JSON.stringify(jsonData, null, 2));
        console.log('\nData has been saved to all_football_competitions.json');

    } catch (error) {
        console.error('An error occurred:', error);
        throw error;
    } finally {
        await browser.close();
    }

    return jsonData;
}

// Function to read only men's leagues
async function read_mens_leagues() {
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
        console.log('Navigating to fbref.com competitions page for men\'s leagues...');
        await page.goto('https://fbref.com/en/comps/', {
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

        // Save to file
        fs.writeFileSync('mens_football_competitions.json', JSON.stringify(jsonData, null, 2));
        console.log('\nData has been saved to mens_football_competitions.json');

    } catch (error) {
        console.error('An error occurred:', error);
        throw error;
    } finally {
        await browser.close();
    }

    return jsonData;
}

// Function to read only women's leagues
async function read_womens_leagues() {
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
        console.log('Navigating to fbref.com competitions page for women\'s leagues...');
        await page.goto('https://fbref.com/en/comps/', {
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

        // Save to file
        fs.writeFileSync('womens_football_competitions.json', JSON.stringify(jsonData, null, 2));
        console.log('\nData has been saved to womens_football_competitions.json');

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

// analyze_page_structure().catch(console.error);
read_womens_leagues().catch(console.error);

// Export the main function instead of running it automatically
export { main };