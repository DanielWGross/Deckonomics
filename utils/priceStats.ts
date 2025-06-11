import * as fs from 'fs';
import * as path from 'path';
import * as ss from 'simple-statistics';
import { getSetWithCardsByGroupId } from './db';
import { CardWithSales, SetWithCards } from '../types/types';

function getPriceTrend(salesData: { orderDate: string; purchasePrice: number }[]): {
    trend: 'up' | 'down' | 'sideways';
    slope: number;
    confidence: number;
} {
    if (salesData.length < 2) {
        return { trend: 'sideways', slope: 0, confidence: 0 };
    }

    // Convert to (time, price) points, sorted by date
    const points = salesData
        .map((sale) => [new Date(sale.orderDate).getTime(), sale.purchasePrice] as [number, number])
        .sort((a, b) => a[0] - b[0]); // Sort by timestamp

    // Calculate linear regression
    const regression = ss.linearRegression(points);
    const slope = regression.m; // This is the trend slope (price change per millisecond)
    const rSquared = ss.rSquared(points, ss.linearRegressionLine(regression));

    // Calculate average price for threshold calculation
    const avgPrice = ss.mean(salesData.map((sale) => sale.purchasePrice));

    // Calculate 5% threshold per day
    const fivePercentThreshold = (avgPrice * 0.05) / (1000 * 60 * 60 * 24); // 5% per day in price change per millisecond

    let trend: 'up' | 'down' | 'sideways';
    if (slope > fivePercentThreshold) {
        trend = 'up';
    } else if (slope < -fivePercentThreshold) {
        trend = 'down';
    } else {
        trend = 'sideways';
    }

    return {
        trend,
        slope: slope * (1000 * 60 * 60 * 24), // Convert to price change per day
        confidence: rSquared, // R² value (0-1, higher = more reliable trend)
    };
}
export async function getSetCards(groupId: number): Promise<SetWithCards['cards']> {
    try {
        const set = await getSetWithCardsByGroupId(groupId);

        if (set == undefined) {
            throw new Error(`⚠️ No set found for groupId ${groupId}`);
        }

        console.log(
            `✅ Fetched ${set.cards.length} cards for groupId ${groupId} — Set: ${set.name} (${set.abbreviation})`
        );
        return set.cards;
    } catch (err) {
        console.error(`❌ Error fetching cards for ${groupId}`, err);
        throw err;
    }
}

function interpolateSorted(arr: number[], fraction: number): number {
    if (arr.length === 0) return NaN;
    const n = arr.length;
    const pos = (n - 1) * fraction;
    const lower = Math.floor(pos);
    const upper = Math.ceil(pos);
    if (lower === upper) {
        return arr[lower];
    }
    const weight = pos - lower;
    return arr[lower] * (1 - weight) + arr[upper] * weight;
}

function theoreticalPercentile(min: number, max: number, percentile: number): number {
    return min + percentile * (max - min);
}

function getCardPrice(card: CardWithSales): any {
    const allCardSales = card.sales.map((sale) => sale.purchasePrice);

    const cardSales = allCardSales.filter((price) => price < 0.5);
    // const quant100 = interpolateSorted(
    //     [...cardSales].sort((a, b) => a - b),
    //     1.0
    // );
    // const quant100 = ss.quantileSorted(
    //     [...cardSales].sort((a, b) => a - b),
    //     1.0
    // );
    // const quant99 = ss.quantileSorted(
    //     [...cardSales].sort((a, b) => a - b),
    //     0.99
    // );
    // const quant99 = interpolateSorted(
    //     [...cardSales].sort((a, b) => a - b),
    //     0.99
    // );
    // const quant98 = interpolateSorted(
    //     [...cardSales].sort((a, b) => a - b),
    //     0.98
    // );
    // const quant98 = ss.quantileSorted(
    //     [...cardSales].sort((a, b) => a - b),
    //     0.98
    // );
    // const quant97 = ss.quantileSorted(
    //     [...cardSales].sort((a, b) => a - b),
    //     0.97
    // );
    // const quant96 = ss.quantileSorted(
    //     [...cardSales].sort((a, b) => a - b),
    //     0.96
    // );
    // const quant95 = ss.quantileSorted(
    //     [...cardSales].sort((a, b) => a - b),
    //     0.95
    // );
    // console.log(cardSales);
    const min = ss.min(cardSales);
    console.log('🚀 ~ getCardPrice ~ min:', min);
    const max = ss.max(cardSales);
    console.log('🚀 ~ getCardPrice ~ max:', max);
    const p99 = theoreticalPercentile(min, max, 0.99);
    console.log('🚀 ~ getCardPrice ~ p99:', p99);
    const p98 = theoreticalPercentile(min, max, 0.98);
    console.log('🚀 ~ getCardPrice ~ p98:', p98);
    const p97 = theoreticalPercentile(min, max, 0.97);
    console.log('🚀 ~ getCardPrice ~ p97:', p97);
    const p96 = theoreticalPercentile(min, max, 0.96);
    console.log('🚀 ~ getCardPrice ~ p96:', p96);
    const p95 = theoreticalPercentile(min, max, 0.95);
    console.log('🚀 ~ getCardPrice ~ p95:', p95);

    const priceTrend = getPriceTrend(card.sales as any);
    console.log('🚀 ~ getCardPrice ~ priceTrend:', priceTrend);
    // const quantile25 = ss.quantile(cardSales, 0.25);
    // const quantile50 = ss.quantile(cardSales, 0.25);
    // const quantile75 = ss.quantile(cardSales, 0.25);

    // const quantile90 = ss.quantile(cardSales, 0.9);
    // console.log('🚀 ~ getCardPrice ~ quantile90:', quantile90);
    // const quantile95 = ss.quantile(cardSales, 0.95);
    // console.log('🚀 ~ getCardPrice ~ quantile95:', quantile95);

    //     const mean = ss.mean(cardSales);
    //     const mode = ss.mode(cardSales);
    //     const harmonicMean = ss.harmonicMean(cardSales);
    //     const standardDeviation = ss.sampleStandardDeviation(cardSales);
    //     const interquartileRange = ss.interquartileRange(cardSales);
    //     console.log(
    //         `Card: ${card.productName}
    // Min: ${min}
    // Max: ${max}
    // Mean: ${mean}
    // Mode: ${mode}
    // Harmonic Mean: ${harmonicMean}
    // Std Dev: ${standardDeviation}
    // IQR: ${interquartileRange}
    // Quantile 95: ${quant95}
    // Quantile 96: ${quant96}
    // Quantile 97: ${quant97}
    // Quantile 98: ${quant98}
    // Quantile 99: ${quant99}
    // Quantile 100: ${quant100}
    // `
    //     );
}

export async function generatePrices(groupId: number): Promise<void> {
    const cards = await getSetCards(groupId);
    const firstCard = cards[0];
    getCardPrice(firstCard);
}

export async function analyzeSingleProduct(filePath: string): Promise<{
    productId: string | null;
    p75: number | null;
    p80: number | null;
    p85: number | null;
    p90: number | null;
    p95: number | null;
    p100: number | null;
}> {
    try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);

        // Extract product ID from filename
        const productId = path.basename(filePath).split('_')[0];

        // Get all relevant sales data
        const salesData: number[] = [];
        for (const sale of data.data || []) {
            // Uncomment and adjust filtering as needed
            // if (sale.condition === 'Near Mint' && sale.variant === 'Normal' && sale.language === 'English') {
            salesData.push(Number(sale.purchasePrice) || 0);
            // }
        }

        if (salesData.length === 0) {
            console.warn(`No valid sales data found for TCGplayer ID ${productId}`);
            return { productId, p75: null, p80: null, p85: null, p90: null, p95: null, p100: null };
        }

        // Calculate IQR and bounds for outlier detection
        const q1 = ss.quantileSorted(
            [...salesData].sort((a, b) => a - b),
            0.25
        );
        const q3 = ss.quantileSorted(
            [...salesData].sort((a, b) => a - b),
            0.75
        );
        const iqr = q3 - q1;

        let lowerBound = q1 - 1.5 * iqr;
        let upperBound = q3 + 1.5 * iqr;

        // Filter out outliers
        let filteredPrices = salesData.filter(
            (price) => price >= lowerBound && price <= upperBound
        );

        // If we filtered out too many prices, use a more lenient bound (2.0 * IQR)
        if (filteredPrices.length < salesData.length * 0.5) {
            lowerBound = q1 - 2.0 * iqr;
            upperBound = q3 + 2.0 * iqr;
            filteredPrices = salesData.filter(
                (price) => price >= lowerBound && price <= upperBound
            );
        }

        // Calculate statistics on filtered data
        const median = ss.median(filteredPrices);

        // Calculate prices at different percentiles using filtered data
        const sortedFiltered = [...filteredPrices].sort((a, b) => a - b);
        const p75 = ss.quantileSorted(sortedFiltered, 0.75);
        const p80 = ss.quantileSorted(sortedFiltered, 0.8);
        const p85 = ss.quantileSorted(sortedFiltered, 0.85);
        const p90 = ss.quantileSorted(sortedFiltered, 0.9);
        const p95 = ss.quantileSorted(sortedFiltered, 0.95);
        const p100 = ss.quantileSorted(sortedFiltered, 1.0);

        // Print detailed analysis
        console.log(`\nAnalysis for TCGplayer ID ${productId}:`);
        console.log(`Total sales: ${salesData.length}`);
        console.log(`Filtered sales (excluding outliers): ${filteredPrices.length}`);
        console.log(
            `Original price range: $${Math.min(...salesData).toFixed(2)} - $${Math.max(...salesData).toFixed(2)}`
        );
        console.log(
            `Filtered price range: $${Math.min(...filteredPrices).toFixed(2)} - $${Math.max(...filteredPrices).toFixed(2)}`
        );
        console.log(`Median price: $${median.toFixed(2)}`);
        console.log(`Q1 (25th percentile): $${q1.toFixed(2)}`);
        console.log(`Q3 (75th percentile): $${q3.toFixed(2)}`);
        console.log(`IQR: $${iqr.toFixed(2)}`);
        console.log(`Outlier bounds: $${lowerBound.toFixed(2)} - $${upperBound.toFixed(2)}`);

        console.log(`75th percentile price: $${p75.toFixed(2)}`);
        console.log(`80th percentile price: $${p80.toFixed(2)}`);
        console.log(`85th percentile price: $${p85.toFixed(2)}`);
        console.log(`90th percentile price: $${p90.toFixed(2)}`);
        console.log(`95th percentile price: $${p95.toFixed(2)}`);
        console.log(`100th percentile price: $${p100.toFixed(2)}`);

        // Print price distribution
        console.log('\nPrice distribution (filtered):');
        for (const price of sortedFiltered) {
            console.log(`$${price.toFixed(2)}`);
        }
        console.log('-'.repeat(50));

        return { productId, p75, p80, p85, p90, p95, p100 };
    } catch (e: any) {
        console.error(`Error analyzing file ${filePath}: ${e.message}`);
        return {
            productId: null,
            p75: null,
            p80: null,
            p85: null,
            p90: null,
            p95: null,
            p100: null,
        };
    }
}
