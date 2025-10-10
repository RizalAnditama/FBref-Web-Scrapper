import { chromium } from 'playwright';
import fs from 'fs';

async function scrapeFbref() {
    // Launch browser with custom viewport and user agent
    const browser = await chromium.launch({
        headless: false, // Set to true if you want to run in headless mode
        channel: 'msedge' // Use the installed Edge browser
    });

    // Create a new context with specific user agent and viewport
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
    });

    // Create a new page
    const page = await context.newPage();

    // Set additional headers
    await page.setExtraHTTPHeaders({
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Chromium";v="119", "Microsoft Edge";v="119", "Not?A_Brand";v="24"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
    });

    try {
        // Navigate to the competitions page with full page load
        console.log('Navigating to fbref.com competitions page...');
        await page.goto('https://fbref.com/en/comps/', {
            waitUntil: 'load',
            timeout: 60000
        });

        // Add a longer delay for dynamic content and possible anti-bot measures
        console.log('Waiting for dynamic content...');
        await page.waitForTimeout(10000);

        // Try to handle any potential popup/overlay
        try {
            const popup = await page.$('[role="dialog"]');
            if (popup) {
                const closeButton = await popup.$('button');
                if (closeButton) await closeButton.click();
            }
        } catch (e) {
            console.log('No popup found or could not close it');
        }

        // Wait for network to be completely idle
        await page.waitForLoadState('networkidle', { timeout: 30000 });

        // Check if we have the expected content and retry if needed
        console.log('Checking page content...');
        for (let i = 0; i < 3; i++) {
            const content = await page.content();
            if (content.includes('competition') || content.includes('Competitions')) {
                break;
            }
            console.log(`Retry ${i + 1}: Waiting for content...`);
            await page.waitForTimeout(5000);
        }

        // Wait for and verify table content
        console.log('Waiting for competition table...');
        const hasTable = await page.waitForSelector('table', {
            timeout: 30000,
            state: 'attached'
        }).then(() => true).catch(() => false);

        if (!hasTable) {
            throw new Error('Could not find competition table - possible anti-bot detection');
        }

        // First analyze the page structure
        console.log('Analyzing page structure...');
        const tableStructure = await page.evaluate(() => {
            const table = document.querySelector('table');
            if (!table) return null;

            const headers = Array.from(table.querySelectorAll('thead th'))
                .map(th => th.textContent.trim());
            return headers;
        });
        console.log('Table headers:', tableStructure);

        // Get all competition information
        const competitions = await page.evaluate(() => {
            const rows = document.querySelectorAll('table tbody tr');
            const competitions = [];

            rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length > 0) {
                    const linkElement = cells[0].querySelector('a');
                    const name = linkElement ? linkElement.textContent.trim() : cells[0].textContent.trim();
                    const url = linkElement ? linkElement.href : '';
                    const country = cells[1] ? cells[1].textContent.trim() : '';
                    const type = cells[2] ? cells[2].textContent.trim() : '';
                    const seasons = cells[3] ? cells[3].textContent.trim() : '';

                    competitions.push({
                        name,
                        url,
                        country,
                        type,
                        seasons,
                        // Flag if this is likely a women's competition
                        isWomens: name.toLowerCase().includes('women') ||
                            name.toLowerCase().includes('feminine') ||
                            type.toLowerCase().includes('women') ||
                            type.toLowerCase().includes('feminine')
                    });
                }
            });

            return competitions;
        });

        // Filter for women's competitions
        const womensCompetitions = competitions.filter(comp => comp.isWomens);

        // Create a data object with metadata
        const jsonData = {
            timestamp: new Date().toISOString(),
            source: 'fbref.com',
            dataType: 'football competitions',
            total_competitions: competitions.length,
            womens_competitions: womensCompetitions.length,
            all_competitions: competitions,
            womens_only: womensCompetitions
        };

        // Write to file
        fs.writeFileSync('football_competitions.json', JSON.stringify(jsonData, null, 2));

        console.log('\nData has been saved to football_competitions.json');
        console.log(`\nTotal competitions found: ${competitions.length}`);
        console.log(`Women's competitions found: ${womensCompetitions.length}`);
        console.log('\nSample of women\'s competitions:');
        console.log('-------------------');
        womensCompetitions.slice(0, 3).forEach(comp => {
            console.log(`Competition: ${comp.name}
Country: ${comp.country}
Years: ${comp.years}
URL: ${comp.url}
-------------------`);
        });

    } catch (error) {
        console.log('An error occurred:', error);
    } finally {
        // Close browser
        await browser.close();
    }
}

// Run the scraper
scrapeFbref().catch(console.error);