import { getAllCardsByGroupId } from './utils/db';
import { printError } from './utils/displayUtils';
import { scrapeSetPrices } from './utils/scraper';

async function fetchSetPrices(): Promise<void> {
    const allCards = await getAllCardsByGroupId(23874);
    // Create an array that just contains the item at index 0 from allCards
    // const cards = [allCards[0]];
    if (allCards == undefined) {
        return;
    }

    // const cards = allCards.cards;
    // filter this to only include cards that have 0 sales
    const cards = allCards.cards.filter((card) => card.sales.length === 0);
    // console.log('🚀 ~ fetchSetPrices ~ cards:', cards.length);
    // const cards = allCards.cards.slice(98);
    try {
        await scrapeSetPrices(cards);
    } catch (error) {
        printError('Error scraping set prices:', error);
    }
}

async function scrape(): Promise<void> {
    await fetchSetPrices();
}

scrape();
