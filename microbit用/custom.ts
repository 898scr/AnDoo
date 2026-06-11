/// <reference path="../../node_modules/pxt-core/built/pxtsim.d.ts"/>
/// <reference path="../../node_modules/pxt-core/localtypings/pxtarm.d.ts"/>
/// <reference path="../../node_modules/pxt-core/localtypings/pxtcore.d.ts"/>

//% color="#00BCD4" weight=100 icon="\uf140" block="2連VL53L0X"
namespace doubleVL53L0X {
    const ADDR_A = 0x30; // 変更後のセンサーAの番号
    const ADDR_B = 0x29; // センサーBの番号（初期値のまま）

    // I2Cに1バイト書き込むヘルパー関数
    function i2cWriteReg(addr: number, reg: number, val: number): void {
        let buf = pins.createBuffer(2);
        buf.setNumber(NumberFormat.UInt8LE, 0, reg);
        buf.setNumber(NumberFormat.UInt8LE, 1, val);
        pins.i2cWriteBuffer(addr, buf);
    }

    // I2Cから2バイト（距離データ）を読み込むヘルパー関数
    function i2cRead2Bytes(addr: number, reg: number): number {
        pins.i2cWriteNumber(addr, reg, NumberFormat.UInt8LE, true);
        let buf = pins.i2cReadBuffer(addr, 2);
        return (buf.getUint8(0) << 8) | buf.getUint8(1);
    }

    /**
     * 2つのVL53L0Xセンサーを初期化し、片方のアドレスを変更します。
     * @param pinA センサーAのXSHUTピン, eg: DigitalPin.P0
     * @param pinB センサーBのXSHUTピン, eg: DigitalPin.P1
     */
    //% block="センサーを初期化 XSHUT_A %pinA XSHUT_B %pinB"
    export function initSensors(pinA: DigitalPin, pinB: DigitalPin): void {
        // 1. 両方のセンサーを一旦眠らせる
        pins.digitalWritePin(pinA, 0);
        pins.digitalWritePin(pinB, 0);
        basic.pause(50);

        // 2. センサーAだけを起こす
        pins.digitalWritePin(pinA, 1);
        basic.pause(50);

        // 3. 起きているセンサーAのアドレスを 0x29 -> 0x30 に書き換える
        // (レジスタ 0x8A に新しいアドレスを書き込みます)
        i2cWriteReg(0x29, 0x8A, ADDR_A);
        basic.pause(10);

        // 4. センサーBを起こす（こっちは初期値 0x29 のままになる）
        pins.digitalWritePin(pinB, 1);
        basic.pause(50);

        // 5. それぞれのセンサーの初期設定（データ測定を有効化）
        // センサーA (0x30)
        i2cWriteReg(ADDR_A, 0x00, 0x01); // 開始コマンドなど
        // センサーB (0x29)
        i2cWriteReg(ADDR_B, 0x00, 0x01);
        
        basic.pause(50);
    }

    /**
     * センサーA（アドレス: 0x30）の距離を取得します（mm）
     */
    //% block="センサーAの距離 (mm)"
    export function getDistanceA(): number {
        // VL53L0Xの距離データレジスタ(0x14)から読み取り
        let dist = i2cRead2Bytes(ADDR_A, 0x14);
        // エラー値（通常20mm以下やエラー時は大きな値になります）の簡易フィルター
        if (dist > 8000) return 0;
        return dist;
    }

    /**
     * センサーB（アドレス: 0x29）の距離を取得します（mm）
     */
    //% block="センサーBの距離 (mm)"
    export function getDistanceB(): number {
        let dist = i2cRead2Bytes(ADDR_B, 0x14);
        if (dist > 8000) return 0;
        return dist;
    }
}