import {assert} from "chai";
import {describe, it} from "mocha";
import {intToBytes} from "../../src";

describe("intToBytes", () => {                                    
  const zeroedArray = (length: number): number[] => Array.from({length}, () => 0);
  const testCases: { input: [bigint | number, number]; output: Buffer }[] = [
    {input: [255, 1], output: Buffer.from([255])},                                        
    {input: [255n, 1], output: Buffer.from([255])},
    {input: [65535, 2], output: Buffer.from([255, 255])},
    {input: [65535n, 2], output: Buffer.from([255, 255])},
    {input: [16777215, 3], output: Buffer.from([255, 255, 255])},
    {input: [16777215n, 3], output: Buffer.from([255, 255, 255])},
    {input: [4294967295, 4], output: Buffer.from([255, 255, 255, 255])},
    {input: [4294967295n, 4], output: Buffer.from([255, 255, 255, 255])},
    {input: [65535, 8], output: Buffer.from([255, 255, ...zeroedArray(8-2)])},
    {input: [65535n, 8], output: Buffer.from([255, 255, ...zeroedArray(8-2)])},
    {input: [65535, 32], output: Buffer.from([255, 255, ...zeroedArray(32-2)])},
    {input: [65535n, 32], output: Buffer.from([255, 255, ...zeroedArray(32-2)])},
    {input: [65535, 48], output: Buffer.from([255, 255, ...zeroedArray(48-2)])},
    {input: [65535n, 48], output: Buffer.from([255, 255, ...zeroedArray(48-2)])},
    {input: [65535, 96], output: Buffer.from([255, 255, ...zeroedArray(96-2)])},
    {input: [65535n, 96], output: Buffer.from([255, 255, ...zeroedArray(96-2)])},
  ];
  for (const {input, output} of testCases) {
    const type = typeof input;
    const length = input[1];
    it(`should correctly serialize ${type} to bytes length ${length}`, () => {
      assert(intToBytes(input[0], input[1]).equals(output));
    });
  }
});
