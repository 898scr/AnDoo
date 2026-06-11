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
        pins.digitalWritePin(pinA, 0);
        pins.digitalWritePin(pinB, 0);
        basic.pause(50);

        pins.digitalWritePin(pinA, 1);
        basic.pause(50);

        i2cWriteReg(0x29, 0x8A, ADDR_A);
        basic.pause(10);

        pins.digitalWritePin(pinB, 1);
        basic.pause(50);

        i2cWriteReg(ADDR_A, 0x00, 0x01);
        i2cWriteReg(ADDR_B, 0x00, 0x01);
        
        basic.pause(50);
    }

    /**
     * センサーA（アドレス: 0x30）の距離を取得します（mm）
     */
    //% block="センサーAの距離 (mm)"
    export function getDistanceA(): number {
        let dist = i2cRead2Bytes(ADDR_A, 0x14);
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

//% color="#4G85E6" weight=90 icon="\uf00a" block="MCP23017拡張"
namespace mcp23017 {
    const MCP23017_ADDR = 0x20; // MCP23017の標準I2Cアドレス

    const IODIRA = 0x00; // ポートAの入出力設定
    const IODIRB = 0x01; // ポートBの入出力設定
    const GPIOA = 0x12;  // ポートAのデータ
    const GPIOB = 0x13;  // ポートBのデータ

    let current_output_a = 0x00;
    let current_output_b = 0x00;

    export enum MCPPin {
        A0 = 0, A1 = 1, A2 = 2, A3 = 3, A4 = 4, A5 = 5, A6 = 6, A7 = 7,
        B0 = 8, B1 = 9, B2 = 10, B3 = 11, B4 = 12, B5 = 13, B6 = 14, B7 = 15
    }

    export enum PinMode {
        //% block="出力"
        Output = 0,
        //% block="入力"
        Input = 1
    }

    function writeReg(reg: number, val: number): void {
        let buf = pins.createBuffer(2);
        buf.setNumber(NumberFormat.UInt8LE, 0, reg);
        buf.setNumber(NumberFormat.UInt8LE, 1, val);
        pins.i2cWriteBuffer(MCP23017_ADDR, buf);
    }

    function readReg(reg: number): number {
        pins.i2cWriteNumber(MCP23017_ADDR, reg, NumberFormat.UInt8LE, true);
        return pins.i2cReadNumber(MCP23017_ADDR, NumberFormat.UInt8LE, false);
    }

    /**
     * MCP23017を初期化します（すべてのピンを出力モードにします）
     */
    //% block="MCP23017を初期化する"
    export function init(): void {
        writeReg(IODIRA, 0x00);
        writeReg(IODIRB, 0x00);
        writeReg(GPIOA, 0x00);
        writeReg(GPIOB, 0x00);
        current_output_a = 0x00;
        current_output_b = 0x00;
    }

    /**
     * 指定したピンのモード（入力・出力）を設定します
     */
    //% block="MCP23017の ピン %pin を %mode に設定"
    export function setPinMode(pin: MCPPin, mode: PinMode): void {
        let isB = pin >= 8;
        let bit = isB ? pin - 8 : pin;
        let reg = isB ? IODIRB : IODIRA;
        
        let current_dir = readReg(reg);
        if (mode == PinMode.Input) {
            current_dir |= (1 << bit);
        } else {
            current_dir &= ~(1 << bit);
        }
        writeReg(reg, current_dir);
    }

    /**
     * 指定したピンにデジタル値（1または0）を出力します
     */
    //% block="MCP23017の ピン %pin に %value を出力"
    //% value.min=0 value.max=1
    export function digitalWrite(pin: MCPPin, value: number): void {
        let isB = pin >= 8;
        let bit = isB ? pin - 8 : pin;
        let reg = isB ? GPIOB : GPIOA;
        let current_val = isB ? current_output_b : current_output_a;

        if (value == 1) {
            current_val |= (1 << bit);
        } else {
            current_val &= ~(1 << bit);
        }

        if (isB) {
            current_output_b = current_val;
        } else {
            current_output_a = current_val;
        }
        writeReg(reg, current_val);
    }

    /**
     * 指定したピンのデジタル入力状態（1または0）を読み取ります
     */
    //% block="MCP23017の ピン %pin の入力状態"
    export function digitalRead(pin: MCPPin): number {
        let isB = pin >= 8;
        let bit = isB ? pin - 8 : pin;
        let reg = isB ? GPIOB : GPIOA;

        let reg_val = readReg(reg);
        return (reg_val >> bit) & 1;
    }
}