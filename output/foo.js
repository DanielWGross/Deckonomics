import salesData from './sales-614328.json' assert { type: 'json' };

const avgPerDay = 10;

const filterdSales = salesData.filter((sale) => {
    return sale.purchasePrice > 0;
});

console.log('🚀 ~ filterdSales ~ filterdSales:', filterdSales);

// Format a number as USD currency
const formatCurrency = (amount) => {
    return amount.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const oldestSale = salesData.reduce((oldest, current) => {
    return new Date(oldest.orderDate) < new Date(current.orderDate) ? oldest : current;
});

const newestSale = salesData.reduce((newest, current) => {
    return new Date(newest.orderDate) > new Date(current.orderDate) ? newest : current;
});

const averageSalePrice =
    salesData.reduce((sum, current) => {
        return sum + current.purchasePrice;
    }, 0) / salesData.length;

const medianSalePrice = salesData.sort((a, b) => a.purchasePrice - b.purchasePrice)[
    Math.floor(salesData.length / 2)
].purchasePrice;

const mostCommonSalePrice = salesData.reduce((acc, curr) => {
    acc[curr.purchasePrice] = (acc[curr.purchasePrice] || 0) + 1;
    return acc;
}, {});
console.log('🚀 ~ mostCommonSalePrice ~ mostCommonSalePrice:', mostCommonSalePrice);

// Using the mostCommonSalePrice object, create a new array that only contains sales with a price that has occcurred more than 2 times
const mostCommonSalePrices = Object.keys(mostCommonSalePrice).filter(
    (price) => mostCommonSalePrice[price] > 2
);

console.log('🚀 ~ mostCommonSalePrices ~ mostCommonSalePrices:', mostCommonSalePrices);

// Get me the highest value from the mostCommonSalePrices array
const highestMostCommonSalePrice = Math.max(...mostCommonSalePrices);

console.log(
    '🚀 ~ highestMostCommonSalePrice ~ highestMostCommonSalePrice:',
    highestMostCommonSalePrice
);

const highestSalePrice = salesData.reduce((max, current) => {
    return Math.max(max, current.purchasePrice);
}, 0);

console.log(`
    Oldest Sale Date: ${oldestSale.orderDate}
    Newest Sale Date: ${newestSale.orderDate}
    Average Sale Price: ${formatCurrency(averageSalePrice)}
    Median Sale Price: ${formatCurrency(medianSalePrice)}
    Most Common Sale Price: ${formatCurrency(mostCommonSalePrice)}
    Highest Sale Price: ${formatCurrency(highestSalePrice)}
    `);
// Clean up the console log to make it more readable
