//% color="#00BCD4" weight=100 icon="\uf140" block="2連VL53L0X"
namespace doubleVL53L0X {
    const ADDR_A = 0x30; // センサーAの変更後アドレス
    const ADDR_B = 0x29; // センサーBのアドレス（初期値）

    function i2cWriteReg(addr: number, reg: number, val: number): void {
        let buf = pins.createBuffer(2);
        buf.setNumber(NumberFormat.UInt8LE, 0, reg);
        buf.setNumber(NumberFormat.UInt8LE, 1, val);
        pins.i2cWriteBuffer(addr, buf);
    }

    function i2cReadReg(addr: number, reg: number): number {
        pins.i2cWriteNumber(addr, reg, NumberFormat.UInt8LE, true);
        return pins.i2cReadNumber(addr, NumberFormat.UInt8LE, false);
    }

    /**
     * 公式ライブラリ(rangefinder)と全く同じ内部シーケンスでVL53L0Xを初期化します。
     * アドレスが0x29のままのセンサーに有効です。
     */
    function vl53l0x_init_sequence(addr: number): void {
        // 1. 各種内部レジスタの初期化・チューニング設定（公式の完全コピー）
        i2cWriteReg(addr, 0x88, 0x00);
        i2cWriteReg(addr, 0x80, 0x01);
        i2cWriteReg(addr, 0xff, 0x01);
        i2cWriteReg(addr, 0x00, 0x00);
        let stop_variable = i2cReadReg(addr, 0x91);
        i2cWriteReg(addr, 0x00, 0x01);
        i2cWriteReg(addr, 0xff, 0x00);
        i2cWriteReg(addr, 0x80, 0x00);

        // 2. パイプライン・タイミングの設定
        i2cWriteReg(addr, 0x60, i2cReadReg(addr, 0x60) | 0x12);
        i2cWriteReg(addr, 0x01, i2cReadReg(addr, 0x01) | 0x40);

        // 3. 各種キャリブレーション・感度設定の流し込み
        i2cWriteReg(addr, 0xff, 0x01);
        i2cWriteReg(addr, 0x4e, 0x2c);
        i2cWriteReg(addr, 0x48, 0x00);
        i2cWriteReg(addr, 0x30, 0x20);
        i2cWriteReg(addr, 0xff, 0x00);
        i2cWriteReg(addr, 0x30, 0x09);
        i2cWriteReg(addr, 0x54, 0x00);
        i2cWriteReg(addr, 0x31, 0x04);
        i2cWriteReg(addr, 0x32, 0x03);
        i2cWriteReg(addr, 0x40, 0x83);
        i2cWriteReg(addr, 0x46, 0x25);
        i2cWriteReg(addr, 0x60, 0x00);
        i2cWriteReg(addr, 0x27, 0x00);
        i2cWriteReg(addr, 0x50, 0x06);
        i2cWriteReg(addr, 0x51, 0x00);
        i2cWriteReg(addr, 0x52, 0x96);
        i2cWriteReg(addr, 0x56, 0x08);
        i2cWriteReg(addr, 0x57, 0x30);
        i2cWriteReg(addr, 0x61, 0x00);
        i2cWriteReg(addr, 0x62, 0x00);
        i2cWriteReg(addr, 0x64, 0x00);
        i2cWriteReg(addr, 0x65, 0x00);
        i2cWriteReg(addr, 0x66, 0xa0);
        i2cWriteReg(addr, 0xff, 0x01);
        i2cWriteReg(addr, 0x22, 0x32);
        i2cWriteReg(addr, 0x47, 0x14);
        i2cWriteReg(addr, 0x49, 0xff);
        i2cWriteReg(addr, 0x4a, 0x00);
        i2cWriteReg(addr, 0xff, 0x00);
        i2cWriteReg(addr, 0x7a, 0x0a);
        i2cWriteReg(addr, 0x7b, 0x00);
        i2cWriteReg(addr, 0x78, 0x21);
        i2cWriteReg(addr, 0xff, 0x01);
        i2cWriteReg(addr, 0x23, 0x34);
        i2cWriteReg(addr, 0x42, 0x00);
        i2cWriteReg(addr, 0x44, 0xff);
        i2cWriteReg(addr, 0x45, 0x26);
        i2cWriteReg(addr, 0x46, 0x05);
        i2cWriteReg(addr, 0x40, 0x40);
        i2cWriteReg(addr, 0x0E, 0x06);
        i2cWriteReg(addr, 0x20, 0x1a);
        i2cWriteReg(addr, 0x43, 0x40);
        i2cWriteReg(addr, 0xff, 0x00);
        i2cWriteReg(addr, 0x34, 0x03);
        i2cWriteReg(addr, 0x35, 0x44);
        i2cWriteReg(addr, 0xff, 0x01);
        i2cWriteReg(addr, 0x31, 0x04);
        i2cWriteReg(addr, 0x4b, 0x09);
        i2cWriteReg(addr, 0x4c, 0x05);
        i2cWriteReg(addr, 0x4d, 0x04);
        i2cWriteReg(addr, 0xff, 0x00);
        i2cWriteReg(addr, 0x44, 0x00);
        i2cWriteReg(addr, 0x45, 0x20);
        i2cWriteReg(addr, 0x47, 0x08);
        i2cWriteReg(addr, 0x48, 0x28);
        i2cWriteReg(addr, 0x67, 0x00);
        i2cWriteReg(addr, 0x70, 0x04);
        i2cWriteReg(addr, 0x71, 0x01);
        i2cWriteReg(addr, 0x72, 0xfe);
        i2cWriteReg(addr, 0x76, 0x00);
        i2cWriteReg(addr, 0x77, 0x00);
        i2cWriteReg(addr, 0xff, 0x01);
        i2cWriteReg(addr, 0x0d, 0x01);
        i2cWriteReg(addr, 0xff, 0x00);
        i2cWriteReg(addr, 0x80, 0x01);
        i2cWriteReg(addr, 0x01, 0xf8);
        i2cWriteReg(addr, 0xff, 0x01);
        i2cWriteReg(addr, 0x8e, 0x01);
        i2cWriteReg(addr, 0x00, 0x01);
        i2cWriteReg(addr, 0xff, 0x00);
        i2cWriteReg(addr, 0x80, 0x00);

        // 4. システム割り込みと連続測定モードの開始
        i2cWriteReg(addr, 0x00, 0x04);
        i2cWriteReg(addr, 0xff, 0x01);
        i2cWriteReg(addr, 0x4f, 0x01);
        i2cWriteReg(addr, 0x4e, 0x2c);
        i2cWriteReg(addr, 0xff, 0x00);
        i2cWriteReg(addr, 0x00, 0x02); // START CONTINUOUS MODE
        basic.pause(50);
    }

    /**
     * 2つのVL53L0Xセンサーを公式完全互換の手順で順次初期化し、アドレスを変更します。
     */
    //% block="【公式互換版】2連センサーを初期化 XSHUT_A %pinA XSHUT_B %pinB"
    export function initSensorsOfficial(pinA: DigitalPin, pinB: DigitalPin): void {
        // 1. 一旦両方をリセット
        pins.digitalWritePin(pinA, 0);
        pins.digitalWritePin(pinB, 0);
        basic.pause(50);

        // 2. センサーAだけを起こして、公式シーケンスで初期化
        pins.digitalWritePin(pinA, 1);
        basic.pause(50);
        vl53l0x_init_sequence(0x29); // まず初期アドレスで中身を公式化

        // 3. 初期化が終わったセンサーAのアドレスを「0x30」に変更
        i2cWriteReg(0x29, 0x22, ADDR_A);
        basic.pause(10);

        // 4. センサーBを起こして、公式シーケンスで初期化（こちらは0x29のまま）
        pins.digitalWritePin(pinB, 1);
        basic.pause(50);
        vl53l0x_init_sequence(ADDR_B);
    }

    /**
     * センサーA（アドレス: 0x30）の距離を取得（公式互換）
     */
    //% block="【公式互換】センサーAの距離 (mm)"
    export function getDistanceA(): number {
        pins.i2cWriteNumber(ADDR_A, 0x14, NumberFormat.UInt8LE, true);
        let buf = pins.i2cReadBuffer(ADDR_A, 12);
        let dist = (buf.getUint8(10) << 8) | buf.getUint8(11);
        if (dist > 8000 || dist <= 20) return 0;
        return dist;
    }

    /**
     * センサーB（アドレス: 0x29）の距離を取得（公式互換）
     */
    //% block="【公式互換】センサーBの距離 (mm)"
    export function getDistanceB(): number {
        pins.i2cWriteNumber(ADDR_B, 0x14, NumberFormat.UInt8LE, true);
        let buf = pins.i2cReadBuffer(ADDR_B, 12);
        let dist = (buf.getUint8(10) << 8) | buf.getUint8(11);
        if (dist > 8000 || dist <= 20) return 0;
        return dist;
    }
}

//% color="#4185E6" weight=90 icon="\uf00a" block="MCP23017拡張"
namespace mcp23017 {
    const MCP23017_ADDR = 0x20;
    const IODIRA = 0x00; const IODIRB = 0x01;
    const GPIOA = 0x12;  const GPIOB = 0x13;
    let current_output_a = 0x00; let current_output_b = 0x00;

    export enum MCPPin {
        A0 = 0, A1 = 1, A2 = 2, A3 = 3, A4 = 4, A5 = 5, A6 = 6, A7 = 7,
        B0 = 8, B1 = 9, B2 = 10, B3 = 11, B4 = 12, B5 = 13, B6 = 14, B7 = 15
    }
    export enum PinMode { Output = 0, Input = 1 }

    function writeReg(reg: number, val: number): void {
        let buf = pins.createBuffer(2);
        buf.setNumber(NumberFormat.UInt8LE, 0, reg);
        buf.setNumber(NumberFormat.UInt8LE, 1, val);
        pins.i2cWriteBuffer(MCP23017_ADDR, buf);
    }

    //% block="MCP23017を初期化する"
    export function init(): void {
        writeReg(IODIRA, 0x00); writeReg(IODIRB, 0x00);
        writeReg(GPIOA, 0x00); writeReg(GPIOB, 0x00);
    }
}