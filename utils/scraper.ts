import { Card } from '../generated/prisma';
import { Cluster } from 'puppeteer-cluster';
import { createCardSales } from './db';
import { Page } from 'puppeteer';

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

async function humanDelay(min = MIN_DELAY, max = MAX_DELAY): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLatestSalesResponse(response: any, latestSalesEndpoint: string): boolean {
    const req = response.request();
    if (!req.url().startsWith(latestSalesEndpoint)) {
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
    try {
        const cluster = await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_PAGE,
            maxConcurrency: 1,
            retryLimit: 3,
            retryDelay: 1000,
            puppeteerOptions: {
                headless: false,
                devtools: true,
                args: ['--auto-open-devtools-for-tabs', '--window-size=960,540'],
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
            const index = (card as any).__index ?? 0;
            const total = (card as any).__total ?? 1;
            const percent = (((index + 1) / total) * 100).toFixed(1);
            const attempt = (card as any).__attempt ?? 1;

            const maxAttempts = 3;

            try {
                const latestSalesEndpoint = `https://mpapi.tcgplayer.com/v2/product/${cardData.productId}/latestsales?mpfev`;

                console.log(
                    `🤖 Scraping Card: ${cardData.productName} TCGPlayer ID: ${cardData.tcgPlayerId} Condition: ${cardData.condition} Printing: ${cardData.printing} — ${index + 1}/${total} (${percent}%) complete`
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

                while (new Date(oldestRecord.orderDate) > threshold) {
                    try {
                        const morePromise = page.waitForResponse(
                            (response) => {
                                const req = response.request();
                                if (
                                    req.method() !== 'POST' ||
                                    !req.url().includes('/latestsales?mpfev=')
                                )
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
                        await page.waitForSelector(
                            'button.sales-history-snapshot__load-more__button'
                        );
                        await page.click('button.sales-history-snapshot__load-more__button', {
                            delay: Math.floor(Math.random() * 100),
                        });

                        const moreResponse = await morePromise;
                        const moreData = await moreResponse.json();
                        const moreDataData: SalesRecord[] = moreData.data;

                        for (const moreSale of moreDataData) {
                            salesResults.push(moreSale);
                            await createCardSales({
                                orderDate: moreSale.orderDate,
                                shippingPrice: moreSale.shippingPrice,
                                purchasePrice: moreSale.purchasePrice,
                                quantity: moreSale.quantity,
                                id: cardData.id,
                            });
                        }

                        oldestRecord = getOldestSale(salesResults);
                    } catch (err) {
                        console.error(
                            `❌ Error on attempt ${attempt} for card ${cardData.productName}:`,
                            err
                        );
                        if (attempt < maxAttempts) {
                            console.log(
                                `🔄 Re-queuing card for retry (${attempt + 1}/${maxAttempts})`
                            );
                            cluster.queue({ ...card, __attempt: attempt + 1 });
                        } else {
                            console.error(
                                `🚫 Failed to scrape card ${cardData.productName} after ${maxAttempts} attempts.`
                            );
                        }
                    }
                }

                console.log(`✅ Success! Total records collected: ${salesResults.length}`);
            } catch (err) {
                console.error(
                    `❌ Error on attempt ${attempt} for card ${cardData.productName}:`,
                    err
                );
                if (attempt < maxAttempts) {
                    console.log(`🔄 Re-queuing card for retry (${attempt + 1}/${maxAttempts})`);
                    cluster.queue({ ...card, __attempt: attempt + 1 });
                } else {
                    console.error(
                        `🚫 Failed to scrape card ${cardData.productName} after ${maxAttempts} attempts.`
                    );
                }
            }
        });

        for (const [index, card] of cards.entries()) {
            cluster.queue({ ...card, __index: index, __total: cards.length });
        }

        await cluster.idle();
        await cluster.close();
    } catch (error) {
        console.error('❌ Error in scrapeSetPrices:', error);
        throw error;
    }
    console.log('✅ All cards processed successfully!');
}
