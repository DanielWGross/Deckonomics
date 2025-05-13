## Add logic to validate a set in the Database
  - The call to `https://tcgcsv.com/tcgplayer/1/groups` returns a `modifiedOn` property that indicates if a set has changed.
  - If the `modifiedOn` date in the Set table is behind the `modifiedOn` from the TCGCSV response we should update
    - Need to maintain the cards as we would want the historical record of the cards
    - Need to figure out which individual card has changed?
    - This may require some trial and error to figure out.

## Update logic when saving to the database to include the foil query param
  - A Normal printing will have a URL like: `https://www.tcgplayer.com/product/614328/magic-aetherdrift-aatchik-emerald-radian?Language=English`
  - A Foil printing will have a URL like: `https://www.tcgplayer.com/product/614328/magic-aetherdrift-aatchik-emerald-radian?Language=English&Printing=Foil`
  - The product ID is the same, it is just the `Printing` query param that separates the two

## Add logic to fetch individual card data
  - The URL is already in the table
  - Need to capture the following for each card
    - Total Listings
      - This needs to be filtered by condition
      - Should also be filtered by Direct
        - Determining cards that are not Direct eligible may be out of scope for now
      - 30 Day Sales
        - Lowest Price
        - Highest Price
        - Total # Sold
        - Avg. Daily Sold
      - Individual Sales
        - The `latestsales` call includes specific sales based on the current filters set
        - The `orderDate` seems to be a unique identifier that can be used to only worry about capturing "new" sales when running multiple times
        - 