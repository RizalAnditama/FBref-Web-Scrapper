import { chromium } from 'playwright';

async function scrapeFbref() {
    // Launch browser with custom viewport and user agent
    const browser = await chromium.launch({
        headless: false // Set to true if you want to run in headless mode
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
        // Navigate to the website
        console.log('Navigating to fbref.com...');
        await driver.get('https://fbref.com/en/comps/');

        // Wait for the page to load completely
        console.log('Waiting for page to load...');
        await driver.sleep(5000); // Wait for dynamic content to load

        // Try different selectors for the Women button
        console.log('Looking for Women filter button...');
        try {
            // Try multiple different selectors that might match the Women button
            const selectors = [
                "//button[contains(., 'Women')]",
                "//div[contains(@class, 'filter')]//button[contains(., 'Women')]",
                "//button[@data-filter='women']",
                "//input[@value='women']",
                "//a[contains(., 'Women')]"
            ];

            for (const selector of selectors) {
                try {
                    const elements = await driver.findElements(By.xpath(selector));
                    if (elements.length > 0) {
                        console.log(`Found Women button using selector: ${selector}`);
                        await elements[0].click();
                        console.log('Clicked the Women button');
                        await driver.sleep(5000); // Wait longer for filter to apply

                        // Wait for the table to update
                        await driver.wait(until.elementLocated(By.css('#comps_club')), 10000);
                        break;
                    }
                } catch (error) {
                    continue;
                }
            }
        } catch (error) {
            console.log('Could not find Women button, proceeding with default view');
        }
        console.log('Clicked Women filter button');

        // Wait for the table to update
        await driver.sleep(2000); // Give time for the table to update

        // Wait for the table to load
        await driver.wait(until.elementLocated(By.css('#comps_club')), 10000);

        // Find the table and get all rows
        const rows = await driver.findElements(By.css('#comps_club tbody tr'));

        // Array to store competition data
        const competitions = [];

        // Extract data from each row
        for (const row of rows) {
            try {
                const name = await row.findElement(By.css('th')).getText();
                const cells = await row.findElements(By.css('td'));

                const data = {
                    name: name,
                    country: cells.length > 0 ? await cells[0].getText() : 'N/A',
                    level: cells.length > 1 ? await cells[1].getText() : 'N/A',
                    teams: cells.length > 2 ? await cells[2].getText() : 'N/A',
                    matches: cells.length > 3 ? await cells[3].getText() : 'N/A'
                };

                competitions.push(data);
            } catch (error) {
                console.log('Error processing row:', error.message);
                continue;
            }
        }

        // Print results
        console.log('\nWomen\'s Competitions:');
        console.log('-------------------');
        competitions.forEach(comp => {
            console.log(`
Competition: ${comp.name}
Country: ${comp.country}
Level: ${comp.level}
Teams: ${comp.teams}
Matches: ${comp.matches}
-------------------`);
        });
    } catch (error) {
        console.error('An error occurred:', error);
    } finally {
        // Always close the browser
        await driver.quit();
    }
}

// Run the scraper
scrapeFbref().catch(console.error);