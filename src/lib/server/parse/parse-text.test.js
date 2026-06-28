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

  it('adds the pant line total to the item above without adding a row', () => {
    const cola = byName('COLA');
    expect(cola).toMatchObject({ price: 13.15, quantity: 3, deposit: 6, discount: 0 });
    expect(r.items.filter((it) => /pant/i.test(it.name))).toHaveLength(0);
  });

  it('never invents a discount on an item that is not discounted', () => {
    expect(byName('COLA').discount).toBe(0);
    expect(byName('YOGH').discount).toBe(0);
  });

  it('reproduces the printed total from the parsed line items', () => {
    const sum = r.items.reduce((acc, it) => acc + lineTotal(it), 0);
    // within ~0.5 kr: the weight discount is taken per-kg, a few öre off the receipt
    expect(sum).toBeCloseTo(720.03, 0);
  });

  it('returns null for text that is not a self-scan receipt', () => {
    expect(parseReceiptText('just some random text\nwith no markers')).toBeNull();
  });
});

describe('parseReceiptText (ICA Maxi column layout)', () => {
  const ICA = [
    'Kvitto Maxi ICA Stormarknad Haninge',
    'Datum 2026-06-22 17:30',
    'Beskrivning Artikelnummer Pris Mängd Summa(SEK)',
    'Bifftomat lv 2003229 32,90 1,00 kg 12,24',
    'Extra Creamy 2000685 52,90 1,00 st 52,90',
    '*Gurka Haninge 2879144 7,50 2,00 st 27,60',
    'Svensk gurka 2f15kr -12,60',
    '*Ägg Frigående M 1430960 30,00 2,00 st 81,20',
    'Ägg 30kr/st -21,20',
    'Pantretur, låg moms 1,00 1 -1,00',
    'Pantretur, låg moms 60,00 1 -60,00',
    'Betalat 173,38'
  ].join('\n');
  const r = parseReceiptText(ICA);
  const byName = (frag) => r.items.find((it) => it.name.includes(frag));

  it('reads store, date and the Betalat total', () => {
    expect(r.store).toBe('Maxi ICA Stormarknad Haninge');
    expect(r.date).toBe('2026-06-22');
    expect(r.total).toBe(173.38);
  });

  it('reads a weight item as per-kg price * computed weight', () => {
    expect(byName('Bifftomat')).toMatchObject({ price: 32.9, quantity: 0.372, discount: 0 });
  });

  it('strips the offer asterisk and leaves plain items alone', () => {
    expect(byName('Gurka').name).toBe('Gurka Haninge');
    expect(byName('Extra')).toMatchObject({ price: 52.9, quantity: 1, discount: 0 });
  });

  it('turns a discount line into a per-unit discount off the gross unit price', () => {
    expect(byName('Gurka')).toMatchObject({ price: 13.8, quantity: 2, discount: 6.3 });
    expect(byName('Ägg')).toMatchObject({ price: 40.6, quantity: 2, discount: 10.6 });
  });

  it('combines pant returns into a single negative row', () => {
    const pant = r.items.filter((it) => it.name === 'Pantretur');
    expect(pant).toHaveLength(1);
    expect(pant[0].price).toBe(-61);
  });
});

describe('normalizeDecimals', () => {
  it('turns Swedish decimal commas into dots', () => {
    expect(normalizeDecimals('13,90 och 1,002kg')).toBe('13.90 och 1.002kg');
  });
});
