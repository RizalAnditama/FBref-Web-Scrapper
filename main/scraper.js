export async function scrapeCompetitionData(page) {
    return await page.evaluate(async () => {
        const tables = {};

        for (const wrapper of document.querySelectorAll('.table_wrapper')) {
            const heading = wrapper.querySelector('.section_heading h2');
            const table = wrapper.querySelector('table');

            if (!heading || !table) continue;

            const captionText = heading.textContent.trim();

            const headers = Array.from(table.querySelectorAll('thead th')).map(th =>
                th.textContent.trim()
                    .toLowerCase()
                    .replace(/\s+/g, '_')
                    .replace(/[^a-z0-9_]/g, '')
            );

            const rows = [];
            const links = [];

            const tableRows = Array.from(table.querySelectorAll('tbody tr:not(.hidden)'));
            for (const row of tableRows) {
                const cells = Array.from(row.querySelectorAll('th, td'));
                const rowData = {};
                const rowLinks = {};

                for (let i = 0; i < cells.length; i++) {
                    const cell = cells[i];
                    const links = cell.querySelectorAll('a');
                    const cellData = cell.textContent.trim();

                    if (i === 0) {
                        rowData.competition_name = cellData;
                        if (links.length > 0) {
                            rowData.url = links[0].href;
                            rowLinks.competition_link = {
                                name: cellData,
                                url: links[0].href
                            };
                        }
                    }
                    else if (headers[i]) {
                        const fieldName = headers[i];
                        rowData[fieldName] = cellData;

                        if (links.length > 0) {
                            rowLinks[`${fieldName}_link`] = {
                                name: cellData,
                                url: links[0].href
                            };
                        }

                        // Extract champion and top scorer info from awards or notes column
                        if (fieldName === 'awards' || fieldName === 'notes') {
                            const championMatch = cellData.match(/Champion:?\s*([^,;]+)/i);
                            const topScorerMatch = cellData.match(/(?:Top Scorer|Golden Boot):?\s*([^,;]+)/i);

                            if (championMatch) {
                                rowData.champion = championMatch[1].trim();
                            }
                            if (topScorerMatch) {
                                rowData.top_scorer = topScorerMatch[1].trim();
                            }
                        }
                    }
                }

                if (Object.keys(rowLinks).length > 0) {
                    rowData.links = rowLinks;
                }

                rows.push(rowData);

                if (rowLinks.competition_link) {
                    links.push(rowLinks.competition_link);
                }
            }

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
        }

        return tables;
    });
}

export async function scrapeCompetitionPage(page, url) {
    try {
        await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

        const details = await page.evaluate(() => {
            const data = {
                champion: null,
                top_scorer: null
            };

            // Look for championship information
            const championInfo = document.querySelector('.champion-info, .champions-section, #champions-section');
            if (championInfo) {
                data.champion = championInfo.textContent.trim();
            }

            // Look for top scorer information
            const scorerInfo = document.querySelector('.top-scorer-info, .scorers-section, #top-scorers');
            if (scorerInfo) {
                data.top_scorer = scorerInfo.textContent.trim();
            }

            // Alternative: look in tables
            if (!data.champion || !data.top_scorer) {
                document.querySelectorAll('table').forEach(table => {
                    const caption = table.querySelector('caption');
                    if (caption) {
                        const captionText = caption.textContent.toLowerCase();
                        if (captionText.includes('champion') && !data.champion) {
                            const championCell = table.querySelector('tbody tr:first-child td:last-child');
                            if (championCell) {
                                data.champion = championCell.textContent.trim();
                            }
                        }
                        if (captionText.includes('scorer') && !data.top_scorer) {
                            const scorerCell = table.querySelector('tbody tr:first-child td:last-child');
                            if (scorerCell) {
                                data.top_scorer = scorerCell.textContent.trim();
                            }
                        }
                    }
                });
            }

            return data;
        });

        return details;
    } catch (error) {
        console.warn(`Failed to fetch details for ${url}:`, error.message);
        return { champion: null, top_scorer: null };
    }
}