import { Card } from '../generated/prisma';
import { Cluster } from 'puppeteer-cluster';
import { promises as fs } from 'fs';
import path from 'path';
import { createCardSales } from './db';

const MIN_DELAY = 200;
const MAX_DELAY = 800;

interface SalesRecord {
    orderDate: string;
    shippingPrice: number;
    purchasePrice: number;
    quantity: number;
}

function getOldestSale(arr: SalesRecord[]): SalesRecord {
    return arr.reduce((oldest, current) =>
        new Date(oldest.orderDate) < new Date(current.orderDate) ? oldest : current
    );
}

async function openSalesHistoryModal(page: Page): Promise<void> {
    await humanDelay(300, 600);
    await page.waitForSelector('div.modal__activator');
    await page.click('div.modal__activator', { delay: Math.floor(Math.random() * 100) });
}

async function saveResultsToFile(card: Card, sales: SalesRecord[]): Promise<void> {
    const outDir = path.resolve(process.cwd(), 'output');
    await fs.mkdir(outDir, { recursive: true });
    const filename = `sales-${card.productId}.json`;
    const filePath = path.join(outDir, filename);
    await fs.writeFile(filePath, JSON.stringify(sales, null, 2), 'utf8');
    console.log(`💾 Wrote ${sales.length} records to ${filePath}`);
}

async function humanDelay(min = MIN_DELAY, max = MAX_DELAY): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLatestSalesResponse(response: any, latestSalesEndpoint: string): boolean {
    const req = response.request();
    if (!req.url().startsWith(latestSalesEndpoint)) {
        return false;
    }

    console.log('🔍 Checking response for latest sales:', req.url());

    try {
        const postData = JSON.parse(req.postData()!);
        // We only want the request with limit !== 1 (usually limit of 25)
        return postData.limit !== 1;
    } catch {
        return false;
    }
}

export async function scrapeSetPrices(cards: Card[]): Promise<void> {
    const alreadyScraped = new Set<number>();

    const cluster = await Cluster.launch({
        concurrency: Cluster.CONCURRENCY_CONTEXT,
        maxConcurrency: 2,
        retryLimit: 3,
        retryDelay: 1000,
        puppeteerOptions: {
            headless: false,
            devtools: true,
            args: ['--auto-open-devtools-for-tabs', '--window-size=1280,800'],
            slowMo: 50,
        },
    });

    cluster.on('taskerror', (err, data, willRetry) => {
        console.log(
            `Task failed for ${JSON.stringify(data)}: ${err.message}` +
                (willRetry ? ' — retrying…' : ' — no more retries left.')
        );
    });

    await cluster.task(async ({ page, data: card }) => {
        const cardData: Card = card as unknown as Card;
        if (alreadyScraped.has(cardData.id)) {
            console.log(`🛑 Skipping already scraped card: ${cardData.productName}`);
            return;
        }
        alreadyScraped.add(cardData.id);
        const latestSalesEndpoint = `https://mpapi.tcgplayer.com/v2/product/${cardData.productId}/latestsales?mpfev`;

        console.log(
            `🤖 Scraping Card: ${cardData.productName} Condition: ${cardData.condition} Printing: ${cardData.printing}`
        );
        const salesResults: SalesRecord[] = [];

        const salesResponsePromise = page.waitForResponse(
            (response) => isLatestSalesResponse(response, latestSalesEndpoint),
            { timeout: 30000 }
        );

        const url = `${cardData.productUrl}?Language=English&Condition=Near+Mint&Printing=Normal`;
        await page.goto(url, { waitUntil: 'networkidle2' });
        const salesResponse = await salesResponsePromise;
        const data = await salesResponse.json();
        const salesData: SalesRecord[] = data.data;
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

        await openSalesHistoryModal(page);

        const threshold = new Date();
        threshold.setDate(threshold.getDate() - 7);

        let oldestRecord = getOldestSale(salesResults);
        console.log(`🔍 Current oldest: ${oldestRecord.orderDate}`);

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
            const moreData: { data: SalesRecord[] } = await moreResponse.json();
            salesResults.push(...moreData.data);
            console.log(`✅ Loaded ${moreData.data.length} more records`);

            oldestRecord = getOldestSale(salesResults);
            console.log(`🔍 New oldest: ${oldestRecord.orderDate}`);
        }

        console.log(
            `🎉 Stopped: oldest record is at least 30 days old (${oldestRecord.orderDate})`
        );
        console.log(`🔢 Total records collected: ${salesResults.length}`);

        try {
            await saveResultsToFile(cardData, salesResults);
        } catch (error) {
            console.error('Error writing JSON to file:', error);
        }
    });

    for (const card of cards) {
        cluster.queue(card);
    }

    await cluster.idle();
    await cluster.close();
}
