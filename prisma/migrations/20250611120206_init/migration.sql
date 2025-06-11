-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('C', 'L', 'M', 'P', 'R', 'S', 'T', 'U');

-- CreateEnum
CREATE TYPE "Condition" AS ENUM ('NM', 'LP', 'MP', 'HP', 'DM');

-- CreateEnum
CREATE TYPE "Printing" AS ENUM ('NORMAL', 'FOIL');

-- CreateTable
CREATE TABLE "Set" (
    "id" SERIAL NOT NULL,
    "groupId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "abbreviation" TEXT NOT NULL,
    "isSupplemental" BOOLEAN NOT NULL,
    "publishedOn" TIMESTAMP(3) NOT NULL,
    "modifiedOn" TIMESTAMP(3) NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Set_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Card" (
    "id" SERIAL NOT NULL,
    "tcgPlayerId" INTEGER NOT NULL,
    "setId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "productUrl" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "rarity" "Rarity" NOT NULL,
    "condition" "Condition" NOT NULL,
    "printing" "Printing" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Card_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardSales" (
    "id" SERIAL NOT NULL,
    "cardId" INTEGER NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shippingPrice" DOUBLE PRECISION NOT NULL,
    "purchasePrice" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardSales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardPrice" (
    "id" SERIAL NOT NULL,
    "cardId" INTEGER NOT NULL,
    "p90Price" DOUBLE PRECISION NOT NULL,
    "p95Price" DOUBLE PRECISION NOT NULL,
    "p100Price" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Set_groupId_key" ON "Set"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Card_tcgPlayerId_key" ON "Card"("tcgPlayerId");

-- CreateIndex
CREATE INDEX "CardSales_cardId_orderDate_idx" ON "CardSales"("cardId", "orderDate");

-- CreateIndex
CREATE UNIQUE INDEX "CardSales_cardId_orderDate_key" ON "CardSales"("cardId", "orderDate");

-- CreateIndex
CREATE INDEX "CardPrice_cardId_idx" ON "CardPrice"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "CardPrice_cardId_key" ON "CardPrice"("cardId");

-- AddForeignKey
ALTER TABLE "Card" ADD CONSTRAINT "Card_setId_fkey" FOREIGN KEY ("setId") REFERENCES "Set"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardSales" ADD CONSTRAINT "CardSales_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardPrice" ADD CONSTRAINT "CardPrice_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
