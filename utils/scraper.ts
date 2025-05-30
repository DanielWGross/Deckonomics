import { Card } from '../generated/prisma';
import { Cluster } from 'puppeteer-cluster';
import { promises as fs } from 'fs';
import path from 'path';
import { createCardSales } from './db';

const MIN_DELAY = 200;
const MAX_DELAY = 800;

async function humanDelay(min = MIN_DELAY, max = MAX_DELAY) {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLatestSalesResponse(response: any, latestSalesEndpoint: string): boolean {
    const req = response.request();
    if (req.url() !== latestSalesEndpoint) {
        return false;
    }

    try {
        const postData = JSON.parse(req.postData()!);
        // We only want the request with limit !== 1 (usually limit of 25)
        return postData.limit !== 1;
    } catch {
        return false;
    }
}

export async function scrapeSetPrices(cards: Card[]): Promise<void> {
    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 1,
        puppeteerOptions: {
            headless: false,
            devtools: true,
            args: ['--auto-open-devtools-for-tabs', '--window-size=1280,800'],
            slowMo: 50,
        },
    });

    await cluster.task(async ({ page, data: card }) => {
        const cardData: Card = card as unknown as Card;
        const latestSalesEndpoint = `https://mpapi.tcgplayer.com/v2/product/${cardData.productId}/latestsales?mpfev=3691`;

        console.log(
            `🤖 Scraping Card: ${cardData.productName} Condition: ${cardData.condition} Printing: ${cardData.printing}`
        );
        const salesResults: any[] = [];

        const salesResponsePromise = page.waitForResponse(
            (response) => isLatestSalesResponse(response, latestSalesEndpoint),
            { timeout: 30000 }
        );

        const url = `${cardData.productUrl}?Language=English&Condition=Near+Mint&Printing=Normal`;
        await page.goto(url, { waitUntil: 'networkidle2' });
        const salesResponse = await salesResponsePromise;
        const data = await salesResponse.json();

        const salesData = data.data;

        for (const sale of salesData) {
            salesResults.push(sale);
            await createCardSales({
                orderDate: sale.orderDate,
                shippingPrice: sale.shippingPrice,
                purchasePrice: sale.purchasePrice,
                quantity: sale.quantity,
                id: cardData.id,
            });
        }

        await humanDelay(300, 600);
        await page.waitForSelector('div.modal__activator');
        await page.click('div.modal__activator', { delay: Math.floor(Math.random() * 100) });

        // 3️⃣ Define a helper to extract the oldest record
        const getOldest = (arr: any[]) =>
            arr.reduce((oldest, current) =>
                new Date(oldest.orderDate) < new Date(current.orderDate) ? oldest : current
            );

        // 4️⃣ Set threshold date (7 days ago)
        const threshold = new Date();
        threshold.setDate(threshold.getDate() - 7);

        // Compute current oldest
        let oldestRecord = getOldest(salesResults);
        console.log(`🔍 Current oldest: ${oldestRecord.orderDate}`);

        // 5️⃣ Loop: click Load More until oldest is >= 30 days ago
        while (new Date(oldestRecord.orderDate) > threshold) {
            console.log('🌀 Loading more sales...');

            const morePromise = page.waitForResponse(
                (response) => {
                    const req = response.request();
                    if (req.method() !== 'POST' || !req.url().includes('/latestsales?mpfev='))
                        return false;
                    try {
                        const body = JSON.parse(req.postData()!);
                        return body.limit !== 1;
                    } catch {
                        return false;
                    }
                },
                { timeout: 30000 }
            );
            await humanDelay(300, 600);
            await page.waitForSelector('button.sales-history-snapshot__load-more__button');
            await page.click('button.sales-history-snapshot__load-more__button', {
                delay: Math.floor(Math.random() * 100),
            });

            const moreResponse = await morePromise;
            const moreData = await moreResponse.json();
            salesResults.push(...moreData.data);
            console.log(`✅ Loaded ${moreData.data.length} more records`);

            oldestRecord = getOldest(salesResults);
            console.log(`🔍 New oldest: ${oldestRecord.orderDate}`);
        }

        console.log(
            `🎉 Stopped: oldest record is at least 30 days old (${oldestRecord.orderDate})`
        );
        console.log(`🔢 Total records collected: ${salesResults.length}`);

        try {
            // once salesResults is complete:
            const outDir = path.resolve(process.cwd(), 'output');
            await fs.mkdir(outDir, { recursive: true });

            // use the productId (or name) so each card gets its own file
            const filename = `sales-${cardData.productId}.json`;
            const filePath = path.join(outDir, filename);

            console.log('Writing JSON to:', filePath);

            // pretty-print with 2-space indent
            await fs.writeFile(filePath, JSON.stringify(salesResults, null, 2), 'utf8');
            console.log(`💾 Wrote ${salesResults.length} records to ${filePath}`);
        } catch (error) {
            console.error('Error writing JSON to file:', error);
        }
    });

    // 6. Queue up all URLs
    for (const card of cards) {
        cluster.queue(card);
    }

    // 7. Run the cluster
    await cluster.idle();
    await cluster.close();
}
