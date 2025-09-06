const ColorThief = require('colorthief');
import fetch from 'node-fetch';

const COLORS: string[] = [
    '#3c2b5e',
    '#65000b',
    '#640524',
    '#06009f',
    '#1a3c00',
    '#36362f',
    '#003c24',
    '#0c3d00',
    '#003d00',
    '#492f00',
    '#610b3a',
    '#5d183a',
    '#002f73',
    '#35353b',
    '#353535',
    '#5f1531',
    '#650000',
    '#65000e',
    '#660000',
    '#442f37',
    '#520f68',
    '#003753',
    '#133946',
    '#2f363d',
    '#393246',
    '#2a3a09',
    '#233a2b',
    '#403038',
    '#31372b',
    '#47007e',
    '#253933',
    '#003a40',
    '#0b3d00',
    '#4a2f00',
    '#3e3238',
    '#202f6e',
    '#552721',
    '#5c0053',
    '#3f3138',
    '#41330e',
    '#581018',
    '#00384e',
    '#23374a',
    '#442466',
    '#363628',
    '#303730',
    '#5e0b47',
    '#452f30',
    '#413316',
    '#303637',
    '#281294',
    '#213168',
    '#003851',
    '#003a41',
    '#480000',
    '#640f0f',
    '#2b3832',
    '#492d35',
    '#601a14',
    '#3a3241',
    '#003368',
    '#1f3c00',
    '#4f2c00',
    '#5d1e16',
    '#343444',
    '#001e93',
    '#630b26',
    '#650715',
    '#53243c',
    '#203c00',
    '#440082',
    '#0a3c29',
    '#1c3c1c',
    '#193753',
    '#5e034c',
    '#372d60',
    '#2a3643',
    '#462b4c',
    '#003949',
    '#463100',
    '#1b3b2c',
    '#4b186e',
    '#2f363c',
    '#143c1e',
    '#003b36',
    '#003c2e',
    '#0d3d12',
    '#30363c',
    '#31372a',
    '#502800',
    '#382f57',
    '#2f372f',
    '#58184d',
    '#650004',
    '#2b3838',
    '#001048',
    '#502000',
    '#2e3544',
    '#4c2e00',
    '#162685',
    '#003c2b',
    '#640027',
    '#650a0e',
    '#00394c',
    '#452e3e',
    '#023753',
    '#5c0052',
    '#293931',
    '#1e393a',
    '#55233a',
    '#3a3434',
    '#383038',
    '#481810',
    '#401820',
    '#65001d',
    '#2a373e',
    '#093d17',
    '#093d20',
    '#303038',
    '#393600',
    '#5a1f30',
    '#413300',
    '#0c3c30',
    '#03394d',
    '#502820',
    '#26364d',
    '#4b2c33',
    '#5f1b00',
    '#00326a',
    '#223845',
    '#472f2f',
    '#452c46',
    '#650016',
    '#3d3144',
    '#432d4b',
    '#002e77',
    '#00384d',
    '#2b3924',
    '#582132',
    '#002d7a',
    '#611714',
    '#202040',
    '#003465',
    '#1e306b',
    '#3b3333',
    '#5c1f21',
    '#003754',
    '#35353c',
    '#580060',
    '#103050',
    '#592223',
    '#183050',
    '#452463',
    '#4b2c34',
    '#2c3925',
    '#1c3a3a',
    '#37370e',
    '#083070',
];

function hexToRgb(hex: string): [number, number, number] {
    const h = hex.replace('#', '').trim();
    const full =
        h.length === 3
            ? h
                  .split('')
                  .map((ch) => ch + ch)
                  .join('')
            : h;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToLab([r, g, b]: [number, number, number]) {
    let [R, G, B] = [r / 255, g / 255, b / 255];
    [R, G, B] = [R, G, B].map((v) =>
        v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    );
    const X = (R * 0.4124564 + G * 0.3575761 + B * 0.1804375) / 0.95047;
    const Y = R * 0.2126729 + G * 0.7151522 + B * 0.072175;
    const Z = (R * 0.0193339 + G * 0.119192 + B * 0.9503041) / 1.08883;
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const fx = f(X),
        fy = f(Y),
        fz = f(Z);
    const L = Math.max(0, 116 * fy - 16);
    const a = 500 * (fx - fy);
    const b2 = 200 * (fy - fz);
    return { L, a, b: b2 };
}
function deltaE(l1: any, l2: any) {
    const dL = l1.L - l2.L,
        da = l1.a - l2.a,
        db = l1.b - l2.b;
    return Math.sqrt(dL * dL + da * da + db * db);
}

export async function getAccentColorFromUrl(
    imageUrl: string,
    targetLightness = 0,
    opts?: { paletteSize?: number; colorWeight?: number; lightnessWeight?: number }
): Promise<string> {
    if (!imageUrl) {
        return '#303030';
    }

    try {
        const paletteSize = opts?.paletteSize ?? 6;
        const res = await fetch(imageUrl);
        const buffer = Buffer.from(await res.arrayBuffer());

        // @ts-ignore
        let raw: any = await ColorThief.getPalette(buffer, paletteSize).catch(async () => {
            // @ts-ignore
            const single = await ColorThief.getColor(buffer).catch(() => null);
            return single ? single : null;
        });

        if (!raw) {
            raw = [];
        }

        const paletteRgb: [number, number, number][] = [];

        if (Array.isArray(raw)) {
            if (raw.length >= 3 && raw.slice(0, 3).every((v: any) => typeof v === 'number')) {
                paletteRgb.push([raw[0], raw[1], raw[2]]);
            } else {
                for (const entry of raw) {
                    if (
                        Array.isArray(entry) &&
                        entry.length >= 3 &&
                        typeof entry[0] === 'number' &&
                        typeof entry[1] === 'number' &&
                        typeof entry[2] === 'number'
                    ) {
                        paletteRgb.push([entry[0], entry[1], entry[2]]);
                    } else if (
                        entry &&
                        typeof entry === 'object' &&
                        typeof entry.r === 'number' &&
                        typeof entry.g === 'number' &&
                        typeof entry.b === 'number'
                    ) {
                        paletteRgb.push([entry.r, entry.g, entry.b]);
                    }
                }
            }
        } else if (
            raw &&
            typeof raw === 'object' &&
            typeof raw.r === 'number' &&
            typeof raw.g === 'number' &&
            typeof raw.b === 'number'
        ) {
            paletteRgb.push([raw.r, raw.g, raw.b]);
        }

        if (!paletteRgb.length) {
            // @ts-ignore
            const single = await ColorThief.getColor(buffer).catch(() => null);
            if (
                single &&
                Array.isArray(single) &&
                single.length >= 3 &&
                single.slice(0, 3).every((v: any) => typeof v === 'number')
            ) {
                paletteRgb.push([single[0], single[1], single[2]]);
            } else {
                paletteRgb.push([48, 48, 48]);
            }
        }

        const paletteLab = paletteRgb.map(rgbToLab);
        const candidates = COLORS.map((hex) => {
            const rgb = hexToRgb(hex);
            const lab = rgbToLab(rgb);
            return { hex, lab, Lnorm: lab.L / 100 };
        });

        const colorWeight = opts?.colorWeight ?? 0.8;
        const lightnessWeight = opts?.lightnessWeight ?? 0.2;

        const scored = candidates.map((cand) => {
            let minDE = Infinity;
            for (const p of paletteLab) {
                const de = deltaE(cand.lab, p);
                if (de < minDE) {
                    minDE = de;
                }
            }
            const colorDistNorm = Math.min(1, minDE / 100);
            const lightDiff = Math.abs(cand.Lnorm - targetLightness);
            const score = colorWeight * colorDistNorm + lightnessWeight * lightDiff;
            return { hex: cand.hex, score, minDE, lightDiff };
        });

        scored.sort((a, b) => a.score - b.score);
        return scored[0].hex;
    } catch (err) {
        console.error('getAccentColorFromUrl error', err);
        return '#303030';
    }
}
function rgbToHex([r, g, b]: [number, number, number]): string {
    const toHex = (n: number) =>
        Math.max(0, Math.min(255, Math.round(n)))
            .toString(16)
            .padStart(2, '0');
    return `${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsv([r, g, b]: [number, number, number]): [number, number, number] {
    const r1 = r / 255,
        g1 = g / 255,
        b1 = b / 255;
    const max = Math.max(r1, g1, b1),
        min = Math.min(r1, g1, b1);
    const d = max - min;
    const v = max;
    const s = max === 0 ? 0 : d / max;
    let h = 0;
    if (d !== 0) {
        switch (max) {
            case r1:
                h = (g1 - b1) / d + (g1 < b1 ? 6 : 0);
                break;
            case g1:
                h = (b1 - r1) / d + 2;
                break;
            default:
                h = (r1 - g1) / d + 4;
        }
        h /= 6;
    }
    return [h, s, v];
}

function hsvToRgb([h, s, v]: [number, number, number]): [number, number, number] {
    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = v * (1 - s);
    const q = v * (1 - s * f);
    const t = v * (1 - s * (1 - f));
    let r = 0,
        g = 0,
        b = 0;
    switch (i % 6) {
        case 0:
            r = v;
            g = t;
            b = p;
            break;
        case 1:
            r = q;
            g = v;
            b = p;
            break;
        case 2:
            r = p;
            g = v;
            b = t;
            break;
        case 3:
            r = p;
            g = q;
            b = v;
            break;
        case 4:
            r = t;
            g = p;
            b = v;
            break;
        case 5:
            r = v;
            g = p;
            b = q;
            break;
    }
    return [r * 255, g * 255, b * 255].map((x) => Math.round(x)) as [number, number, number];
}

function clamp01(x: number): number {
    return Math.max(0, Math.min(1, x));
}

export function generateTextColor(hexCover: string, hShiftDeg = 12, coeff = 0.81): string {
    const rgbCover = hexToRgb(hexCover);
    const [h, s, v] = rgbToHsv(rgbCover);
    const newH = (h + hShiftDeg / 360) % 1;
    const newS = clamp01(v * coeff);
    const newV = 1;
    const rgbText = hsvToRgb([newH, newS, newV]);
    return rgbToHex(rgbText);
}
