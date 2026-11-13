import { describe, expect, it } from 'vitest';
import { cleanFileName, imageSize, sniffMediaType } from './media.utils.js';

const png = Buffer.from('89504e470d0a1a0a0000000d49484452000002580000012c08060000001f15c489', 'hex');
const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.from([0x40, 0x01, 0xf0, 0x00]), Buffer.alloc(10)]);
const jpeg = Buffer.from('ffd8ffe000104a46494600010100000100010000ffc0001108012c025803012200021101031101', 'hex');

describe('sniffMediaType', () => {
  it('detects real file types from bytes', () => {
    expect(sniffMediaType(png)).toBe('image/png');
    expect(sniffMediaType(gif)).toBe('image/gif');
    expect(sniffMediaType(jpeg)).toBe('image/jpeg');
    expect(sniffMediaType(Buffer.from('%PDF-1.7 some pdf content'))).toBe('application/pdf');
    expect(sniffMediaType(Buffer.from('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
  });
  it('rejects SVG, HTML and short files', () => {
    expect(sniffMediaType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
    expect(sniffMediaType(Buffer.from('<html><body>hi</body></html>'))).toBeNull();
    expect(sniffMediaType(Buffer.from('abc'))).toBeNull();
  });
});

describe('imageSize', () => {
  it('reads dimensions', () => {
    expect(imageSize(png, 'image/png')).toEqual({ width: 600, height: 300 });
    expect(imageSize(gif, 'image/gif')).toEqual({ width: 320, height: 240 });
    expect(imageSize(jpeg, 'image/jpeg')).toEqual({ width: 600, height: 300 });
  });
  it('returns null for garbage', () => {
    expect(imageSize(Buffer.from('ffd8ff00', 'hex'), 'image/jpeg')).toBeNull();
  });
});

describe('cleanFileName', () => {
  it('strips paths and odd characters', () => {
    expect(cleanFileName('C:\\Users\\me\\Diwali Offer!.png')).toBe('Diwali Offer_.png');
    expect(cleanFileName('../../etc/passwd')).toBe('passwd');
    expect(cleanFileName('')).toBe('file');
  });
});
