#!/usr/bin/env tsx

import { getTop10CardsByRecentSales } from './utils/db.js';
import { printMessage, printError } from './utils/displayUtils.js';

async function testTop10RecentSales() {
    try {
        console.log('Testing getTop10CardsByRecentSales function...\n');

        const cards = await getTop10CardsByRecentSales();

        if (cards.length === 0) {
            printMessage('No cards found with sales in the last 7 days.', 'yellow');
            return;
        }

        printMessage('=== Top 10 Cards by Sales (Last 7 Days) ===\n', 'yellow');

        cards.forEach((card, index) => {
            printMessage(
                `${index + 1}. ${card.productName} (${card.printing}) - ${card._count.sales} sale(s)`,
                'green'
            );
        });

        printMessage(`\nTotal cards found: ${cards.length}`, 'gray');
        printMessage('\n✅ Function test completed successfully!', 'green');
    } catch (error) {
        printError('❌ Error testing function:', error);
    } finally {
        process.exit(0);
    }
}

testTop10RecentSales();
