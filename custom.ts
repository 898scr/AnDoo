//% color="#00BCD4" weight=100 icon="\uf140" block="2連VL53L0X"
namespace doubleVL53L0X {
    const ADDR_A = 0x30;
    const ADDR_B = 0x29;

    function i2cwrite(addr: number, reg: number, value: number) {
        let buf = pins.createBuffer(2);
        buf[0] = reg;
        buf[1] = value;
        pins.i2cWriteBuffer(addr, buf);
    }

    function i2cread(addr: number, reg: number): number {
        pins.i2cWriteNumber(addr, reg, NumberFormat.UInt8BE, true);
        return pins.i2cReadNumber(addr, NumberFormat.UInt8BE, false);
    }

    function initVL53L0X(addr: number): void {
        i2cwrite(addr, 0x88, 0x00);
        i2cwrite(addr, 0x80, 0x01);
        i2cwrite(addr, 0xff, 0x01);
        i2cwrite(addr, 0x00, 0x00);
        let stop_variable = i2cread(addr, 0x91);
        i2cwrite(addr, 0x00, 0x01);
        i2cwrite(addr, 0xff, 0x00);
        i2cwrite(addr, 0x80, 0x00);
        i2cwrite(addr, 0x60, i2cread(addr, 0x60) | 0x12);
        i2cwrite(addr, 0x01, i2cread(addr, 0x01) | 0x40);
        i2cwrite(addr, 0x01, 0x00);
        i2cwrite(addr, 0x01, 0x01);
        i2cwrite(addr, 0x01, 0x00);
        i2cwrite(addr, 0x00, 0x02); 
        basic.pause(50);
    }

    function readDistance(addr: number): number {
        pins.i2cWriteNumber(addr, 0x14, NumberFormat.UInt8BE, true);
        let buf = pins.i2cReadBuffer(addr, 12);
        let dist = (buf[10] << 8) | buf[11];
        if (dist > 8000 || dist <= 20) return 0;
        return dist;
    }

    /**
     * 2つのセンサーのXSHUTを制御して順番に初期化・アドレス変更をします。
     */
    //% block="2連センサーを初期化する XSHUT_A %pinA XSHUT_B %pinB"
    export function initSensors(pinA: DigitalPin, pinB: DigitalPin): void {
        pins.digitalWritePin(pinA, 0);
        pins.digitalWritePin(pinB, 0);
        basic.pause(50);
        pins.digitalWritePin(pinA, 1);
        basic.pause(50);
        i2cwrite(0x29, 0x22, ADDR_A);
        basic.pause(20);
        initVL53L0X(ADDR_A);
        pins.digitalWritePin(pinB, 1);
        basic.pause(50);
        initVL53L0X(ADDR_B);
    }

    /**
     * センサーA（アドレス: 0x30）の距離を取得します（mm）
     */
    //% block="センサーAの距離 (mm)"
    export function getDistanceA(): number {
        return readDistance(ADDR_A);
    }

    /**
     * センサーB（アドレス: 0x29）の距離を取得します（mm）
     */
    //% block="センサーBの距離 (mm)"
    export function getDistanceB(): number {
        return readDistance(ADDR_B);
    }
}

//% color="#4185E6" weight=90 icon="\uf00a" block="MCP23017"
namespace mcp23017 {
    const MCP23017_ADDR = 0x20;
    //% block="MCP23017を初期化する"
    export function init(): void {
        let buf = pins.createBuffer(2);
        buf[0] = 0x00; buf[1] = 0x00;
        pins.i2cWriteBuffer(MCP23017_ADDR, buf);
    }
}