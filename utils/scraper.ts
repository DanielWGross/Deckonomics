import { Card } from '../generated/prisma';
import { Cluster } from 'puppeteer-cluster';
import { createCardSales } from './db';
import { Page, HTTPResponse } from 'puppeteer';

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
    await page.waitForSelector('div.modal__activator', { timeout: 28000 }); // Modal selector timeout
    await page.click('div.modal__activator', { delay: Math.floor(Math.random() * 100) });
}

async function humanDelay(min = MIN_DELAY, max = MAX_DELAY): Promise<void> {
    const ms = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLatestSalesResponse(response: HTTPResponse, latestSalesEndpoint: string): boolean {
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

// Helper function to check if error is recoverable
function isRecoverableError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;

    return (
        err.message.includes('timeout') ||
        err.message.includes('waiting') ||
        err.message.includes('Protocol error') ||
        err.message.includes('Navigation timeout') ||
        err.message.includes('Page closed') ||
        err.message.includes('Target closed') ||
        err.message.includes('TargetCloseError')
    );
}

export async function scrapeSetPrices(cards: Card[]): Promise<void> {
    // Track already scraped cards to avoid duplicates
    const alreadyScraped = new Set<number>();

    try {
        const cluster = await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_CONTEXT,
            maxConcurrency: 1,
            retryLimit: 0, // Handle retries manually
            retryDelay: 1000,
            puppeteerOptions: {
                headless: false,
                devtools: false,
                args: [
                    '--window-size=800,600',
                    '--window-position=-700,-500', // Position mostly off screen
                    '--disable-background-tab-freeze',
                    '--disable-backgrounding-occluded-windows',
                    '--disable-renderer-backgrounding',
                    '--no-first-run',
                    '--disable-default-apps',
                    '--disable-popup-blocking',
                ],
                // args: ['--auto-open-devtools-for-tabs', '--window-size=960,540'],
                // args: ['--no-sandbox', '--disable-setuid-sandbox'],
                // slowMo: 50,
            },
        });

        cluster.on('taskerror', (err, data, willRetry) => {
            console.log(
                `Task failed for ${JSON.stringify(data)}: ${err.message}` +
                    (willRetry ? ' — retrying…' : ' — no more retries left.')
            );
        });

        await cluster.task(async ({ page, data: card }) => {
            // Wrap the entire task in a top-level try-catch to handle any TargetCloseError
            try {
                const cardData: Card = card as unknown as Card;
                const index = ((card as Record<string, unknown>).__index as number) ?? 0;
                const total = ((card as Record<string, unknown>).__total as number) ?? 1;
                const percent = (((index + 1) / total) * 100).toFixed(1);
                const attempt = ((card as Record<string, unknown>).__attempt as number) ?? 1;
                const maxAttempts = 3;

                // Skip if already scraped
                if (alreadyScraped.has(cardData.tcgPlayerId)) {
                    console.log(
                        `🛑 Skipping already scraped card: ${cardData.productName} (${cardData.tcgPlayerId})`
                    );
                    return;
                }

                // Early check if page is closed before any operations
                if (page.isClosed()) {
                    console.log('🔄 Page is closed before starting, re-queuing card');
                    if (attempt < maxAttempts) {
                        cluster.queue({
                            ...card,
                            __attempt: attempt + 1,
                            __index: index,
                            __total: total,
                        });
                    } else {
                        console.error(
                            `❌ Max attempts reached for ${cardData.productName} - giving up`
                        );
                    }
                    return;
                }

                // Prevent focus stealing - wrapped in try/catch to handle closed pages
                try {
                    await page.evaluate(() => {
                        if (typeof window !== 'undefined') {
                            (window as Window).blur();
                        }
                    });
                } catch (err: unknown) {
                    // If page is closed during focus prevention, re-queue
                    if (page.isClosed()) {
                        console.log('🔄 Page closed during focus prevention, re-queuing');
                        if (attempt < maxAttempts) {
                            cluster.queue({
                                ...card,
                                __attempt: attempt + 1,
                                __index: index,
                                __total: total,
                            });
                        }
                        return;
                    }
                    console.warn('Warning: Could not prevent focus stealing');
                }

                try {
                    const latestSalesEndpoint = `https://mpapi.tcgplayer.com/v2/product/${cardData.productId}/latestsales?mpfev`;

                    console.log(
                        `🤖 Scraping Card: ${cardData.productName} TCGPlayer ID: ${cardData.tcgPlayerId} Condition: ${cardData.condition} Printing: ${cardData.printing} — ${index + 1}/${total} (${percent}%) complete (attempt ${attempt})`
                    );
                    const salesResults: SalesRecord[] = [];

                    // Check if page is still usable before proceeding
                    if (page.isClosed()) {
                        throw new Error('Page closed before navigation');
                    }

                    const salesResponsePromise = page.waitForResponse(
                        (response) => isLatestSalesResponse(response, latestSalesEndpoint),
                        { timeout: 43000 } // Initial sales response timeout
                    );

                    const url = `${cardData.productUrl}?Language=English&Condition=Near+Mint&Printing=${cardData.printing === 'FOIL' ? 'Foil' : 'Normal'}`;

                    // Wrap navigation in try-catch to handle page closure during navigation
                    try {
                        await page.goto(url, {
                            waitUntil: 'networkidle2',
                            timeout: 32000, // Navigation timeout
                        });
                    } catch (navErr: unknown) {
                        // Check if page was closed during navigation
                        if (page.isClosed()) {
                            throw new Error('Page closed during navigation');
                        }
                        // Re-throw navigation errors for retry logic
                        throw navErr;
                    }

                    // Check if page is still usable after navigation
                    if (page.isClosed()) {
                        throw new Error('Page closed after navigation');
                    }

                    // Wrap response handling in try-catch
                    let salesResponse;
                    try {
                        salesResponse = await salesResponsePromise;
                    } catch (responseErr: unknown) {
                        // Check if page was closed while waiting for response
                        if (page.isClosed()) {
                            throw new Error('Page closed while waiting for sales response');
                        }
                        throw responseErr;
                    }

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

                    // Check if page is still usable before opening modal
                    if (page.isClosed()) {
                        throw new Error('Page closed before opening modal');
                    }

                    await openSalesHistoryModal(page);

                    const threshold = new Date();
                    threshold.setDate(threshold.getDate() - 7);
                    let oldestRecord = getOldestSale(salesResults);

                    while (new Date(oldestRecord.orderDate) > threshold) {
                        try {
                            // Check if page is still usable before each "load more" operation
                            if (page.isClosed()) {
                                throw new Error('Page closed during load more operations');
                            }

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
                                { timeout: 47000 } // Load more response timeout
                            );

                            await humanDelay(300, 600);

                            // Check page state before waiting for selector
                            if (page.isClosed()) {
                                throw new Error('Page closed before waiting for load more button');
                            }

                            await page.waitForSelector(
                                'button.sales-history-snapshot__load-more__button',
                                { timeout: 26000 } // Load more button selector timeout
                            );

                            // Check page state before clicking
                            if (page.isClosed()) {
                                throw new Error('Page closed before clicking load more button');
                            }

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
                        } catch (innerErr) {
                            // ❌ REMOVE re-queuing logic from here
                            console.error(
                                `❌ Error loading more sales for ${cardData.productName}:`,
                                innerErr
                            );
                            // Just break out of the while loop and let the outer catch handle retry
                            break;
                        }
                    }

                    console.log(`✅ Success! Total records collected: ${salesResults.length}`);

                    // Mark card as successfully scraped
                    alreadyScraped.add(cardData.tcgPlayerId);
                } catch (err: unknown) {
                    console.error(
                        `❌ Error on attempt ${attempt} for card ${cardData.productName}:`,
                        err
                    );

                    // Check if this is a recoverable error and we haven't exceeded max attempts
                    if (attempt < maxAttempts && isRecoverableError(err)) {
                        console.log(`🔄 Re-queuing card for retry (${attempt + 1}/${maxAttempts})`);

                        // Wait 3 seconds before retry
                        await new Promise((resolve) => setTimeout(resolve, 3000));

                        // Re-queue with updated attempt counter - cluster will create new context if needed
                        cluster.queue({
                            ...card,
                            __attempt: attempt + 1,
                            __index: index,
                            __total: total,
                        });
                    } else {
                        console.error(
                            `🚫 Failed to scrape card ${cardData.productName} after ${maxAttempts} attempts or unrecoverable error.`
                        );
                    }
                }
            } catch (topLevelErr: unknown) {
                // This catches any TargetCloseError or other errors that occur at the highest level
                console.error(
                    `❌ Top-level error for card ${(card as Card)?.productName || 'unknown'}:`,
                    topLevelErr
                );

                const cardData: Card = card as unknown as Card;
                const attempt = ((card as Record<string, unknown>).__attempt as number) ?? 1;
                const index = ((card as Record<string, unknown>).__index as number) ?? 0;
                const total = ((card as Record<string, unknown>).__total as number) ?? 1;
                const maxAttempts = 3;

                // If it's a recoverable error and we haven't exceeded max attempts, retry
                if (attempt < maxAttempts && isRecoverableError(topLevelErr)) {
                    console.log(`🔄 Top-level retry for card (${attempt + 1}/${maxAttempts})`);

                    // Wait before retry
                    await new Promise((resolve) => setTimeout(resolve, 3000));

                    cluster.queue({
                        ...card,
                        __attempt: attempt + 1,
                        __index: index,
                        __total: total,
                    });
                } else {
                    console.error(
                        `🚫 Top-level failure for card ${cardData?.productName || 'unknown'} after ${maxAttempts} attempts or unrecoverable error.`
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
