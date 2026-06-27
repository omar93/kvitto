import { describe, it, expect } from 'vitest';
import { parseReceiptText, normalizeDecimals } from './parse-text.js';
import { lineTotal } from './schema.js';

// Faithful reconstruction of the user's Willys self-scan PDF receipt.
const RECEIPT = `            Port 73 Haninge
            Tel: 08-12135620
            Org: 556163-2232
-------------------------------------------
========= Start Självscanning ===========
KASSE VIT/RÖD FLG                    10,00
LÖK RÖD 1KG                          13,90
ROMANSALLAD                          14,90
  Rabatt:ROMANSALLAD                 -5,00
GURKA SVERIGE ST      2st*14,90      29,80
ÄPPLE JONAGOLD                       27,10
KYCKLINGBRÖSTFILÉ
          1,002kg*112,62kr/kg       112,85
   Willys Plus:89,90 KR/KG MAX..    -22,77
NÖTFÄRS IMP                          99,90
   Willys Plus:NÖTFÄRS MAX 3        -10,00
YOGH KVARG VANILJ                    23,90
HALLONKVARG U/SOCK                   22,90
COLA SOCKERFRI 2L     3st*13,15      39,45
   +PANT ENG PET >1L  3st*2,00        6,00
TANDBORSTE            2st*27,90      55,80
COMPLETE TANDKRÄM                    16,90
TANDTRÅDSBYGEL                       39,90
DISKBORSTE GREPP                     19,90
POWER INOX                           26,90
TVÅLULL 100G                         19,90
KEBABSKAV 750G        2st*88,90     177,80
========= Slut Självscanning  ===========
-------------------------------------------
  Totalt 22 varor
 Totalt    720,03 SEK
2026-06-15 13:24`;

describe('parseReceiptText', () => {
  const r = parseReceiptText(RECEIPT);
  const byName = (frag) => r.items.find((it) => it.name.includes(frag));

  it('reads the store, date and total', () => {
    expect(r.store).toBe('Port 73 Haninge');
    expect(r.date).toBe('2026-06-15');
    expect(r.total).toBe(720.03);
  });

  it('captures every product line, including the cheap bag', () => {
    expect(r.items).toHaveLength(17);
    expect(byName('KASSE')).toMatchObject({ price: 10, quantity: 1 });
  });

  it('reads "N st * unitprice" as unit price + quantity', () => {
    expect(byName('GURKA')).toMatchObject({ price: 14.9, quantity: 2, discount: 0 });
    expect(byName('KEBABSKAV')).toMatchObject({ price: 88.9, quantity: 2 });
  });

  it('attaches a flat discount to the item above it', () => {
    expect(byName('ROMANSALLAD')).toMatchObject({ price: 14.9, discount: 5 });
    expect(byName('NÖTFÄRS')).toMatchObject({ price: 99.9, discount: 10 });
  });

  it('reads a weight item with its per-kg price, weight and discount', () => {
    expect(byName('KYCKLING')).toMatchObject({ price: 112.62, quantity: 1.002, discount: 22.77 });
  });

  it('folds pant into the item above without adding a row', () => {
    const cola = byName('COLA');
    expect(cola).toMatchObject({ price: 13.15, quantity: 3, deposit: 2, discount: 0 });
    expect(r.items.filter((it) => /pant/i.test(it.name))).toHaveLength(0);
  });

  it('never invents a discount on an item that is not discounted', () => {
    expect(byName('COLA').discount).toBe(0);
    expect(byName('YOGH').discount).toBe(0);
  });

  it('reproduces the printed total from the parsed line items', () => {
    const sum = r.items.reduce((acc, it) => acc + lineTotal(it), 0);
    expect(sum).toBeCloseTo(720.03, 1);
  });

  it('returns null for text that is not a self-scan receipt', () => {
    expect(parseReceiptText('just some random text\nwith no markers')).toBeNull();
  });
});

describe('normalizeDecimals', () => {
  it('turns Swedish decimal commas into dots', () => {
    expect(normalizeDecimals('13,90 och 1,002kg')).toBe('13.90 och 1.002kg');
  });
});
