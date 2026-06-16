//% color="#00BCD4" weight=100 icon="\uf140" block="2連VL53L0X"
namespace doubleVL53L0X {
    const ADDR_A = 0x30; // 変更後のセンサーAのアドレス
    const ADDR_B = 0x29; // センサーBのアドレス（初期値のまま）

    // zobclubのライブラリが内部で使っているI2Cヘルパー関数群
    function i2cwrite(addr: number, reg: number, value: number) {
        let buf = pins.createBuffer(2);
        buf[0] = reg;
        buf[1] = value;
        pins.i2cWriteBuffer(addr, buf);
    }

    function i2cread(addr: number, reg: number): number {
        pins.i2cWriteNumber(addr, reg, NumberFormat.UInt8BE, true);
        let val = pins.i2cReadNumber(addr, NumberFormat.UInt8BE, false);
        return val;
    }

    // zobclubの「init」処理を、指定したI2Cアドレスに対して実行する関数
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

        // キャリブレーションの実行
        i2cwrite(addr, 0x01, 0x00);
        i2cwrite(addr, 0x01, 0x01);

        i2cwrite(addr, 0x01, 0x00);
        
        // 連続測定モードの開始 (Continuous mode)
        i2cwrite(addr, 0x00, 0x02); 
        basic.pause(50);
    }

    // zobclubの「readSingleDistance」の計算処理
    function readDistance(addr: number): number {
        pins.i2cWriteNumber(addr, 0x14, NumberFormat.UInt8BE, true);
        let buf = pins.i2cReadBuffer(addr, 12);
        
        let acnt = (buf[6] << 8) | buf[7];
        let scnt = (buf[8] << 8) | buf[9];
        let dist = (buf[10] << 8) | buf[11];
        
        if (dist > 8000 || dist <= 20) {
            return 0; // 測定範囲外またはエラー
        }
        return dist;
    }

    /**
     * zobclubの方式を使い、2つのセンサーのXSHUTを制御して順番に初期化・アドレス変更をします。
     */
    //% block="2連センサーを初期化する XSHUT_A %pinA XSHUT_B %pinB"
    export function initSensors(pinA: DigitalPin, pinB: DigitalPin): void {
        // 1. 両方のセンサーを一旦シャットダウンしてリセット
        pins.digitalWritePin(pinA, 0);
        pins.digitalWritePin(pinB, 0);
        basic.pause(50);

        // 2. センサーAだけを起動
        pins.digitalWritePin(pinA, 1);
        basic.pause(50);

        // 3. センサーA（まだ0x29にいる）のアドレスを「0x30」に変更
        i2cwrite(0x29, 0x22, ADDR_A);
        basic.pause(20);

        // 4. 新アドレス(0x30)になったセンサーAをzobclub方式で初期化
        initVL53L0X(ADDR_A);

        // 5. センサーBを起動（こちらは初期アドレス0x29のまま起きてくる）
        pins.digitalWritePin(pinB, 1);
        basic.pause(50);

        // 6. センサーB（0x29）をzobclub方式で初期化
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

//% color="#4185E6" weight=90 icon="\uf00a" block="MCP23017拡張"
namespace mcp23017 {
    const MCP23017_ADDR = 0x20;
    const IODIRA = 0x00; const IODIRB = 0x01;
    const GPIOA = 0x12;  const GPIOB = 0x13;

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